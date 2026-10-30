// Attaches req.actor (who is doing this) so services can write audit entries.
export const actorOf = (req) => ({ type: 'admin', id: req.admin?.id, email: req.admin?.email, role: req.admin?.role, ip: req.ip });
export function auditLog(req, res, next) {
  if (req.admin) req.actor = actorOf(req);
  next();
}
