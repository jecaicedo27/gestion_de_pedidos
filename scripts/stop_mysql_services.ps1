param(
    [string[]]$ProcessNames = @('mysqld','mariadbd','mysqlrouter','wampmysqld')
)

$regex = '(?i)(mysql|mariadb|wamp|xampp|mysqlrouter)'

Write-Host "Buscando servicios relacionados con MySQL/MariaDB..."
$services = Get-Service | Where-Object { $_.Name -match $regex -or $_.DisplayName -match $regex }

if (-not $services -or $services.Count -eq 0) {
    Write-Host "No se detectaron servicios MySQL/MariaDB/XAMPP/WAMP en el sistema."
} else {
    foreach ($svc in $services) {
        try {
            if ($svc.Status -eq 'Running') {
                Write-Host ("Deteniendo servicio {0} ({1})..." -f $svc.Name, $svc.DisplayName)
                try {
                    Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
                } catch {
                    Write-Host ("Stop-Service falló para {0}: {1}" -f $svc.Name, $_.Exception.Message)
                }

                try {
                    cmd /c "sc stop $($svc.Name)" | Out-Null
                } catch {}

                # Esperar hasta 5s que se detenga
                for ($i = 0; $i -lt 5; $i++) {
                    $state = (Get-Service -Name $svc.Name -ErrorAction SilentlyContinue).Status
                    if ($state -ne 'Running') { break }
                    Start-Sleep -Seconds 1
                }

                # Intentar matar el proceso asociado al servicio (si existe)
                try {
                    $cim = Get-CimInstance Win32_Service -Filter ("Name='{0}'" -f $svc.Name) -ErrorAction SilentlyContinue
                    if ($cim -and $cim.ProcessId -gt 0) {
                        Write-Host ("Matando PID {0} del servicio {1}..." -f $cim.ProcessId, $svc.Name)
                        try {
                            Stop-Process -Id $cim.ProcessId -Force -ErrorAction SilentlyContinue
                        } catch {
                            Write-Host ("Stop-Process falló para PID {0}: {1}. Intentando taskkill..." -f $cim.ProcessId, $_.Exception.Message)
                            cmd /c "taskkill /F /PID $($cim.ProcessId)" | Out-Null
                        }
                    }
                } catch {}
            } else {
                Write-Host ("Servicio {0} no está en ejecución (estado: {1})" -f $svc.Name, $svc.Status)
            }
        } catch {
            Write-Host ("Error al procesar servicio {0}: {1}" -f $svc.Name, $_.Exception.Message)
        }
    }
}

# Matar procesos por nombre
Write-Host "Buscando y matando procesos: $($ProcessNames -join ', ')"
foreach ($n in $ProcessNames) {
    $plist = Get-Process -Name $n -ErrorAction SilentlyContinue
    if ($plist) {
        foreach ($p in $plist) {
            Write-Host ("Matando proceso {0} (PID {1})..." -f $p.ProcessName, $p.Id)
            try {
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Host ("Stop-Process falló para {0} (PID {1}): {2}. Intentando taskkill..." -f $p.ProcessName, $p.Id, $_.Exception.Message)
                cmd /c "taskkill /F /PID $($p.Id)" | Out-Null
            }
        }
    }
}

# Intento adicional por nombre de imagen (exe)
foreach ($exe in @('mysqld.exe','mariadbd.exe','mysqlrouter.exe','wampmysqld.exe')) {
    try { cmd /c "taskkill /F /IM $exe" | Out-Null } catch {}
}

# Verificación y cierre de conexiones en puertos 3306/33060
Write-Host "Verificando y liberando puertos 3306 y 33060..."
try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    & "$scriptDir\kill_mysql_ports.ps1"
} catch {
    Write-Host "No se pudo invocar kill_mysql_ports.ps1: $($_.Exception.Message)"
}

# Comprobación final
$remaining = @()
foreach ($n in $ProcessNames) {
    $p = Get-Process -Name $n -ErrorAction SilentlyContinue
    if ($p) { $remaining += $p }
}

if ($remaining -and $remaining.Count -gt 0) {
    Write-Host ("Aún quedan procesos activos: {0}" -f (($remaining | Select-Object -ExpandProperty Id) -join ', '))
    exit 1
} else {
    Write-Host "No quedan procesos MySQL/MariaDB activos y puertos liberados."
    exit 0
}
