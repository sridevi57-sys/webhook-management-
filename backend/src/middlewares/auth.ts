import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Authenticates dashboard users using JWT Access Tokens.
 * Checks the Authorization header (Bearer <token>) or credentials cookies.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token = '';

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } 
    // Fallback: check cookies
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Authentication token is missing' });
    }

    const secret = process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-change-me-in-production';
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User account no longer exists' });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Unauthorized: Access token has expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication token' });
  }
}

/**
 * Authenticates server-to-server webhook ingestion requests using X-API-Key header.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKeyHeader = req.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      return res.status(401).json({ error: 'Unauthorized: API Key is missing (X-API-Key header required)' });
    }

    // Check key in the database
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: apiKeyHeader },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (!apiKey || !apiKey.isActive) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or revoked API Key' });
    }

    // Verify expiration if applicable
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized: API Key has expired' });
    }

    // Update last used timestamp in background
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    }).catch(err => console.error('Failed to update API Key lastUsedAt:', err));

    // Attach associated user (tenant) and key context to request
    req.user = { id: apiKey.userId, email: apiKey.user.email };
    req.apiKey = { id: apiKey.id, key: apiKey.key, userId: apiKey.userId };
    
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error authenticating API Key' });
  }
}
