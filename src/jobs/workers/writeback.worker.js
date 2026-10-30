import { registerWorker } from '../queue.js';
import { writeback } from '../../integrations/hubspot/writeback.js';
import { logger } from '../../utils/logger.js';

export const registerWritebackWorker = () => registerWorker('writeback', (data) => writeback(data), {
  onFinalFailure: (data, err) => logger.error({ err: err.message, email: data.email, status: data.status }, 'HubSpot write-back gave up: use the reconcile job / admin retry'),
});
