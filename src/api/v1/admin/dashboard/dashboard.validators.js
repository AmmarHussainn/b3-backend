import { z } from 'zod';

export const activity = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  before: z.string().datetime({ offset: true }).optional(), // pass the previous response's nextBefore to load older events
});
