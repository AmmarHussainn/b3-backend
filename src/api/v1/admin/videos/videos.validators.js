import { z } from 'zod';
import { oid } from '../../../../utils/zodHelpers.js';
export const lessonParams = z.object({ lessonId: oid });
