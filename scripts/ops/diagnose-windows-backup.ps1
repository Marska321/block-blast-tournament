# Read-only diagnostics. Never prints passwords, keys, connection strings or raw database errors.
$ErrorActionPreference = 'Stop'
$Private = Join-Path $env:LOCALAPPDATA 'Playables\BackupSecrets'
$Stage = 'configuration'
function Invoke-PrivateCheck($Exe, $Arguments) {
    $Info = New-Object System.Diagnostics.ProcessStartInfo
    $Info.FileName = $Exe
    $Info.Arguments = $Arguments
    $Info.UseShellExecute = $false
    $Info.CreateNoWindow = $true
    $Info.RedirectStandardOutput = $true
    $Info.RedirectStandardError = $true
    $Proc = New-Object System.Diagnostics.Process
    $Proc.StartInfo = $Info
    $Proc.Start() | Out-Null
    $Drain = $Proc.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null)
    $ErrorRead = $Proc.StandardError.ReadToEndAsync()
    if (!$Proc.WaitForExit(180000)) { $Proc.Kill(); throw 'CHECK_TIMEOUT' }
    $Drain.GetAwaiter().GetResult()
    $Detail = $ErrorRead.GetAwaiter().GetResult()
    $Code = $Proc.ExitCode
    $Proc.Dispose()
    if ($Code -eq 0) { return 'OK' }
    switch -Regex ($Detail) {
        'password authentication failed|SASL authentication failed' { return 'DATABASE_PASSWORD_REJECTED' }
        'Tenant or user not found' { return 'POOLER_PROJECT_OR_USERNAME_REJECTED' }
        'certificate verify failed|root certificate|could not read certificate' { return 'CERTIFICATE_NOT_TRUSTED_OR_UNREADABLE' }
        'server certificate.*does not match|does not match host name' { return 'CERTIFICATE_HOSTNAME_MISMATCH' }
        'could not translate host name|No such host|Name or service not known' { return 'HOSTNAME_NOT_RESOLVED' }
        'timeout expired|Connection timed out|could not connect|connection.*refused' { return 'DATABASE_NETWORK_CONNECTION_FAILED' }
        'permission denied|must be owner|row-level security' { return 'DATABASE_BACKUP_PERMISSION_DENIED' }
        'server version mismatch|server version:.*pg_dump version:' { return 'POSTGRES_CLIENT_TOO_OLD' }
        'unsupported.*parameter|unrecognized configuration parameter' { return 'CONNECTION_PARAMETER_REJECTED' }
        default { return 'DATABASE_TOOL_FAILED_OTHER' }
    }
}
try {
    $Config = Import-Clixml (Join-Path $Private 'settings.xml')
    foreach ($Name in @('pg_dump.exe','psql.exe')) {
        if (!(Test-Path (Join-Path $Config.PostgresBin $Name) -PathType Leaf)) { throw 'POSTGRES_CLIENT_FILE_NOT_FOUND' }
    }
    if (!(Test-Path $Config.Node -PathType Leaf)) { throw 'NODE_FILE_NOT_FOUND' }
    if (!(Test-Path $Config.Certificate -PathType Leaf)) { throw 'CERTIFICATE_FILE_NOT_FOUND' }
    if (!(Test-Path $Config.BackupDir -PathType Container)) { throw 'DRIVE_FOLDER_NOT_AVAILABLE' }
    $Key = Join-Path $Private 'blokblaster.backup-key'
    if (!(Test-Path $Key) -or (Get-Item $Key).Length -ne 32) { throw 'BACKUP_KEY_MISSING_OR_INVALID' }
    $Password = Import-Clixml (Join-Path $Private 'password.xml')
    $Credential = New-Object System.Management.Automation.PSCredential('backup', $Password)
    $env:PGPASSWORD = $Credential.GetNetworkCredential().Password
    $env:PGHOST = $Config.DatabaseHost
    $env:PGUSER = $Config.DatabaseUser
    $env:PGPORT = '5432'; $env:PGDATABASE = 'postgres'
    $env:PGSSLMODE = 'verify-full'; $env:PGSSLROOTCERT = $Config.Certificate
    $env:PGCONNECT_TIMEOUT = '20'
    $env:PGOPTIONS = '-c statement_timeout=120000 -c lock_timeout=10000'
    Write-Output 'Local files: OK'
    $Stage = 'TLS/database login'
    $Login = Invoke-PrivateCheck (Join-Path $Config.PostgresBin 'psql.exe') '-X --no-password --set=ON_ERROR_STOP=1 --command="SELECT 1;"'
    Write-Output ('Database login: ' + $Login)
    if ($Login -eq 'OK') {
        $Stage = 'read-only dump'
        $Dump = Invoke-PrivateCheck (Join-Path $Config.PostgresBin 'pg_dump.exe') '--no-password --format=custom --no-owner --schema=public --schema=auth --schema=storage --schema=supabase_migrations'
        Write-Output ('Read-only dump (discarded, not saved): ' + $Dump)
    }
} catch {
    # Emit only known safe error codes; never forward raw error objects.
    $SafeCodes = @('POSTGRES_CLIENT_FILE_NOT_FOUND','NODE_FILE_NOT_FOUND','CERTIFICATE_FILE_NOT_FOUND','DRIVE_FOLDER_NOT_AVAILABLE','BACKUP_KEY_MISSING_OR_INVALID','CHECK_TIMEOUT')
    $Safe = 'LOCAL_CONFIGURATION_OR_TOOL_ERROR'
    if ($SafeCodes -contains $_.Exception.Message) { $Safe = $_.Exception.Message }
    Write-Output ($Stage + ': ' + $Safe)
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $Password = $null; $Credential = $null
}
