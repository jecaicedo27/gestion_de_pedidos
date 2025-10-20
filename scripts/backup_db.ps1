# PowerShell script to back up the gestion_pedidos_dev database using mysqldump
# Creates a timestamped folder and a ZIP containing the SQL dump

$ErrorActionPreference = 'Stop'

function Get-EnvFromFile([string]$path) {
    $map = @{}
    if (-not (Test-Path $path)) {
        throw "No se encontró el archivo .env en: $path"
    }
    Get-Content -LiteralPath $path | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { return }
        if ($line.StartsWith('#')) { return }
        $kv = $line -split '=', 2
        if ($kv.Length -eq 2) {
            $key = $kv[0].Trim()
            $val = $kv[1].Trim()
            # Remover comillas envolventes si existen
            if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                $val = $val.Substring(1, $val.Length - 2)
            }
            $map[$key] = $val
        }
    }
    return $map
}

# Localizar el .env del backend
try {
    $envPath = Join-Path $PSScriptRoot '..\backend\.env'
    $envPath = Resolve-Path -LiteralPath $envPath
} catch {
    # Fallback si el script no está en scripts\
    $envPath = Resolve-Path -LiteralPath '.\backend\.env'
}

$envVars = Get-EnvFromFile $envPath

# Variables de conexión
$dbHost = if ($envVars.ContainsKey('DB_HOST')) { $envVars['DB_HOST'] } else { '127.0.0.1' }
$dbPort = if ($envVars.ContainsKey('DB_PORT')) { $envVars['DB_PORT'] } else { '3306' }
$dbUser = if ($envVars.ContainsKey('DB_USER')) { $envVars['DB_USER'] } else { 'root' }
$dbPass = if ($envVars.ContainsKey('DB_PASSWORD')) { $envVars['DB_PASSWORD'] } else { '' }
$dbName = if ($envVars.ContainsKey('DB_NAME')) { $envVars['DB_NAME'] } else { '' }

if ([string]::IsNullOrWhiteSpace($dbName)) {
    throw "DB_NAME no definido en el .env"
}

# Crear carpeta timestamp
$timestamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'
$backupDirName = "backup_database_$timestamp"
$backupDir = Join-Path (Get-Location) $backupDirName
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$dumpPath = Join-Path $backupDir "$dbName.sql"

# Buscar mysqldump
$cmd = Get-Command mysqldump.exe -ErrorAction SilentlyContinue
$mysqldump = $null
if ($cmd) {
    $mysqldump = $cmd.Source
}
if (-not $mysqldump) {
    $candidates = @(
        'C:\xampp\mysql\bin\mysqldump.exe',
        'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe',
        'C:\Program Files\MySQL\MySQL Shell 8.0\bin\mysqldump.exe',
        'C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysqldump.exe',
        'C:\Program Files\MySQL\MySQL Server 5.7\bin\mysqldump.exe',
        'C:\Program Files (x86)\MySQL\MySQL Server 5.7\bin\mysqldump.exe'
    )
    foreach ($p in $candidates) {
        if (Test-Path -LiteralPath $p) {
            $mysqldump = $p
            break
        }
    }
}
if (-not $mysqldump) {
    throw "mysqldump no encontrado. Instala MySQL o agrega mysqldump al PATH."
}

# Construir argumentos
$argList = New-Object System.Collections.Generic.List[string]
$argList.AddRange([string[]]@('-h', "$dbHost", '-P', "$dbPort", '-u', "$dbUser"))
if (-not [string]::IsNullOrEmpty($dbPass)) {
    $argList.Add("--password=$dbPass")
}
$argList.AddRange([string[]]@('--databases', "$dbName", '--routines', '--events', '--triggers', '--single-transaction', '--quick'))

# Ejecutar mysqldump y redirigir salida al archivo
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $mysqldump
$psi.Arguments = ($argList -join ' ')
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)
$stdOut = $proc.StandardOutput.ReadToEnd()
$stdErr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

if ($proc.ExitCode -ne 0) {
    throw "mysqldump falló con código $($proc.ExitCode). Error: $stdErr"
}

[System.IO.File]::WriteAllText($dumpPath, $stdOut, [System.Text.Encoding]::UTF8)

# Verificar tamaño mínimo
if (!(Test-Path -LiteralPath $dumpPath) -or (Get-Item -LiteralPath $dumpPath).Length -lt 1024) {
    throw "El dump parece vacío o muy pequeño: $dumpPath"
}

# Comprimir a ZIP
$zipPath = "$backupDir.zip"
Compress-Archive -Path $dumpPath -DestinationPath $zipPath -Force

Write-Host "Dump creado: $dumpPath"
Write-Host "ZIP creado: $zipPath"
