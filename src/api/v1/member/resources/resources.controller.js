import * as content from '../../../../services/content.service.js';
import * as resources from '../../../../services/resource.service.js';
import { ok, paginated } from '../../../../utils/response.js';

export const list = async (req, res) => paginated(res, await content.getResourceLibrary(req.entitlements, req.valid.query));
export const get = async (req, res) => {
  const r = await content.getAccessibleResource(req.valid.params.id, req.entitlements);
  ok(res, { id: String(r._id), title: r.title, assetType: r.assetType, topic: r.topic, version: r.currentVersion, fileName: content.currentVersion(r).fileName, lessonId: String(r.lessonId) });
};
/** JSON { url, expiresAt, fileName }: short-lived signed CDN URL. */
export const downloadUrl = async (req, res) => ok(res, resources.signedUrl(await content.getAccessibleResource(req.valid.params.id, req.entitlements)));
/** Streams the file as an attachment (always downloads, never previews). */
export const file = async (req, res) => resources.pipeDownload(await content.getAccessibleResource(req.valid.params.id, req.entitlements), res);
