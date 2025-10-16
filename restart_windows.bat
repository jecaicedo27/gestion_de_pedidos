@echo off
echo ========================================
echo 🔄 REINICIO COMPLETO DE LA APLICACION
echo ========================================
echo.

echo 📋 INSTRUCCIONES:
echo 1. Cierra las terminales del backend y frontend si estan abiertas
echo 2. Ejecuta este script para reiniciar todo
echo.

echo 🔧 Iniciando Backend...
echo Abriendo nueva terminal para el backend...
start "Backend Server" cmd /k "cd backend && npm start"

echo.
echo ⏳ Esperando 5 segundos para que el backend inicie...
timeout /t 5 /nobreak >nul

echo.
echo 🎨 Iniciando Frontend...
echo Abriendo nueva terminal para el frontend...
start "Frontend Server" cmd /k "cd frontend && npm start"

echo.
echo ✅ REINICIO COMPLETADO!
echo.
echo 📋 VERIFICACION:
echo - Backend: Se abrio en una nueva terminal
echo - Frontend: Se abrio en otra nueva terminal
echo.
echo 🌐 Una vez que ambos servidores esten listos:
echo 1. Ve a: http://localhost:3000
echo 2. Prueba la funcionalidad de guias de envio
echo.
echo 🧪 Para verificar que todo funciona:
echo Ejecuta: node verify_complete_restart.js
echo.
pause
