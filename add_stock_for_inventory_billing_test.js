const mysql = require('mysql2/promise');

async function addStockForTest() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        console.log('🔄 Adding stock to products for inventory billing test...');
        
        // Update first 10 active products to have stock
        const updateQuery = `
            UPDATE products 
            SET stock = 10, is_active = 1 
            WHERE is_active = 1 OR id <= 10 
            LIMIT 10
        `;
        
        const [result] = await connection.execute(updateQuery);
        console.log(`✅ Updated ${result.affectedRows} products with stock`);
        
        // Check updated products
        const checkQuery = `
            SELECT id, product_name, code, siigo_code, stock, is_active, unit_price 
            FROM products 
            WHERE stock > 0 AND is_active = 1 
            LIMIT 5
        `;
        
        const [products] = await connection.execute(checkQuery);
        console.log('\n📋 Products with stock:');
        products.forEach(p => {
            console.log(`- ${p.product_name || 'No name'} (ID: ${p.id}, Code: ${p.siigo_code || p.code}, Stock: ${p.stock})`);
        });
        
        console.log('\n✅ Stock added successfully for inventory billing test');
        
    } catch (error) {
        console.error('❌ Error adding stock:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

addStockForTest();
