const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkProductsWithInactiveStatus() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gestion_pedidos',
        port: process.env.DB_PORT || 3306
    });

    try {
        // Check products table structure
        console.log('=== Products Table Structure ===');
        const [structure] = await connection.execute('DESCRIBE products');
        structure.forEach(col => {
            if (col.Field.includes('active') || col.Field.includes('status') || col.Field.includes('siigo')) {
                console.log(`${col.Field}: ${col.Type} (${col.Null}, default: ${col.Default})`);
            }
        });
        
        console.log('\n=== Sample Products with INAVILITADO in Name ===');
        const [inactiveProducts] = await connection.execute(`
            SELECT id, product_name, siigo_id, is_active, last_sync_at 
            FROM products 
            WHERE product_name LIKE '%INAVILITADO%' 
            LIMIT 5
        `);
        
        inactiveProducts.forEach(product => {
            console.log(`ID: ${product.id}`);
            console.log(`Name: ${product.product_name}`);
            console.log(`SIIGO ID: ${product.siigo_id}`);
            console.log(`is_active: ${product.is_active}`);
            console.log(`last_sync_at: ${product.last_sync_at}`);
            console.log('---');
        });
        
        console.log('\n=== Product Status Statistics ===');
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_products,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_products,
                COUNT(CASE WHEN product_name LIKE '%INAVILITADO%' THEN 1 END) as products_with_inavilitado,
                COUNT(CASE WHEN product_name LIKE '%INAVILITADO%' AND is_active = 1 THEN 1 END) as inavilitado_but_active
            FROM products
        `);
        
        console.log(`Total products: ${stats[0].total_products}`);
        console.log(`Active products: ${stats[0].active_products}`);
        console.log(`Inactive products: ${stats[0].inactive_products}`);
        console.log(`Products with INAVILITADO in name: ${stats[0].products_with_inavilitado}`);
        console.log(`INAVILITADO products marked as active: ${stats[0].inavilitado_but_active}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkProductsWithInactiveStatus();
