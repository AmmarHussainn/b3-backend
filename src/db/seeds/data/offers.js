import { OFFER_KEYS as O, TAGS as T } from '../../../config/constants.js';

// Launch: ONE client offer holding everything. Tier tags grant nothing; that is the point.
export const OFFERS = [
  { key: O.ALL_ACCESS, title: 'b3 Portal - All Access', grantedByTags: [T.PORTAL_ACCESS_ACTIVE, T.PORTAL_COMP], includesUnpublished: false },
  { key: O.STAFF, title: 'b3 Portal - Staff', grantedByTags: [T.PORTAL_STAFF], includesUnpublished: true },
];
