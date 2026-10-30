import { HubspotEvent } from '../db/models/index.js';
import { logger } from '../utils/logger.js';

// Expired auth tokens are purged by a Mongo TTL index. This trims old, successfully processed HubSpot events.
export async function cleanupJob() {
  const cutoff = new Date(Date.now() - 90 * 864e5);
  const r = await HubspotEvent.deleteMany({ status: 'done', updatedAt: { $lt: cutoff } });
  logger.info({ deleted: r.deletedCount }, 'cleanup finished');
}
