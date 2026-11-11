# Clerk OAuth authorization lifecycle

`@ankhorage/auth-clerk` treats Clerk as the authority for identities and sessions. The adapter does
not infer account links, merge users, or persist provider credentials.

Each OAuth authorization starts with a fresh adapter-generated attempt ID and state value. The
host provides a persistent `ClerkAuthorizationAttemptStore`; it must atomically consume unexpired
attempts and purge expired records. The callback must reference that attempt, return its exact
state, and target the registered redirect URI. The attempt is consumed before the authorization
code is exchanged, so a callback cannot be replayed across adapter instances or process restarts.
Missing, malformed, replayed, expired, or state-mismatched callbacks return the released typed OAuth
error rather than attempting an exchange.

Every session returned by a Clerk operation or code exchange is verified before it crosses the
provider boundary. The default verifier selects the token `kid` from the configured JWKS and uses
Clerk's supported JWT verification API to validate signature, expiry, issuer, and audience.
Consumers can inject a JWT verifier for deterministic tests or a controlled policy. Returned errors
are classified without carrying provider causes, callback URLs, tokens, authorization codes, or
other provider payloads.

This package owns the secure boundary around a caller-supplied `ClerkTransport`; the host remains
responsible for selecting the platform-specific Clerk client or browser transport. It deliberately
does not claim to implement UI or platform transport behavior itself.
