# Public API

## ClerkAuthConfig

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:86:1`

Configure a Clerk transport adapter with durable OAuth state and JWT verification boundaries.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| authorizationAttempts | property | `ClerkAuthorizationAttemptStore` | yes |  |
| authorizationAttemptTtlMs | property | `number \| undefined` | no |  |
| createAttemptId | property | `(() => string) \| undefined` | no |  |
| createState | property | `(() => string) \| undefined` | no |  |
| jwks | property | `ClerkJwksResolver` | yes |  |
| now | property | `(() => number) \| undefined` | no |  |
| public | property | `ClerkPublicConfig` | yes |  |
| transport | property | `ClerkTransport` | yes |  |
| verifyJwt | property | `ClerkJwtVerifier \| undefined` | no |  |

## ClerkAuthorizationAttempt

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:59:1`

Define the durable, short-lived state needed to bind an OAuth callback to its authorization.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| attemptId | property | `string` | yes |  |
| expiresAt | property | `number` | yes |  |
| provider | property | `string` | yes |  |
| redirectUri | property | `string` | yes |  |
| state | property | `string` | yes |  |

## ClerkAuthorizationAttemptStore

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:52:1`

Persist one OAuth attempt and atomically retire it before any callback is processed.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| consume | method | `(attemptId: string, now: number) => Promise<ClerkAuthorizationAttempt \| null>` | yes |  |
| create | method | `(attempt: ClerkAuthorizationAttempt) => Promise<void>` | yes |  |
| purgeExpired | method | `(now: number) => Promise<void>` | yes |  |

## ClerkAuthorizationCodeInput

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:79:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `string` | yes |  |
| provider | property | `string` | yes |  |
| redirectUri | property | `string` | yes |  |

## ClerkAuthorizationStartInput

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:67:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| provider | property | `string` | yes |  |
| queryParams | property | `Record<string, string> \| undefined` | no |  |
| redirectUri | property | `string` | yes |  |
| scopes | property | `readonly string[] \| undefined` | no |  |
| state | property | `string` | yes |  |

## ClerkAuthorizationStartResult

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:75:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| authorizationUrl | property | `string` | yes |  |

## ClerkJwk

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:36:1`

Represent a Clerk JWKS key, including the identifier used to select it for a JWT.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| alg | property | `string \| undefined` | no |  |
| crv | property | `string \| undefined` | no |  |
| d | property | `string \| undefined` | no |  |
| dp | property | `string \| undefined` | no |  |
| dq | property | `string \| undefined` | no |  |
| e | property | `string \| undefined` | no |  |
| ext | property | `boolean \| undefined` | no |  |
| k | property | `string \| undefined` | no |  |
| key_ops | property | `string[] \| undefined` | no |  |
| kid | property | `string \| undefined` | no |  |
| kty | property | `string \| undefined` | no |  |
| n | property | `string \| undefined` | no |  |
| oth | property | `RsaOtherPrimesInfo[] \| undefined` | no |  |
| p | property | `string \| undefined` | no |  |
| q | property | `string \| undefined` | no |  |
| qi | property | `string \| undefined` | no |  |
| use | property | `string \| undefined` | no |  |
| x | property | `string \| undefined` | no |  |
| y | property | `string \| undefined` | no |  |

## ClerkJwksResolver

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:40:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| getJwks | method | `() => Promise<{ keys: readonly ClerkJwk[]; }>` | yes |  |

## ClerkJwtVerificationInput

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:44:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| audience | property | `string \| readonly string[] \| undefined` | no |  |
| issuer | property | `string \| undefined` | no |  |
| jwks | property | `ClerkJwksResolver` | yes |  |
| token | property | `string` | yes |  |

## ClerkJwtVerifier

Kind: `unknown`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:33:1`

Verify a token using the Clerk JWKS supplied by the adapter configuration.

## ClerkPublicConfig

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:13:1`

Public, serializable Clerk configuration safe to share with a client application.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| audience | property | `string \| readonly string[] \| undefined` | no |  |
| issuer | property | `string \| undefined` | no |  |
| publishableKey | property | `string` | yes |  |

## ClerkTransport

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:20:1`

Map the host application's Clerk operations into the provider-neutral auth port.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| exchangeAuthorizationCode | method | `(input: ClerkAuthorizationCodeInput) => Promise<AuthSession>` | yes |  |
| getSession | method | `() => Promise<AuthResult<AuthSession \| null>>` | yes |  |
| refreshSession | method | `() => Promise<AuthResult<AuthSession \| null>>` | yes |  |
| requestPasswordReset | method | `(input: PasswordResetInput) => Promise<AuthResult>` | yes |  |
| signIn | method | `(input: SignInInput) => Promise<AuthResult<AuthSession>>` | yes |  |
| signOut | method | `(input?: SignOutInput) => Promise<AuthResult>` | yes |  |
| signUp | method | `(input: SignUpInput) => Promise<AuthResult<AuthSession \| AuthUser>>` | yes |  |
| startAuthorization | method | `(input: ClerkAuthorizationStartInput) => Promise<ClerkAuthorizationStartResult>` | yes |  |
| verifyOtp | method | `(input: VerifyOtpInput) => Promise<AuthResult<AuthSession>>` | yes |  |

## createClerkAuthAdapter

Kind: `function`
Module: `src/features/auth/adapters/clerk/createClerkAuthAdapter.ts`
Source: `src/features/auth/adapters/clerk/createClerkAuthAdapter.ts:16:1`

Create a framework-neutral Clerk implementation of the Ankhorage authentication port.

### Signatures

- `(config: ClerkAuthConfig) => AuthPort`
  - config: `ClerkAuthConfig`
  - returns: `AuthPort`
