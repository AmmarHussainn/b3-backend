import pino from 'pino';

const dev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'passwordHash', 'refreshToken', 'token'],
  ...(dev ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
});
