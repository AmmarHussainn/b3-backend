// npm run create-owner -- --email kristi@consultb3.com --first Kristi --last Stanbery-Bedgood [--password 'Long-pass-123']
// Without --password it prints a one-time set-password link (valid INVITE_TTL_HOURS).
import { connectDb, disconnectDb } from '../src/db/connection.js';
import { AdminUser } from '../src/db/models/index.js';
import { ADMIN_ROLES } from '../src/config/constants.js';
import { env } from '../src/config/env.js';
import * as pw from '../src/utils/password.js';
import * as tokens from '../src/services/token.service.js';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const email = arg('email')?.toLowerCase();
if (!email) { console.error('--email is required'); process.exit(1); }
await connectDb();
let a = await AdminUser.findOne({ email });
if (!a) a = await AdminUser.create({ email, firstName: arg('first'), lastName: arg('last'), role: ADMIN_ROLES.OWNER, active: true });
if (arg('password')) { pw.assertPolicy(arg('password')); a.passwordHash = await pw.hash(arg('password')); await a.save(); console.log(`Owner ${email} ready. Sign in with the password you set.`); }
else console.log(`Owner ${email} ready. Set a password here:\n${env.ADMIN_URL}/set-password?token=${await tokens.issueInvite(a._id, 'admin')}`);
await disconnectDb();
