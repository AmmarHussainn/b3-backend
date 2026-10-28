import { OFFER_KEYS as O, TAGS as T } from '../../../config/constants.js';

// productKeys: null = every product. The launch rule: active client sees everything, via a named bundle.
export const offers = [
  { key: O.ALL_ACCESS, title: 'b3 Portal - All Access', productKeys: null, grantedByTags: [T.PORTAL_ACCESS_ACTIVE, T.PORTAL_COMP], includesUnpublished: false },
  { key: O.STAFF, title: 'b3 Portal - Staff', productKeys: null, grantedByTags: [T.PORTAL_STAFF], includesUnpublished: true },
];
