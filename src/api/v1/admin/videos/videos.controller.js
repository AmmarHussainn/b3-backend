import * as video from '../../../../services/video.service.js';
import { ok, created, noContent } from '../../../../utils/response.js';

export const upload = async (req, res) => created(res, await video.createUpload(req.valid.params.lessonId, req.actor));
export const replace = async (req, res) => created(res, await video.replaceUpload(req.valid.params.lessonId, req.actor));
export const status = async (req, res) => ok(res, await video.refreshStatus(req.valid.params.lessonId));
export const preview = async (req, res) => ok(res, await video.previewUrl(req.valid.params.lessonId));
export const remove = async (req, res) => { await video.remove(req.valid.params.lessonId, req.actor); noContent(res); };
