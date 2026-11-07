import type {
  AuthResult,
  AuthSession,
  AuthUser,
  PasswordResetInput,
  SignInInput,
  SignOutInput,
  SignUpInput,
  VerifyOtpInput,
} from '@ankhorage/contracts/auth';

/*** Public, serializable Clerk configuration safe to share with a client application. */
export interface ClerkPublicConfig {
  publishableKey: string;
  issuer?: string;
  audience?: string | readonly string[];
}

/*** Map the host application's Clerk operations into the provider-neutral auth port. */
export interface ClerkTransport {
  signIn(input: SignInInput): Promise<AuthResult<AuthSession>>;
  signUp(input: SignUpInput): Promise<AuthResult<AuthSession | AuthUser>>;
  signOut(input?: SignOutInput): Promise<AuthResult>;
  getSession(): Promise<AuthResult<AuthSession | null>>;
  refreshSession(): Promise<AuthResult<AuthSession | null>>;
  requestPasswordReset(input: PasswordResetInput): Promise<AuthResult>;
  verifyOtp(input: VerifyOtpInput): Promise<AuthResult<AuthSession>>;
  startAuthorization(input: ClerkAuthorizationStartInput): Promise<ClerkAuthorizationStartResult>;
  exchangeAuthorizationCode(input: ClerkAuthorizationCodeInput): Promise<AuthSession>;
}

/*** Verify a token using the Clerk JWKS supplied by the adapter configuration. */
export type ClerkJwtVerifier = (input: ClerkJwtVerificationInput) => Promise<void>;

/*** Represent a Clerk JWKS key, including the identifier used to select it for a JWT. */
export interface ClerkJwk extends JsonWebKey {
  kid?: string;
}

export interface ClerkJwksResolver {
  getJwks(): Promise<{ keys: readonly ClerkJwk[] }>;
}

export interface ClerkJwtVerificationInput {
  token: string;
  issuer?: string;
  audience?: string | readonly string[];
  jwks: ClerkJwksResolver;
}

/*** Persist one OAuth attempt and atomically retire it before any callback is processed. */
export interface ClerkAuthorizationAttemptStore {
  create(attempt: ClerkAuthorizationAttempt): Promise<void>;
  consume(attemptId: string, now: number): Promise<ClerkAuthorizationAttempt | null>;
  purgeExpired(now: number): Promise<void>;
}

/*** Define the durable, short-lived state needed to bind an OAuth callback to its authorization. */
export interface ClerkAuthorizationAttempt {
  attemptId: string;
  provider: string;
  redirectUri: string;
  state: string;
  expiresAt: number;
}

export interface ClerkAuthorizationStartInput {
  provider: string;
  redirectUri: string;
  scopes?: readonly string[];
  queryParams?: Record<string, string>;
  state: string;
}

export interface ClerkAuthorizationStartResult {
  authorizationUrl: string;
}

export interface ClerkAuthorizationCodeInput {
  provider: string;
  redirectUri: string;
  code: string;
}

/*** Configure a Clerk transport adapter with durable OAuth state and JWT verification boundaries. */
export interface ClerkAuthConfig {
  public: ClerkPublicConfig;
  transport: ClerkTransport;
  verifyJwt?: ClerkJwtVerifier;
  jwks: ClerkJwksResolver;
  authorizationAttempts: ClerkAuthorizationAttemptStore;
  authorizationAttemptTtlMs?: number;
  createAttemptId?: () => string;
  createState?: () => string;
  now?: () => number;
}
