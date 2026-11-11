# Public API

## ClerkAuthConfig

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:65:1`

Server-only configuration for a Clerk adapter. Never expose `secretKey` to a client.

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| createAttemptId | property | `(() => string) \| undefined` | no |  |
| createState | property | `(() => string) \| undefined` | no |  |
| jwks | property | `ClerkJwksResolver` | yes |  |
| public | property | `ClerkPublicConfig` | yes |  |
| secretKey | property | `string` | yes |  |
| transport | property | `ClerkTransport` | yes |  |
| verifyJwt | property | `ClerkJwtVerifier \| undefined` | no |  |

## ClerkAuthorizationCodeInput

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:58:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| code | property | `string` | yes |  |
| provider | property | `string` | yes |  |
| redirectUri | property | `string` | yes |  |

## ClerkAuthorizationStartInput

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:46:1`

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
Source: `src/types/clerk.ts:54:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| authorizationUrl | property | `string` | yes |  |

## ClerkJwksResolver

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:35:1`

### Members

| Name | Kind | Type | Required | Description |
| --- | --- | --- | --- | --- |
| getJwks | method | `() => Promise<{ keys: readonly JsonWebKey[]; }>` | yes |  |

## ClerkJwtVerificationInput

Kind: `type`
Module: `src/types/clerk.ts`
Source: `src/types/clerk.ts:39:1`

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

The server-side Clerk operations used by the adapter. Secrets remain inside this boundary.

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
Source: `src/features/auth/adapters/clerk/createClerkAuthAdapter.ts:20:1`

Create a framework-neutral Clerk implementation of the Ankhorage authentication port.

### Signatures

- `(config: ClerkAuthConfig) => AuthPort`
  - config: `ClerkAuthConfig`
  - returns: `AuthPort`
