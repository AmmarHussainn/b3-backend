import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

/** fetch wrapper: timeout + uniform errors. parse: 'json' | 'none' | 'raw' (returns the Response). */
export async function bunnyFetch(url, { method = 'GET', headers = {}, body, timeoutMs = 30_000, parse = 'json' } = {}) {
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw ApiError.upstream(`Bunny request failed: ${e.name === 'TimeoutError' ? 'timed out' : e.message}`);
  }
  if (parse === 'raw') return res;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn({ url: url.split('?')[0], status: res.status, text: text.slice(0, 300) }, 'Bunny error');
    throw ApiError.upstream(`Bunny responded ${res.status}`, { status: res.status });
  }
  if (parse === 'none') return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
