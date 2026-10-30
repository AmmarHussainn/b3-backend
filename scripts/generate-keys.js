// Prints the four JWT key lines for .env. Plain Node, no project imports (env.js needs these keys to start).
import { generateKeyPairSync } from 'node:crypto';

const pair = () => generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const line = (name, pem) => `${name}="${pem.trim().replace(/\n/g, '\\n')}"`;
const m = pair(); const a = pair();
console.log([line('JWT_MEMBER_PRIVATE_KEY', m.privateKey), line('JWT_MEMBER_PUBLIC_KEY', m.publicKey), line('JWT_ADMIN_PRIVATE_KEY', a.privateKey), line('JWT_ADMIN_PUBLIC_KEY', a.publicKey)].join('\n'));
console.error('\nPaste into .env. Give the web apps only the PUBLIC keys. Never commit private keys.');
