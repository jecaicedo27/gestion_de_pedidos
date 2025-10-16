const mysql = require('mysql2/promise');

// Configuración de base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'gestion_pedidos_dev',
    charset: 'utf8mb4'
};

async function verifyCategories() {
    let connection;
    
    try {
        console.log('🔄 Conectando a la base de datos gestion_pedidos_dev...');
        connection = await mysql.createConnection(dbConfig);
        
        console.log('✅ Conexión establecida');
        
        // Verificar todas las categorías disponibles
        console.log('\n📋 Categorías disponibles en la tabla products:');
        const [categories] = await connection.execute(`
            SELECT DISTINCT category, COUNT(*) as total_productos
            FROM products 
            WHERE category IS NOT NULL 
            AND category != '' 
            AND is_active = 1
            GROUP BY category
            ORDER BY category ASC
        `);
        
        console.log(`\nTotal de categorías encontradas: ${categories.length}\n`);
        categories.forEach((cat, index) => {
            console.log(`${index + 1}. ${cat.category} (${cat.total_productos} productos)`);
        });
        
        // Categorías que el usuario quiere por defecto
        const requestedCategories = [
            'GENIALITY',
            'LIQUIPOPS', 
            'MEZCLAS EN POLVO',
            'Productos No fabricados 19%',
            'YEXIS'
        ];
        
        console.log('\n🎯 Categorías solicitadas por defecto:');
        requestedCategories.forEach((reqCat, index) => {
            console.log(`${index + 1}. ${reqCat}`);
        });
        
        console.log('\n✅ Verificación de coincidencias:');
        const foundCategories = [];
        const missingCategories = [];
        
        requestedCategories.forEach(reqCat => {
            const found = categories.find(cat => cat.category === reqCat);
            if (found) {
                console.log(`✅ ${reqCat} - ENCONTRADA (${found.total_productos} productos)`);
                foundCategories.push(reqCat);
            } else {
                console.log(`❌ ${reqCat} - NO ENCONTRADA`);
                missingCategories.push(reqCat);
            }
        });
        
        console.log(`\n📊 Resumen:`);
        console.log(`- Categorías encontradas: ${foundCategories.length}/${requestedCategories.length}`);
        console.log(`- Categorías faltantes: ${missingCategories.length}`);
        
        if (missingCategories.length > 0) {
            console.log('\n🔍 Búsqueda de categorías similares:');
            missingCategories.forEach(missing => {
                console.log(`\nBuscando similar a "${missing}":`);
                const similar = categories.filter(cat => 
                    cat.category.toLowerCase().includes(missing.toLowerCase()) ||
                    missing.toLowerCase().includes(cat.category.toLowerCase())
                );
                if (similar.length > 0) {
                    similar.forEach(sim => {
                        console.log(`  - Posible coincidencia: "${sim.category}" (${sim.total_productos} productos)`);
                    });
                } else {
                    console.log(`  - No se encontraron categorías similares`);
                }
            });
        }
        
        // Mostrar algunos productos de cada categoría encontrada
        if (foundCategories.length > 0) {
            console.log('\n📦 Ejemplos de productos por categoría encontrada:');
            for (const category of foundCategories) {
                const [products] = await connection.execute(`
                    SELECT product_name, standard_price, available_quantity
                    FROM products 
                    WHERE category = ? AND is_active = 1
                    LIMIT 3
                `, [category]);
                
                console.log(`\n${category}:`);
                products.forEach((product, index) => {
                    console.log(`  ${index + 1}. ${product.product_name} - $${product.standard_price} (Stock: ${product.available_quantity})`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

verifyCategories();
