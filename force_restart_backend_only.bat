@echo off
echo ========================================
echo 🔄 FORZANDO REINICIO SOLO DEL BACKEND
echo ========================================
echo.

echo 🛑 Matando todos los procesos Node.js del backend...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo table /nh') do (
    echo Matando proceso %%i
    taskkill /f /pid %%i >nul 2>&1
)

echo ⏳ Esperando 5 segundos...
timeout /t 5 /nobreak >nul

echo 🔧 Iniciando Backend con los cambios más recientes...
start "Backend Server - UPDATED" cmd /k "cd backend && echo REINICIANDO CON CAMBIOS ACTUALIZADOS && npm start"

echo ⏳ Esperando 10 segundos para que el backend inicie completamente...
timeout /t 10 /nobreak >nul

echo.
echo ✅ BACKEND REINICIADO CON CAMBIOS!
echo.

echo 🧪 Probando endpoint HTML actualizado...
node test_html_guide.js

echo.
echo 🔍 Verificando funcionamiento completo...
node verify_complete_restart.js

echo.
pause
