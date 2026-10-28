import { PRODUCT_KEYS as K, PRESENTATION as P } from '../../../config/constants.js';

export const products = [
  { key: K.START_HERE, title: 'Start Here', presentation: P.FLAT, order: 0 },
  { key: K.GROWTH_LAB_REPLAYS, title: 'b3 Growth Lab replays', presentation: P.ARCHIVE, order: 1 },
  { key: K.TRAINING_CORE, title: 'b3 Growth System™ Training - Core', presentation: P.COURSE_LIBRARY, navGroup: 'b3 Growth System™ Training', order: 2 },
  // Add the Advanced container only when the core/advanced split is decided. It is a small change.
  { key: K.RESOURCE_LIBRARY, title: 'Resource Library', presentation: P.INDEX, order: 4 },
];
