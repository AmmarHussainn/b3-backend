import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = env.MONGODB_URI, dbName = env.MONGODB_DB) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  logger.info({ db: dbName }, 'MongoDB connected');
  return mongoose.connection;
}
export const disconnectDb = () => mongoose.disconnect();
export async function dbHealth() {
  try {
    if (mongoose.connection.readyState !== 1) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch { return false; }
}
