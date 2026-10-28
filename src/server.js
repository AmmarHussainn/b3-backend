import http from 'node:http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDB, disconnectDB } from './db/connection.js';
import app from './app.js';

await connectDB();
// TODO(BE-M4): start BullMQ workers and the reconcile scheduler here.

const server = http.createServer(app);
server.listen(env.PORT, () => logger.info(`API listening on :${env.PORT} (${env.NODE_ENV})`));

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
