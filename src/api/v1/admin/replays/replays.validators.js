import { z } from 'zod';
import { idParams, dateOnly, boolish } from '../../../../utils/zodHelpers.js';
export { idParams };
const topic = z.string().trim().min(2).max(150);
const description = z.string().trim().max(1200);
export const create = z.object({ sessionDate: dateOnly, topic, description: description.optional() });
export const update = z.object({ sessionDate: dateOnly.optional(), topic: topic.optional(), description: description.optional() }).refine((o) => Object.keys(o).length, 'Nothing to update');
export const actionParams = z.object({ id: idParams.shape.id, action: z.enum(['publish', 'unpublish', 'archive', 'restore', 'remove']) });
export const actionBody = z.object({ allowMissingCaptions: boolish.optional(), confirm: z.boolean().optional() });
