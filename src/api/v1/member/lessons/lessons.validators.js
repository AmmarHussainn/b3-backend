import { z } from 'zod';
import { idParams } from '../../../../utils/zodHelpers.js';
export { idParams };
export const resolve = z.object({ category: z.string().min(1).max(120), lesson: z.string().min(1).max(160) });
