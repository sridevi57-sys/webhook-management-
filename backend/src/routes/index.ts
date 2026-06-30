import { Router } from 'express';
import authRoutes from './auth.routes.js';
import endpointRoutes from './endpoint.routes.js';
import keyRoutes from './key.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/endpoints', endpointRoutes);
router.use('/keys', keyRoutes);

export default router;
