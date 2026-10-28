import { ApiError } from '../../utils/ApiError.js';

/** Thin fetch wrapper for Bunny APIs: timeout, JSON handling, consistent upstream errors. */
export async function bunnyFetch(url, { method = 'GET', headers = {}, body, json, timeoutMs = 30_000, raw = false, duplex } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { accept: 'application/json', ...(json ? { 'content-type': 'application/json' } : {}), ...headers },
      body: json ? JSON.stringify(json) : body,
      signal: ctrl.signal,
      ...(duplex ? { duplex } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw ApiError.upstream('Bunny', `${method} ${new URL(url).pathname} failed (${res.status})`, text.slice(0, 500));
    }
    if (raw) return res;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.upstream('Bunny', err.name === 'AbortError' ? 'request timed out' : err.message);
  } finally {
    clearTimeout(timer);
  }
}
