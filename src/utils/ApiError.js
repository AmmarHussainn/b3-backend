import { ERROR_CODES as C } from '../config/constants.js';

const HTTP = {
  [C.BAD_REQUEST]: 400, [C.VALIDATION_ERROR]: 422, [C.UNAUTHORIZED]: 401, [C.INVALID_CREDENTIALS]: 401,
  [C.TOKEN_EXPIRED]: 401, [C.TOKEN_INVALID]: 401, [C.LINK_EXPIRED]: 410, [C.PASSWORD_NOT_SET]: 403,
  [C.ACCOUNT_LOCKED]: 423, [C.ACCESS_ENDED]: 403, [C.FORBIDDEN]: 403, [C.NOT_FOUND]: 404,
  [C.CONFLICT]: 409, [C.RATE_LIMITED]: 429, [C.UPSTREAM_ERROR]: 502, [C.INTERNAL]: 500,
};

export class ApiError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
    this.status = HTTP[code] || 500;
    this.details = details;
  }
  static badRequest(m, d) { return new ApiError(C.BAD_REQUEST, m, d); }
  static validation(m, d) { return new ApiError(C.VALIDATION_ERROR, m, d); }
  static unauthorized(m = 'Authentication required') { return new ApiError(C.UNAUTHORIZED, m); }
  static forbidden(m = 'You do not have permission to do that') { return new ApiError(C.FORBIDDEN, m); }
  static notFound(m = 'Not found') { return new ApiError(C.NOT_FOUND, m); }
  static conflict(m, d) { return new ApiError(C.CONFLICT, m, d); }
  static upstream(m, d) { return new ApiError(C.UPSTREAM_ERROR, m, d); }
}
