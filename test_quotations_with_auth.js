require('dotenv').config({ path: 'backend/.env' });
const axios = require('axios');

async function testQuotationsWithAuth() {
    try {
        console.log('🧪 Probando el sistema de cotizaciones con autenticación...');
        
        const baseURL = 'http://localhost:3001';
        
        // Step 1: Login to get authentication token
        console.log('\n🔐 Paso 1: Iniciando sesión para obtener token...');
        let authToken;
        
        try {
            const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
                username: 'admin',
                password: 'admin123' // Using default admin credentials
            });
            
            authToken = loginResponse.data.token;
            console.log('✅ Login exitoso, token obtenido');
        } catch (error) {
            console.log('❌ Error en login:', error.response?.data || error.message);
            console.log('⚠️ Probando sin autenticación...');
        }

        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

        // Test 1: Check quotations stats
        console.log('\n📊 Prueba 1: Verificando estadísticas de cotizaciones...');
        try {
            const statsResponse = await axios.get(`${baseURL}/api/quotations/stats`, { headers });
            console.log('✅ Estadísticas obtenidas:', statsResponse.data);
        } catch (error) {
            console.log('❌ Error en estadísticas:', error.response?.status, error.response?.data || error.message);
        }

        // Test 2: Search for customers
        console.log('\n🔍 Prueba 2: Búsqueda de clientes...');
        const searchTerms = ['Mostrador', 'JUDIT', '3105244298', '3167250636'];
        
        for (const searchTerm of searchTerms) {
            try {
                console.log(`\n🔍 Buscando: "${searchTerm}"`);
                const searchResponse = await axios.get(`${baseURL}/api/quotations/customers/search?q=${encodeURIComponent(searchTerm)}`, { headers });
                console.log(`✅ Resultados encontrados: ${searchResponse.data.length}`);
                if (searchResponse.data.length > 0) {
                    console.log(`   📋 Primeros resultados:`);
                    searchResponse.data.slice(0, 3).forEach((customer, index) => {
                        console.log(`   ${index + 1}. ${customer.name} - ${customer.phone} (${customer.identification || 'Sin ID'})`);
                    });
                }
            } catch (error) {
                console.log(`❌ Error buscando "${searchTerm}":`, error.response?.status, error.response?.data || error.message);
            }
        }

        // Test 3: Get all customers (paginated)
        console.log('\n📋 Prueba 3: Listado de todos los clientes (paginado)...');
        try {
            const allCustomersResponse = await axios.get(`${baseURL}/api/quotations/customers?page=1&limit=10`, { headers });
            console.log(`✅ Clientes obtenidos: ${allCustomersResponse.data.length}`);
            if (allCustomersResponse.data.length > 0) {
                console.log(`   📋 Muestra de clientes:`);
                allCustomersResponse.data.slice(0, 5).forEach((customer, index) => {
                    console.log(`   ${index + 1}. ${customer.name} - ${customer.phone}`);
                });
            }
        } catch (error) {
            console.log('❌ Error obteniendo clientes:', error.response?.status, error.response?.data || error.message);
        }

        // Test 4: Test database direct connection to verify data
        console.log('\n🔍 Prueba 4: Verificación directa de la base de datos...');
        try {
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'gestion_pedidos_dev',
                charset: 'utf8mb4'
            });

            const [customers] = await connection.execute('SELECT COUNT(*) as total FROM customers WHERE active = 1');
            console.log(`✅ Total de clientes activos en BD: ${customers[0].total}`);

            const [sampleCustomers] = await connection.execute(`
                SELECT name, phone, identification, city 
                FROM customers 
                WHERE active = 1 
                ORDER BY created_at DESC 
                LIMIT 5
            `);
            
            console.log('📋 Muestra de clientes desde BD:');
            sampleCustomers.forEach((customer, index) => {
                console.log(`   ${index + 1}. ${customer.name} - ${customer.phone} - ${customer.city || 'Sin ciudad'}`);
            });

            await connection.end();
        } catch (error) {
            console.log('❌ Error verificando BD:', error.message);
        }

        console.log('\n🎉 Prueba del sistema de cotizaciones completada');

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error.message);
    }
}

// Run the test
testQuotationsWithAuth()
    .then(() => {
        console.log('✅ Todas las pruebas finalizadas');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error en las pruebas:', error);
        process.exit(1);
    });
