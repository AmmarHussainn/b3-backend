// Naming rules from the Technical Build Scope section 9.4 + terminology rules from 9.6.
import { ApiError } from './ApiError.js';

export const WELCOME_TITLE = '00 - Welcome to this course';
const REPLAY_RE = /^(\d{4})-(0[1-9]|1[0-2]) Growth Lab - (\S.*)$/;
const COURSE_RE = /^Course (\d{1,3}) - (\S.*)$/;
const LESSON_RE = /^(\d{2}) - (\S.*)$/;
const FILE_RE = /^b3-([a-z0-9]+(?:-[a-z0-9]+)*)-v(\d+)\.(docx|xlsx|pptx|pdf|png|jpe?g)$/;
const MONTHS = 'january|february|march|april|june|july|august|september|october|november|december';
const DATE_PATTERNS = [/\b(19|20)\d{2}\b/, new RegExp(`\\b(${MONTHS})\\b`, 'i'), /\b\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?\b/, /\b\d{4}-\d{2}(-\d{2})?\b/];
const pad2 = (n) => String(n).padStart(2, '0');

export function buildReplayTitle(sessionDate, topic) {
  const d = new Date(sessionDate);
  const t = String(topic || '').trim();
  if (!t) throw ApiError.validation('Topic is required', { topic: ['Required'] });
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)} Growth Lab - ${t}`;
}
export function parseReplayTitle(title) {
  const m = REPLAY_RE.exec(title || '');
  if (!m) throw ApiError.validation('Replay title must look like "2026-10 Growth Lab - Topic"', { title: [`"${title}" does not match`] });
  return { year: +m[1], month: +m[2], topic: m[3] };
}
export const buildCourseTitle = (n, name) => `Course ${Number(n)} - ${String(name || '').trim()}`;
export function parseCourseTitle(title) {
  const m = COURSE_RE.exec(title || '');
  if (!m) throw ApiError.validation('Course title must look like "Course 3 - The Vital Signs"', { title: [`"${title}" does not match`] });
  return { courseNumber: +m[1], name: m[2] };
}
export const buildLessonTitle = (n, name) => `${pad2(n)} - ${String(name || '').trim()}`;
export function parseLessonTitle(title) {
  const m = LESSON_RE.exec(title || '');
  if (!m) throw ApiError.validation('Lesson title must look like "01 - Reading your numbers weekly"', { title: [`"${title}" does not match`] });
  const number = +m[1];
  if (number === 0 && title !== WELCOME_TITLE) throw ApiError.validation(`Lesson 00 must be exactly "${WELCOME_TITLE}"`, { title: ['Invalid welcome title'] });
  return { number, name: m[2] };
}
/** Training must contain no dates anywhere. */
export function assertNoDates(text, field = 'title') {
  for (const re of DATE_PATTERNS) {
    if (re.test(text || '')) throw ApiError.validation('Training content must not contain dates, years or months', { [field]: [`"${text}" contains a date`] });
  }
}
export function parseFileName(name, expectedVersion) {
  const m = FILE_RE.exec(name || '');
  if (!m) throw ApiError.validation('File name must follow b3-topic-assettype-vN.ext (lowercase, hyphens), e.g. b3-cash-flow-worksheet-v1.xlsx', { file: [`"${name}" does not match`] });
  const out = { slug: m[1], version: +m[2], ext: m[3] === 'jpeg' ? 'jpg' : m[3] };
  if (expectedVersion && out.version !== expectedVersion) {
    throw ApiError.validation(`This upload must be version ${expectedVersion}: rename the file to end in -v${expectedVersion}.${m[3]}`, { file: [`Expected v${expectedVersion}`] });
  }
  return out;
}
/** Non-blocking lint for brand/terminology rules (9.6). Returns human-readable warnings. */
export function terminologyWarnings(text = '') {
  const w = [];
  if (/b3 Growth System(?!™)/.test(text) || /b3 Growth System\s+™/.test(text)) w.push('b3 Growth System needs ™ directly after it, with no space.');
  if (/\bGTM OS(?!™)/.test(text)) w.push('GTM OS needs ™ directly after it.');
  if (/\bGTM(?! OS)(?!™)\b/.test(text)) w.push('GTM needs ™ directly after it.');
  if (/\bcustomers?\b/i.test(text)) w.push('Use "clients", not "customers".');
  if (/\bwebinars?\b/i.test(text)) w.push('The b3 Growth Lab is a live and recorded group session, never a "webinar".');
  for (const m of text.match(/\bconsult\s+b3\b/gi) || []) if (m !== 'Consult b3') w.push('Write the company name as "Consult b3".');
  return [...new Set(w)];
}
