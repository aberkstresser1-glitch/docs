# Architecture

## Runtime

The production installation is designed as two primary Docker services:

- `app`: Next.js web application, auth endpoints, document APIs, PDF generation, PWA assets.
- `postgres`: private PostgreSQL database.

A private persistent volume stores finalized binary documents separately from database metadata.

The public path should terminate at the existing Cloudflare Tunnel/reverse proxy and forward only to the app service.

## Trust model

The server is authoritative for:

- identity and sessions
- document membership
- roles
- workflow state
- version numbers
- finalization
- signature records
- document hashes
- audit history
- canonical stored PDFs

The browser may cache data for offline use but must never be authoritative for access control or finalization.

## Offline model

The service worker caches the application shell and previously visited navigation responses.

IndexedDB stores explicit device copies of:

- document summaries
- finalized PDF blobs
- later: selected draft payloads and an outbound sync queue

A future sync layer will use per-document version numbers and conflict detection. Finalized document versions will be immutable and therefore never participate in edit conflicts.

## Document model

A document points to a template key/version and contains participants.

Every material change creates or updates a draft payload. Finalization creates an immutable document version with a deterministic hash.

A signature binds:

- participant
- account when available
- typed/adopted signature representation
- explicit consent text
- timestamp
- document hash
- audit metadata

This allows the app to show what exact version a person signed.

## Templates

Templates should contain:

- stable key
- human name
- category
- semantic version
- field schema
- workflow rules
- jurisdiction/rule metadata
- PDF renderer identifier

Legal/compliance rules are versioned so previously finalized records do not silently change when current rules are updated.

## Firearm template direction

The firearm bill-of-sale template will be the first regulated workflow.

Jurisdiction selection happens before signing.

If the parties are residents of different states, the document workflow must enter an external-transfer state and cannot be marked completed merely because both parties signed. FFL information and the actual external transfer-completion date will be tracked separately.

The legal-rules layer will be sourced and versioned separately from the reusable document engine.
