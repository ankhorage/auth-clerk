import type { AuthPort } from '@ankhorage/auth';
import type {
  AuthOAuthCompletionResult,
  AuthOAuthError,
  AuthOAuthStartResult,
  AuthResult,
  AuthSession,
} from '@ankhorage/contracts/auth';

import type { ClerkAuthConfig } from '../../../../types/clerk.js';
import { createClerkJwtVerifier } from './createClerkJwtVerifier.js';

const DEFAULT_AUTHORIZATION_ATTEMPT_TTL_MS = 10 * 60 * 1000;

/*** Create a framework-neutral Clerk implementation of the Ankhorage authentication port. */
export function createClerkAuthAdapter(config: ClerkAuthConfig): AuthPort {
  const verifySession = createSessionVerifier(config);
  return {
    signIn: async (input) =>
      verifyResult(await guardedResult(() => config.transport.signIn(input)), verifySession),
    signUp: async (input) =>
      verifyResult(await guardedResult(() => config.transport.signUp(input)), async (data) =>
        'accessToken' in data ? verifySession(data) : data,
      ),
    signOut: (input) => guardedResult(() => config.transport.signOut(input)),
    getSession: async () =>
      verifyResult(await guardedResult(() => config.transport.getSession()), verifySession),
    refreshSession: async () =>
      verifyResult(await guardedResult(() => config.transport.refreshSession()), verifySession),
    requestPasswordReset: (input) =>
      guardedResult(() => config.transport.requestPasswordReset(input)),
    verifyOtp: async (input) =>
      verifyResult(await guardedResult(() => config.transport.verifyOtp(input)), verifySession),
    startAuthorization: async (input) => startAuthorization(config, input),
    completeAuthorization: async (input) => completeAuthorization(config, input),
  };
}

/*** Verify every returned Clerk session before it crosses the provider boundary. */
function createSessionVerifier(config: ClerkAuthConfig) {
  return async <T extends AuthSession | null>(session: T): Promise<T> => {
    if (session === null) return session;
    await (config.verifyJwt ?? createClerkJwtVerifier())({
      token: session.accessToken,
      issuer: config.public.issuer,
      audience: config.public.audience,
      jwks: config.jwks,
    });
    return session;
  };
}

/*** Convert provider transport failures into secret-free portable errors. */
async function guardedResult<T>(operation: () => Promise<AuthResult<T>>): Promise<AuthResult<T>> {
  try {
    const result = await operation();
    return result.ok ? result : providerError<T>('provider_error', 'Clerk operation failed.');
  } catch {
    return providerError<T>('provider_error', 'Clerk operation failed.');
  }
}

/*** Normalize verified provider results without leaking provider exceptions. */
async function verifyResult<T>(
  result: AuthResult<T>,
  verifySession: (session: T) => Promise<T>,
): Promise<AuthResult<T>> {
  if (!result.ok || result.data === undefined) return result;
  try {
    return { ok: true, data: await verifySession(result.data) };
  } catch {
    return providerError<T>('invalid_session', 'Clerk rejected the session token.');
  }
}

/*** Start a single-use Clerk authorization-code attempt with an unguessable state value. */
async function startAuthorization(
  config: ClerkAuthConfig,
  input: Parameters<AuthPort['startAuthorization']>[0],
): Promise<AuthOAuthStartResult> {
  const attemptId = (config.createAttemptId ?? crypto.randomUUID)();
  const state = (config.createState ?? crypto.randomUUID)();
  try {
    const result = await config.transport.startAuthorization({ ...input, state });
    const now = getNow(config);
    await config.authorizationAttempts.purgeExpired(now);
    await config.authorizationAttempts.create({
      attemptId,
      provider: input.provider,
      redirectUri: input.redirectUri,
      state,
      expiresAt: now + (config.authorizationAttemptTtlMs ?? DEFAULT_AUTHORIZATION_ATTEMPT_TTL_MS),
    });
    return {
      ok: true,
      data: { attemptId, provider: input.provider, redirectUri: input.redirectUri, ...result },
    };
  } catch {
    return oauthStartError(input.provider);
  }
}

