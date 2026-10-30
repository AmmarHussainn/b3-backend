import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { corsOptions } from './config/cors.js';
import { logger } from './utils/logger.js';
import { isTest } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { dbHealth } from './db/connection.js';
import v1 from './api/v1/index.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // the BFF / load balancer sets X-Forwarded-For
  app.disable('x-powered-by');
  app.use(requestId);
  if (!isTest) app.use(pinoHttp({ logger, genReqId: (req) => req.id, autoLogging: { ignore: (req) => req.url === '/health' } }));
  app.use(helmet());
  app.use(cors(corsOptions));
  app.get('/health', async (req, res) => { const db = await dbHealth(); res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) }); });
  app.use(globalLimiter);
  // rawBody is kept for HubSpot v3 signature verification
  app.use(express.json({ limit: '2mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
  app.use('/v1', v1);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
