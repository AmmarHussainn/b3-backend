import * as progress from '../../../../services/progress.service.js';
import { ok } from '../../../../utils/response.js';

export const summary = async (req, res) => ok(res, await progress.getOverall(req.user.id, req.entitlements));
export const resume = async (req, res) => ok(res, await progress.getContinue(req.user.id, req.entitlements));
export const position = async (req, res) => ok(res, await progress.setPosition(req.user.id, req.valid.params.lessonId, req.valid.body.positionSeconds, req.entitlements));
export const complete = async (req, res) => ok(res, await progress.setCompleted(req.user.id, req.valid.params.lessonId, true, req.entitlements));
export const incomplete = async (req, res) => ok(res, await progress.setCompleted(req.user.id, req.valid.params.lessonId, false, req.entitlements));
