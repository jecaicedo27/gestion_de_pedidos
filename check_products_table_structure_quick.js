const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkProductsTableStructure() {
    console.log('🔍 Verificando estructura de la tabla products...\n');
    
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });
        
        console.log('✅ Conectado a la base de datos');
        
        // Describir estructura de la tabla products
        console.log('\n📋 Estructura de la tabla products:');
        const [columns] = await connection.execute('DESCRIBE products');
        
        columns.forEach(column => {
            console.log(`- ${column.Field} (${column.Type}) ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${column.Key ? `[${column.Key}]` : ''} ${column.Default !== null ? `DEFAULT: ${column.Default}` : ''}`);
        });
        
        // Mostrar algunos productos de ejemplo
        console.log('\n📦 Muestra de productos (primeros 5):');
        const [products] = await connection.execute('SELECT * FROM products LIMIT 5');
        
        if (products.length > 0) {
            console.log('Columnas disponibles:', Object.keys(products[0]).join(', '));
            products.forEach((product, index) => {
                console.log(`\n${index + 1}. ID: ${product.id}`);
                console.log(`   siigo_id: ${product.siigo_id}`);
                console.log(`   name: ${product.name}`);
                console.log(`   is_active: ${product.is_active}`);
                if (product.barcode) console.log(`   barcode: ${product.barcode}`);
                if (product.reference) console.log(`   reference: ${product.reference}`);
            });
        } else {
            console.log('No hay productos en la tabla');
        }
        
        // Contar productos
        const [count] = await connection.execute('SELECT COUNT(*) as total FROM products');
        console.log(`\n📊 Total de productos: ${count[0].total}`);
        
        // Contar productos activos vs inactivos
        const [activeCount] = await connection.execute('SELECT COUNT(*) as total FROM products WHERE is_active = 1');
        const [inactiveCount] = await connection.execute('SELECT COUNT(*) as total FROM products WHERE is_active = 0');
        console.log(`📊 Productos activos: ${activeCount[0].total}`);
        console.log(`📊 Productos inactivos: ${inactiveCount[0].total}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkProductsTableStructure();
