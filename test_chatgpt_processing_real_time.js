const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testChatGPTProcessing() {
    console.log('\n=== Prueba de Procesamiento con ChatGPT ===\n');

    try {
        // 1. Hacer login
        console.log('1. Haciendo login...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        // Extraer token con la estructura correcta
        const token = loginResponse.data.data.token;
        console.log('✓ Login exitoso');
        
        // 2. Buscar un cliente para la prueba
        console.log('\n2. Buscando cliente de prueba...');
        
        // Primero intentar obtener todos los clientes
        const customersResponse = await axios.get(`${API_URL}/customers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!customersResponse.data || customersResponse.data.length === 0) {
            console.log('✗ No se encontraron clientes en la base de datos');
            console.log('  Intentando buscar con un término más genérico...');
            
            // Intentar buscar con letra 'A'
            const searchResponse = await axios.get(`${API_URL}/customers/search?search=A`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!searchResponse.data || searchResponse.data.length === 0) {
                console.log('✗ No se encontraron clientes con la búsqueda');
                return;
            }
            customersResponse.data = searchResponse.data;
        }

        const customer = customersResponse.data[0];
        console.log(`✓ Cliente encontrado: ${customer.business_name || customer.name}`);

        // 3. Probar procesamiento con ChatGPT
        console.log('\n3. Procesando pedido con ChatGPT...');
        console.log('   Pedido: "2 paletas Liquipp 06 y 3 paletas Liquipp 07"');
        
        const chatGPTResponse = await axios.post(
            `${API_URL}/quotations/process-natural-order`,
            {
                customer_id: customer.id,
                natural_language_order: "2 paletas Liquipp 06 y 3 paletas Liquipp 07"
            },
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        if (chatGPTResponse.data.success) {
            console.log('✓ Procesamiento con ChatGPT exitoso!');
            console.log('\nProductos identificados:');
            
            const products = chatGPTResponse.data.data.products;
            products.forEach(product => {
                console.log(`  - ${product.name}: ${product.quantity} unidades`);
                console.log(`    Código: ${product.code}`);
                console.log(`    Precio: $${product.price.toLocaleString('es-CO')}`);
            });
            
            const totals = chatGPTResponse.data.data.totals;
            console.log('\nTotales:');
            console.log(`  Subtotal: $${totals.subtotal.toLocaleString('es-CO')}`);
            console.log(`  IVA (19%): $${totals.tax.toLocaleString('es-CO')}`);
            console.log(`  Total: $${totals.total.toLocaleString('es-CO')}`);
            
            console.log('\n✅ ChatGPT está funcionando correctamente!');
        } else {
            console.log('✗ Error en el procesamiento');
            console.log('  Mensaje:', chatGPTResponse.data.message);
        }

    } catch (error) {
        console.log('\n✗ Error en la prueba:');
        
        if (error.response) {
            console.log(`  Status: ${error.response.status}`);
            console.log(`  Mensaje: ${error.response.data?.message || error.response.statusText}`);
            
            if (error.response.data?.details) {
                console.log('  Detalles:', JSON.stringify(error.response.data.details, null, 2));
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.log('  No se puede conectar al backend. ¿Está el servidor corriendo?');
        } else {
            console.log(`  ${error.message}`);
        }
    }
}

// Ejecutar prueba
testChatGPTProcessing();
