// The b3_* contact properties from Technical Build Scope 6.1. Internal names are fixed before go-live.
export const HS = Object.freeze({
  ACCESS: 'b3_portal_access',
  TIER: 'b3_service_tier',
  LOGIN_EMAIL: 'b3_portal_login_email',
  SYNC_STATUS: 'b3_portal_sync_status',
  PROVISIONED_DATE: 'b3_portal_provisioned_date',
  REVOKED_DATE: 'b3_portal_revoked_date',
  SYNC_MESSAGE: 'b3_portal_sync_message',
});
export const HS_ACCESS = Object.freeze({ ACTIVE: 'Active', SUSPENDED: 'Suspended', REMOVED: 'Removed' });
export const HS_CONTACT_PROPS = ['email', 'firstname', 'lastname', 'company', ...Object.values(HS)];
