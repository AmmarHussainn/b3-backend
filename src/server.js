import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db/connection.js';
import { logger } from './utils/logger.js';
import { startWorkers } from './jobs/workers/index.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';
import { closeQueues } from './jobs/queue.js';

await connectDb();
startWorkers(); // registers provision + writeback handlers (needed by the in-memory queue too)
startScheduler();
const server = createApp().listen(env.PORT, () => logger.info(`API listening on :${env.PORT} (${env.NODE_ENV})`));

async function shutdown(sig) {
  logger.info({ sig }, 'shutting down');
  stopScheduler();
  server.close(async () => { await closeQueues(); await disconnectDb(); process.exit(0); });
  setTimeout(() => process.exit(1), 15_000).unref();
}
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
