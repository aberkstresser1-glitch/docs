# Docs

A private, self-hosted document creation, e-signature, storage, and offline-access web app.

This repository is the foundation for a reusable document platform. The first planned document workflow is a firearm bill of sale, but the application is intentionally designed so additional private-party forms can be added as templates without rebuilding the platform.

## Current foundation

- Next.js 16 / TypeScript
- Better Auth with email/password login
- Prisma 7
- Self-hosted PostgreSQL
- Docker Compose
- Private document volume mounted at `/data/documents`
- PWA manifest and service worker
- IndexedDB helpers for offline document metadata and finalized PDFs
- Document, participant, immutable-version, signature, and audit-event data models
- Health endpoint at `/api/health`

## Planned document lifecycle

1. User creates a document from a template.
2. The creator chooses their role.
3. Participants receive invitations and attach their accounts to the document.
4. Draft state syncs to the server while online.
5. Signed versions are hashed and immutable.
6. Final PDFs are written to private server storage.
7. Each participant receives the finalized document in their own account.
8. A participant can explicitly keep a finalized copy offline on each device.
9. Offline copies are stored locally in IndexedDB and remain viewable if the home server or internet connection is unavailable.

## Docker deployment

Copy `.env.example` to `.env` and change every placeholder secret/password.

Important values:

- `APP_PORT`: localhost port exposed by Docker. Default is 3002.
- `APP_URL`: public HTTPS address.
- `BETTER_AUTH_URL`: same public HTTPS address used by authentication.
- `BETTER_AUTH_SECRET`: random secret of at least 32 characters.
- `DATABASE_URL`: PostgreSQL connection string using the Docker service name `postgres`.
- `STORAGE_ROOT`: private document archive location inside the app container.

Start the stack with Docker Compose. The app container currently uses Prisma `db push` during early development to bootstrap the empty database. Before the app is considered production-stable, this will be replaced with checked-in migrations.

The app binds only to `127.0.0.1` on the host by default. A Cloudflare Tunnel or reverse proxy should be the public ingress.

## Storage and backups

The Compose stack defines two persistent Docker volumes:

- `postgres_data`: accounts, document metadata, signatures, audit records, and sync state.
- `documents_data`: finalized generated files such as PDFs.

Backups should include both volumes. A database backup without the document volume is incomplete, and a document-volume backup without PostgreSQL loses the account/audit relationships.

## Security direction

The application is intended to contain private identity and transaction records.

Production requirements include:

- HTTPS only
- secure authentication cookies
- participant-level authorization on every document route
- no public document bucket
- immutable finalized versions
- document hashes stored with signatures
- invitation tokens that expire and cannot enumerate documents
- no client-side trust for authorization
- encrypted or otherwise protected backup storage
- server-side validation before every state transition

Offline data is device data. Device loss should be considered when choosing how much personal information is cached locally. Device-level encryption or an app PIN can be added before enabling offline draft editing.

## Next milestones

1. Verify the stack on the home server and connect the existing Cloudflare Tunnel.
2. Replace bootstrap `db push` with formal migrations.
3. Build server-backed document library APIs and participant authorization.
4. Add secure invitations.
5. Add local-first sync and offline cache controls.
6. Add deterministic PDF generation and finalization hashing.
7. Build the template engine.
8. Implement Firearm Bill of Sale as template #1, including same-state versus interstate/FFL workflow states.
9. Add versioned jurisdiction rules and citations.
10. Add automated backups and restore documentation.

## Legal-design principle

A generated or signed document must never claim that the document itself completed a regulated transfer when an external legal process is required. Templates can document agreements and status, but regulated workflows must track required external completion steps separately.
