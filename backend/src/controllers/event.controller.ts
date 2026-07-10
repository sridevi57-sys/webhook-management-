import { Request, Response } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import { deliveryQueue } from '../queue/client.js';

const publishEventSchema = z.object({
  eventType: z.string()
    .min(3, 'Event type must be at least 3 characters long')
    .regex(/^[a-z0-9_.-]+\.v[0-9]+$/, 'Event type must contain alphanumeric characters, underscores, hyphens, periods, and end with a version (e.g., payment.success.v1)'),
  payload: z.record(z.any(), { message: 'Payload must be a valid JSON object' }),
  idempotencyKey: z.string().max(255).optional()
});

/**
 * Resolves priority for events (lower is higher priority in BullMQ).
 * High Priority (1): Payments, Checkout, Orders
 * Normal Priority (10): Analytics, Email, Logs, etc.
 */
function resolveEventPriority(eventType: string): number {
  const highPriorityKeywords = ['payment', 'checkout', 'order', 'invoice'];
  const name = eventType.toLowerCase();
  
  if (highPriorityKeywords.some(keyword => name.includes(keyword))) {
    return 1; // High Priority
  }
  return 10; // Normal Priority
}

export async function publishEvent(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { eventType, payload, idempotencyKey } = publishEventSchema.parse(req.body);

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingEvent = await prisma.event.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: user.id,
            idempotencyKey
          }
        },
        include: {
          deliveryLogs: {
            select: {
              id: true,
              endpointId: true,
              status: true,
              statusCode: true,
              createdAt: true
            }
          }
        }
      });

      if (existingEvent) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({
          message: 'Event was already ingested (Idempotency Hit)',
          event: {
            id: existingEvent.id,
            eventType: existingEvent.eventType,
            createdAt: existingEvent.createdAt
          },
          deliveries: existingEvent.deliveryLogs
        });
      }
    }

    // 2. Find target endpoints subscribed to this event type
    // Must be active and verified
    const matchedEndpoints = await prisma.endpoint.findMany({
      where: {
        userId: user.id,
        isActive: true,
        isVerified: true,
        subscriptions: {
          some: {
            eventType
          }
        }
      }
    });

    // 3. Create Event in Database
    const event = await prisma.event.create({
      data: {
        eventType,
        payload,
        idempotencyKey: idempotencyKey || null,
        userId: user.id
      }
    });

    if (matchedEndpoints.length === 0) {
      return res.status(202).json({
        message: 'Event ingested successfully but no active/verified subscriptions matched.',
        event: {
          id: event.id,
          eventType: event.eventType,
          createdAt: event.createdAt
        }
      });
    }

    const deliveriesInfo = [];

    // 4. Create initial DeliveryLog and push delivery jobs to Queue
    for (const endpoint of matchedEndpoints) {
      // Create Log
      const log = await prisma.deliveryLog.create({
        data: {
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'QUEUED',
          attempt: 1
        }
      });

      // Resolve priority (SDE Queue Priority feature)
      const priority = resolveEventPriority(eventType);

      // Add to BullMQ
      const job = await deliveryQueue.add(
        'deliver-webhook',
        {
          eventId: event.id,
          endpointId: endpoint.id,
          deliveryLogId: log.id,
          attempt: 1
        },
        {
          priority,
          attempts: 1 // We handle manual retries with exponential backoffs programmatically on Day 4
        }
      );

      deliveriesInfo.push({
        endpointId: endpoint.id,
        url: endpoint.url,
        deliveryLogId: log.id,
        jobId: job.id,
        priority: priority === 1 ? 'HIGH' : 'NORMAL'
      });
    }

    return res.status(202).json({
      message: 'Event ingested and queued for delivery',
      event: {
        id: event.id,
        eventType: event.eventType,
        createdAt: event.createdAt
      },
      deliveries: deliveriesInfo
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error ingesting event: ' + (error as Error).message });
  }
}

export async function replayEvent(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params; // Event ID

    const event = await prisma.event.findFirst({
      where: { id, userId: user.id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Determine target endpoints (allow passing specific endpointId in body)
    const { endpointId } = req.body;
    let targetEndpoints = [];

    if (endpointId) {
      const endpoint = await prisma.endpoint.findFirst({
        where: { id: endpointId, userId: user.id, isActive: true, isVerified: true }
      });
      if (!endpoint) {
        return res.status(404).json({ error: 'Endpoint not found or unhealthy/unverified' });
      }
      targetEndpoints = [endpoint];
    } else {
      // Find all active/verified endpoints subscribed to this event type
      targetEndpoints = await prisma.endpoint.findMany({
        where: {
          userId: user.id,
          isActive: true,
          isVerified: true,
          subscriptions: {
            some: {
              eventType: event.eventType
            }
          }
        }
      });
    }

    if (targetEndpoints.length === 0) {
      return res.status(400).json({ error: 'No active/verified endpoints are subscribed to this event type' });
    }

    const deliveriesInfo = [];

    for (const endpoint of targetEndpoints) {
      // Create new log entry
      const log = await prisma.deliveryLog.create({
        data: {
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'QUEUED',
          attempt: 1
        }
      });

      // Add to BullMQ
      const job = await deliveryQueue.add(
        'deliver-webhook',
        {
          eventId: event.id,
          endpointId: endpoint.id,
          deliveryLogId: log.id,
          attempt: 1
        },
        {
          priority: resolveEventPriority(event.eventType),
          attempts: 1
        }
      );

      deliveriesInfo.push({
        endpointId: endpoint.id,
        deliveryLogId: log.id,
        jobId: job.id
      });
    }

    return res.json({
      message: `Event replayed successfully to ${targetEndpoints.length} endpoint(s)`,
      deliveries: deliveriesInfo
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error replaying event' });
  }
}
