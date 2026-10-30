import * as sync from '../../../../services/sync.service.js';
import * as prov from '../../../../services/provisioning.service.js';
import * as reconcile from '../../../../services/reconcile.service.js';
import * as bulk from '../../../../services/bulk.service.js';
import { parseCsv } from '../../../../utils/csv.js';
import { ApiError } from '../../../../utils/ApiError.js';
import { ok, paginated } from '../../../../utils/response.js';

const rowsOf = (b) => b.rows || parseCsv(b.csv);
export const status = async (req, res) => ok(res, await sync.status());
export const events = async (req, res) => paginated(res, await sync.listEvents(req.valid.query));
export const event = async (req, res) => ok(res, await sync.getEvent(req.valid.params.id));
export const retry = async (req, res) => ok(res, await prov.retryEvent(req.valid.params.id, req.actor));
export const errors = async (req, res) => ok(res, await sync.unresolvedErrors());
export const run = async (req, res) => ok(res, await reconcile.run({ full: req.valid.body.full ?? true, dryRun: req.valid.body.dryRun, force: req.valid.body.force ?? false }));
export const preview = async (req, res) => ok(res, await bulk.preview(rowsOf(req.valid.body)));
export const hubspotRows = async (req, res) => { const rows = await bulk.rowsFromHubspot(); ok(res, { count: rows.length, rows }); };
export const load = async (req, res) => {
  const b = req.valid.body;
  if (!b.dryRun && b.confirm !== true) throw ApiError.badRequest('Loading creates accounts. Send { "dryRun": false, "confirm": true }');
  ok(res, await bulk.load(rowsOf(b), { dryRun: b.dryRun, actor: req.actor }));
};
export const sendWelcome = async (req, res) => {
  const b = req.valid.body;
  if (!b.dryRun && b.confirm !== true) throw ApiError.badRequest('Sending emails to clients is irreversible. Send { "dryRun": false, "confirm": true }');
  ok(res, await bulk.sendWelcomeBatch({ emails: b.emails, limit: b.limit, dryRun: b.dryRun, actor: req.actor }));
};
