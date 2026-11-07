import { decodeJwt, verifyJwt } from '@clerk/backend/jwt';

import type { ClerkJwtVerifier } from '../../../../types/clerk.js';

/*** Create the default Clerk JWT verifier from the explicitly configured JWKS boundary. */
export function createClerkJwtVerifier(): ClerkJwtVerifier {
  return async ({ token, issuer, audience, jwks }) => {
    const decoded = decodeJwt(token);
    const key = (await jwks.getJwks()).keys.find(
      (candidate) => candidate.kid === decoded.header.kid,
    );
    if (key === undefined) throw new Error('The token signing key is not in the configured JWKS.');
    await verifyJwt(token, {
      key,
      ...(issuer === undefined ? {} : { issuer }),
      ...(audience === undefined
        ? {}
        : { audience: typeof audience === 'string' ? audience : [...audience] }),
    });
  };
}
