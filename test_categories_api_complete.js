require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');

async function testCategoriesAPI() {
    let connection = null;
    
    try {
        console.log('🔍 PROBANDO CATEGORÍAS - BASE DE DATOS vs API');
        
        // Conectar a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });
        
        // Obtener categorías directamente de la BD
        console.log('\n📂 CATEGORÍAS EN BASE DE DATOS:');
        const [dbCategories] = await connection.execute(`
            SELECT c.id, c.name as categoria, COUNT(p.id) as productos 
            FROM categories c 
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE 
            WHERE c.is_active = TRUE 
            GROUP BY c.id, c.name 
            ORDER BY productos DESC, c.name ASC
        `);
        
        dbCategories.forEach(cat => {
            console.log(`   ${cat.categoria}: ${cat.productos} productos`);
        });
        
        console.log(`\n✅ Total categorías en BD: ${dbCategories.length}`);
        
        // Probar endpoint de categorías (simulando llamada HTTP)
        console.log('\n🌐 PROBANDO ENDPOINT /api/categories...');
        
        const axios = require('axios');
        try {
            const response = await axios.get('http://localhost:3001/api/categories', {
                timeout: 5000
            });
            
            console.log(`✅ Status: ${response.status}`);
            console.log(`✅ Categorías devueltas por API: ${response.data.length}`);
            console.log('\n📋 Categorías desde API:');
            
            response.data.forEach(cat => {
                console.log(`   ${cat.categoria}: ${cat.productos} productos`);
            });
            
            // Comparar
            if (response.data.length === dbCategories.length) {
                console.log('\n🎉 ¡PERFECTO! La API devuelve todas las categorías');
            } else {
                console.log('\n⚠️ DISCREPANCIA:');
                console.log(`   BD: ${dbCategories.length} categorías`);
                console.log(`   API: ${response.data.length} categorías`);
            }
            
        } catch (apiError) {
            console.log('❌ Error consultando API:', apiError.message);
            console.log('💡 Esto puede ser normal si el backend no está corriendo');
        }
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testCategoriesAPI();
