const { pool } = require('./backend/config/database');

async function debugCategoriesFilter() {
    console.log('🔍 Debuggeando filtro de categorías...');
    
    try {
        // 1. Ver cuántas categorías únicas hay en la base de datos
        console.log('\n📊 Categorías únicas en la base de datos:');
        const [categories] = await pool.execute(`
            SELECT category, COUNT(*) as count 
            FROM products 
            WHERE category IS NOT NULL AND category != '' AND category != 'Sin categoría'
            GROUP BY category 
            ORDER BY category
        `);
        
        console.log('📂 Categorías encontradas:');
        categories.forEach((cat, index) => {
            console.log(`${index + 1}. "${cat.category}" (${cat.count} productos)`);
        });
        
        console.log(`\n📊 Total de categorías únicas: ${categories.length}`);
        
        // 2. Ver también las categorías incluyendo "Sin categoría"
        console.log('\n📊 Incluye también productos "Sin categoría":');
        const [allCategories] = await pool.execute(`
            SELECT category, COUNT(*) as count 
            FROM products 
            GROUP BY category 
            ORDER BY category
        `);
        
        console.log('📂 Todas las categorías:');
        allCategories.forEach((cat, index) => {
            console.log(`${index + 1}. "${cat.category || 'NULL'}" (${cat.count} productos)`);
        });
        
        // 3. Probar el endpoint de categorías directamente
        console.log('\n🌐 Probando endpoint de categorías...');
        const axios = require('axios');
        
        try {
            const response = await axios.get('http://localhost:3001/api/products/categories');
            console.log('✅ Respuesta del endpoint /api/products/categories:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (endpointError) {
            console.error('❌ Error consultando endpoint:', endpointError.message);
        }
        
        // 4. Ver algunas categorías específicas que deberían estar
        console.log('\n🔍 Verificando categorías específicas que deberían estar:');
        const expectedCategories = ['LIQUIPOPS', 'MEZCLAS EN POLVO', 'GENIALITY', 'Materia prima gravadas 19%'];
        
        for (const expectedCat of expectedCategories) {
            const [found] = await pool.execute(
                'SELECT COUNT(*) as count FROM products WHERE category = ?',
                [expectedCat]
            );
            console.log(`📂 "${expectedCat}": ${found[0].count} productos`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

debugCategoriesFilter();
