const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkOrdersTableStructure() {
    let connection;
    
    try {
        console.log('🔧 Conectando a la base de datos...');
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });

        console.log('✅ Conexión establecida');

        // Describir la estructura de la tabla orders
        const [columns] = await connection.execute('DESCRIBE orders');
        
        console.log('📊 Estructura de la tabla orders:');
        columns.forEach(column => {
            console.log(`   - ${column.Field}: ${column.Type} (${column.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });

        // Mostrar algunas filas de ejemplo para ver qué datos tenemos
        const [sampleData] = await connection.execute(`
            SELECT id, siigo_customer_id, customer_name, customer_phone, customer_email, 
                   customer_address, customer_city, customer_state, notes
            FROM orders 
            WHERE siigo_customer_id IS NOT NULL 
            AND customer_name IS NOT NULL 
            LIMIT 5
        `);

        console.log('\n📝 Datos de ejemplo:');
        sampleData.forEach((row, index) => {
            console.log(`\n   Ejemplo ${index + 1}:`);
            console.log(`   - ID: ${row.id}`);
            console.log(`   - SIIGO Customer ID: ${row.siigo_customer_id}`);
            console.log(`   - Customer Name: ${row.customer_name}`);
            console.log(`   - Customer Phone: ${row.customer_phone}`);
            console.log(`   - Customer Email: ${row.customer_email}`);
            console.log(`   - Customer Address: ${row.customer_address}`);
            console.log(`   - Customer City: ${row.customer_city}`);
            console.log(`   - Customer State: ${row.customer_state}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code) {
            console.error('🔍 Código de error:', error.code);
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

// Ejecutar la función
checkOrdersTableStructure();
