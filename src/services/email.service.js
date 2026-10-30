// Templates + sends. Terminology: "clients", never "customers". Copy is supplied by Consult b3.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { env } from '../config/env.js';
import { send } from '../integrations/email/provider.js';
import * as audit from './audit.service.js';
import * as settings from './settings.service.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../integrations/email/templates');
const cacheTpl = new Map();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function render(name, vars) {
  if (!cacheTpl.has(name)) cacheTpl.set(name, await readFile(path.join(DIR, `${name}.html`), 'utf8'));
  const html = cacheTpl.get(name).replace(/{{(\w+)}}/g, (_, k) => esc(vars[k]));
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2: $1')
    .replace(/<br\s*\/?>|<\/p>|<\/h1>|<\/tr>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
  return { html, text };
}

async function deliver({ to, subject, tpl, vars, kind, userId, idempotencyKey }) {
  const { supportEmail } = await settings.getSupportInfo();
  const { html, text } = await render(tpl, { supportEmail, ...vars });
  const r = await send({ to, subject, html, text, idempotencyKey });
  await audit.log({ action: `email.${kind}`, entity: 'user', entityId: userId, after: { to, subject, providerId: r.id } }); // delivery log
  return r;
}

export const sendWelcome = (user, rawToken) => deliver({
  to: user.email, subject: 'Welcome to the b3 Growth Portal', tpl: 'welcome', kind: 'welcome', userId: user._id,
  vars: { firstName: user.firstName || 'there', actionUrl: `${env.CLIENT_URL}/set-password?token=${rawToken}`, buttonLabel: 'Set your password', expiresText: `This link works once and expires in ${env.INVITE_TTL_HOURS} hours. If it expires, use "Forgot password" on the login page.` },
});
export const sendReset = (user, rawToken, userType = 'member') => deliver({
  to: user.email, subject: 'Reset your b3 Growth Portal password', tpl: 'reset', kind: `reset.${userType}`, userId: user._id,
  vars: { firstName: user.firstName || 'there', actionUrl: `${userType === 'admin' ? env.ADMIN_URL : env.CLIENT_URL}/reset-password?token=${rawToken}`, buttonLabel: 'Choose a new password', expiresText: `This link works once and expires in ${env.RESET_TTL_MINUTES} minutes.` },
});
export const sendAdminInvite = (admin, rawToken) => deliver({
  to: admin.email, subject: 'You have been invited to the b3 Growth Portal admin', tpl: 'reset', kind: 'invite.admin', userId: admin._id,
  vars: { firstName: admin.firstName || 'there', actionUrl: `${env.ADMIN_URL}/set-password?token=${rawToken}`, buttonLabel: 'Set your password', expiresText: `This link works once and expires in ${env.INVITE_TTL_HOURS} hours.` },
});
export async function sendAccessEnded(user) {
  const { accessEndedMessage } = await settings.getSupportInfo();
  return deliver({ to: user.email, subject: 'Your b3 Growth Portal access has ended', tpl: 'access-ended', kind: 'access-ended', userId: user._id, vars: { firstName: user.firstName || 'there', message: accessEndedMessage } });
}
export async function sendSupportRequest(user, { subject, message }) {
  const { supportEmail } = await settings.getSupportInfo();
  const body = `<p>From: ${esc(user.firstName)} ${esc(user.lastName)} &lt;${esc(user.email)}&gt;</p><p>${esc(message).replace(/\n/g, '<br>')}</p>`;
  const r = await send({ to: supportEmail, subject: `[Portal support] ${subject}`, html: body, text: `From: ${user.email}\n\n${message}` });
  await audit.log({ action: 'email.support-request', entity: 'user', entityId: user._id, after: { subject } });
  return r;
}
