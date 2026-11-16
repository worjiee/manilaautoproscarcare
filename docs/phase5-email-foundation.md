# Phase 5.1 transactional email foundation

This phase is deliberately dormant. `EMAIL_DELIVERY_MODE` defaults to
`disabled`, there is no dispatcher route, and applying the migration does not
send email or schedule new work.

## Atomic event model

The Phase 3 and Phase 4 booking RPCs remain the only booking-state writers.
They already insert an immutable `booking_audit_logs` row in the same database
transaction. The Phase 5.1 migration adds an `AFTER INSERT` audit trigger that
derives a constrained email event from that audit record. Consequently:

- a rolled-back booking produces no audit or email event;
- an idempotent RPC replay produces no second audit or email event;
- concurrent expiration remains protected by the existing row locks;
- the existing `expire_pending_bookings_atomic()` pg_cron command is unchanged.

The trigger stores booking state and scheduling snapshots only. It never stores
raw customer tokens, cancellation reasons, phone numbers, vehicle notes, or
additional requests.

## Management-link envelopes

Raw cancel and reschedule tokens continue to be generated with 256 bits of
entropy. Their SHA-256 hashes remain the authorization records in
`booking_tokens`.

When email is explicitly enabled, the application additionally encrypts the
raw pair with AES-256-GCM before invoking an email-aware wrapper RPC. The
authenticated additional data contains the token version and both hashes. The
database verifies that the hashes identify the two active tokens for the
booking before storing the ciphertext. The wrapper and the underlying booking
operation run in one PostgreSQL transaction.

The encryption key never enters PostgreSQL. `booking_delivery_secrets` stores
only the key version, nonce, ciphertext, authentication tag, AAD digest, token
hashes, and expiration. Terminal booking transitions revoke the current
envelope. A future dispatcher must also reject expired, used, or revoked token
rows immediately before rendering an email.

## Key rotation and recovery

1. Generate a new independent 32-byte key in the deployment secret manager.
2. Move the old version/key into `EMAIL_TOKEN_ENCRYPTION_PREVIOUS_KEYS`.
3. Set the new current key and increment `EMAIL_TOKEN_ENCRYPTION_KEY_VERSION`.
4. Deploy before creating envelopes with the new version.
5. Retain old keys until every envelope using them is revoked, expired, or
   re-encrypted by a separately reviewed maintenance operation.
6. Remove old key material only after a database count confirms no usable
   envelope references that version.

Losing an encryption key does not affect booking integrity or token hashes, but
the corresponding email links cannot be recovered. Recovery must use an
authorized token-rotation operation; it must never decrypt hashes, bypass token
authorization, or place a replacement token directly into a URL or log.

## Rollout order

The migration must receive a separate security review and be applied before
`EMAIL_DELIVERY_MODE` is changed from `disabled`. Resend credentials, verified
sender details, approved administrator recipients, and the development test
recipient are deliberately absent from source control.
