const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugProductStatusImport() {
    console.log('🔍 Iniciando debug del problema de estado de productos...');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: 'utf8mb4'
    });

    try {
        console.log('📋 1. Consultando producto MP175 en la base de datos local...');
        
        const [localProduct] = await connection.execute(
            'SELECT * FROM products WHERE internal_code = ? OR siigo_id IS NOT NULL',
            ['MP175']
        );
        
        if (localProduct.length > 0) {
            console.log('📦 Producto MP175 encontrado en BD local:');
            console.log(JSON.stringify(localProduct[0], null, 2));
        } else {
            console.log('❌ Producto MP175 no encontrado en BD local');
        }

        console.log('\n📋 2. Consultando algunos productos que deberían estar inactivos...');
        const [products] = await connection.execute(
            'SELECT internal_code, product_name, is_active, siigo_id FROM products WHERE internal_code IN ("MP175", "MP174", "SH32", "SH36") ORDER BY internal_code'
        );
        
        console.log('📊 Productos en BD local:');
        products.forEach(product => {
            console.log(`- ${product.internal_code}: is_active=${product.is_active}, siigo_id=${product.siigo_id}`);
        });

        console.log('\n📋 3. Verificando estructura de la tabla products...');
        const [columns] = await connection.execute(
            'DESCRIBE products'
        );
        
        console.log('📊 Columnas relacionadas con estado:');
        columns.forEach(col => {
            if (col.Field.includes('active') || col.Field.includes('status') || col.Field.includes('siigo')) {
                console.log(`- ${col.Field}: ${col.Type} (Default: ${col.Default})`);
            }
        });

        console.log('\n📋 4. Consultando todos los productos con estado inactivo...');
        const [inactiveProducts] = await connection.execute(
            'SELECT internal_code, product_name, is_active FROM products WHERE is_active = 0 LIMIT 10'
        );
        
        console.log(`📊 Productos inactivos encontrados: ${inactiveProducts.length}`);
        inactiveProducts.forEach(product => {
            console.log(`- ${product.internal_code}: is_active=${product.is_active}`);
        });

        console.log('\n📋 5. Verificar algunos productos específicos mencionados por el usuario...');
        const [specificProducts] = await connection.execute(
            'SELECT internal_code, product_name, is_active, siigo_id FROM products WHERE internal_code LIKE "MP%" ORDER BY internal_code LIMIT 20'
        );
        
        console.log(`📊 Productos MP* encontrados: ${specificProducts.length}`);
        specificProducts.forEach(product => {
            console.log(`- ${product.internal_code}: is_active=${product.is_active}, siigo_id=${product.siigo_id}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

debugProductStatusImport().catch(console.error);
