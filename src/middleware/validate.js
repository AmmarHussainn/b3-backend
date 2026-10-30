import { ApiError } from '../utils/ApiError.js';

/**
 * validate({ body, query, params }) with zod schemas.
 * Express 5 makes req.query read-only, so parsed values go to req.valid.{body,query,params}.
 */
export const validate = (schemas = {}) => (req, res, next) => {
  const valid = {};
  const details = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const r = schemas[part].safeParse(req[part] ?? {});
    if (r.success) valid[part] = r.data;
    else details[part] = r.error.flatten();
  }
  if (Object.keys(details).length) return next(ApiError.validation('Validation failed', details));
  req.valid = valid;
  next();
};
