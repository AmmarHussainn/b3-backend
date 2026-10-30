import { describe, it, expect } from 'vitest';
import { buildReplayTitle, parseCourseTitle, parseLessonTitle, assertNoDates, parseFileName, terminologyWarnings, WELCOME_TITLE } from '../../src/utils/naming.js';

describe('naming rules', () => {
  it('builds replay titles', () => expect(buildReplayTitle(new Date('2026-10-28T00:00:00Z'), 'Cash Flow Visibility')).toBe('2026-10 Growth Lab - Cash Flow Visibility'));
  it('parses course and lesson titles', () => {
    expect(parseCourseTitle('Course 3 - The Vital Signs')).toEqual({ courseNumber: 3, name: 'The Vital Signs' });
    expect(parseLessonTitle('01 - Reading your numbers weekly').number).toBe(1);
    expect(parseLessonTitle(WELCOME_TITLE).number).toBe(0);
    expect(() => parseLessonTitle('00 - Intro')).toThrow();
    expect(() => parseLessonTitle('Reading numbers')).toThrow();
  });
  it('rejects dates in training', () => {
    for (const t of ['Q4 2026 planning', 'October review', '10/28 recap']) expect(() => assertNoDates(t)).toThrow();
    expect(() => assertNoDates('Reading your numbers weekly')).not.toThrow();
  });
  it('enforces file names and version', () => {
    expect(parseFileName('b3-cash-flow-worksheet-v1.xlsx', 1).version).toBe(1);
    expect(() => parseFileName('Cash Flow.xlsx')).toThrow();
    expect(() => parseFileName('b3-cash-flow-worksheet-v1.xlsx', 2)).toThrow();
  });
  it('lints terminology', () => {
    expect(terminologyWarnings('Our b3 Growth System helps customers in a webinar')).toHaveLength(3);
    expect(terminologyWarnings('The b3 Growth System™ helps clients at Consult b3')).toHaveLength(0);
  });
});
