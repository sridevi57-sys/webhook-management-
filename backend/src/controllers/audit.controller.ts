import { Request, Response } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';

const queryParamsSchema = z.object({
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 15))
});

export async function getAuditLogs(req: Request, res: Response) {
  try {
    const user = req.user!;
    const query = queryParamsSchema.parse(req.query);

    const skip = (query.page - 1) * query.limit;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where: { userId: user.id },
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count({
        where: { userId: user.id }
      })
    ]);

    return res.json({
      logs,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error retrieving audit logs' });
  }
}
