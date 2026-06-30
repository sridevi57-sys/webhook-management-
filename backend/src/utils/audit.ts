import { prisma } from '../db.js';

export async function writeAuditLog(params: {
  userId: string;
  action: string;
  resourceId?: string;
  resourceType?: string;
  ipAddress?: string;
  details?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resourceId: params.resourceId,
        resourceType: params.resourceType,
        ipAddress: params.ipAddress,
        details: params.details || undefined
      }
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
