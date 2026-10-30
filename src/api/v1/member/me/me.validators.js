import { z } from 'zod';
export const update = z.object({ firstName: z.string().trim().min(1).max(80).optional(), lastName: z.string().trim().min(1).max(80).optional() }).refine((o) => Object.keys(o).length, 'Nothing to update');
export const support = z.object({ subject: z.string().trim().min(3).max(150), message: z.string().trim().min(5).max(5000) });
