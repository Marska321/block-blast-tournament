# Windows + Google Drive backup setup

Supabase access was verified on 17 November 2026: production project `ivtbxaoflwuzkfbgtedh` (`blockblast`) is healthy on PostgreSQL 17. This connection permits management checks; the Windows backup runner still needs its own private database login.

This setup runs on **your PC**, not inside ChatGPT. It costs no additional hosting subscription, but uses Google Drive storage. Only encrypted archives go into Drive. It does not automatically verify that Drive uploaded them.

## 1. Install the prerequisites

- [Google Drive for desktop](https://www.google.com/drive/download/), signed into your own account.
- [Node.js LTS](https://nodejs.org/en/download), version 22.12 or newer. Restart Windows PowerShell after installation.
- [PostgreSQL 17 client tools](https://www.postgresql.org/download/windows/). The installer must include `pg_dump.exe` and `pg_restore.exe`; a local database server is not needed for backups. Record the bin folder, usually `C:\Program Files\PostgreSQL\17\bin`.
- A downloaded checkout of PR #2's `ops/monitoring-and-backups` branch, outside the Google Drive backup folder. Keep the checkout in the same location after scheduling.

Create a folder named `Blok Blaster encrypted backups` in your private Drive. Do not share it publicly or put it inside an already-shared folder. Locate that folder in File Explorer and copy its full path. Streamed and mirrored Drive paths differ; the installer asks for yours rather than guessing it. Drive desktop must be running when the folder is used.

## 2. Get connection details privately

Open [the production project's Connect panel](https://supabase.com/dashboard/project/ivtbxaoflwuzkfbgtedh?showConnect=true). Choose the **session pooler, port 5432** if the direct IPv6 connection is unavailable. Copy **only the host** to enter into setup; the script selects the matching production username itself. Do not use the transaction pooler on port 6543.

Get the database password from your password manager. It is different from the Supabase API keys and account login. Do not reset it casually: other database clients may depend on it. Download the database root CA certificate from the project's connection/SSL settings to a local file; TLS certificate validation stays enabled.

Never send the password, connection string or recovery key in chat. The setup prompts for the password locally with hidden input.

## 3. Run setup on your PC

Open **Windows PowerShell** under your normal Windows account, change into the downloaded repository folder, then run:

```powershell
powershell.exe -NoProfile -File .\scripts\ops\setup-windows-backups.ps1
```

If Windows says the downloaded scripts are blocked, review the two `.ps1` files first, then unblock those specific files using File Explorer → Properties → Unblock. If local execution policy still prevents running them, use `-ExecutionPolicy RemoteSigned` for this PowerShell process only, if your organization's policy permits it. Do not change machine-wide policy or use Bypass.

Setup asks for your PostgreSQL bin folder, Drive folder, database host, root CA certificate file and database password. It creates:

- A DPAPI-encrypted password file tied to this Windows account.
- A random backup encryption key and private configuration under `%LOCALAPPDATA%\Playables\BackupSecrets`.
- A first encrypted, authenticated database snapshot in the Drive folder.
- A daily Task Scheduler job at **10:00 local PC time**, only after the first backup succeeds.

It restricts the private directory to your Windows account and SYSTEM. Keep the key outside Drive and outside the code checkout. Password protection does not protect against someone controlling your signed-in Windows account.

The task runs while you are signed in (locking the screen is fine). It can run on battery, catches up on missed runs when possible, prevents overlapping runs, and stops after 45 minutes. It cannot back up while the PC is shut down or while you are signed out. Change the time in Task Scheduler if 10:00 does not suit you.

## 4. Verify the first backup and protect the recovery key

1. Confirm setup reports success and Drive contains a `.pgdump.enc` file.
2. Open **Google Drive in a web browser** and confirm the same file appears there with a nonzero size. A local file alone does not prove upload.
3. Store a **second copy of `blokblaster.backup-key`** separately, such as a password manager's secure attachment or a protected offline USB. Do not store it alongside the archives in Drive. Google cannot recover this key.
4. In Task Scheduler, locate **Blok Blaster encrypted backup**, choose Run, and check **Last Run Result = 0x0**.
5. Confirm `%LOCALAPPDATA%\Playables\BackupSecrets\last-success.txt` has the new time. `last-failure.txt` means the last attempt failed. These local markers are not remotely monitored yet.

The first real snapshot still needs a restore into an isolated test environment before production recovery can be considered rehearsed. The passing fixture rehearsal does not prove your production dataset restores correctly.

## Updating settings or fixing a failed setup

Do not delete or regenerate the backup key to fix a password or connection problem. Earlier backups require that same key. Review `settings.xml` privately to correct a path or host. Update the stored password locally with:

```powershell
$Private = Join-Path $env:LOCALAPPDATA 'Playables\BackupSecrets'
Read-Host 'Database password' -AsSecureString | Export-Clixml (Join-Path $Private 'password.xml')
```

After correcting settings, rerun the setup command: it reuses the existing key/configuration, tests a backup, and creates or updates the scheduled task. If this computer/account is replaced, DPAPI's password file is not portable; configure the password again and preserve the original backup key.

If `pg_dump` fails, check the exact project/host, port 5432, certificate trust, database password and PostgreSQL client version privately. The script deliberately suppresses raw diagnostic output to avoid leaking connection details into logs. Check Supabase's database permissions/settings without weakening app access controls.

## Remaining operational work

- This daily schedule can lose up to 24 hours of changes, more if a failure goes unnoticed.
- Drive sync, task failures and 26-hour snapshot freshness still require operator checks; the hourly public-site monitor cannot see your PC or Drive uploads.
- No automatic retention deletion is enabled. Keep seven daily and four weekly snapshots initially; do not delete the latest verified snapshot before a newer restore is tested. Monitor Drive's available space.
- See [operations](operations.md) for backup scope, excluded project settings/file bytes, and the isolated restore procedure.

## Diagnose a failed first backup

Run `powershell.exe -NoProfile -File .\scripts\ops\diagnose-windows-backup.ps1` from this checkout. It checks the configured files and performs a TLS/database login and read-only dump, discarding the dump without saving it. It prints only safe diagnostic codes; it never prints passwords, keys or raw database errors. It changes no database data or backup configuration. Keep the existing recovery key. If it reports `DATABASE_TOOL_FAILED_OTHER`, the operator must inspect raw PostgreSQL diagnostics privately rather than post them in chat.
