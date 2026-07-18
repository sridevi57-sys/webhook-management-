import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { prisma } from './db.js';
import { connection } from './queue/client.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Register API v1 routes
app.use('/api/v1', apiRouter);

// Kubernetes Probes & Health Checks
// 1. Basic Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 2. Liveness probe (Check if container process is up)
app.get('/live', (req, res) => {
  res.status(200).json({ status: 'ALIVE' });
});

// 3. Readiness probe (Checks connections to database and cache)
app.get('/ready', async (req, res) => {
  let postgresStatus = 'UP';
  let redisStatus = 'UP';
  let isReady = true;

  // Verify PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    postgresStatus = 'DOWN';
    isReady = false;
  }

  // Verify Redis Connection
  try {
    const pingRes = await connection.ping();
    if (pingRes !== 'PONG') {
      redisStatus = 'DOWN';
      isReady = false;
    }
  } catch (err) {
    redisStatus = 'DOWN';
    isReady = false;
  }

  if (isReady) {
    return res.status(200).json({
      status: 'READY',
      checks: { postgres: postgresStatus, redis: redisStatus }
    });
  } else {
    return res.status(503).json({
      status: 'UNHEALTHY',
      checks: { postgres: postgresStatus, redis: redisStatus }
    });
  }
});

app.listen(port, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
});

export default app;
