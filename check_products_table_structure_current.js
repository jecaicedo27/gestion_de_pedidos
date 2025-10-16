const mysql = require('mysql2/promise');

// Database connection
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function checkProductsTableStructure() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('🔗 Conectado a la base de datos');

        // Check products table structure
        console.log('\n📋 ESTRUCTURA ACTUAL DE LA TABLA PRODUCTS:');
        console.log('=====================================================');
        
        const [columns] = await connection.execute('DESCRIBE products');
        columns.forEach(column => {
            console.log(`${column.Field.padEnd(25)} | ${column.Type.padEnd(20)} | ${column.Null.padEnd(8)} | Default: ${column.Default}`);
        });

        // Check categories table structure
        console.log('\n📂 ESTRUCTURA ACTUAL DE LA TABLA CATEGORIES:');
        console.log('=====================================================');
        
        try {
            const [categoryColumns] = await connection.execute('DESCRIBE categories');
            categoryColumns.forEach(column => {
                console.log(`${column.Field.padEnd(25)} | ${column.Type.padEnd(20)} | ${column.Null.padEnd(8)} | Default: ${column.Default}`);
            });
        } catch (error) {
            console.log('❌ Tabla categories no existe');
        }

        // Check current data
        console.log('\n📊 DATOS ACTUALES:');
        console.log('=====================================================');
        
        const [productCount] = await connection.execute('SELECT COUNT(*) as count FROM products');
        console.log(`Productos en BD: ${productCount[0].count}`);

        if (productCount[0].count > 0) {
            console.log('\n📋 MUESTRA DE PRODUCTOS EXISTENTES:');
            const [sampleProducts] = await connection.execute('SELECT * FROM products LIMIT 3');
            sampleProducts.forEach((product, index) => {
                console.log(`\n--- PRODUCTO ${index + 1} ---`);
                Object.keys(product).forEach(key => {
                    console.log(`${key}: ${product[key]}`);
                });
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

checkProductsTableStructure();
