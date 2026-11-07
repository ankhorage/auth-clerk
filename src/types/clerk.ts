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

/*** The server-side Clerk operations used by the adapter. Secrets remain inside this boundary. */
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

export interface ClerkJwksResolver {
  getJwks(): Promise<{ keys: readonly JsonWebKey[] }>;
}

export interface ClerkJwtVerificationInput {
  token: string;
  issuer?: string;
  audience?: string | readonly string[];
  jwks: ClerkJwksResolver;
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

/*** Server-only configuration for a Clerk adapter. Never expose `secretKey` to a client. */
export interface ClerkAuthConfig {
  public: ClerkPublicConfig;
  secretKey: string;
  transport: ClerkTransport;
  verifyJwt?: ClerkJwtVerifier;
  jwks: ClerkJwksResolver;
  createAttemptId?: () => string;
  createState?: () => string;
}
