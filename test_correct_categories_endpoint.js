const axios = require('axios');
const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function testCategoriesEndpoint() {
    try {
        console.log('🧪 PROBANDO EL ENDPOINT CORRECTO DE CATEGORÍAS');
        console.log('='*60);

        // 1. Verificar datos en la base de datos directamente
        console.log('\n🗄️  PASO 1: VERIFICANDO DATOS EN LA BASE DE DATOS...');
        const connection = await mysql.createConnection(dbConfig);

        const query = `
            SELECT category, COUNT(*) as product_count 
            FROM products 
            WHERE category IS NOT NULL AND category != '' 
            GROUP BY category 
            ORDER BY product_count DESC
        `;
        
        const [rows] = await connection.execute(query);
        console.log(`📊 Categorías encontradas en BD: ${rows.length}`);
        
        rows.forEach((row, index) => {
            console.log(`   ${index + 1}. ${row.category}: ${row.product_count} productos`);
        });
        
        await connection.end();

        // 2. Probar el endpoint correcto
        console.log('\n🌐 PASO 2: PROBANDO ENDPOINT /api/products/categories...');
        
        try {
            // Primero, necesitamos obtener un token de autenticación
            console.log('🔐 Obteniendo token de autenticación...');
            
            const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
                username: 'admin',
                password: 'admin123'
            });
            
            const token = loginResponse.data.token;
            console.log('✅ Token obtenido exitosamente');
            
            // Ahora probamos el endpoint de categorías con autenticación
            const categoriesResponse = await axios.get('http://localhost:3001/api/products/categories', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('\n✅ ENDPOINT /api/products/categories FUNCIONA CORRECTAMENTE!');
            console.log(`📊 Categorías devueltas por API: ${categoriesResponse.data.data.length}`);
            
            categoriesResponse.data.data.forEach((category, index) => {
                console.log(`   ${index + 1}. ${category.name}: ${category.product_count} productos`);
            });
            
            // 3. Comparación entre BD y API
            console.log('\n🔍 PASO 3: COMPARACIÓN BD vs API...');
            console.log(`📊 Categorías en BD: ${rows.length}`);
            console.log(`📊 Categorías en API: ${categoriesResponse.data.data.length}`);
            
            if (rows.length === categoriesResponse.data.data.length) {
                console.log('✅ ¡PERFECTO! Las cantidades coinciden');
            } else {
                console.log('⚠️  Las cantidades no coinciden - posible problema en el servicio');
            }
            
            // 4. Resumen del problema
            console.log('\n🎯 RESUMEN DEL PROBLEMA:');
            console.log('='*50);
            console.log('❌ El frontend está llamando: /api/categories');
            console.log('✅ El endpoint correcto es: /api/products/categories');
            console.log('💡 SOLUCIÓN: Actualizar el frontend para usar el endpoint correcto');
            
        } catch (apiError) {
            if (apiError.response) {
                console.log(`❌ Error ${apiError.response.status}: ${apiError.response.statusText}`);
                if (apiError.response.status === 404) {
                    console.log('💡 Confirma que el endpoint /api/products/categories no existe o no está configurado');
                }
            } else {
                console.log(`❌ Error de conexión: ${apiError.message}`);
                console.log('💡 Asegúrate de que el backend esté corriendo en puerto 3001');
            }
        }
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

// Ejecutar la prueba
testCategoriesEndpoint();
