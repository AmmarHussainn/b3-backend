import { run } from '../services/reconcile.service.js';
import { logger } from '../utils/logger.js';

export async function reconcileJob({ full = false } = {}) {
  try {
    const r = await run({ full, dryRun: false });
    logger.info({ full, scanned: r.scanned, applied: r.applied, planned: r.planned?.length, aborted: r.aborted }, 'reconcile finished');
    return r;
  } catch (e) { logger.error({ err: e }, 'reconcile failed'); }
}
