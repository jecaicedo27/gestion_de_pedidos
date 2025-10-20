/**
 * Update stock values for demonstration
 * This script will set realistic stock values for products to demonstrate the color-coded inventory system
 */

const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function updateStockForDemo() {
    console.log('📦 ACTUALIZANDO STOCK PARA DEMOSTRACIÓN...');
    
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        // Set different stock levels to demonstrate color coding
        // Green (>=50), Yellow (<50 but >0), Red (0)
        
        const stockUpdates = [
            // Green products (high stock >= 50)
            { id: 1, stock: 150, available_quantity: 120 },
            { id: 2, stock: 75, available_quantity: 60 },
            { id: 3, stock: 200, available_quantity: 180 },
            { id: 4, stock: 100, available_quantity: 85 },
            { id: 5, stock: 65, available_quantity: 50 },
            
            // Yellow products (low stock < 50 but > 0)
            { id: 6, stock: 25, available_quantity: 20 },
            { id: 7, stock: 15, available_quantity: 12 },
            { id: 8, stock: 35, available_quantity: 30 },
            { id: 9, stock: 10, available_quantity: 8 },
            { id: 10, stock: 40, available_quantity: 35 },
            
            // Red products (no stock = 0)
            { id: 11, stock: 0, available_quantity: 0 },
            { id: 12, stock: 0, available_quantity: 0 },
            { id: 13, stock: 0, available_quantity: 0 }
        ];
        
        for (const update of stockUpdates) {
            await connection.execute(`
                UPDATE products 
                SET stock = ?, available_quantity = ? 
                WHERE id = ? AND is_active = TRUE
            `, [update.stock, update.available_quantity, update.id]);
        }
        
        // Update LIQUIPOPS products specifically with good stock levels
        await connection.execute(`
            UPDATE products 
            SET stock = 50 + FLOOR(RAND() * 200), 
                available_quantity = 30 + FLOOR(RAND() * 150) 
            WHERE category = 'LIQUIPOPS' 
            AND is_active = TRUE
            LIMIT 10
        `);
        
        // Verify the updates
        const [updatedProducts] = await connection.execute(`
            SELECT id, product_name, category, stock, available_quantity, standard_price
            FROM products 
            WHERE (stock > 0 OR available_quantity > 0)
            AND is_active = TRUE
            ORDER BY stock DESC
            LIMIT 15
        `);
        
        console.log('\n✅ STOCK ACTUALIZADO:');
        updatedProducts.forEach(product => {
            const stock = product.stock || 0;
            const available = product.available_quantity || 0;
            const stockLevel = stock >= 50 ? '🟢 ALTO' : stock > 0 ? '🟡 BAJO' : '🔴 AGOTADO';
            
            console.log(`   ${stockLevel} ${product.product_name}`);
            console.log(`      Stock: ${stock}, Disponible: ${available}, Precio: $${product.standard_price}`);
        });
        
        console.log('\n🎨 COLORES DE STOCK CONFIGURADOS:');
        console.log('   🟢 Verde: Stock >= 50 unidades');
        console.log('   🟡 Amarillo: Stock < 50 pero > 0');
        console.log('   🔴 Rojo: Stock = 0 (agotado)');
        
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    updateStockForDemo().catch(console.error);
}

module.exports = updateStockForDemo;
