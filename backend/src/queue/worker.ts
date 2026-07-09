import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { parse } from 'url';
import { prisma } from '../db.js';
import { calculateHmacSignature } from '../utils/crypto.js';
import { connection, deliveryQueue } from './client.js';
import { writeAuditLog } from '../utils/audit.js';

interface WebhookJobData {
  eventId: string;
  endpointId: string;
  deliveryLogId: string;
  attempt: number;
}

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_SEC = 15;
const MAX_RETRY_DELAY_SEC = 3600; // 1 hour
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const CIRCUIT_FAILURE_THRESHOLD = 5;

function getHost(urlStr: string): string {
  try {
    return parse(urlStr).host || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Calculates exponential backoff with 20% jitter.
 */
function calculateBackoffDelayMs(attempt: number): number {
  const factor = Math.pow(2, attempt - 1);
  const rawDelay = Math.min(MAX_RETRY_DELAY_SEC, BASE_RETRY_DELAY_SEC * factor);
  const jitter = Math.random() * (rawDelay * 0.2); // 20% jitter
  return Math.round((rawDelay + jitter) * 1000);
}

export const webhookWorker = new Worker(
  'webhook-delivery-queue',
  async (job: Job<WebhookJobData>) => {
    const { eventId, endpointId, deliveryLogId, attempt } = job.data;
    
    // 1. Fetch Context
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    const endpoint = await prisma.endpoint.findUnique({ where: { id: endpointId } });
    const log = await prisma.deliveryLog.findUnique({ where: { id: deliveryLogId } });

    if (!event || !endpoint || !log) {
      console.warn(`[Worker] Skipping job ${job.id}: dependencies not found.`);
      return;
    }

    // 2. Check Endpoint Activation Status
    if (!endpoint.isActive) {
      await prisma.deliveryLog.update({
        where: { id: deliveryLogId },
        data: { status: 'CANCELLED', errorDetails: 'Endpoint deactivated' }
      });
      return;
    }

    // 3. Concurrency Rate Limiter
    const host = getHost(endpoint.url);
    const currentSecond = Math.floor(Date.now() / 1000);
    const rateLimitKey = `rate_limit:${host}:${currentSecond}`;
    
    const requestCount = await connection.incr(rateLimitKey);
    if (requestCount === 1) {
      await connection.expire(rateLimitKey, 2);
    }

    if (requestCount > endpoint.rateLimitPerSecond) {
      console.log(`[RateLimit] Host ${host} exceeded limit of ${endpoint.rateLimitPerSecond}/s. Delaying job.`);
      
      // Update delivery log back to QUEUED
      await prisma.deliveryLog.update({
        where: { id: deliveryLogId },
        data: { status: 'QUEUED' }
      });

      // Re-queue the delivery job with a 1-second delay
      await deliveryQueue.add(
        'deliver-webhook',
        job.data,
        { delay: 1000, priority: job.opts.priority }
      );
      return;
    }

    // 4. Circuit Breaker Evaluation
    let currentCircuitState = endpoint.circuitState;
    
    if (currentCircuitState === 'OPEN') {
      const openedAt = endpoint.circuitOpenedAt ? new Date(endpoint.circuitOpenedAt).getTime() : 0;
      const timeSinceOpened = Date.now() - openedAt;

      if (timeSinceOpened < CIRCUIT_COOLDOWN_MS) {
        // Circuit is active and in cooldown. Immediately cancel request.
        await prisma.deliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: 'CANCELLED',
            errorDetails: 'Circuit breaker is OPEN (endpoint is unhealthy)'
          }
        });
        console.log(`[CircuitBreaker] Cancelled delivery to ${endpoint.url}. Circuit is OPEN.`);
        return;
      } else {
        // Cooldown expired, transition to HALF_OPEN to attempt a single trial webhook
        currentCircuitState = 'HALF_OPEN';
        await prisma.endpoint.update({
          where: { id: endpointId },
          data: { circuitState: 'HALF_OPEN' }
        });
        
        await writeAuditLog({
          userId: endpoint.userId,
          action: 'CIRCUIT_HALF_OPEN',
          resourceId: endpointId,
          resourceType: 'ENDPOINT',
          details: { url: endpoint.url, reason: 'Cooldown expired, trial request scheduled' }
        });
        console.log(`[CircuitBreaker] Endpoint ${endpoint.url} transitioned to HALF_OPEN.`);
      }
    }

    // Update log status to PROCESSING
    await prisma.deliveryLog.update({
      where: { id: deliveryLogId },
      data: { status: 'PROCESSING' }
    });

    const payloadString = JSON.stringify(event.payload);
    const signature = calculateHmacSignature(payloadString, endpoint.secret);

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
    let isSuccess = false;

    try {
      // Execute delivery request
      const response = await axios.post(endpoint.url, payloadString, {
        headers,
        timeout: 10000, // 10 second timeout
        validateStatus: () => true
      });

      const latencyMs = Date.now() - startTime;
      statusCode = response.status;
      responseHeaders = response.headers;
      
      responseBody = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
        
      if (responseBody && responseBody.length > 5000) {
        responseBody = responseBody.substring(0, 5000) + '... (truncated)';
      }

      if (statusCode >= 200 && statusCode < 300) {
        isSuccess = true;
        // 5. Success Flow
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

        // Reset Circuit Breaker if healthy
        if (endpoint.circuitState !== 'CLOSED') {
          await prisma.endpoint.update({
            where: { id: endpointId },
            data: {
              circuitState: 'CLOSED',
              circuitFailureCount: 0,
              circuitOpenedAt: null
            }
          });

          await writeAuditLog({
            userId: endpoint.userId,
            action: 'CIRCUIT_CLOSED',
            resourceId: endpointId,
            resourceType: 'ENDPOINT',
            details: { url: endpoint.url, reason: 'Successful trial request completed' }
          });
          console.log(`[CircuitBreaker] Endpoint ${endpoint.url} recovered. Circuit is CLOSED.`);
        }
        
        console.log(`[Worker] Delivered event ${eventId} to ${endpoint.url} in ${latencyMs}ms`);
      } else {
        errorDetails = `Receiver returned HTTP status code ${statusCode}`;
        throw new Error(errorDetails);
      }
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      errorDetails = errorDetails || error.message || 'Connection timeout';
      
      console.warn(`[Worker] Webhook delivery failed for ${endpoint.url}. Error: ${errorDetails}`);

      // Log failure detail
      await prisma.deliveryLog.update({
        where: { id: deliveryLogId },
        data: {
          status: 'FAILED',
          requestHeaders: headers,
          requestPayload: event.payload as any,
          responseHeaders: responseHeaders,
          responseBody: responseBody || undefined,
          statusCode: statusCode || undefined,
          latencyMs,
          errorDetails
        }
      });

      // 6. Failure Flow & Circuit Breaker State Transition
      const nextFailureCount = endpoint.circuitFailureCount + 1;
      
      // If we are in HALF_OPEN and fail, or reach failure threshold in CLOSED
      if (currentCircuitState === 'HALF_OPEN' || nextFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
        await prisma.endpoint.update({
          where: { id: endpointId },
          data: {
            circuitState: 'OPEN',
            circuitFailureCount: nextFailureCount,
            circuitOpenedAt: new Date()
          }
        });

        await writeAuditLog({
          userId: endpoint.userId,
          action: 'CIRCUIT_OPENED',
          resourceId: endpointId,
          resourceType: 'ENDPOINT',
          details: {
            url: endpoint.url,
            consecutiveFailures: nextFailureCount,
            reason: currentCircuitState === 'HALF_OPEN' ? 'Trial request failed in HALF_OPEN' : 'Consecutive failure threshold reached'
          }
        });
        console.error(`[CircuitBreaker] Endpoint ${endpoint.url} is now OPEN. Failures: ${nextFailureCount}`);
      } else {
        // Just increment failure count
        await prisma.endpoint.update({
          where: { id: endpointId },
          data: { circuitFailureCount: nextFailureCount }
        });
      }

      // 7. Retries & Dead Letter Queue
      if (attempt >= MAX_RETRIES) {
        // Exceeded maximum attempts, route to Dead Letter status
        await prisma.deliveryLog.update({
          where: { id: deliveryLogId },
          data: { status: 'DEAD_LETTER' }
        });
        console.error(`[DLQ] Webhook ${deliveryLogId} to ${endpoint.url} exceeded max retries. Moved to DEAD_LETTER.`);
      } else {
        // Calculate retry delay with backoff + jitter
        const nextDelayMs = calculateBackoffDelayMs(attempt + 1);
        console.log(`[Retry] Scheduling attempt ${attempt + 1} in ${nextDelayMs}ms for log ${deliveryLogId}`);

        // Create new queued delivery log row for next attempt
        const nextLog = await prisma.deliveryLog.create({
          data: {
            eventId,
            endpointId,
            status: 'QUEUED',
            attempt: attempt + 1
          }
        });

        // Add next attempt job with delay
        await deliveryQueue.add(
          'deliver-webhook',
          {
            eventId,
            endpointId,
            deliveryLogId: nextLog.id,
            attempt: attempt + 1
          },
          {
            delay: nextDelayMs,
            priority: job.opts.priority
          }
        );
      }
    }
  },
  {
    connection,
    concurrency: 20
  }
);
