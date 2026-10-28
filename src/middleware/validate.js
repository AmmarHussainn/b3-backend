/**
 * validate({ params, query, body }) with zod schemas.
 * Parsed values are available as req.valid.{params,query,body}; body and params are also replaced.
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    req.valid = {};
    for (const key of ['params', 'query', 'body']) {
      if (!schemas[key]) continue;
      req.valid[key] = schemas[key].parse(req[key]);
      if (key !== 'query') req[key] = req.valid[key];
    }
    next();
  } catch (err) {
    next(err);
  }
};
