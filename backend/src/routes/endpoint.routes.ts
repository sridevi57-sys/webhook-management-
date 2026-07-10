import { Router } from 'express';
import { 
  createEndpoint, 
  getEndpoints, 
  getEndpointById, 
  updateEndpoint, 
  deleteEndpoint,
  getEndpointLogs,
  verifyEndpoint
} from '../controllers/endpoint.controller.js';
import { 
  addSubscription, 
  deleteSubscription 
} from '../controllers/subscription.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Protect all endpoint & subscription routes with dashboard authentication
router.use(requireAuth);

// Webhook destination CRUD
router.post('/', createEndpoint);
router.get('/', getEndpoints);
router.get('/:id', getEndpointById);
router.patch('/:id', updateEndpoint);
router.delete('/:id', deleteEndpoint);

// Logs & Challenge Verification
router.get('/:id/logs', getEndpointLogs);
router.post('/:id/verify', verifyEndpoint);

// Event subscription management
router.post('/:endpointId/subscriptions', addSubscription);
router.delete('/:endpointId/subscriptions/:subId', deleteSubscription);

export default router;
