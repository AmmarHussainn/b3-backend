import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { env } from '../config/env.js';
import { ERROR_CODES } from '../config/constants.js';
import { ApiError } from './ApiError.js';

// RS256: only this API holds the private keys. The Next.js apps get the PUBLIC key
// so their middleware can verify tokens without being able to mint them.
const ALG = 'RS256';
const AUD = { member: 'b3-member', admin: 'b3-admin' }; // member tokens can never open admin routes
const keys = new Map();

const privKey = (kind) => {
  const k = `${kind}:private`;
  if (!keys.has(k)) keys.set(k, importPKCS8(kind === 'member' ? env.JWT_MEMBER_PRIVATE_KEY : env.JWT_ADMIN_PRIVATE_KEY, ALG));
  return keys.get(k);
};
const pubKey = (kind) => {
  const k = `${kind}:public`;
  if (!keys.has(k)) keys.set(k, importSPKI(kind === 'member' ? env.JWT_MEMBER_PUBLIC_KEY : env.JWT_ADMIN_PUBLIC_KEY, ALG));
  return keys.get(k);
};

/** kind: 'member' | 'admin'. Claims stay small: sub, status/role, ver (tokenVersion). */
export async function signAccessToken(kind, { sub, ...claims }) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(sub))
    .setIssuer(env.JWT_ISSUER)
    .setAudience(AUD[kind])
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TTL_SECONDS}s`)
    .sign(await privKey(kind));
}

export async function verifyAccessToken(kind, token) {
  try {
    const { payload } = await jwtVerify(token, await pubKey(kind), {
      issuer: env.JWT_ISSUER,
      audience: AUD[kind],
      algorithms: [ALG],
    });
    return payload;
  } catch (err) {
    const expired = err?.code === 'ERR_JWT_EXPIRED';
    throw ApiError.unauthorized(expired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID, expired ? 'Session expired' : 'Invalid session');
  }
}
