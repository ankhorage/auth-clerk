import { signJwt } from '@clerk/backend/jwt';
import { expect, test } from 'bun:test';

import { createClerkAuthAdapter } from './index.js';
import type {
  ClerkAuthConfig,
  ClerkAuthorizationAttempt,
  ClerkAuthorizationAttemptStore,
  ClerkJwk,
} from './types/clerk.js';

const session = { accessToken: 'token', user: { id: 'user_1' } };

/*** Create a durable test store whose atomic consume behavior is shared by adapter instances. */
function createAttemptStore(): ClerkAuthorizationAttemptStore {
  const attempts = new Map<string, ClerkAuthorizationAttempt>();
  return {
    create: (attempt) => {
      if (attempts.has(attempt.attemptId))
        return Promise.reject(new Error('attempt already exists'));
      attempts.set(attempt.attemptId, attempt);
      return Promise.resolve();
    },
    consume: (attemptId, now) => {
      const attempt = attempts.get(attemptId) ?? null;
      attempts.delete(attemptId);
      return Promise.resolve(attempt === null || attempt.expiresAt <= now ? null : attempt);
    },
    purgeExpired: (now) => {
      for (const [attemptId, attempt] of attempts) {
        if (attempt.expiresAt <= now) attempts.delete(attemptId);
      }
      return Promise.resolve();
    },
  };
}

/*** Create a deterministic Clerk boundary for adapter contract tests. */
function createConfig(overrides: Partial<ClerkAuthConfig> = {}): ClerkAuthConfig {
  return {
    public: { publishableKey: 'pk_test' },
    createAttemptId: () => 'attempt_1',
    createState: () => 'state_1',
    now: () => 1_000,
    authorizationAttempts: createAttemptStore(),
    jwks: { getJwks: () => Promise.resolve({ keys: [] }) },
    verifyJwt: () => Promise.resolve(),
    transport: {
      signIn: () => Promise.resolve({ ok: true, data: session }),
      signUp: () => Promise.resolve({ ok: true, data: session.user }),
      signOut: () => Promise.resolve({ ok: true }),
      getSession: () => Promise.resolve({ ok: true, data: session }),
      refreshSession: () => Promise.resolve({ ok: true, data: session }),
      requestPasswordReset: () => Promise.resolve({ ok: true }),
      verifyOtp: () => Promise.resolve({ ok: true, data: session }),
      startAuthorization: () =>
        Promise.resolve({ authorizationUrl: 'https://clerk.example/authorize' }),
      exchangeAuthorizationCode: () => Promise.resolve(session),
    },
    ...overrides,
  };
}

/*** Create an RS256 token and matching public key for the real Clerk JWT verifier. */
async function createSignedToken(): Promise<{ token: string; publicKey: ClerkJwk }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const now = Math.floor(Date.now() / 1_000);
  return {
    token: await signJwt(
      {
        iss: 'https://issuer.example',
        sub: 'user_1',
        sid: 'session_1',
        iat: now,
        nbf: now,
        exp: now + 60,
      },
      privateKey,
      { algorithm: 'RS256', header: { kid: 'key_1' } },
    ),
    publicKey: { ...publicKey, kid: 'key_1' },
  };
}

test('rejects an OAuth callback with a mismatched state', async () => {
  const adapter = createClerkAuthAdapter(createConfig());
  await adapter.startAuthorization({
    provider: 'google',
    redirectUri: 'https://app.example/callback',
  });
  const result = await adapter.completeAuthorization({
    attemptId: 'attempt_1',
    response: { type: 'callback', url: 'https://app.example/callback?code=code_1&state=other' },
  });
  expect(result).toMatchObject({ ok: false, status: 'error', error: { code: 'state_mismatch' } });
});

test('atomically consumes OAuth attempts across adapter instances', async () => {
  const authorizationAttempts = createAttemptStore();
  const config = createConfig({ authorizationAttempts });
  const firstAdapter = createClerkAuthAdapter(config);
  const secondAdapter = createClerkAuthAdapter(config);
  await firstAdapter.startAuthorization({
    provider: 'google',
    redirectUri: 'https://app.example/callback',
  });
  const input = {
    attemptId: 'attempt_1',
    response: {
      type: 'callback' as const,
      url: 'https://app.example/callback?code=code_1&state=state_1',
    },
  };
  const results = await Promise.all([
    firstAdapter.completeAuthorization(input),
    secondAdapter.completeAuthorization(input),
  ]);
  expect(results.filter((result) => result.ok)).toHaveLength(1);
  expect(results.filter((result) => !result.ok && result.status === 'error')).toHaveLength(1);
});

test('rejects an expired OAuth attempt', async () => {
  let now = 1_000;
  const adapter = createClerkAuthAdapter(
    createConfig({ authorizationAttemptTtlMs: 1, now: () => now }),
  );
  await adapter.startAuthorization({
    provider: 'google',
    redirectUri: 'https://app.example/callback',
  });
  now = 1_002;
  expect(
    await adapter.completeAuthorization({
      attemptId: 'attempt_1',
      response: { type: 'callback', url: 'https://app.example/callback?code=code_1&state=state_1' },
    }),
  ).toMatchObject({ error: { code: 'authorization_attempt_not_found' } });
});

