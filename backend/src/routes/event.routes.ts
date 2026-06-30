import { Router } from 'express';
import { publishEvent } from '../controllers/event.controller.js';
import { requireApiKey } from '../middlewares/auth.js';

const router = Router();

// Protect event publishing with server-to-server API Key check
router.post('/', requireApiKey, publishEvent);

export default router;
