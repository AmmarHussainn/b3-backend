import cron from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { reconcileJob } from './reconcile.job.js';
import { cleanupJob } from './cleanup.job.js';

const tasks = [];
export function startScheduler() {
  if (!env.RUN_JOBS) return;
  if (env.RECONCILE_ENABLED) {
    tasks.push(cron.schedule('*/15 * * * *', () => reconcileJob({ full: false })));  // recent changes + stale-Pending check
    tasks.push(cron.schedule('30 2 * * *', () => reconcileJob({ full: true })));     // nightly full scan (both directions)
  } else logger.warn('RECONCILE_ENABLED=false: HubSpot drift checks are NOT running');
  tasks.push(cron.schedule('0 3 * * 0', () => cleanupJob()));
}
export const stopScheduler = () => tasks.forEach((t) => t.stop());
