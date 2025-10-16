const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function runMigration() {
    let connection;
    
    try {
        // Crear conexión
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev',
            multipleStatements: true
        });

        console.log('🔗 Conectado a la base de datos');

        // Leer el archivo SQL
        const fs = require('fs').promises;
        const sqlFilePath = path.join(__dirname, 'create_messenger_cash_system.sql');
        const sqlContent = await fs.readFile(sqlFilePath, 'utf8');

        console.log('📋 Ejecutando migración del sistema de caja de mensajeros...');

        // Ejecutar las queries
        await connection.query(sqlContent);

        console.log('✅ Migración completada exitosamente');

        // Verificar las tablas creadas
        const [tables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME IN (
                'messenger_cash_closings',
                'cash_closing_details',
                'delivery_evidence',
                'cash_deliveries'
            )
        `, [process.env.DB_NAME || 'gestion_pedidos_dev']);

        console.log('\n📊 Tablas creadas:');
        tables.forEach(table => {
            console.log(`   ✓ ${table.TABLE_NAME}`);
        });

        // Verificar la vista
        const [views] = await connection.query(`
            SELECT TABLE_NAME 
            FROM information_schema.VIEWS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'messenger_cash_summary'
        `, [process.env.DB_NAME || 'gestion_pedidos_dev']);

        if (views.length > 0) {
            console.log('   ✓ messenger_cash_summary (vista)');
        }

        // Verificar columnas agregadas a orders
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'orders'
            AND COLUMN_NAME IN ('cash_collected', 'cash_collected_at', 'cash_collected_by')
        `, [process.env.DB_NAME || 'gestion_pedidos_dev']);

        console.log('\n📝 Columnas agregadas a orders:');
        columns.forEach(col => {
            console.log(`   ✓ ${col.COLUMN_NAME}`);
        });

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

// Ejecutar la migración
runMigration().catch(console.error);
