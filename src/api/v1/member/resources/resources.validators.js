import { z } from 'zod';
import { idParams, pageQuery } from '../../../../utils/zodHelpers.js';
export { idParams };
export const list = z.object({ ...pageQuery, type: z.enum(['docx', 'xlsx', 'pptx', 'pdf', 'image']).optional(), topic: z.string().max(100).optional(), q: z.string().max(100).optional(), productKey: z.string().max(80).optional() });
