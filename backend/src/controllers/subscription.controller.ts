import { Request, Response } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import { writeAuditLog } from '../utils/audit.js';

const addSubscriptionSchema = z.object({
  eventType: z.string()
    .min(3, 'Event type must be at least 3 characters long')
    .regex(/^[a-z0-9_.-]+\.v[0-9]+$/, 'Event type must contain alphanumeric characters, underscores, hyphens, periods, and end with a version (e.g., payment.success.v1)')
});

export async function addSubscription(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { endpointId } = req.params;
    const body = addSubscriptionSchema.parse(req.body);

    // Verify endpoint belongs to user
    const endpoint = await prisma.endpoint.findFirst({
      where: { id: endpointId, userId: user.id }
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Webhook endpoint not found' });
    }

    // Check if subscription already exists
    const existing = await prisma.subscription.findUnique({
      where: {
        endpointId_eventType: {
          endpointId,
          eventType: body.eventType
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Endpoint is already subscribed to this event type' });
    }

    const subscription = await prisma.subscription.create({
      data: {
        endpointId,
        eventType: body.eventType
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: 'SUBSCRIPTION_CREATED',
      resourceId: subscription.id,
      resourceType: 'SUBSCRIPTION',
      ipAddress: req.ip,
      details: { eventType: body.eventType, endpointId }
    });

    return res.status(201).json({
      message: `Subscribed successfully to ${body.eventType}`,
      subscription
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error adding subscription' });
  }
}

export async function deleteSubscription(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { endpointId, subId } = req.params;

    // Verify endpoint belongs to user
    const endpoint = await prisma.endpoint.findFirst({
      where: { id: endpointId, userId: user.id }
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Webhook endpoint not found' });
    }

    // Verify subscription belongs to this endpoint
    const subscription = await prisma.subscription.findFirst({
      where: { id: subId, endpointId }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found for this endpoint' });
    }

    await prisma.subscription.delete({
      where: { id: subId }
    });

    await writeAuditLog({
      userId: user.id,
      action: 'SUBSCRIPTION_DELETED',
      resourceId: subId,
      resourceType: 'SUBSCRIPTION',
      ipAddress: req.ip,
      details: { eventType: subscription.eventType, endpointId }
    });

    return res.json({ message: 'Unsubscribed from event type successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error deleting subscription' });
  }
}
