import { uuid } from '../utils/crypto.js';

export function requestId(req, res, next) {
  req.id = String(req.get('x-request-id') || uuid()).slice(0, 64);
  res.setHeader('x-request-id', req.id);
  next();
}
