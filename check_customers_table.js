const mysql = require('mysql2/promise');

async function checkCustomersTable() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        console.log('🔍 Verificando tabla customers...');
        
        // Verificar si existe la tabla customers
        const [tables] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'gestion_pedidos' 
            AND table_name = 'customers'
        `);

        if (tables[0].count === 0) {
            console.log('❌ Tabla customers no existe');
            return false;
        } else {
            console.log('✅ Tabla customers existe');
            
            // Verificar estructura
            const [columns] = await connection.execute('DESCRIBE customers');
            console.log('📋 Estructura de la tabla customers:');
            columns.forEach(col => {
                console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
            });
            
            // Verificar datos
            const [count] = await connection.execute('SELECT COUNT(*) as count FROM customers');
            console.log(`📊 Registros en customers: ${count[0].count}`);
            
            if (count[0].count > 0) {
                const [sample] = await connection.execute('SELECT * FROM customers LIMIT 3');
                console.log('📋 Muestra de datos:');
                sample.forEach(customer => {
                    console.log(`   ID: ${customer.id}, NIT: ${customer.document_number}, Nombre: ${customer.name}`);
                });
            }
            
            return true;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkCustomersTable().then(exists => {
    if (!exists) {
        console.log('🔧 Necesita crear la tabla customers');
        process.exit(1);
    } else {
        console.log('✅ Tabla customers OK');
        process.exit(0);
    }
});
