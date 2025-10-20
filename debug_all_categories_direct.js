const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugAllCategories() {
    console.log('🔍 Consultando TODAS las categorías directamente de la BD...');
    
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        // Consultar todas las categorías con sus conteos
        const [categories] = await pool.execute(`
            SELECT 
                category, 
                COUNT(*) as count,
                GROUP_CONCAT(DISTINCT barcode ORDER BY barcode SEPARATOR ', ') as sample_codes
            FROM products 
            WHERE category IS NOT NULL 
            AND category != '' 
            AND category != 'Sin categoría'
            GROUP BY category 
            ORDER BY count DESC, category ASC
        `);

        console.log(`\n✅ Encontradas ${categories.length} categorías únicas:`);
        console.log('═'.repeat(80));
        
        categories.forEach((cat, index) => {
            console.log(`${index + 1}. 📂 ${cat.category}`);
            console.log(`   📊 ${cat.count} productos`);
            console.log(`   🔍 Códigos ejemplo: ${cat.sample_codes.substring(0, 100)}${cat.sample_codes.length > 100 ? '...' : ''}`);
            console.log('');
        });

        console.log('═'.repeat(80));
        console.log(`📈 RESUMEN: ${categories.length} categorías total`);
        
        // Buscar específicamente LIQUIPOPS
        const [liquipops] = await pool.execute(`
            SELECT barcode, name FROM products 
            WHERE category LIKE '%LIQUIPOPS%' 
            LIMIT 5
        `);
        
        console.log(`\n🔍 Productos LIQUIPOPS encontrados: ${liquipops.length}`);
        liquipops.forEach(product => {
            console.log(`   - ${product.barcode}: ${product.name}`);
        });

        await pool.end();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

debugAllCategories();
