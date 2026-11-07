import type { AuthPort } from '@ankhorage/auth';
import type {
  AuthOAuthCompletionResult,
  AuthOAuthError,
  AuthOAuthStartResult,
  AuthResult,
  AuthSession,
} from '@ankhorage/contracts/auth';
import { verifyToken } from '@clerk/backend';

import type { ClerkAuthConfig } from '../../../../types/clerk.js';

interface AuthorizationAttempt {
  provider: string;
  redirectUri: string;
  state: string;
}

/*** Create a framework-neutral Clerk implementation of the Ankhorage authentication port. */
export function createClerkAuthAdapter(config: ClerkAuthConfig): AuthPort {
  const attempts = new Map<string, AuthorizationAttempt>();
  const verifySession = createSessionVerifier(config);
  return {
    signIn: (input) => config.transport.signIn(input),
    signUp: (input) => config.transport.signUp(input),
    signOut: (input) => config.transport.signOut(input),
    getSession: async () => verifyResult(await config.transport.getSession(), verifySession),
    refreshSession: async () =>
      verifyResult(await config.transport.refreshSession(), verifySession),
    requestPasswordReset: (input) => config.transport.requestPasswordReset(input),
    verifyOtp: async (input) =>
      verifyResult(await config.transport.verifyOtp(input), verifySession),
    startAuthorization: async (input) => startAuthorization(config, attempts, input),
    completeAuthorization: async (input) => completeAuthorization(config, attempts, input),
  };
}

/*** Verify every returned Clerk session before it crosses the provider boundary. */
function createSessionVerifier(config: ClerkAuthConfig) {
  return async <T extends AuthSession | null>(session: T): Promise<T> => {
    if (session === null) return session;
    await (config.verifyJwt ?? createClerkJwtVerifier(config))({
      token: session.accessToken,
      issuer: config.public.issuer,
      audience: config.public.audience,
      jwks: config.jwks,
    });
    return session;
  };
}

/*** Normalize verified provider results without leaking provider exceptions. */
async function verifyResult<T extends AuthSession | null>(
  result: AuthResult<T>,
  verifySession: (session: T) => Promise<T>,
): Promise<AuthResult<T>> {
  if (!result.ok || result.data === undefined) return result;
  try {
    return { ok: true, data: await verifySession(result.data) };
  } catch (cause) {
    return providerError<T>('invalid_session', 'Clerk rejected the session token.', cause);
  }
}

/*** Start a single-use Clerk authorization-code attempt with an unguessable state value. */
async function startAuthorization(
  config: ClerkAuthConfig,
  attempts: Map<string, AuthorizationAttempt>,
  input: Parameters<AuthPort['startAuthorization']>[0],
): Promise<AuthOAuthStartResult> {
  const attemptId = (config.createAttemptId ?? crypto.randomUUID)();
  const state = (config.createState ?? crypto.randomUUID)();
  try {
    const result = await config.transport.startAuthorization({ ...input, state });
    attempts.set(attemptId, { provider: input.provider, redirectUri: input.redirectUri, state });
    return {
      ok: true,
      data: { attemptId, provider: input.provider, redirectUri: input.redirectUri, ...result },
    };
  } catch (cause) {
    return oauthStartError(input.provider, cause);
  }
}

/*** Complete one Clerk code flow, rejecting missing, replayed, malformed, and mismatched callbacks. */
async function completeAuthorization(
  config: ClerkAuthConfig,
  attempts: Map<string, AuthorizationAttempt>,
  input: Parameters<AuthPort['completeAuthorization']>[0],
): Promise<AuthOAuthCompletionResult> {
  if (input.response.type === 'cancelled') {
    return { ok: false, status: 'cancelled', provider: '', reason: input.response.reason };
  }
  if (input.response.type === 'error') {
    return oauthCompletionError('provider_error', 'transport', undefined, input.response.error);
  }
  const attempt = attempts.get(input.attemptId);
  if (attempt === undefined)
    return oauthCompletionError('authorization_attempt_not_found', 'callback');
  attempts.delete(input.attemptId);
  const callback = parseCallback(input.response.url);
  if (callback === null)
    return oauthCompletionError('invalid_callback', 'callback', attempt.provider);
  if (callback.state !== attempt.state)
    return oauthCompletionError('state_mismatch', 'callback', attempt.provider);
  if (callback.error !== undefined)
    return oauthCompletionError('provider_error', 'callback', attempt.provider, callback.error);
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
  } catch (cause) {
    return oauthCompletionError('code_exchange_failed', 'exchange', attempt.provider, cause);
  }
}

/*** Read only the standardized callback parameters from an authorization redirect. */
function parseCallback(url: string) {
  try {
    const params = new URL(url).searchParams;
    return {
      state: params.get('state'),
      code: params.get('code') ?? undefined,
      error: params.get('error') ?? undefined,
    };
  } catch {
    return null;
  }
}

/*** Normalize Clerk operation failures into the released Ankhorage result shape. */
function providerError<T>(code: string, message: string, cause: unknown): AuthResult<T> {
  return { ok: false, error: { code, message, cause } };
}

/*** Produce a released OAuth-start error without exposing sensitive callback data. */
function oauthStartError(provider: string, cause: unknown): AuthOAuthStartResult {
  return { ok: false, error: oauthError('authorization_failed', 'start', provider, cause) };
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
  cause?: unknown,
): AuthOAuthCompletionResult {
  return { ok: false, status: 'error', error: oauthError(code, stage, provider, cause) };
}

/*** Construct a released OAuth error without including raw provider payloads. */
function oauthError(
  code: AuthOAuthError['code'],
  stage: AuthOAuthError['stage'],
  provider?: string,
  cause?: unknown,
): AuthOAuthError {
  return {
    code,
    stage,
    recoverable: false,
    message: 'Clerk authorization failed.',
    provider,
    cause,
  };
}

/*** Verify Clerk-issued JWTs through the supported backend SDK verification surface. */
function createClerkJwtVerifier(config: ClerkAuthConfig) {
  return async ({
    token,
    issuer,
    audience,
  }: Parameters<NonNullable<ClerkAuthConfig['verifyJwt']>>[0]) =>
    verifyToken(token, {
      secretKey: config.secretKey,
      ...(issuer === undefined ? {} : { issuer }),
      ...(audience === undefined
        ? {}
        : { audience: [...(typeof audience === 'string' ? [audience] : audience)] }),
    });
}
