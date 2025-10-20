const axios = require('axios');
const mysql = require('mysql2/promise');

const API_URL = 'http://localhost:3001/api';

async function testChatGPTProcessing() {
    console.log('\n=== Prueba de Procesamiento con ChatGPT ===\n');
    
    let connection;
    
    try {
        // 1. Conectar a la base de datos
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        // 2. Buscar el cliente específico
        console.log('1. Buscando cliente con documento 1082746400...');
        const [customers] = await connection.execute(
            'SELECT * FROM customers WHERE document = ?',
            ['1082746400']
        );
        
        if (customers.length === 0) {
            console.log('✗ Cliente no encontrado en la base de datos');
            return;
        }
        
        const customer = customers[0];
        console.log(`✓ Cliente encontrado: ${customer.business_name || customer.name}`);
        console.log(`  ID: ${customer.id}`);
        console.log(`  Documento: ${customer.document}`);
        
        // 3. Hacer login
        console.log('\n2. Haciendo login...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        // Extraer token con la estructura correcta
        const token = loginResponse.data.data.token;
        console.log('✓ Login exitoso');

        // 4. Probar procesamiento con ChatGPT
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
            
            // 5. Guardar cotización para probar facturación
            if (chatGPTResponse.data.data.quotation_id) {
                console.log(`\n📋 Cotización creada: ID ${chatGPTResponse.data.data.quotation_id}`);
                console.log('   Puedes usar esta cotización para crear una factura');
            }
            
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
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar prueba
testChatGPTProcessing();
