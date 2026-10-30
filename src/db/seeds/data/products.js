import { PRODUCT_KEYS as K, PRESENTATION as P, CONTENT_STATUS as CS } from '../../../config/constants.js';

// Named by topic, never by tier.
export const PRODUCTS = [
  { key: K.START_HERE, title: 'Start Here', presentation: P.FLAT, order: 1, status: CS.LIVE },
  { key: K.GROWTH_LAB_REPLAYS, title: 'b3 Growth Lab replays', presentation: P.ARCHIVE, order: 2, status: CS.LIVE },
  { key: K.TRAINING_CORE, title: 'b3 Growth System™ Training - Core', presentation: P.COURSE_LIBRARY, navGroup: 'b3 Growth System™ Training', order: 3, status: CS.LIVE },
  { key: K.TRAINING_ADVANCED, title: 'b3 Growth System™ Training - Advanced', presentation: P.COURSE_LIBRARY, navGroup: 'b3 Growth System™ Training', order: 4, status: CS.LIVE, optional: true },
  { key: K.RESOURCE_LIBRARY, title: 'Resource Library', presentation: P.INDEX, order: 5, status: CS.LIVE },
];
