export const isoDate = (d) => new Date(d).toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * 864e5);
export const hoursBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 36e5;
export const startOfUtcMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
/** 'YYYY-MM-DD' -> Date at 00:00 UTC (session dates are calendar dates, not instants). */
export const parseDateOnly = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`);
/** Wednesday session -> must be live by end of Friday = start of Saturday UTC (session day + 3). */
export const publishDeadline = (sessionDate) => {
  const s = new Date(sessionDate);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + 3));
};
