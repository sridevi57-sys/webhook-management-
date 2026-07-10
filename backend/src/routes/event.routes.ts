import { Router } from 'express';
import { publishEvent, replayEvent } from '../controllers/event.controller.js';
import { requireApiKey, requireAuth } from '../middlewares/auth.js';

const router = Router();

// Ingestion requests are authenticated using server-to-server API Keys
router.post('/', requireApiKey, publishEvent);

// Replay requests from Dashboard are authenticated using JWT Access Tokens
router.post('/:id/replay', requireAuth, replayEvent);

export default router;
