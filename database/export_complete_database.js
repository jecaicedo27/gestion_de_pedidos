const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Configuración de la base de datos desde variables de entorno
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'gestion_pedidos_dev';

console.log('🔍 Configuración detectada:');
console.log(`   Host: ${DB_HOST}`);
console.log(`   Usuario: ${DB_USER}`);
console.log(`   Base de datos: ${DB_NAME}`);
console.log(`   Password: ${DB_PASSWORD ? '***' : '(vacío)'}`);

// Fecha y hora para el nombre del archivo
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
const outputDir = path.join(__dirname);
const outputFile = path.join(outputDir, `gestion_pedidos_complete_${timestamp}.sql`);

console.log('\n🗄️  Exportando base de datos completa...');
console.log(`📁 Archivo de salida: ${outputFile}`);

// Construir el comando mysqldump con contraseña si existe
const passwordArg = DB_PASSWORD ? `-p'${DB_PASSWORD}'` : '';

const dumpCommand = `mysqldump -h ${DB_HOST} -u ${DB_USER} ${passwordArg} \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --complete-insert \
  --add-drop-table \
  --add-drop-trigger \
  --default-character-set=utf8mb4 \
  ${DB_NAME} > "${outputFile}"`;

console.log('\n⏳ Ejecutando exportación...');

exec(dumpCommand, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error exportando base de datos:', error.message);
        if (stderr) {
            console.error('Detalles del error:', stderr);
        }
        process.exit(1);
    }

    // Verificar que el archivo se creó
    if (fs.existsSync(outputFile)) {
        const stats = fs.statSync(outputFile);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log('\n✅ ¡Base de datos exportada exitosamente!');
        console.log(`📦 Tamaño del archivo: ${fileSizeMB} MB`);
        console.log(`📍 Ubicación: ${outputFile}`);
        console.log('\n📋 Contenido exportado:');
        console.log('   ✓ Estructura de todas las tablas');
        console.log('   ✓ Todos los datos (usuarios, productos, pedidos, clientes, etc.)');
        console.log('   ✓ Stored procedures y functions');
        console.log('   ✓ Triggers');
        console.log('   ✓ Eventos programados');
        console.log('\n💡 Para importar esta base de datos en un nuevo servidor:');
        console.log('   1. Crear la base de datos: CREATE DATABASE gestion_pedidos_dev;');
        console.log(`   2. Importar: mysql -u ${DB_USER} ${passwordArg} ${DB_NAME} < "${path.basename(outputFile)}"`);
        console.log('\nEste archivo contiene TODA la información necesaria para replicar');
        console.log('el sistema completo con usuarios, productos, pedidos y configuraciones.');
    } else {
        console.error('❌ El archivo de exportación no se creó correctamente');
        process.exit(1);
    }
});