/*** Complete one Clerk code flow, rejecting missing, replayed, malformed, and mismatched callbacks. */
async function completeAuthorization(
  config: ClerkAuthConfig,
  input: Parameters<AuthPort['completeAuthorization']>[0],
): Promise<AuthOAuthCompletionResult> {
  const attempt = await consumeAuthorizationAttempt(config, input.attemptId);
  if (attempt === null) return oauthCompletionError('authorization_attempt_not_found', 'callback');
  if (input.response.type === 'cancelled') {
    return {
      ok: false,
      status: 'cancelled',
      provider: attempt.provider,
      reason: input.response.reason,
    };
  }
  if (input.response.type === 'error') {
    return oauthCompletionError('provider_error', 'transport', attempt.provider);
  }
  const callback = parseCallback(input.response.url);
  if (callback === null)
    return oauthCompletionError('invalid_callback', 'callback', attempt.provider);
  if (!hasExpectedRedirectUri(callback.url, attempt.redirectUri))
    return oauthCompletionError('invalid_callback', 'callback', attempt.provider);
  if (callback.state !== attempt.state)
    return oauthCompletionError('state_mismatch', 'callback', attempt.provider);
  if (callback.error !== undefined)
    return oauthCompletionError('provider_error', 'callback', attempt.provider);
  if (callback.code === undefined)
    return oauthCompletionError('invalid_callback', 'callback', attempt.provider);
  try {
    const session = await config.transport.exchangeAuthorizationCode({
      provider: attempt.provider,
      redirectUri: attempt.redirectUri,
      code: callback.code,
    });
    const verified = await createSessionVerifier(config)(session);
    return { ok: true, status: 'authenticated', provider: attempt.provider, session: verified };
  } catch {
    return oauthCompletionError('code_exchange_failed', 'exchange', attempt.provider);
  }
}

/*** Read only the standardized callback parameters from an authorization redirect. */
function parseCallback(url: string) {
  try {
    const callback = new URL(url);
    const params = callback.searchParams;
    return {
      url: callback,
      state: params.get('state'),
      code: params.get('code') ?? undefined,
      error: params.get('error') ?? undefined,
    };
  } catch {
    return null;
  }
}

/*** Require the callback to return to the redirect URI that started this authorization attempt. */
function hasExpectedRedirectUri(callback: URL, redirectUri: string): boolean {
  try {
    const expected = new URL(redirectUri);
    return callback.origin === expected.origin && callback.pathname === expected.pathname;
  } catch {
    return false;
  }
}

/*** Atomically consume an unexpired OAuth attempt while keeping store failures unobservable. */
async function consumeAuthorizationAttempt(config: ClerkAuthConfig, attemptId: string) {
  try {
    return await config.authorizationAttempts.consume(attemptId, getNow(config));
  } catch {
    return null;
  }
}

/*** Obtain the adapter clock so expiry decisions stay deterministic in tests and explicit in hosts. */
function getNow(config: ClerkAuthConfig): number {
  return (config.now ?? Date.now)();
}

/*** Normalize Clerk operation failures into the released Ankhorage result shape. */
function providerError<T>(code: string, message: string): AuthResult<T> {
  return { ok: false, error: { code, message } };
}

/*** Produce a released OAuth-start error without exposing sensitive callback data. */
function oauthStartError(provider: string): AuthOAuthStartResult {
  return { ok: false, error: oauthError('authorization_failed', 'start', provider) };
}

/*** Produce a released OAuth completion failure without exposing sensitive callback data. */
function oauthCompletionError(
  code:
    | 'authorization_attempt_not_found'
    | 'code_exchange_failed'
    | 'invalid_callback'
    | 'provider_error'
    | 'state_mismatch',
  stage: 'callback' | 'exchange' | 'transport',
  provider?: string,
): AuthOAuthCompletionResult {
  return { ok: false, status: 'error', error: oauthError(code, stage, provider) };
}

/*** Construct a released OAuth error without including raw provider payloads. */
function oauthError(
  code: AuthOAuthError['code'],
  stage: AuthOAuthError['stage'],
  provider?: string,
): AuthOAuthError {
  return {
    code,
    stage,
    recoverable: false,
    message: 'Clerk authorization failed.',
    provider,
  };
}
