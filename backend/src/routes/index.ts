import { Router } from 'express';
import authRoutes from './auth.routes.js';
import endpointRoutes from './endpoint.routes.js';
import keyRoutes from './key.routes.js';
import eventRoutes from './event.routes.js';
import auditRoutes from './audit.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/endpoints', endpointRoutes);
router.use('/keys', keyRoutes);
router.use('/events', eventRoutes);
router.use('/audit', auditRoutes);

export default router;
