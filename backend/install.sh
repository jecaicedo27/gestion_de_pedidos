#!/bin/bash

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}   🚀  INSTALADOR BASE DE DATOS GESTIÓN DE PEDIDOS  🚀${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Solicitar credenciales
read -p "🖥️  Host de la Base de Datos (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "👤  Usuario de MySQL: " DB_USER

echo -n "🔑  Contraseña de MySQL: "
read -s DB_PASS
echo ""

read -p "📂  Nombre de la Base de Datos (se creará si no existe): " DB_NAME

echo ""
echo -e "${BLUE}⏳  Iniciando proceso de instalación...${NC}"

# Comando base
MYSQL_CMD="mysql -h $DB_HOST -u $DB_USER -p$DB_PASS"

# Crear BD si no existe
echo -e "📦  Creando base de datos '$DB_NAME' si no existe..."
$MYSQL_CMD -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;"
if [ $? -ne 0 ]; then
    echo "❌ Error conectando a MySQL. Verifica tus credenciales."
    exit 1
fi

# Cargar Schema
echo -e "🏗️  Cargando estructura (schema.sql)..."
$MYSQL_CMD $DB_NAME < schema.sql
if [ $? -ne 0 ]; then
    echo "❌ Error cargando schema.sql"
    exit 1
fi

# Cargar Configuraciones Base
if [ -f "seed_config.sql" ]; then
    echo -e "⚙️  Cargando configuración base (seed_config.sql)..."
    $MYSQL_CMD $DB_NAME < seed_config.sql
else
    echo "⚠️  No se encontró seed_config.sql, saltando..."
fi

# Cargar Transportadoras
if [ -f "seed_carriers.sql" ]; then
    echo -e "🚛  Cargando transportadoras (seed_carriers.sql)..."
    $MYSQL_CMD $DB_NAME < seed_carriers.sql
else
    echo "⚠️  No se encontró seed_carriers.sql, saltando..."
fi

# Cargar Usuarios
if [ -f "seed_users.sql" ]; then
    echo -e "👥  Cargando usuarios existentes (seed_users.sql)..."
    $MYSQL_CMD $DB_NAME < seed_users.sql
else
    echo "⚠️  No se encontró seed_users.sql, saltando..."
fi

echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}   ✅  ¡INSTALACIÓN COMPLETADA EXITOSAMENTE!  ✅${NC}"
echo -e "${GREEN}=================================================${NC}"
echo -e "La base de datos '$DB_NAME' está lista para usar."
echo ""
