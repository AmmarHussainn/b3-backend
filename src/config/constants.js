// Single source of truth. Tag names are NEVER renamed once live: workflows depend on them.

export const TAGS = Object.freeze({
  PORTAL_ACCESS_ACTIVE: 'portal-access-active',
  TIER_GROWTH_LAB: 'tier-growth-lab',
  TIER_ADVISORY: 'tier-advisory',
  TIER_EXECUTIVE: 'tier-executive',
  PORTAL_STAFF: 'portal-staff',
  PORTAL_COMP: 'portal-comp',
  // Reserved (FUTURE): stored, grant nothing
  PORTAL_TEAM_SEAT: 'portal-team-seat',
  INDUSTRY_LEGAL: 'industry-legal',
  INDUSTRY_MEDICAL: 'industry-medical',
});
export const TAG_VALUES = Object.values(TAGS);
export const TAG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// HubSpot b3_service_tier value -> tier tag
export const TIERS = Object.freeze({
  'b3 Growth Lab': TAGS.TIER_GROWTH_LAB,
  'b3 1:1 Business Advisory Coaching': TAGS.TIER_ADVISORY,
  'b3 Executive Partner': TAGS.TIER_EXECUTIVE,
});
export const TIER_TAGS = Object.values(TIERS);

export const USER_STATUS = Object.freeze({ ACTIVE: 'active', SUSPENDED: 'suspended', REMOVED: 'removed' });
export const ADMIN_ROLES = Object.freeze({ OWNER: 'owner', CONTENT_ADMIN: 'content_admin', DEVELOPER: 'developer' });
export const CONTENT_STATUS = Object.freeze({ DRAFT: 'draft', LIVE: 'live', ARCHIVED: 'archived', REMOVED: 'removed' });
export const VIDEO_STATUS = Object.freeze({ NONE: 'none', UPLOADING: 'uploading', PROCESSING: 'processing', READY: 'ready', FAILED: 'failed' });
export const SYNC_STATUS = Object.freeze({ PENDING: 'Pending', PROVISIONED: 'Provisioned', REVOKED: 'Revoked', ERROR: 'Error' });
export const SYNC_ACTIONS = Object.freeze({ GRANT: 'grant', REVOKE: 'revoke', UPDATE: 'update' });
export const TOKEN_TYPES = Object.freeze({ INVITE: 'invite', RESET: 'reset', REFRESH: 'refresh' });
export const PRESENTATION = Object.freeze({ FLAT: 'flat', ARCHIVE: 'archive', COURSE_LIBRARY: 'course_library', INDEX: 'index' });

// Products are named by topic, never by tier.
export const PRODUCT_KEYS = Object.freeze({
  START_HERE: 'start-here',
  GROWTH_LAB_REPLAYS: 'growth-lab-replays',
  TRAINING_CORE: 'growth-system-training-core',
  TRAINING_ADVANCED: 'growth-system-training-advanced',
  RESOURCE_LIBRARY: 'resource-library',
});
export const OFFER_KEYS = Object.freeze({ ALL_ACCESS: 'portal-all-access', STAFF: 'portal-staff' });

export const ALLOWED_FILE_TYPES = Object.freeze({
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
});

export const ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  LINK_EXPIRED: 'LINK_EXPIRED',
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCESS_ENDED: 'ACCESS_ENDED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  INTERNAL: 'INTERNAL',
});
