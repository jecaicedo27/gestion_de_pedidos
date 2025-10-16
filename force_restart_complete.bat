@echo off
echo ========================================
echo 🔄 FORZANDO REINICIO COMPLETO
echo ========================================
echo.

echo 🛑 Deteniendo todos los procesos Node.js...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1

echo ⏳ Esperando 3 segundos...
timeout /t 3 /nobreak >nul

echo 🔧 Iniciando Backend...
start "Backend Server" cmd /k "cd backend && npm start"

echo ⏳ Esperando 8 segundos para que el backend inicie completamente...
timeout /t 8 /nobreak >nul

echo 🎨 Iniciando Frontend...
start "Frontend Server" cmd /k "cd frontend && npm start"

echo.
echo ✅ REINICIO FORZADO COMPLETADO!
echo.
echo 📋 Se abrieron dos nuevas terminales:
echo - Backend: Servidor en puerto 3001
echo - Frontend: Servidor en puerto 3000
echo.
echo 🧪 Verificando en 10 segundos...
timeout /t 10 /nobreak >nul

echo.
echo 🔍 Ejecutando verificación...
node verify_complete_restart.js

echo.
echo 🧪 Probando endpoint HTML...
node test_html_guide.js

echo.
pause
