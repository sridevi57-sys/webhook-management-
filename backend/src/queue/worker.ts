import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { prisma } from '../db.js';
import { calculateHmacSignature } from '../utils/crypto.js';
import { connection } from './client.js';

interface WebhookJobData {
  eventId: string;
  endpointId: string;
  deliveryLogId: string;
  attempt: number;
}

export const webhookWorker = new Worker(
  'webhook-delivery-queue',
  async (job: Job<WebhookJobData>) => {
    const { eventId, endpointId, deliveryLogId, attempt } = job.data;
    
    console.log(`Processing job ${job.id}: delivering Event ${eventId} to Endpoint ${endpointId} (Attempt ${attempt})`);

    // 1. Fetch event and endpoint context
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    const endpoint = await prisma.endpoint.findUnique({ where: { id: endpointId } });
    const log = await prisma.deliveryLog.findUnique({ where: { id: deliveryLogId } });

    if (!event || !endpoint || !log) {
      console.warn(`Skipping delivery: event, endpoint, or log details not found. job: ${job.id}`);
      return;
    }

    // Skip if endpoint was deactivated after queueing
    if (!endpoint.isActive) {
      await prisma.deliveryLog.update({
        where: { id: deliveryLogId },
        data: { status: 'CANCELLED', errorDetails: 'Endpoint deactivated before delivery' }
      });
      return;
    }

    // Update log status to PROCESSING
    await prisma.deliveryLog.update({
      where: { id: deliveryLogId },
      data: { status: 'PROCESSING' }
    });

    const payloadString = JSON.stringify(event.payload);
    
    // Calculate HMAC SHA-256 signature
    const signature = calculateHmacSignature(payloadString, endpoint.secret);

    // Prepare HTTP request config
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event-Id': event.id,
      'X-Webhook-Delivery-Id': deliveryLogId,
      'X-Webhook-Signature': signature,
      'X-Webhook-Idempotency-Key': event.idempotencyKey || ''
    };

    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseHeaders: any = null;
    let responseBody: string | null = null;
    let errorDetails: string | null = null;

    try {
      // Execute the webhook post request
      const response = await axios.post(endpoint.url, payloadString, {
        headers,
        timeout: 10000, // 10-second timeout
        validateStatus: () => true // Allow handling non-2xx status codes directly
      });

      const latencyMs = Date.now() - startTime;
      statusCode = response.status;
      responseHeaders = response.headers;
      
      // Save truncated response body to prevent excessive storage usage
      responseBody = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
        
      if (responseBody && responseBody.length > 5000) {
        responseBody = responseBody.substring(0, 5000) + '... (truncated)';
      }

      if (statusCode >= 200 && statusCode < 300) {
        // Success
        await prisma.deliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: 'DELIVERED',
            requestHeaders: headers,
            requestPayload: event.payload as any,
            responseHeaders: responseHeaders,
            responseBody,
            statusCode,
            latencyMs
          }
        });
        
        console.log(`Webhook delivered successfully to ${endpoint.url}. Status: ${statusCode}, Latency: ${latencyMs}ms`);
      } else {
        // HTTP Error Response (e.g. 500, 404)
        errorDetails = `Receiver returned status code ${statusCode}`;
        await prisma.deliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: 'FAILED',
            requestHeaders: headers,
            requestPayload: event.payload as any,
            responseHeaders: responseHeaders,
            responseBody,
            statusCode,
            latencyMs,
            errorDetails
          }
        });

        console.warn(`Webhook delivery failed for ${endpoint.url}. Status: ${statusCode}`);
        throw new Error(errorDetails); // Throw to let Day 4 handle retry logic
      }
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      errorDetails = error.message || 'Network connection timeout';

      if (!statusCode) {
        // Network errors or timeout (where no response headers/status exists)
        await prisma.deliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: 'FAILED',
            requestHeaders: headers,
            requestPayload: event.payload as any,
            errorDetails,
            latencyMs
          }
        });
      }

      console.error(`Network error delivering webhook to ${endpoint.url}:`, errorDetails);
      throw new Error(errorDetails); // Throw to trigger retries in BullMQ (implemented on Day 4)
    }
  },
  {
    connection,
    concurrency: 20 // Max concurrent jobs running on this worker instance
  }
);

webhookWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err.message);
});
