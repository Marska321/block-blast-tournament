# Run with Windows PowerShell 5.1 as the account that will own the scheduled task.
$ErrorActionPreference = 'Stop'
$Repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Private = Join-Path $env:LOCALAPPDATA 'Playables\BackupSecrets'
if (!(Test-Path (Join-Path $Private 'settings.xml'))) {
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$Version = & $Node -p 'process.versions.node'
if ([version]$Version -lt [version]'22.12.0') { throw 'Install Node.js 22.12 or newer.' }
$PostgresBin = Read-Host 'PostgreSQL bin folder (for example C:\Program Files\PostgreSQL\17\bin)'
if (!(Test-Path (Join-Path $PostgresBin 'pg_dump.exe'))) { throw 'pg_dump.exe not found.' }
$DumpVersion = & (Join-Path $PostgresBin 'pg_dump.exe') --version
if ($DumpVersion -notmatch '(\d+)\.' -or [int]$Matches[1] -lt 17) { throw 'PostgreSQL client 17 or newer is required.' }
$BackupDir = [IO.Path]::GetFullPath((Read-Host 'Full path of your private Google Drive backup folder'))
if ($BackupDir.Equals($Repo, [StringComparison]::OrdinalIgnoreCase) -or $BackupDir.StartsWith($Repo + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Choose a folder outside the repository.' }
$DatabaseHost = (Read-Host 'Database host from Supabase Connect (direct or session pooler)').Trim()
if ($DatabaseHost -eq 'db.ivtbxaoflwuzkfbgtedh.supabase.co') { $DatabaseUser = 'postgres' }
elseif ($DatabaseHost -match '^aws-[a-z0-9-]+\.pooler\.supabase\.com$') { $DatabaseUser = 'postgres.ivtbxaoflwuzkfbgtedh' }
else { throw 'Use the production direct host or Supabase session-pooler host.' }
$Certificate = [IO.Path]::GetFullPath((Read-Host 'Full path to the database root CA certificate downloaded from Supabase'))
if (!(Test-Path $Certificate -PathType Leaf)) { throw 'Certificate file not found.' }
$Password = Read-Host 'Database password (entered only on this PC)' -AsSecureString
New-Item $Private -ItemType Directory -Force | Out-Null
# Restrict the directory to the current user and SYSTEM. DPAPI also binds the password to this Windows account.
$Sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$Acl = New-Object Security.AccessControl.DirectorySecurity
$Acl.SetAccessRuleProtection($true, $false)
foreach ($Identity in @($Sid, (New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))) {
    $Rule = New-Object Security.AccessControl.FileSystemAccessRule($Identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $Acl.AddAccessRule($Rule)
}
Set-Acl $Private $Acl
$Password | Export-Clixml (Join-Path $Private 'password.xml')
$Settings = [pscustomobject]@{ Node=$Node; PostgresBin=$PostgresBin; DatabaseHost=$DatabaseHost; DatabaseUser=$DatabaseUser; Certificate=$Certificate; BackupDir=$BackupDir }
$Settings | Export-Clixml (Join-Path $Private 'settings.xml')
}
$Settings = Import-Clixml (Join-Path $Private 'settings.xml')
$Node = $Settings.Node
$Sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$env:BACKUP_KEY_FILE = Join-Path $Private 'blokblaster.backup-key'
Set-Location $Repo
if (!(Test-Path $env:BACKUP_KEY_FILE)) {
    & $Node (Join-Path $PSScriptRoot 'backup.mjs') keygen
    if ($LASTEXITCODE -ne 0) { throw 'Key creation failed.' }
}
# Validate the first real backup before scheduling anything.
& powershell.exe -NoProfile -File (Join-Path $PSScriptRoot 'windows-backup.ps1')
if ($LASTEXITCODE -ne 0) { throw 'First backup failed; no scheduled task was created. Fix settings.xml/password.xml privately, then run the backup again.' }
$Action = New-ScheduledTaskAction -Execute (Join-Path $PSHOME 'powershell.exe') -Argument ('-NoProfile -File "' + (Join-Path $PSScriptRoot 'windows-backup.ps1') + '"') -WorkingDirectory $Repo
$Trigger = New-ScheduledTaskTrigger -Daily -At '10:00'
$Principal = New-ScheduledTaskPrincipal -UserId $Sid.Value -LogonType Interactive -RunLevel Limited
$TaskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 45) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Blok Blaster encrypted backup' -Action $Action -Trigger $Trigger -Principal $Principal -Settings $TaskSettings -Force | Out-Null
Write-Host 'Daily backup scheduled for 10:00 local time while you are signed in. Missed runs start when possible.'
Write-Host ('Save a SECOND copy of this recovery key outside Google Drive: ' + $env:BACKUP_KEY_FILE)
Write-Host 'Check the encrypted file appears in Google Drive on the web. Scheduling is not proof of cloud sync.'
