import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { z } from 'zod';
import { writeAuditLog } from '../utils/audit.js';

const createKeySchema = z.object({
  name: z.string().min(1, 'API Key name is required').max(100)
});

export async function createKey(req: Request, res: Response) {
  try {
    const user = req.user!;
    const body = createKeySchema.parse(req.body);

    const randomBytes = crypto.randomBytes(24).toString('hex');
    const apiKeyVal = `whkey_${randomBytes}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        key: apiKeyVal,
        name: body.name,
        userId: user.id
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: 'API_KEY_CREATED',
      resourceId: apiKey.id,
      resourceType: 'API_KEY',
      ipAddress: req.ip,
      details: { name: body.name }
    });

    return res.status(201).json({
      message: 'API Key generated successfully. Save it now as it won\'t be visible again.',
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error generating API Key' });
  }
}

export async function getKeys(req: Request, res: Response) {
  try {
    const user = req.user!;

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(apiKeys);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error fetching API Keys' });
  }
}

export async function deleteKey(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId: user.id }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API Key not found' });
    }

    await prisma.apiKey.delete({
      where: { id }
    });

    await writeAuditLog({
      userId: user.id,
      action: 'API_KEY_DELETED',
      resourceId: id,
      resourceType: 'API_KEY',
      ipAddress: req.ip,
      details: { name: apiKey.name }
    });

    return res.json({ message: 'API Key revoked and deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error deleting API Key' });
  }
}
