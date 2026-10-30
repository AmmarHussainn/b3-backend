import { z } from 'zod';
import { oid, boolish } from '../../../../utils/zodHelpers.js';
export const engagement = z.object({ months: z.coerce.number().int().min(1).max(24).default(6) });
export const inactive = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
export const exportQ = z.object({ format: z.enum(['csv', 'json']).default('csv') });

export const completions = z.object({ courseId: oid.optional(), productId: oid.optional(), lessons: boolish.default(false) });
