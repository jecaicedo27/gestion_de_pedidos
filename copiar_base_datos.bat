@echo off
echo ========================================
echo COPIANDO ARCHIVOS DE BASE DE DATOS
echo ========================================
echo.
echo ORIGEN: C:\Users\USUARIO\Downloads\gestion_pedidos_dev
echo DESTINO: C:\xampp\mysql\data\gestion_pedidos_dev
echo.
echo Copiando archivos...
xcopy "C:\Users\USUARIO\Downloads\gestion_pedidos_dev\*.*" "C:\xampp\mysql\data\gestion_pedidos_dev\" /Y /Q
echo.
if %ERRORLEVEL% EQU 0 (
    echo ✅ ARCHIVOS COPIADOS EXITOSAMENTE
    echo.
    echo AHORA:
    echo 1. Inicia MySQL desde XAMPP Control Panel
    echo 2. Ejecuta: node consultar_pedido_12580_directo.js
) else (
    echo ❌ ERROR AL COPIAR ARCHIVOS
    echo Verifica que:
    echo - XAMPP MySQL esté detenido
    echo - Tengas permisos de administrador
    echo - Las rutas sean correctas
)
echo.
pause