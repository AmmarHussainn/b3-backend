import { z } from 'zod';
import { pageQuery } from '../../../../utils/zodHelpers.js';
export const list = z.object({ ...pageQuery, action: z.string().max(80).optional(), entity: z.string().max(40).optional(), entityId: z.string().max(40).optional(), actorEmail: z.string().max(254).optional(), from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() });
