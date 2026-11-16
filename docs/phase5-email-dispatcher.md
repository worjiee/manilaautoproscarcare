# Phase 5.2 email dispatcher

Phase 5.2 is implemented but intentionally dormant. Applying its migration does
not activate delivery, create a schedule, or send an email.

## Safety gates

Delivery requires all three independent conditions:

1. `EMAIL_DELIVERY_MODE` is explicitly set to `development` or `production`.
2. The trusted caller supplies `EMAIL_DISPATCH_SECRET` to the POST-only job route.
3. The singleton `email_dispatch_control` row is enabled by the database owner
   with a reviewed `activation_cutoff_at` value.

The migration creates the singleton disabled. There is deliberately no
service-role activation RPC. Events older than the cutoff are atomically moved
to `dead_letter` with `ACTIVATION_CUTOFF` and can never be claimed.
Every activation, cutoff change, and deactivation is captured by an immutable
database audit trigger with an owner-supplied actor and reason. A separate
owner-only, non-replay function records any future historical replay approval.

## Processing model

- Domain events remain atomic with booking audit writes.
- A worker claims outbox events using short, token-bound leases and
  `FOR UPDATE SKIP LOCKED`.
- Rendering creates one recipient-specific delivery per address. The exact
  sender, recipient, subject, HTML, text, template identity, and stable
  idempotency key are encrypted and frozen before contacting Resend.
- Every retry decrypts the same frozen payload. It never re-renders from current
  booking fields or current template code.
- Delivery claims use independent leases. Resend retries reuse the exact same
  idempotency key, including after an ambiguous timeout.
- Every provider attempt is appended to `email_delivery_attempts`.
- Retryable failures use bounded retries; exhausted or permanent failures move
  to a terminal state. Expired leases are recovered safely.
- No scheduler is installed in this phase.

## Management links

Only events that can still be managed request links. The worker receives an
AES-256-GCM envelope only when its booking tokens are current, unused,
unrevoked, and unexpired. It decrypts the envelope in server-only code, checks
the authenticated token-hash/version binding, and puts bearer tokens only in
the final customer email URL fragments. The browser consumes and clears the
fragment before inspecting the token, so it is not sent in HTTP requests or
left in browser history. Tokens are never placed in plaintext outbox payloads,
delivery tables, audit logs, or application logs. Missing or invalid envelopes
prevent sending.

## Activation procedure (not yet approved)

Before activation, independently review and apply
`20261116000003_phase5_email_dispatcher.sql`, validate effective privileges,
choose a cutoff later than all historical/test events, and test in development
with `EMAIL_TEST_RECIPIENT`. Enabling the database row and configuring a
scheduler require separate approval. Production activation must use HTTPS,
verified Resend sender/recipient configuration, monitoring, and webhook work.
