import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { corsOptions } from './config/cors.js';
import { logger } from './utils/logger.js';
import { requestId } from './middleware/requestId.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { dbHealth } from './db/connection.js';
import v1 from './api/v1/index.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(requestId);
app.use(pinoHttp({ logger, genReqId: (req) => req.id, autoLogging: { ignore: (req) => req.url === '/health' } }));
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf; } })); // rawBody for webhook signatures
app.use(globalLimiter);

app.get('/health', (_req, res) => {
  const db = dbHealth();
  res.status(db.ok ? 200 : 503).json({ ok: db.ok, db });
});

app.use('/v1', v1);

app.use(notFound);
app.use(errorHandler);

export default app;
