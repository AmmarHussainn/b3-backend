import { z } from 'zod';
import { idParams, oid, pageQuery } from '../../../../utils/zodHelpers.js';
export { idParams };
export const list = z.object({ ...pageQuery, lessonId: oid.optional(), productId: oid.optional(), type: z.enum(['docx', 'xlsx', 'pptx', 'pdf', 'image']).optional(), topic: z.string().max(100).optional(), q: z.string().max(100).optional(), status: z.enum(['draft', 'live', 'archived', 'removed']).optional() });
export const create = z.object({ lessonId: oid, title: z.string().trim().min(2).max(160), topic: z.string().trim().max(100).optional() });
export const update = z.object({ title: z.string().trim().min(2).max(160).optional(), topic: z.string().trim().max(100).optional(), lessonId: oid.optional() }).refine((o) => Object.keys(o).length, 'Nothing to update');
export const currentVersion = z.object({ version: z.number().int().min(1) });

export const downloadQuery = z.object({ version: z.coerce.number().int().min(1).optional() });
