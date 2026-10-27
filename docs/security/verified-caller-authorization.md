# Verified Caller Authorization Design

## Status

This document defines the required security boundary for implementing PR 6. It is a design prerequisite, not a claim that caller authorization is already enforced.

## Problem found in the current implementation

- `backend-combined/app.js` accepts claimed identity fields such as `req.body.userEmail`.
- `backend-combined/query.js` connects transactions using shared server-side wallet identities such as `patient` and `doctor`.
- `chaincode/lib/emrcontract.js` receives email parameters but does not currently bind them to `ctx.clientIdentity`.

As a result, an email supplied in an HTTP request is not proof that the requester is that patient. Adding an email comparison only in the frontend or Express handler would not establish a trusted identity. Because Fabric sees the shared service identity, the chaincode cannot distinguish one human patient from another today.

## Required design

### 1. Establish a verified user-to-Fabric-identity binding

Choose and document one supported authentication path before implementing the routes:

- Prefer an authenticated, per-user Fabric X.509 identity, with a certificate attribute (for example, immutable application user ID and role) issued by the trusted CA; or
- Use a separately authenticated identity provider and a backend session/token whose subject is mapped to a specific Fabric identity. The mapping must be verified server-side and must not be derived from request-body email fields.

The current shared `patient` / `doctor` identities are service identities and must not be treated as individual patient identities.

### 2. Derive actor identity from the trusted transaction context

For user-sensitive chaincode operations, derive the actor from verified identity information exposed by Fabric's transaction context, such as `ctx.clientIdentity` and CA-issued attributes. Reject missing, malformed, or unrecognized identity attributes. Do not allow a caller to choose their own role or identity by passing an email in the transaction arguments.

### 3. Enforce authorization in chaincode

- A patient can grant/revoke access only to records that belong to that verified patient identity.
- A doctor can read a record only when the trusted state says that doctor identity has permission.
- Record creation must verify the authenticated adder identity and the patient's explicit add-access grant.
- Administrative operations must require a distinct, trusted administrator attribute/role.
- API-level checks may improve errors, but chaincode remains the authority for ledger state changes and data access.

### 4. Fail closed

Reject transactions with no valid caller identity or with a role/record-owner mismatch. Never fall back to a body-provided email when the identity is missing.

## Required tests before calling PR 6 complete

Use chaincode unit tests with mock transaction contexts and Fabric identities/attributes:

1. Patient A reads/grants/revokes access to Patient A's record: allowed only for authorized operations.
2. Patient A attempts to read, grant, or revoke access to Patient B's record: rejected.
3. Doctor without a grant attempts to read a patient's record: rejected.
4. Doctor with a valid grant reads the record: allowed.
5. Caller spoofs another user's email in request/transaction arguments: rejected because the authenticated identity is authoritative.
6. Missing or invalid identity attributes: rejected.
7. Non-doctor identity attempts doctor-only record creation; non-admin identity attempts admin-only account creation: rejected.

Add API integration tests to prove the HTTP layer forwards only the authenticated principal, and does not trust client-supplied actor fields.

## Migration and rollout

1. Define how real users receive, enroll, renew, revoke, and recover their individual identities.
2. Create a mapping between existing ledger users and trusted Fabric identities. Avoid reusing one shared identity for multiple patients.
3. Update API authentication and gateway selection to use the verified principal's identity.
4. Update chaincode methods to derive the actor from `ctx.clientIdentity`; do not deploy until API and contract changes are compatible.
5. Deploy the new chaincode and API together, then run the cross-user denial suite against a clean test network.

## Explicit non-goal

Do not add a middleware that merely checks that an email string exists, matches a route, or was included in a frontend payload. Such checks would not prevent patient impersonation in the current architecture.
