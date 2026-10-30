import { z } from 'zod';

export const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const emailField = z.string().trim().toLowerCase().email().max(254);
export const pageQuery = { page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) };
export const idParams = z.object({ id: oid });
export const confirmBody = z.object({ confirm: z.literal(true, { errorMap: () => ({ message: 'Send { "confirm": true }' }) }) });
export const boolish = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
