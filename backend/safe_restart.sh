#!/bin/bash

# 🛡️ SCRIPT DE REINICIO SEGURO - GESTIÓN PERLAS
# Este script previene errores humanos o de IA asegurando que estamos en la carpeta correcta
# antes de reiniciar el proceso específico.

APP_NAME="perlas-backend"
EXPECTED_DIR="/var/www/gestion_de_pedidos/backend"

# 1. Verificación de Directorio (Context Safety)
if [[ "$PWD" != "$EXPECTED_DIR" ]]; then
    echo "❌ PELIGRO: Estás intentando reiniciar desde el directorio incorrecto."
    echo "   Esperado: $EXPECTED_DIR"
    echo "   Actual:   $PWD"
    echo "⛔ Operación cancelada para proteger otras aplicaciones (ej. Popping Boba)."
    exit 1
fi

# 2. Ejecución Segura
echo "✅ Contexto Verificado: Gestión de Pedidos (Perlas)"
echo "🔄 Reiniciando proceso exclusivo: '$APP_NAME'..."

pm2 restart $APP_NAME

if [ $? -eq 0 ]; then
    echo "✨ Éxito: '$APP_NAME' se ha reiniciado correctamente."
else
    echo "❌ Error: No se pudo reiniciar. Verifica 'pm2 list'."
fi
