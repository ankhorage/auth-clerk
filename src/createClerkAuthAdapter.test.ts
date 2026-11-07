import { expect, test } from 'bun:test';

import { createClerkAuthAdapter } from './index.js';
import type { ClerkAuthConfig } from './types/clerk.js';

const session = { accessToken: 'token', user: { id: 'user_1' } };

/*** Create a deterministic Clerk boundary for adapter contract tests. */
function createConfig(overrides: Partial<ClerkAuthConfig> = {}): ClerkAuthConfig {
  return {
    public: { publishableKey: 'pk_test' },
    secretKey: 'sk_test',
    createAttemptId: () => 'attempt_1',
    createState: () => 'state_1',
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

test('consumes an OAuth attempt before exchanging a code', async () => {
  const adapter = createClerkAuthAdapter(createConfig());
  await adapter.startAuthorization({
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
  expect(await adapter.completeAuthorization(input)).toMatchObject({
    ok: true,
    status: 'authenticated',
  });
  expect(await adapter.completeAuthorization(input)).toMatchObject({
    ok: false,
    status: 'error',
    error: { code: 'authorization_attempt_not_found' },
  });
});

test('normalizes a rejected session token', async () => {
  const adapter = createClerkAuthAdapter(
    createConfig({ verifyJwt: () => Promise.reject(new Error('bad signature')) }),
  );
  expect(await adapter.getSession()).toMatchObject({
    ok: false,
    error: { code: 'invalid_session' },
  });
});
