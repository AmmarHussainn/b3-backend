import * as team from '../../../../services/team.service.js';
import { ok, created } from '../../../../utils/response.js';
export const list = async (req, res) => ok(res, await team.list());
export const invite = async (req, res) => created(res, await team.invite(req.valid.body, req.actor));
export const update = async (req, res) => ok(res, await team.update(req.valid.params.id, req.valid.body, req.actor));
export const resendInvite = async (req, res) => ok(res, await team.resendInvite(req.valid.params.id, req.actor));
