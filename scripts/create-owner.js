// npm run create-owner -- you@consultb3.com "TempPassw0rd!" Kristi Stanbery-Bedgood
import { connectDB, disconnectDB } from '../src/db/connection.js';
import { AdminUser } from '../src/db/models/index.js';
import { hashPassword, assertPasswordPolicy } from '../src/utils/password.js';
import { ADMIN_ROLES } from '../src/config/constants.js';

const [email, password, firstName = '', lastName = ''] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run create-owner -- <email> <password> [firstName] [lastName]');
  process.exit(1);
}
assertPasswordPolicy(password);
await connectDB();
await AdminUser.updateOne(
  { email: email.toLowerCase() },
  { $set: { firstName, lastName, role: ADMIN_ROLES.OWNER, active: true, passwordHash: await hashPassword(password) } },
  { upsert: true },
);
console.log(`Owner ready: ${email}`);
await disconnectDB();
