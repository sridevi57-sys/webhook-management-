import { Router } from 'express';
import { 
  createEndpoint, 
  getEndpoints, 
  getEndpointById, 
  updateEndpoint, 
  deleteEndpoint 
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

// Event subscription management
router.post('/:endpointId/subscriptions', addSubscription);
router.delete('/:endpointId/subscriptions/:subId', deleteSubscription);

export default router;
