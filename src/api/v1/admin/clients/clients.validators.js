import { z } from 'zod';
import { idParams, emailField, pageQuery, boolish } from '../../../../utils/zodHelpers.js';
export { idParams };
export const list = z.object({ ...pageQuery, q: z.string().max(100).optional(), status: z.enum(['active', 'suspended', 'removed']).optional(), tier: z.string().max(60).optional(), tag: z.string().max(60).optional(), syncStatus: z.enum(['Pending', 'Provisioned', 'Revoked', 'Error']).optional() });
export const comp = z.object({ email: emailField, firstName: z.string().trim().max(80).optional(), lastName: z.string().trim().max(80).optional(), sendWelcome: boolish.optional() });
export const revoke = z.object({ status: z.enum(['removed', 'suspended']).default('removed'), confirm: z.literal(true) });
export const reconcile = z.object({ dryRun: boolish.optional() });
