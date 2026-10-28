// npm run keys  -> prints the four JWT env lines (RS256). Paste into .env (API) and the public keys into each Next.js app.
import { generateKeyPairSync } from 'node:crypto';

const pair = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
const line = (name, pem) => `${name}="${pem.trim().replace(/\n/g, '\\n')}"`;

const member = pair();
const admin = pair();
console.log(line('JWT_MEMBER_PRIVATE_KEY', member.privateKey));
console.log(line('JWT_MEMBER_PUBLIC_KEY', member.publicKey));
console.log(line('JWT_ADMIN_PRIVATE_KEY', admin.privateKey));
console.log(line('JWT_ADMIN_PUBLIC_KEY', admin.publicKey));
console.log('\n# web app .env.local:  JWT_PUBLIC_KEY = the MEMBER public key\n# admin app .env.local: JWT_PUBLIC_KEY = the ADMIN public key');
