param(
    [int[]]$Ports = @(3306, 33060)
)

function Get-PidsByPorts {
    param([int[]]$ports)

    $pids = @()
    foreach ($p in $ports) {
        try {
            # Intentar con Get-NetTCPConnection (requiere módulos de red disponibles)
            $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction Stop
            if ($conns) {
                $pids += ($conns | Select-Object -ExpandProperty OwningProcess)
            }
        } catch {
            # Fallback usando netstat si el cmdlet no está disponible
            $net = cmd /c "netstat -ano | findstr :$p"
            if ($net) {
                $lines = $net -split "`r?`n"
                foreach ($line in $lines) {
                    if ([string]::IsNullOrWhiteSpace($line)) { continue }
                    $tokens = ($line -replace '\s+', ' ').Trim().Split(' ')
                    if ($tokens.Length -ge 5) {
                        $pidToken = $tokens[$tokens.Length - 1]
                        if ([int]::TryParse($pidToken, [ref]([int]$null))) {
                            $pids += [int]$pidToken
                        }
                    }
                }
            }
        }
    }
    return ($pids | Sort-Object -Unique)
}

Write-Host ("Buscando procesos en puertos: {0}..." -f ($Ports -join ", "))

$pids = Get-PidsByPorts -ports $Ports

if (-not $pids -or $pids.Count -eq 0) {
    Write-Host ("No hay procesos usando los puertos: {0}" -f ($Ports -join ", "))
    exit 0
}

Write-Host ("PIDs a eliminar: {0}" -f ($pids -join ", "))

foreach ($pid in $pids) {
    try {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host ("Matando PID {0} ({1})..." -f $pid, $proc.ProcessName)
        } else {
            Write-Host ("Matando PID {0}..." -f $pid)
        }

        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
        } catch {
            Write-Host ("Stop-Process falló para {0}: {1}. Intentando taskkill..." -f $pid, $_.Exception.Message)
            cmd /c "taskkill /F /PID $pid" | Out-Null
        }
    } catch {
        Write-Host ("No se pudo procesar PID {0}: {1}" -f $pid, $_.Exception.Message)
    }
}

Start-Sleep -Seconds 1

$remaining = Get-PidsByPorts -ports $Ports
if ($remaining -and $remaining.Count -gt 0) {
    Write-Host ("Aún quedan PIDs usando los puertos: {0}" -f ($remaining -join ", "))
    exit 1
} else {
    Write-Host ("Puertos liberados: {0}" -f ($Ports -join ", "))
    exit 0
}
