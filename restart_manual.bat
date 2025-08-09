@echo off
echo 🔄 REINICIANDO APLICACION MANUALMENTE
echo ====================================

echo.
echo 1️⃣ Matando procesos Node.js...
taskkill /F /IM node.exe 2>nul
echo ✅ Procesos Node.js terminados

echo.
echo 2️⃣ Esperando 3 segundos...
timeout /t 3 /nobreak >nul

echo.
echo 3️⃣ Iniciando backend...
echo Abriendo nueva ventana para backend...
start "Backend" cmd /k "cd /d %~dp0backend && echo Iniciando backend... && npm run dev"

echo.
echo 4️⃣ Esperando 8 segundos antes de iniciar frontend...
timeout /t 8 /nobreak

echo.
echo 5️⃣ Iniciando frontend...
echo Abriendo nueva ventana para frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && echo Iniciando frontend... && npm start"

echo.
echo 🎉 APLICACION INICIANDOSE
echo =========================
echo.
echo ✅ Backend: Se abrió en nueva ventana
echo ✅ Frontend: Se abrió en nueva ventana
echo.
echo 📋 PROXIMOS PASOS:
echo 1. Espera a que ambas ventanas muestren "corriendo"
echo 2. Ve a http://localhost:3000 en el navegador
echo 3. Inicia sesion como admin/admin123
echo 4. Ve a la seccion de Logistica
echo 5. Verifica las fichas de entrega
echo.
pause
