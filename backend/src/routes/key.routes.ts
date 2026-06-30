import { Router } from 'express';
import { createKey, getKeys, deleteKey } from '../controllers/key.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Protect all API key routes with dashboard user authentication
router.use(requireAuth);

router.post('/', createKey);
router.get('/', getKeys);
router.delete('/:id', deleteKey);

export default router;
