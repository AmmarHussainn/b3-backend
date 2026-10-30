import { z } from 'zod';
import { idParams, emailField, boolish } from '../../../../utils/zodHelpers.js';
import { ADMIN_ROLES } from '../../../../config/constants.js';
export { idParams };
const role = z.enum(Object.values(ADMIN_ROLES));
export const invite = z.object({ email: emailField, firstName: z.string().trim().max(80).optional(), lastName: z.string().trim().max(80).optional(), role });
export const update = z.object({ role: role.optional(), active: boolish.optional(), firstName: z.string().trim().max(80).optional(), lastName: z.string().trim().max(80).optional() }).refine((o) => Object.keys(o).length, 'Nothing to update');
