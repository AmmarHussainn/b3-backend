import * as reports from '../../../../services/report.service.js';
import { ok } from '../../../../utils/response.js';

export const engagement = async (req, res) => ok(res, await reports.engagement(req.valid.query));
export const inactive = async (req, res) => ok(res, await reports.inactiveClients(req.valid.query));
export const exportData = async (req, res) => {
  if (req.valid.query.format === 'json') return ok(res, await reports.exportRows());
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="b3-portal-clients.csv"');
  res.send(await reports.exportCsv());
};

export const completions = async (req, res) => ok(res, await reports.completions(req.valid.query));
