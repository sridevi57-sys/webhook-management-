import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Protect audit log access with dashboard user credentials
router.get('/', requireAuth, getAuditLogs);

export default router;
