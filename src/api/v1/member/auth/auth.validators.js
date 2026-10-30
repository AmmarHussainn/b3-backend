import { z } from 'zod';
import { emailField } from '../../../../utils/zodHelpers.js';

const password = z.string().min(1).max(200);
export const login = z.object({ email: emailField, password });
export const refresh = z.object({ refreshToken: z.string().min(10) });
export const setPassword = z.object({ token: z.string().min(10), password });
export const forgot = z.object({ email: emailField });
export const reset = z.object({ token: z.string().min(10), password });
export const change = z.object({ currentPassword: password, newPassword: password });
export const linkStatus = z.object({ token: z.string().min(10), type: z.enum(['invite', 'reset']) });
