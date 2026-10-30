import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES as C } from '../config/constants.js';
import { env, isProd } from '../config/env.js';
import { logger } from '../utils/logger.js';

// One error envelope for the whole API: { error: { code, message, details, requestId } }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let e = err;
  if (!(e instanceof ApiError)) {
    if (e?.type === 'entity.parse.failed') e = ApiError.badRequest('Malformed JSON body');
    else if (e?.type === 'entity.too.large') e = ApiError.badRequest('Request body too large');
    else if (e?.name === 'MulterError') e = ApiError.badRequest(e.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${env.UPLOAD_MAX_MB} MB)` : e.message);
    else if (e?.name === 'ValidationError' && e.errors) {
      e = ApiError.validation('Invalid data', Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v.message])));
    } else if (e?.name === 'CastError') e = ApiError.badRequest(`Invalid ${e.path}`);
    else if (e?.code === 11000) e = ApiError.conflict('That value already exists', e.keyValue);
    else {
      logger.error({ err, requestId: req.id, path: req.originalUrl }, 'Unhandled error');
      e = new ApiError(C.INTERNAL, isProd ? 'Something went wrong' : err?.message);
    }
  }
  res.status(e.status).json({ error: { code: e.code, message: e.message, details: e.details, requestId: req.id } });
}
