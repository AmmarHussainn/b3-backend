import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../config/constants.js';

/** Last middleware. Converts anything thrown into the standard error envelope. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let e = err;

  if (err instanceof ZodError) e = ApiError.validation(err.flatten().fieldErrors);
  else if (err?.name === 'ValidationError' && err.errors) {
    e = ApiError.validation(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, [v.message]])));
  } else if (err?.code === 11000) e = ApiError.conflict('Duplicate value', err.keyValue);
  else if (err?.type === 'entity.parse.failed') e = ApiError.badRequest('Malformed JSON body');
  else if (err?.type === 'entity.too.large') e = new ApiError(413, ERROR_CODES.BAD_REQUEST, 'Payload too large');

  if (!(e instanceof ApiError)) {
    req.log?.error({ err }, 'Unhandled error');
    e = new ApiError(500, ERROR_CODES.INTERNAL, 'Something went wrong');
  } else if (e.status >= 500) {
    req.log?.error({ err }, e.message);
  }

  res.status(e.status).json({
    success: false,
    error: { code: e.code, message: e.message, details: e.details, requestId: req.id },
  });
}
