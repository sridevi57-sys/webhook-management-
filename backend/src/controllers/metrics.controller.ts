import { Request, Response } from 'express';
import { prisma } from '../db.js';
import { deliveryQueue } from '../queue/client.js';

export async function getSystemMetrics(req: Request, res: Response) {
  try {
    const user = req.user!;

    // 1. Fetch Queue statistics from BullMQ
    let queueCounts = { active: 0, waiting: 0, delayed: 0, failed: 0 };
    try {
      const counts = await deliveryQueue.getJobCounts();
      queueCounts = {
        active: counts.active || 0,
        waiting: counts.wait || 0,
        delayed: counts.delayed || 0,
        failed: counts.failed || 0
      };
    } catch (err) {
      console.error('Failed to retrieve queue counts from BullMQ:', err);
    }

    // 2. Aggregate logs data for this user
    const logAggregates = await prisma.deliveryLog.aggregate({
      where: {
        endpoint: {
          userId: user.id
        }
      },
      _count: {
        id: true
      },
      _avg: {
        latencyMs: true
      }
    });

    const totalLogs = logAggregates._count.id;
    const avgLatencyMs = Math.round(logAggregates._avg.latencyMs || 0);

    // 3. Count logs by status
    const statusCountsRaw = await prisma.deliveryLog.groupBy({
      by: ['status'],
      where: {
        endpoint: {
          userId: user.id
        }
      },
      _count: {
        id: true
      }
    });

    const statusCounts: Record<string, number> = {
      DELIVERED: 0,
      FAILED: 0,
      RETRYING: 0,
      DEAD_LETTER: 0,
      CANCELLED: 0
    };

    statusCountsRaw.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    const successRate = totalLogs > 0 
      ? Math.round((statusCounts.DELIVERED / totalLogs) * 100) 
      : 100;

    // 4. Most active event types
    const eventFrequency = await prisma.event.groupBy({
      by: ['eventType'],
      where: { userId: user.id },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });

    // 5. Top failing endpoints
    const topFailingEndpoints = await prisma.deliveryLog.groupBy({
      by: ['endpointId'],
      where: {
        status: 'FAILED',
        endpoint: {
          userId: user.id
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });

    // Map endpoint IDs to names
    const failingEndpointsWithDetails = [];
    for (const item of topFailingEndpoints) {
      const ep = await prisma.endpoint.findUnique({
        where: { id: item.endpointId },
        select: { name: true, url: true }
      });
      if (ep) {
        failingEndpointsWithDetails.push({
          id: item.endpointId,
          name: ep.name,
          url: ep.url,
          failureCount: item._count.id
        });
      }
    }

    return res.json({
      metrics: {
        totalIngestedEvents: await prisma.event.count({ where: { userId: user.id } }),
        totalDeliveryAttempts: totalLogs,
        successRatePercentage: successRate,
        averageLatencyMs: avgLatencyMs,
        queue: queueCounts,
        statuses: statusCounts,
        eventFrequency: eventFrequency.map(e => ({ eventType: e.eventType, count: e._count.id })),
        topFailingEndpoints: failingEndpointsWithDetails
      }
    });
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    return res.status(500).json({ error: 'Internal server error fetching system metrics' });
  }
}
