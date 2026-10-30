import { z } from 'zod';
import { idParams } from '../../../../utils/zodHelpers.js';
export { idParams };
export const updateProduct = z.object({ title: z.string().trim().min(3).max(120).optional(), navGroup: z.string().trim().max(120).optional(), order: z.number().int().optional(), status: z.enum(['draft', 'live', 'archived']).optional() }).refine((o) => Object.keys(o).length, 'Nothing to update');
