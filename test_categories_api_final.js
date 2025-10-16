const axios = require('axios');
const mysql = require('mysql2/promise');

async function testCategoriesAPI() {
    console.log('🧪 PROBANDO API DE CATEGORÍAS DESPUÉS DEL REINICIO');
    console.log('===============================================');
    
    try {
        // Test direct database first
        console.log('\n1️⃣ VERIFICANDO BASE DE DATOS DIRECTAMENTE...');
        const db = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        // Check categories in database
        const [categories] = await db.execute(`
            SELECT 
                c.id, 
                c.name as categoria, 
                COUNT(p.id) as productos 
            FROM categories c 
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE 
            WHERE c.is_active = TRUE 
            GROUP BY c.id, c.name 
            ORDER BY productos DESC, c.name ASC
        `);

        console.log('\n📊 CATEGORÍAS EN BASE DE DATOS:');
        categories.forEach(cat => {
            const status = cat.productos > 0 ? '✅' : '⚠️';
            console.log(`${status} ${cat.categoria}: ${cat.productos} productos`);
        });

        console.log(`\n📈 Total categorías: ${categories.length}`);
        console.log(`📈 Categorías con productos: ${categories.filter(c => c.productos > 0).length}`);

        // Check YEXIS specifically
        const [yexisCheck] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM products 
            WHERE category = 'YEXIS' AND is_active = TRUE
        `);
        console.log(`📈 YEXIS productos: ${yexisCheck[0].count}`);

        await db.end();

        // Test API endpoint
        console.log('\n2️⃣ PROBANDO API ENDPOINT...');
        
        const response = await axios.get('http://localhost:3001/api/products/categories');
        
        console.log(`✅ Status: ${response.status}`);
        console.log(`📊 Categorías recibidas: ${response.data.length}`);
        
        console.log('\n📋 RESPUESTA DE LA API:');
        response.data.forEach((cat, index) => {
            const status = cat.productos > 0 ? '✅' : '⚠️';
            console.log(`${index + 1}. ${status} ${cat.categoria}: ${cat.productos} productos`);
        });

        // Check YEXIS in API response
        const yexisInAPI = response.data.find(cat => cat.categoria === 'YEXIS');
        if (yexisInAPI) {
            console.log(`\n🎯 YEXIS en API: ${yexisInAPI.productos} productos`);
        } else {
            console.log('\n❌ YEXIS no encontrada en respuesta API');
        }

        console.log('\n3️⃣ ANÁLISIS DE RESULTADOS:');
        
        const categoriesWithProducts = response.data.filter(cat => cat.productos > 0);
        console.log(`✅ Total categorías disponibles: ${response.data.length}`);
        console.log(`✅ Categorías con productos: ${categoriesWithProducts.length}`);
        
        if (response.data.length >= 16) {
            console.log('✅ Las 16 categorías están disponibles');
        } else {
            console.log(`⚠️ Solo ${response.data.length} categorías disponibles (esperadas: 16)`);
        }

        if (yexisInAPI && yexisInAPI.productos >= 27) {
            console.log('✅ YEXIS tiene productos asignados correctamente');
        } else {
            console.log(`⚠️ YEXIS tiene ${yexisInAPI ? yexisInAPI.productos : 0} productos (esperados: 27)`);
        }

        console.log('\n🎉 PRUEBA COMPLETADA');
        console.log('📱 El frontend ahora debería mostrar todas las categorías con productos');
        console.log('🌐 Acceda a: http://localhost:3000/products');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📊 Response status:', error.response.status);
            console.error('📊 Response data:', error.response.data);
        }
    }
}

testCategoriesAPI();
