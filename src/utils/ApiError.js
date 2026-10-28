import { ERROR_CODES as C } from '../config/constants.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(message = 'Bad request', details) { return new ApiError(400, C.BAD_REQUEST, message, details); }
  static validation(details) { return new ApiError(422, C.VALIDATION_ERROR, 'Validation failed', details); }
  static unauthorized(code = C.UNAUTHORIZED, message = 'Authentication required') { return new ApiError(401, code, message); }
  static forbidden(message = 'You do not have permission to do that') { return new ApiError(403, C.FORBIDDEN, message); }
  static notFound(message = 'Not found') { return new ApiError(404, C.NOT_FOUND, message); }
  static conflict(message = 'Conflict', details) { return new ApiError(409, C.CONFLICT, message, details); }
  static tooMany(message = 'Too many requests, try again shortly') { return new ApiError(429, C.RATE_LIMITED, message); }
  static upstream(service, message, details) { return new ApiError(502, C.UPSTREAM_ERROR, `${service}: ${message}`, details); }
  /** Revoked/suspended client. The frontend shows a friendly "contact Consult b3" screen. */
  static accessEnded(message = 'Your portal access has ended. Please contact the Consult b3 team.') {
    return new ApiError(403, C.ACCESS_ENDED, message);
  }
}
