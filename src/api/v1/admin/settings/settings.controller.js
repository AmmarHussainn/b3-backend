import * as settings from '../../../../services/settings.service.js';
import * as audit from '../../../../services/audit.service.js';
import { ok } from '../../../../utils/response.js';
import { ApiError } from '../../../../utils/ApiError.js';
import { SCHEMAS } from './settings.validators.js';

export const list = async (req, res) => ok(res, await settings.getAll());
export const set = async (req, res) => {
  const { key } = req.valid.params;
  const parsed = SCHEMAS[key].safeParse(req.valid.body.value);
  if (!parsed.success) throw ApiError.validation('Invalid value', parsed.error.flatten());
  const r = await settings.set(key, parsed.data);
  await audit.log({ actor: req.actor, action: 'settings.update', entity: 'setting', entityId: key, before: r.before, after: r.after });
  ok(res, { key, value: r.after });
};