test('handles OAuth attempt store failures without exposing the storage error', async () => {
  const secret = 'sk_test_secret';
  const authorizationAttempts: ClerkAuthorizationAttemptStore = {
    create: () => Promise.reject(new Error(secret)),
    consume: () => Promise.reject(new Error(secret)),
    purgeExpired: () => Promise.resolve(),
  };
  const adapter = createClerkAuthAdapter(createConfig({ authorizationAttempts }));
  const start = await adapter.startAuthorization({
    provider: 'google',
    redirectUri: 'https://app.example/callback',
  });
  const complete = await adapter.completeAuthorization({
    attemptId: 'attempt_1',
    response: { type: 'callback', url: 'https://app.example/callback?code=code_1&state=state_1' },
  });
  expect(JSON.stringify({ start, complete })).not.toContain(secret);
  expect(complete).toMatchObject({ error: { code: 'authorization_attempt_not_found' } });
});

test('verifies a session with the configured JWKS through the default verifier', async () => {
  const { token, publicKey } = await createSignedToken();
  let jwksReads = 0;
  const adapter = createClerkAuthAdapter(
    createConfig({
      public: { publishableKey: 'pk_test', issuer: 'https://issuer.example' },
      verifyJwt: undefined,
      jwks: {
        getJwks: () => {
          jwksReads += 1;
          return Promise.resolve({ keys: [publicKey] });
        },
      },
      transport: {
        ...createConfig().transport,
        getSession: () => Promise.resolve({ ok: true, data: { ...session, accessToken: token } }),
      },
    }),
  );
  expect(await adapter.getSession()).toMatchObject({ ok: true, data: { accessToken: token } });
  expect(jwksReads).toBe(1);
});

test('rejects a session signed by a key outside the configured JWKS', async () => {
  const [{ token }, { publicKey }] = await Promise.all([createSignedToken(), createSignedToken()]);
  const adapter = createClerkAuthAdapter(
    createConfig({
      verifyJwt: undefined,
      jwks: { getJwks: () => Promise.resolve({ keys: [publicKey] }) },
      transport: {
        ...createConfig().transport,
        getSession: () => Promise.resolve({ ok: true, data: { ...session, accessToken: token } }),
      },
    }),
  );
  expect(await adapter.getSession()).toMatchObject({
    ok: false,
    error: { code: 'invalid_session' },
  });
});

test('redacts authorization codes, tokens, secrets, and callback URLs from returned failures', async () => {
  const sensitive = 'code=code_1 access_token=token_1 sk_test_secret https://app.example/callback';
  const adapter = createClerkAuthAdapter(
    createConfig({
      verifyJwt: () => Promise.reject(new Error(sensitive)),
      transport: {
        ...createConfig().transport,
        getSession: () => Promise.resolve({ ok: true, data: session }),
        exchangeAuthorizationCode: () => Promise.reject(new Error(sensitive)),
      },
    }),
  );
  const sessionResult = await adapter.getSession();
  await adapter.startAuthorization({
    provider: 'google',
    redirectUri: 'https://app.example/callback',
  });
  const exchangeResult = await adapter.completeAuthorization({
    attemptId: 'attempt_1',
    response: { type: 'callback', url: 'https://app.example/callback?code=code_1&state=state_1' },
  });
  expect(JSON.stringify({ sessionResult, exchangeResult })).not.toContain(sensitive);
});

test('verifies sign-in and sign-up sessions before releasing them to consumers', async () => {
  const verified: string[] = [];
  const config = createConfig();
  const adapter = createClerkAuthAdapter(
    createConfig({
      verifyJwt: ({ token }) => {
        verified.push(token);
        return Promise.resolve();
      },
      transport: {
        ...config.transport,
        signUp: () => Promise.resolve({ ok: true, data: session }),
      },
    }),
  );

  expect(
    await adapter.signIn({ identifier: { kind: 'email', value: 'test@example.org' } }),
  ).toMatchObject({ ok: true, data: session });
  expect(
    await adapter.signUp({ identifier: { kind: 'email', value: 'test@example.org' } }),
  ).toMatchObject({ ok: true, data: session });
  expect(verified).toEqual(['token', 'token']);
});

test('rejects unverified sessions from both initial authentication operations', async () => {
  const config = createConfig();
  const adapter = createClerkAuthAdapter(
    createConfig({
      verifyJwt: () => Promise.reject(new Error('sensitive verifier details')),
      transport: {
        ...config.transport,
        signUp: () => Promise.resolve({ ok: true, data: session }),
      },
    }),
  );

  const signIn = await adapter.signIn({
    identifier: { kind: 'email', value: 'test@example.org' },
  });
  const signUp = await adapter.signUp({
    identifier: { kind: 'email', value: 'test@example.org' },
  });

  expect(signIn).toMatchObject({ ok: false, error: { code: 'invalid_session' } });
  expect(signUp).toMatchObject({ ok: false, error: { code: 'invalid_session' } });
  expect(JSON.stringify({ signIn, signUp })).not.toContain('sensitive verifier details');
});

test('redacts transport errors for authentication and lifecycle operations', async () => {
  const sensitive = 'sk_test_sensitive provider error';
  const config = createConfig();
  const adapter = createClerkAuthAdapter(
    createConfig({
      transport: {
        ...config.transport,
        signIn: () => Promise.reject(new Error(sensitive)),
        signOut: () =>
          Promise.resolve({ ok: false, error: { code: 'remote', message: sensitive } }),
        getSession: () => Promise.reject(new Error(sensitive)),
        requestPasswordReset: () => Promise.reject(new Error(sensitive)),
      },
    }),
  );

  const input = { identifier: { kind: 'email' as const, value: 'test@example.org' } };
  const values = [
    await adapter.signIn(input),
    await adapter.signOut(),
    await adapter.getSession(),
    await adapter.requestPasswordReset(input),
  ];
  for (const value of values) {
    expect(value).toMatchObject({ ok: false, error: { code: 'provider_error' } });
  }
  expect(JSON.stringify(values)).not.toContain(sensitive);
});
