// One response envelope everywhere: { success, data, meta } or { success:false, error }.
export const ok = (res, data = null, meta) => res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });
export const created = (res, data = null) => res.status(201).json({ success: true, data });
export const noContent = (res) => res.status(204).end();
export const paginated = (res, items, { page, limit, total }) =>
  ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
