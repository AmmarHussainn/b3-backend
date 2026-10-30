import { Router } from 'express';
import multer from 'multer';
import { env } from '../../../../config/env.js';
import { validate } from '../../../../middleware/validate.js';
import * as v from './resources.validators.js';
import * as c from './resources.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 } });
const r = Router();
r.get('/', validate({ query: v.list }), c.list);
r.post('/', upload.single('file'), validate({ body: v.create }), c.create); // multipart: file + lessonId + title (+ topic)
r.get('/:id', validate({ params: v.idParams }), c.get);
r.post('/:id/versions', upload.single('file'), validate({ params: v.idParams }), c.addVersion); // replace a file
r.put('/:id/current-version', validate({ params: v.idParams, body: v.currentVersion }), c.setCurrent); // rollback
r.patch('/:id', validate({ params: v.idParams, body: v.update }), c.update);
r.delete('/:id', validate({ params: v.idParams }), c.remove);
r.get('/:id/download-url', validate({ params: v.idParams, query: v.downloadQuery }), c.downloadUrl);
export default r;
