# Monitoring and backups

## Current status

- Hourly ChatGPT health monitoring is enabled for both public domains. Persistent failures produce a notification in the originating chat. Delivery depends on task execution and the user's notification settings; this is a best-effort hourly check, not a 24/7 incident response service.
- `npm run ops:health` performs the same credential-free checks on demand: homepage, JS/CSS and fresh database-backed daily rankings. It never creates users or scores. A nonzero exit means health could not be verified; inspect whether the cause is the service or the runner's network.
- It does not measure client crash rates, guest signup, database capacity or backup freshness. Vercel's current runtime logs provide short-term diagnostics; long-term error collection remains follow-up work.
- Production backup access has NOT been configured. The connected Supabase account does not contain project `ivtbxaoflwuzkfbgtedh`. No production snapshot or backup schedule has been created. GitHub Actions is currently blocked by the GitHub account's billing lock.

The public game and API already log safe operation/status/duration fields. During an incident, inspect Vercel runtime errors for the production project `block-blast-tournament` and Supabase Auth/Postgres logs. Do not copy tokens, claim codes, contacts or request bodies into an incident report.

## Run a health check

```sh
npm run ops:health
```

On a managed computer using an outbound proxy, Node 24.5+ can use `NODE_USE_ENV_PROXY=1`; retain the supplied CA configuration. Do not disable TLS validation. The hourly task can use another authenticated HTTP client if Node cannot access the network.

## Configure a private backup runner

Use an always-on machine under your control with Node 22.12+ and PostgreSQL clients matching or newer than the source server (confirm the server version first). No new paid service is needed if you already have such a machine. A laptop only backs up while it is running.

Store the key and encrypted archives outside the checkout, in private directories. Keep another copy of the key separately in a password manager. Losing the key makes recovery impossible. Keep a second encrypted archive copy on another device/private storage service; a single machine is not sufficient protection.

Create an ignored `.env.ops.local` on the runner. It contains configuration paths, not secrets committed to Git:

```dotenv
PGHOST=db.ivtbxaoflwuzkfbgtedh.supabase.co
PGUSER=postgres
PGPORT=5432
PGDATABASE=postgres
PGSSLMODE=verify-full
PGPASSFILE=/private/path/postgres.pgpass
BACKUP_KEY_FILE=/private/path/blokblaster.backup-key
BACKUP_DIR=/private/path/encrypted-backups
```

Use the direct connection shown in Supabase's Connect panel, or the **session pooler on port 5432** if IPv6 is unavailable. For the pooler, PGUSER must be `postgres.ivtbxaoflwuzkfbgtedh`. Configure the appropriate CA file through `PGSSLROOTCERT` if necessary. The command refuses other projects, transaction poolers and insecure TLS settings.

Put the database password in the private PGPASSFILE using libpq's documented format; on Unix it must have permissions 0600. Configure this through a secure local editor/password manager, never a chat or shell-history command. Use database credentials, not an API/service-role key. Grant only the backup permissions needed; do not change application grants to make a backup work.

```sh
npm run ops:backup -- keygen
npm run ops:backup -- create
npm run ops:backup -- verify /private/path/encrypted-backups/SNAPSHOT.pgdump.enc
```

The command streams one transactionally consistent PostgreSQL custom dump directly into AES-256-GCM encryption. Plaintext is never saved during backup creation. A failed dump is removed and is never labelled successful. Existing archives and keys are not overwritten. Authentication verification detects corruption and incorrect keys; it is not a restore rehearsal.

Included: `public`, `auth`, `storage` metadata, and `supabase_migrations`, including rows, schema objects, policies and grants in those schemas. Blok Blaster's tables are in `public`; guest user rows are in `auth`. No other application schema is covered. Reassess the schema list whenever the architecture changes.

Excluded: PostgreSQL global roles/passwords, project Auth settings, hosting environment variables, encryption root keys/Vault secrets, and Storage file bytes. Preserve those separately through the supported provider tools. Browser-local progress, photos and guest session tokens are not database backups. Recovered Auth user rows do not recover a player's lost browser token.

## Scheduling and retention

Once a first live snapshot and a production-derived isolated restore have both succeeded, configure a daily OS task on the private runner to run `npm run ops:backup -- create` from the checkout. Configure the scheduler to notify the operator on any nonzero exit or no successful snapshot in 26 hours. Do not schedule the backup in the public repo with plaintext artifacts or on Vercel's request runtime.

Suggested initial policy: seven daily snapshots and four weekly snapshots. Keep the latest verified snapshot until a newer snapshot has been restored successfully. Retention/deletion and the off-device copy are manual until the runner and storage destination are selected. This repo does not silently delete archives. A daily schedule can lose up to 24 hours of changes (longer if a failure is missed); it is not point-in-time recovery.

## Rehearse recovery

`npm run ops:rehearse` starts an isolated PostgreSQL 17 Docker container with no published port. It creates fixture user/score data, dumps, encrypts, authenticates, restores into a separate empty database, and verifies the score/user relationship, row security and denied anonymous reads. It cleans up its container and temporary files. This proves the tool chain on fixture data, not the current production dataset or a complete Supabase project restore.

To prepare a real encrypted snapshot for inspection, set `BACKUP_RESTORE_FILE` to a private path outside the checkout, then run:

```sh
npm run ops:backup -- unpack /private/path/SNAPSHOT.pgdump.enc
pg_restore --list /private/path/recovery.pgdump
```

`unpack` writes the path specified by BACKUP_RESTORE_FILE only after authentication succeeds. It contains private plaintext data: keep it private and remove it after the rehearsal.

Restore only to an explicitly identified disposable database first. Restore roles/extensions dependencies before objects that require them. Existing schemas need an explicit restore plan: a plain `pg_restore --exit-on-error` into a normal database will conflict with its existing `public` schema. In the fixture rehearsal only, the empty target's public schema is removed first. **Never drop Supabase-managed auth/storage schemas or use --clean against production.**

For a fresh Supabase target, follow the current [Supabase backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Managed Auth/Storage tables, triggers, roles, extensions, Vault and settings require provider-specific handling; this scoped custom archive is not a one-command project clone. Review an archive's table of contents and prepare the target-specific restore steps before executing them.

Verify real row counts, ranks, Auth linkage, policies, grants, replay submission and idempotent retries on the isolated target. Keep emails, push delivery and prize operations disabled there. Record the snapshot date, verification results and recovery duration privately, without player data. A production restore/cutover requires an explicit recovery decision and target verification.
