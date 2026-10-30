import argon2 from 'argon2';
import { ApiError } from './ApiError.js';

const OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
let dummy;

export const hash = (pw) => argon2.hash(pw, OPTS);
export async function verify(hashed, pw) {
  try { return await argon2.verify(hashed, pw); } catch { return false; }
}
/** Burn the same CPU time when the account does not exist (no timing oracle). */
export async function fakeVerify(pw) {
  dummy ||= await argon2.hash('b3-dummy-password', OPTS);
  await verify(dummy, pw);
}
/** Policy: 10-128 chars, at least one letter and one number. */
export function assertPolicy(pw) {
  const problems = [];
  if (typeof pw !== 'string' || pw.length < 10) problems.push('Use at least 10 characters.');
  if (typeof pw === 'string' && pw.length > 128) problems.push('Use 128 characters or fewer.');
  if (typeof pw === 'string' && !/[A-Za-z]/.test(pw)) problems.push('Include at least one letter.');
  if (typeof pw === 'string' && !/\d/.test(pw)) problems.push('Include at least one number.');
  if (problems.length) throw ApiError.validation('Password does not meet the requirements', { password: problems });
}
