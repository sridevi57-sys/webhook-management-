import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { z } from 'zod';
import axios from 'axios';
import { validateWebhookUrl } from '../utils/ssrf.js';
import { writeAuditLog } from '../utils/audit.js';

const createEndpointSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  url: z.string().url('Invalid URL format'),
  rateLimitPerSecond: z.number().int().min(1).max(500).optional()
});

const updateEndpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  url: z.string().url('Invalid URL format').optional(),
  isActive: z.boolean().optional(),
  rateLimitPerSecond: z.number().int().min(1).max(500).optional()
});

const queryParamsSchema = z.object({
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

export async function createEndpoint(req: Request, res: Response) {
  try {
    const user = req.user!;
    const body = createEndpointSchema.parse(req.body);

    // Validate URL against SSRF threats
    const ssrfCheck = await validateWebhookUrl(body.url);
    if (!ssrfCheck.isValid) {
      return res.status(400).json({ error: `URL security validation failed: ${ssrfCheck.reason}` });
    }

    // Generate secure signing secret
    const signingSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    
    // Generate verification token for verification flow (Day 6)
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const endpoint = await prisma.endpoint.create({
      data: {
        name: body.name,
        description: body.description,
        url: body.url,
        secret: signingSecret,
        verificationToken,
        isVerified: false, // Must verify ownership
        rateLimitPerSecond: body.rateLimitPerSecond || 10,
        userId: user.id
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: 'ENDPOINT_CREATED',
      resourceId: endpoint.id,
      resourceType: 'ENDPOINT',
      ipAddress: req.ip,
      details: { name: body.name, url: body.url }
    });

    return res.status(201).json({
      message: 'Webhook endpoint registered successfully. Complete ownership challenge next.',
      endpoint: {
        id: endpoint.id,
        name: endpoint.name,
        description: endpoint.description,
        url: endpoint.url,
        secret: endpoint.secret,
        isVerified: endpoint.isVerified,
        isActive: endpoint.isActive,
        rateLimitPerSecond: endpoint.rateLimitPerSecond,
        createdAt: endpoint.createdAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error creating webhook endpoint: ' + (error as Error).message });
  }
}

export async function getEndpoints(req: Request, res: Response) {
  try {
    const user = req.user!;
    const query = queryParamsSchema.parse(req.query);

    const skip = (query.page - 1) * query.limit;

    // Build conditions
    const where: any = { userId: user.id };

    if (query.status === 'active') {
      where.isActive = true;
    } else if (query.status === 'inactive') {
      where.isActive = false;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { url: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const [endpoints, total] = await prisma.$transaction([
      prisma.endpoint.findMany({
        where,
        skip,
        take: query.limit,
        include: {
          subscriptions: {
            select: {
              id: true,
              eventType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.endpoint.count({ where })
    ]);

    return res.json({
      endpoints,
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
    return res.status(500).json({ error: 'Internal server error fetching webhook endpoints' });
  }
}

export async function getEndpointById(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const endpoint = await prisma.endpoint.findFirst({
      where: { id, userId: user.id },
      include: {
        subscriptions: true
      }
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Webhook endpoint not found' });
    }

    return res.json(endpoint);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error retrieving endpoint' });
  }
}

export async function updateEndpoint(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;
    const body = updateEndpointSchema.parse(req.body);

    const endpoint = await prisma.endpoint.findFirst({
      where: { id, userId: user.id }
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Webhook endpoint not found' });
    }

    // SSRF validation if URL is updating
    if (body.url && body.url !== endpoint.url) {
      const ssrfCheck = await validateWebhookUrl(body.url);
      if (!ssrfCheck.isValid) {
        return res.status(400).json({ error: `URL security validation failed: ${ssrfCheck.reason}` });
      }
    }

    const updated = await prisma.endpoint.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        url: body.url,
        isActive: body.isActive,
        rateLimitPerSecond: body.rateLimitPerSecond
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: 'ENDPOINT_UPDATED',
      resourceId: id,
      resourceType: 'ENDPOINT',
      ipAddress: req.ip,
      details: body
    });

    return res.json({
      message: 'Webhook endpoint updated successfully',
      endpoint: updated
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error updating endpoint' });
  }
}

export async function deleteEndpoint(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const endpoint = await prisma.endpoint.findFirst({
      where: { id, userId: user.id }
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Webhook endpoint not found' });
    }

    await prisma.endpoint.delete({
      where: { id }
    });

    await writeAuditLog({
      userId: user.id,
      action: 'ENDPOINT_DELETED',
      resourceId: id,
      resourceType: 'ENDPOINT',
      ipAddress: req.ip,
      details: { name: endpoint.name, url: endpoint.url }
    });

    return res.json({ message: 'Webhook endpoint deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error deleting endpoint' });
  }
}

export async function getEndpointLogs(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const query = z.object({
      page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
      limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)),
      status: z.string().optional()
    }).parse(req.query);

    const skip = (query.page - 1) * query.limit;

    // Verify endpoint belongs to user
    const endpoint = await prisma.endpoint.findFirst({
      where: { id, userId: user.id }
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Webhook endpoint not found' });
    }

    const where: any = { endpointId: id };
    if (query.status) {
      where.status = query.status;
    }

    const [logs, total] = await prisma.$transaction([
      prisma.deliveryLog.findMany({
        where,
        skip,
        take: query.limit,
        include: {
          event: {
            select: {
              eventType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.deliveryLog.count({ where })
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
    return res.status(500).json({ error: 'Internal server error fetching logs' });
  }
}

export async function verifyEndpoint(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const endpoint = await prisma.endpoint.findFirst({
      where: { id, userId: user.id }
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Webhook endpoint not found' });
    }

    if (endpoint.isVerified) {
      return res.status(400).json({ error: 'Endpoint is already verified' });
    }

    const challengeToken = endpoint.verificationToken;
    if (!challengeToken) {
      return res.status(400).json({ error: 'Verification token not initialized' });
    }

    try {
      // Execute challenge GET request to client URL
      const response = await axios.get(endpoint.url, {
        params: { challenge: challengeToken },
        timeout: 5000 // 5 second timeout
      });

      // Check if client returned challenge token in response body
      const dataStr = typeof response.data === 'string' 
        ? response.data.trim() 
        : typeof response.data === 'object' && response.data !== null
        ? JSON.stringify(response.data)
        : '';

      const isMatch = dataStr.includes(challengeToken);

      if (!isMatch) {
        return res.status(400).json({ 
          error: `Challenge verification failed: client response did not match the expected challenge token.` 
        });
      }

      // Success: mark as verified
      await prisma.endpoint.update({
        where: { id },
        data: { isVerified: true }
      });

      await writeAuditLog({
        userId: user.id,
        action: 'ENDPOINT_VERIFIED',
        resourceId: id,
        resourceType: 'ENDPOINT',
        ipAddress: req.ip,
        details: { url: endpoint.url }
      });

      return res.json({ message: 'Webhook endpoint verified successfully' });
    } catch (err: any) {
      return res.status(400).json({ 
        error: `Challenge GET request to ${endpoint.url} failed: ${err.message}` 
      });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error verifying endpoint' });
  }
}
