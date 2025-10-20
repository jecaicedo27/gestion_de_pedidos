const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkProductsTableStructure() {
    console.log('🔍 Verificando estructura de la tabla products...');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: 'utf8mb4'
    });

    try {
        console.log('📋 1. Estructura completa de la tabla products:');
        const [columns] = await connection.execute('DESCRIBE products');
        
        columns.forEach(col => {
            console.log(`- ${col.Field}: ${col.Type} (Null: ${col.Null}, Key: ${col.Key}, Default: ${col.Default})`);
        });

        console.log('\n📋 2. Consultando algunos productos de ejemplo...');
        const [products] = await connection.execute('SELECT * FROM products LIMIT 5');
        
        if (products.length > 0) {
            console.log('📦 Ejemplo de productos encontrados:');
            products.forEach((product, index) => {
                console.log(`\nProducto ${index + 1}:`, JSON.stringify(product, null, 2));
            });
        } else {
            console.log('❌ No se encontraron productos en la tabla');
        }

        console.log('\n📋 3. Buscando productos que contengan "MP175"...');
        const [mp175Products] = await connection.execute(
            'SELECT * FROM products WHERE name LIKE ? OR code LIKE ? OR siigo_id LIKE ? LIMIT 5',
            ['%MP175%', '%MP175%', '%MP175%']
        );
        
        if (mp175Products.length > 0) {
            console.log('📦 Productos relacionados con MP175:');
            mp175Products.forEach(product => {
                console.log(JSON.stringify(product, null, 2));
            });
        } else {
            console.log('❌ No se encontraron productos con MP175 en la tabla');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

checkProductsTableStructure().catch(console.error);
