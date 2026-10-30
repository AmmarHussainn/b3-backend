// Provider adapter. Ships with Resend (REST, no SDK). To use Postmark or SES, replace the body of send().
// With no EMAIL_PROVIDER_API_KEY it logs the email instead of sending (local dev).
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

export async function send({ to, subject, html, text, idempotencyKey }) {
  if (!env.EMAIL_PROVIDER_API_KEY) {
    logger.info({ to, subject, text }, '[email:dev-log] not sent (EMAIL_PROVIDER_API_KEY not set)');
    return { id: 'dev-log', dev: true };
  }
  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
    });
  } catch (e) { throw ApiError.upstream(`Email provider unreachable: ${e.message}`); }
  if (!res.ok) throw ApiError.upstream(`Email provider responded ${res.status}`, { body: (await res.text().catch(() => '')).slice(0, 300) });
  const j = await res.json().catch(() => ({}));
  return { id: j.id };
}
