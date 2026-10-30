import { registerProvisionWorker } from './provision.worker.js';
import { registerWritebackWorker } from './writeback.worker.js';

let started = false;
export function startWorkers() {
  if (started) return;
  started = true;
  registerProvisionWorker();
  registerWritebackWorker();
}
