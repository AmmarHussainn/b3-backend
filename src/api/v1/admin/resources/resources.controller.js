import * as resources from '../../../../services/resource.service.js';
import { ok, created, paginated } from '../../../../utils/response.js';

export const list = async (req, res) => paginated(res, await resources.list(req.valid.query));
export const create = async (req, res) => created(res, await resources.create(req.file, req.valid.body, req.actor));
export const get = async (req, res) => ok(res, await resources.get(req.valid.params.id));
export const addVersion = async (req, res) => ok(res, await resources.addVersion(req.valid.params.id, req.file, req.actor));
export const setCurrent = async (req, res) => ok(res, await resources.setCurrentVersion(req.valid.params.id, req.valid.body.version, req.actor));
export const update = async (req, res) => ok(res, await resources.update(req.valid.params.id, req.valid.body, req.actor));
export const remove = async (req, res) => ok(res, await resources.remove(req.valid.params.id, req.actor));

export const downloadUrl = async (req, res) => ok(res, await resources.adminDownloadUrl(req.valid.params.id, req.valid.query.version));
