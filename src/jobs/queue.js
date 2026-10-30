// BullMQ when REDIS_URL is set; otherwise an in-process queue with the same retry semantics (local dev / tests).
import { Queue, Worker, UnrecoverableError } from 'bullmq';
import IORedis from 'ioredis';
import { env, isTest } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const ATTEMPTS = 5; // requirement: at least three
const BACKOFF_MS = 5000; // exponential: 5s, 10s, 20s, 40s

/** Throw from a handler when retrying cannot help (bad data). The job fails immediately. */
export class PermanentError extends Error {}

const handlers = new Map(); // name -> { handler, onFinalFailure }
const queues = new Map();
const workers = [];
let connection;
const useRedis = Boolean(env.REDIS_URL);
const getConn = () => (connection ||= new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }));
const getQueue = (name) => {
  if (!queues.has(name)) queues.set(name, new Queue(name, { connection: getConn() }));
  return queues.get(name);
};

export function registerWorker(name, handler, { onFinalFailure, concurrency = 5 } = {}) {
  handlers.set(name, { handler, onFinalFailure });
  if (!useRedis) return;
  const w = new Worker(name, async (job) => {
    try { return await handler(job.data, job); } catch (e) { throw e instanceof PermanentError ? new UnrecoverableError(e.message) : e; }
  }, { connection: getConn(), concurrency });
  w.on('failed', (job, err) => {
    const final = err?.name === 'UnrecoverableError' || (job && job.attemptsMade >= (job.opts.attempts || ATTEMPTS));
    logger.warn({ queue: name, attempt: job?.attemptsMade, final, err: err?.message }, 'job failed');
    if (final && onFinalFailure) Promise.resolve(onFinalFailure(job.data, err)).catch((e) => logger.error({ err: e }, 'onFinalFailure threw'));
  });
  workers.push(w);
}

async function runInline(name, data) {
  const h = handlers.get(name);
  if (!h) { logger.error({ name }, 'no handler registered for job'); return; }
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try { return await h.handler(data, { attemptsMade: attempt - 1 }); } catch (e) {
      const final = e instanceof PermanentError || attempt === ATTEMPTS;
      logger.warn({ queue: name, attempt, final, err: e.message }, 'job failed (in-memory)');
      if (final) { if (h.onFinalFailure) await Promise.resolve(h.onFinalFailure(data, e)).catch(() => {}); return; }
      if (!isTest) await new Promise((r) => setTimeout(r, BACKOFF_MS * 2 ** (attempt - 1)));
    }
  }
}

export async function enqueue(name, data, opts = {}) {
  if (useRedis) {
    return getQueue(name).add(name, data, { attempts: ATTEMPTS, backoff: { type: 'exponential', delay: BACKOFF_MS }, removeOnComplete: 1000, removeOnFail: 5000, ...opts });
  }
  if (isTest) return runInline(name, data); // deterministic in tests
  setImmediate(() => runInline(name, data));
  return null;
}

export async function closeQueues() {
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([...queues.values()].map((q) => q.close()));
  if (connection) await connection.quit().catch(() => {});
}
