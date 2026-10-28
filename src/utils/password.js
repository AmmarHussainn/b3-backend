import argon2 from 'argon2';
import { ApiError } from './ApiError.js';

export const hashPassword = (plain) => argon2.hash(plain, { type: argon2.argon2id });
export const verifyPassword = (hash, plain) => argon2.verify(hash, plain).catch(() => false);

export function assertPasswordPolicy(pw) {
  const problems = [];
  if (typeof pw !== 'string' || pw.length < 10) problems.push('At least 10 characters');
  if (!/[A-Za-z]/.test(pw || '') || !/\d/.test(pw || '')) problems.push('Include letters and a number');
  if (problems.length) throw ApiError.validation({ password: problems });
}
