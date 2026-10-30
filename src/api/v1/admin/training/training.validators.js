import { z } from 'zod';
import { idParams, oid, boolish, pageQuery } from '../../../../utils/zodHelpers.js';
export { idParams };
const description = z.string().trim().max(1200);
export const createContainer = z.object({ title: z.string().trim().min(3).max(120), navGroup: z.string().trim().max(120).optional(), order: z.number().int().optional() });
export const createCourse = z.object({ productId: oid, courseNumber: z.number().int().min(1).max(999), name: z.string().trim().min(2).max(120), description: description.optional() });
export const updateCourse = z.object({ courseNumber: z.number().int().min(1).max(999).optional(), name: z.string().trim().min(2).max(120).optional(), description: description.optional() }).refine((o) => Object.keys(o).length, 'Nothing to update');
export const move = z.object({ productId: oid });
export const order = z.object({ lessonIds: z.array(oid).min(1) });
export const actionParams = z.object({ id: oid, action: z.enum(['publish', 'unpublish', 'archive', 'restore', 'remove']) });
export const actionBody = z.object({ includeLessons: boolish.optional(), allowMissingCaptions: boolish.optional(), confirm: z.boolean().optional() });

export const removeContainer = z.object({ mode: z.enum(['archive', 'delete']).default('archive') });
export const listCourses = z.object({ ...pageQuery, productId: oid.optional(), status: z.enum(['draft', 'live', 'archived']).optional(), q: z.string().max(100).optional() });
