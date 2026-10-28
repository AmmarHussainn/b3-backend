import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

let connecting = null;

/** Global MongoDB connection. Safe to call many times: connects once, reuses the pool. */
export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connecting) {
    connecting = mongoose
      .connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB,
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 10_000,
        autoIndex: env.NODE_ENV !== 'production', // build indexes via a migration in production
      })
      .then((m) => {
        logger.info({ db: env.MONGODB_DB }, 'MongoDB connected');
        return m.connection;
      })
      .catch((err) => {
        connecting = null;
        logger.error({ err }, 'MongoDB connection failed');
        throw err;
      });
  }
  return connecting;
}

export async function disconnectDB() {
  connecting = null;
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

export function dbHealth() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return { state: states[mongoose.connection.readyState] ?? 'unknown', ok: mongoose.connection.readyState === 1 };
}

mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
