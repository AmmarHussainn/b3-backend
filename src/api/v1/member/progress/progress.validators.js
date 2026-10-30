import { z } from 'zod';
import { oid } from '../../../../utils/zodHelpers.js';
export const lessonParams = z.object({ lessonId: oid });
export const position = z.object({ positionSeconds: z.number().min(0).max(86400) });
