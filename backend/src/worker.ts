import dotenv from 'dotenv';
import { webhookWorker } from './queue/worker.js';

dotenv.config();

console.log('Webhook Background Worker Process is running...');
console.log('Worker listening on BullMQ queue: "webhook-delivery-queue"');

// Handle process termination cleanly
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Shutting down worker...');
  await webhookWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received. Shutting down worker...');
  await webhookWorker.close();
  process.exit(0);
});
