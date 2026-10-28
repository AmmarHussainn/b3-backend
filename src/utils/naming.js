import { ALLOWED_FILE_TYPES } from '../config/constants.js';
import { ApiError } from './ApiError.js';
import { monthKey } from './dates.js';

// Naming conventions from the Technical Build Scope, section 9.4. Enforced in code, not by memory.
export const buildReplayTitle = (sessionDate, topic) => `${monthKey(sessionDate)} Growth Lab - ${topic.trim()}`;

const RE = {
  replay: /^\d{4}-(0[1-9]|1[0-2]) Growth Lab - .+$/,
  course: /^Course \d+ - .+$/,
  welcome: /^00 - Welcome to this course$/,
  lesson: /^\d{2} - .+$/,
  file: new RegExp(`^b3-[a-z0-9]+(?:-[a-z0-9]+)*-v\\d+\\.(${Object.keys(ALLOWED_FILE_TYPES).join('|')})$`),
  year: /^\d{4}$/,
};
const DATE_IN_TEXT = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

const check = (re, value, hint) => {
  if (!re.test(value)) throw ApiError.validation({ name: [`Must follow: ${hint}`] });
  return value;
};

export const assertReplayTitle = (v) => check(RE.replay, v, 'YYYY-MM Growth Lab - Topic');
export const assertCourseTitle = (v) => check(RE.course, v, 'Course N - Course title');
export const assertWelcomeTitle = (v) => check(RE.welcome, v, '00 - Welcome to this course');
export const assertFileName = (v) => check(RE.file, v, 'b3-topic-assettype-vN.ext (lowercase)');
export const assertYearName = (v) => check(RE.year, v, 'YYYY');

/** Training lessons are evergreen: Nn - Title, and no dates anywhere. */
export function assertTrainingLessonTitle(v) {
  if (RE.welcome.test(v)) return v;
  check(RE.lesson, v, 'Nn - Lesson title');
  if (DATE_IN_TEXT.test(v)) throw ApiError.validation({ name: ['Training lessons must not contain dates'] });
  return v;
}
