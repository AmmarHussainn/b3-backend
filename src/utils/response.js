// One success envelope: { data, meta? }.  Errors use { error: { code, message, details, requestId } }.
export const ok = (res, data = null, meta) => res.status(200).json(meta ? { data, meta } : { data });
export const created = (res, data) => res.status(201).json({ data });
export const accepted = (res, data) => res.status(202).json({ data });
export const noContent = (res) => res.status(204).end();
export const paginated = (res, { items, total, page, limit, extra = {} }) =>
  res.status(200).json({ data: items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), ...extra } });
