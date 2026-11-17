# Runs as the Windows user who configured the task. No password appears in task arguments.
$ErrorActionPreference = 'Stop'
$Repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Private = Join-Path $env:LOCALAPPDATA 'Playables\BackupSecrets'
$Config = Import-Clixml (Join-Path $Private 'settings.xml')
$ExitCode = 1
$Password = $null
try {
    Set-Location $Repo
    $env:Path = $Config.PostgresBin + ';' + $env:Path
    $env:PGHOST = $Config.DatabaseHost
    $env:PGUSER = $Config.DatabaseUser
    $env:PGPORT = '5432'
    $env:PGDATABASE = 'postgres'
    $env:PGSSLMODE = 'verify-full'
    $env:PGSSLROOTCERT = $Config.Certificate
    $env:PGCONNECT_TIMEOUT = '30'
    $env:PGOPTIONS = '-c statement_timeout=600000 -c lock_timeout=30000'
    $env:BACKUP_KEY_FILE = Join-Path $Private 'blokblaster.backup-key'
    $env:BACKUP_DIR = $Config.BackupDir
    $Password = Import-Clixml (Join-Path $Private 'password.xml')
    $Credential = New-Object System.Management.Automation.PSCredential('backup', $Password)
    $env:PGPASSWORD = $Credential.GetNetworkCredential().Password
    $env:PGPASSFILE = Join-Path $Private 'unused.pgpass'
    $Output = & $Config.Node (Join-Path $PSScriptRoot 'backup.mjs') create 2>&1
    $ExitCode = $LASTEXITCODE
    if ($ExitCode -ne 0) { throw 'Backup failed. Check connection, password, certificate and client version privately.' }
    $Output | Set-Content (Join-Path $Private 'last-success.json') -Encoding UTF8
    (Get-Date).ToUniversalTime().ToString('o') | Set-Content (Join-Path $Private 'last-success.txt') -Encoding UTF8
    Remove-Item (Join-Path $Private 'last-failure.txt') -ErrorAction SilentlyContinue
    Write-Host 'Encrypted backup created and authenticated. Check Google Drive has finished syncing it.'
} catch {
    $ExitCode = 1
    # Do not log external tool diagnostics: connection errors can contain sensitive details.
    (Get-Date).ToUniversalTime().ToString('o') | Set-Content (Join-Path $Private 'last-failure.txt') -Encoding UTF8
    Write-Error 'Blok Blaster backup failed. See docs/windows-backups.md.' -ErrorAction Continue
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $Password = $null
    $Credential = $null
}
exit $ExitCode
