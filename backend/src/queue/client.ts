import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Setup connection client
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null // Required by BullMQ
});

connection.on('connect', () => {
  console.log('Successfully connected to Redis instance');
});

connection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Configure Queue
// BullMQ jobs are stored in Redis under this namespace
export const deliveryQueue = new Queue('webhook-delivery-queue', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 }, // Keep last 100 succeeded jobs
    removeOnFail: { count: 500 }      // Keep last 500 failed jobs
  }
});
