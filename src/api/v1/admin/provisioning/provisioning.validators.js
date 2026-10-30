import { z } from 'zod';
import { idParams, pageQuery, boolish } from '../../../../utils/zodHelpers.js';
export { idParams };
export const events = z.object({ ...pageQuery, status: z.enum(['received', 'processing', 'done', 'failed']).optional(), action: z.enum(['grant', 'revoke', 'update']).optional(), email: z.string().max(254).optional() });
export const reconcile = z.object({ full: boolish.optional(), dryRun: boolish.default(true), force: boolish.optional() });
export const rows = z.object({ rows: z.array(z.record(z.any())).max(5000).optional(), csv: z.string().max(5_000_000).optional() }).refine((o) => o.rows || o.csv, 'Send rows (JSON) or csv (text)');
export const load = z.object({ rows: z.array(z.record(z.any())).max(5000).optional(), csv: z.string().max(5_000_000).optional(), dryRun: boolish.default(true), confirm: z.boolean().optional() }).refine((o) => o.rows || o.csv, 'Send rows (JSON) or csv (text)');
export const sendWelcome = z.object({ emails: z.array(z.string().email()).max(1000).optional(), limit: z.number().int().min(1).max(2000).default(500), dryRun: boolish.default(true), confirm: z.boolean().optional() });
