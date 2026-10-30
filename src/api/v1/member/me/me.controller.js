import { User } from '../../../../db/models/index.js';
import { getMemberLinks } from '../../../../services/settings.service.js';
import { sendSupportRequest } from '../../../../services/email.service.js';
import { ok } from '../../../../utils/response.js';

const dto = (u) => ({ id: String(u._id), email: u.email, firstName: u.firstName, lastName: u.lastName, company: u.company, lastLoginAt: u.lastLoginAt });
export const me = async (req, res) => ok(res, dto(await User.findById(req.user.id).lean()));
export const update = async (req, res) => ok(res, dto(await User.findByIdAndUpdate(req.user.id, { $set: req.valid.body }, { new: true }).lean()));
export const links = async (req, res) => ok(res, await getMemberLinks());
export const support = async (req, res) => { await sendSupportRequest(req.user, req.valid.body); ok(res, { sent: true }); };
