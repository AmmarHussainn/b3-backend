import * as clients from '../../../../services/client.service.js';
import { ok, created, paginated } from '../../../../utils/response.js';

export const list = async (req, res) => paginated(res, await clients.list(req.valid.query));
export const get = async (req, res) => ok(res, await clients.get(req.valid.params.id));
export const comp = async (req, res) => { const r = await clients.grantComp(req.valid.body, req.actor); created(res, { id: String(r.user._id), email: r.user.email, created: r.created, welcome: r.welcome }); };
export const revoke = async (req, res) => ok(res, await clients.revokeClient(req.valid.params.id, { status: req.valid.body.status }, req.actor));
export const resendWelcome = async (req, res) => ok(res, await clients.resendWelcome(req.valid.params.id, req.actor));
export const retryWriteback = async (req, res) => ok(res, await clients.retryWriteback(req.valid.params.id));
export const reconcile = async (req, res) => ok(res, await clients.reconcileClient(req.valid.params.id, { dryRun: req.valid.body.dryRun ?? false }, req.actor));
