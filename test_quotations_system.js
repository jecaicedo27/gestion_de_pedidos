require('dotenv').config({ path: 'backend/.env' });
const axios = require('axios');

async function testQuotationsSystem() {
    try {
        console.log('🧪 Probando el sistema de cotizaciones...');
        
        const baseURL = 'http://localhost:3001';
        
        // Test 1: Check quotations stats
        console.log('\n📊 Prueba 1: Verificando estadísticas de cotizaciones...');
        try {
            const statsResponse = await axios.get(`${baseURL}/api/quotations/stats`);
            console.log('✅ Estadísticas obtenidas:', statsResponse.data);
        } catch (error) {
            console.log('❌ Error en estadísticas:', error.response?.data || error.message);
        }

        // Test 2: Search for customers
        console.log('\n🔍 Prueba 2: Búsqueda de clientes...');
        const searchTerms = ['Mostrador', 'JUDIT', '3105244298', '3167250636'];
        
        for (const searchTerm of searchTerms) {
            try {
                console.log(`\n🔍 Buscando: "${searchTerm}"`);
                const searchResponse = await axios.get(`${baseURL}/api/quotations/customers/search?q=${encodeURIComponent(searchTerm)}`);
                console.log(`✅ Resultados encontrados: ${searchResponse.data.length}`);
                if (searchResponse.data.length > 0) {
                    console.log(`   📋 Primeros resultados:`);
                    searchResponse.data.slice(0, 3).forEach((customer, index) => {
                        console.log(`   ${index + 1}. ${customer.name} - ${customer.phone} (${customer.identification})`);
                    });
                }
            } catch (error) {
                console.log(`❌ Error buscando "${searchTerm}":`, error.response?.data || error.message);
            }
        }

        // Test 3: Get all customers (paginated)
        console.log('\n📋 Prueba 3: Listado de todos los clientes (paginado)...');
        try {
            const allCustomersResponse = await axios.get(`${baseURL}/api/quotations/customers?page=1&limit=10`);
            console.log(`✅ Clientes obtenidos: ${allCustomersResponse.data.length}`);
            if (allCustomersResponse.data.length > 0) {
                console.log(`   📋 Muestra de clientes:`);
                allCustomersResponse.data.slice(0, 5).forEach((customer, index) => {
                    console.log(`   ${index + 1}. ${customer.name} - ${customer.phone}`);
                });
            }
        } catch (error) {
            console.log('❌ Error obteniendo clientes:', error.response?.data || error.message);
        }

        console.log('\n🎉 Prueba del sistema de cotizaciones completada');

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error.message);
    }
}

// Run the test
testQuotationsSystem()
    .then(() => {
        console.log('✅ Todas las pruebas finalizadas');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error en las pruebas:', error);
        process.exit(1);
    });
