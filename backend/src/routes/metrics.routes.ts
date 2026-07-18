import { Router } from 'express';
import { getSystemMetrics } from '../controllers/metrics.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Protect metrics retrieval route with dashboard authentication
router.get('/', requireAuth, getSystemMetrics);

export default router;
