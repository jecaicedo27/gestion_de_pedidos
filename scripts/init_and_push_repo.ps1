Param(
  [string]$RepoName = "gestion_de_pedidos",
  [ValidateSet("private","public")]
  [string]$Visibility = "private"
)

$ErrorActionPreference = "Stop"

function Info($msg) { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Err ($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 1) Asegurar ejecución desde la raíz del proyecto
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
# Si el script se ejecuta desde otra ubicación, intenta detectar raíz con archivos conocidos
if (-not (Test-Path ".gitignore") -or -not (Test-Path "backend") -or -not (Test-Path "frontend")) {
  Warn "No parece que estés en la raíz del proyecto. Ubicación actual: $(Get-Location)"
  Warn "Asegúrate de ejecutar este script dentro de la carpeta del proyecto."
}

# 2) Validar que .env y secretos están ignorados
if (Test-Path ".gitignore") {
  $gitignore = Get-Content ".gitignore" -Raw
  $requiredPatterns = @(
    "^\.env(\r?)$",
    "^backend/\.env(\r?)?$",
    "^frontend/\.env(\.production)?(\.local)?(\r?)?$",
    "^frontend/build/(\r?)?$",
    "^backend/uploads/(\r?)?$",
    "^node_modules/(\r?)?$"
  )
  $missing = @()
  foreach ($pat in $requiredPatterns) {
    if ($gitignore -notmatch $pat) { $missing += $pat }
  }
  if ($missing.Count -gt 0) {
    Warn "Faltan algunas entradas en .gitignore para proteger secretos/artefactos:"
    $missing | ForEach-Object { Write-Host "  - $_" }
    Warn "Edita .gitignore si es necesario y vuelve a ejecutar."
  } else {
    Info ".gitignore valida: secretos y artefactos están excluidos."
  }
} else {
  Warn ".gitignore no encontrado; crea uno antes de continuar."
}

# 3) Inicializar git si no existe
$insideGit = $false
try {
  $gitStatus = git rev-parse --is-inside-work-tree 2>$null
  if ($LASTEXITCODE -eq 0 -and $gitStatus -eq "true") { $insideGit = $true }
} catch {}

if (-not $insideGit) {
  Info "Inicializando repositorio Git..."
  git init
  # Establecer rama principal a main si no existe
  git checkout -b main
} else {
  Info "Repositorio Git ya inicializado."
  # Cambiar a main si existe
  try { git rev-parse --verify main 2>$null; if ($LASTEXITCODE -eq 0) { git checkout main } } catch {}
}

# 4) Commit inicial (o acumulado)
Info "Preparando commit inicial..."
git add -A
# Evitar fallo si no hay cambios
try {
  git commit -m "Initial commit: project bootstrap" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Warn "No se realizó commit (posiblemente sin cambios nuevos). Continuando..."
  } else {
    Info "Commit inicial realizado."
  }
} catch {
  Warn "No se pudo crear el commit inicial (posible repositorio ya con commits). Continuando..."
}

# 5) Crear repo en GitHub con GitHub CLI (gh) si está disponible
$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($null -ne $gh) {
  Info "Detectado GitHub CLI (gh). Verificando autenticación..."
  gh auth status 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    Warn "No has iniciado sesión en gh. Ejecuta: gh auth login  (elige HTTPS o SSH) y vuelve a correr este script."
    exit 1
  }

  # Ver si remoto origin ya existe
  $origin = ""
  try { $origin = git remote get-url origin 2>$null } catch {}
  if (-not $origin) {
    Info "Creando repositorio '$RepoName' en GitHub y haciendo push..."
    $visibilityFlag = if ($Visibility -eq "private") { "--private" } else { "--public" }
    # Crea repo usando el owner autenticado
    gh repo create $RepoName $visibilityFlag --source . --remote origin --push -y
    if ($LASTEXITCODE -ne 0) {
      Err "Fallo creando el repositorio con gh. Revisa la salida anterior."
      exit 1
    }
    Info "Repositorio creado y push realizado correctamente."
  } else {
    Info "Remoto 'origin' ya existe: $origin"
    Info "Haciendo push de 'main' al remoto existente..."
    git push -u origin main
  }
} else {
  Warn "GitHub CLI (gh) no está instalado. Continuaré con instrucciones manuales."

  # 6) Instrucciones para crear repo manualmente
  $remoteHttps = "https://github.com/<OWNER>/$RepoName.git"
  Write-Host ""
  Write-Host "=== PASOS MANUALES ===" -ForegroundColor Yellow
  Write-Host "1) Crea un repositorio en GitHub llamado '$RepoName' (privado recomendado)."
  Write-Host "2) Luego ejecuta:"
  Write-Host "   git remote add origin $remoteHttps"
  Write-Host "   git push -u origin main"
  Write-Host ""
  Write-Host "NOTA: Si Git pide credenciales, usa un Personal Access Token con scope 'repo' como contraseña."
}

# 7) Mensaje final y siguientes pasos en VPS
Write-Host ""
Info "Repositorio listo. Próximos pasos en el VPS (Ubuntu 24.04):"
Write-Host "  ssh <usuario>@<IP>  (ya estás dentro)"
Write-Host "  sudo apt update && sudo apt install -y git"
Write-Host "  sudo mkdir -p /var/www && cd /var/www"
Write-Host "  sudo git clone https://github.com/<OWNER>/$RepoName.git gestion_de_pedidos"
Write-Host '  sudo chown -R $USER:$USER gestion_de_pedidos && cd gestion_de_pedidos'
Write-Host "  chmod +x deploy/provision_http_vps.sh && sudo ./deploy/provision_http_vps.sh"
Write-Host ""
Info "Frontend:  http://<IP>"
Info "API:       http://<IP>/api/config/public"
