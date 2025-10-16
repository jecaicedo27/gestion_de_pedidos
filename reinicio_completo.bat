@echo off
echo ====================================
echo 🔄 REINICIO COMPLETO DE LA APLICACION
echo ====================================
echo.

echo 📋 CAMBIOS IMPLEMENTADOS:
echo ✅ Base de datos: shipping_payment_method
echo ✅ Backend: Extraccion mejorada logistica  
echo ✅ Frontend: Modal con metodo de pago automatico
echo.

echo 🛑 DETENIENDO PROCESOS EXISTENTES...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 🔄 LIMPIANDO CACHE...
if exist "frontend\node_modules\.cache" (
    rmdir /s /q "frontend\node_modules\.cache" 2>nul
)

echo 📡 INICIANDO BACKEND...
start "BACKEND" cmd /c "cd backend && echo 🚀 Iniciando Backend... && npm run dev"

echo ⏳ Esperando 5 segundos para que inicie el backend...
timeout /t 5 /nobreak >nul

echo 🌐 INICIANDO FRONTEND...
start "FRONTEND" cmd /c "cd frontend && echo 🚀 Iniciando Frontend... && npm start"

echo ⏳ Esperando 10 segundos para la compilacion...
timeout /t 10 /nobreak >nul

echo 🌐 ABRIENDO NAVEGADOR...
start http://localhost:3000

echo.
echo ✅ REINICIO COMPLETO APLICADO!
echo.
echo 🎯 INSTRUCCIONES:
echo 1. Espera que ambas ventanas esten corriendo
echo 2. En el navegador: Login admin/admin123
echo 3. Ir a Logistica ^> Pedido 12668
echo 4. El modal mostrara las nuevas secciones:
echo    📦 Informacion del pedido
echo    📄 Observaciones SIIGO (amarillo)
echo    📍 Datos detectados (verde)
echo    💰 Metodo de pago de envio
echo.
echo 🚨 Si no ves los cambios: Presiona F5 para refrescar
echo.
pause
