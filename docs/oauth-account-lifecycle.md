# Clerk OAuth authorization lifecycle

`@ankhorage/auth-clerk` treats Clerk as the authority for identities and sessions. The adapter does
not infer account links, merge users, or persist provider credentials.

Each OAuth authorization starts with a fresh adapter-generated attempt ID and state value. The
callback must reference that attempt and return its exact state. The attempt is consumed before the
authorization code is exchanged, so a callback cannot be replayed. Missing, malformed, replayed,
or state-mismatched callbacks return the released typed OAuth error rather than attempting an
exchange.

Every session returned by a Clerk operation or code exchange is verified before it crosses the
provider boundary. The default verifier uses Clerk's supported server SDK. Consumers can inject a
JWT verifier and JWKS resolver for deterministic tests or a controlled key-retrieval policy. Secret
keys remain server-only; `ClerkPublicConfig` contains only serializable public configuration.
