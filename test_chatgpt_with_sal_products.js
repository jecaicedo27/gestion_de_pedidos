const axios = require('axios');
const mysql = require('mysql2/promise');

const API_URL = 'http://localhost:3001/api';

async function testChatGPTWithSalProducts() {
    console.log('\n=== Prueba de ChatGPT con Productos de Sal ===\n');
    
    let connection;
    
    try {
        // 1. Conectar a la base de datos
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        // 2. Buscar el cliente
        console.log('1. Buscando cliente con identificación 1082746400...');
        const [customers] = await connection.execute(
            'SELECT * FROM customers WHERE identification = ?',
            ['1082746400']
        );
        
        if (customers.length === 0) {
            console.log('✗ Cliente no encontrado');
            return;
        }
        
        const customer = customers[0];
        console.log(`✓ Cliente encontrado: ${customer.name || customer.commercial_name}`);
        console.log(`  ID: ${customer.id}`);
        
        // 3. Hacer login
        console.log('\n2. Haciendo login...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        console.log('✓ Login exitoso');

        // 4. Probar procesamiento con ChatGPT - Productos que sí reconoce
        console.log('\n3. Procesando pedido con ChatGPT...');
        const pedido = "3 sal limón 500g y 2 sal maracuyá 500g";
        console.log(`   Pedido: "${pedido}"`);
        
        const chatGPTResponse = await axios.post(
            `${API_URL}/quotations/process-natural-order`,
            {
                customer_id: customer.id,
                natural_language_order: pedido
            },
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        console.log('\n=== RESPUESTA COMPLETA DE CHATGPT ===');
        console.log(JSON.stringify(chatGPTResponse.data, null, 2));
        
        if (chatGPTResponse.data.success) {
            console.log('\n✅ ChatGPT procesó exitosamente el pedido de sal');
            
            // Verificar si hay productos en la respuesta
            if (chatGPTResponse.data.data) {
                const data = chatGPTResponse.data.data;
                
                // Buscar productos en diferentes posibles ubicaciones
                const products = data.products || data.items || data.order_items || [];
                
                if (products && products.length > 0) {
                    console.log('\nProductos identificados:');
                    products.forEach(product => {
                        console.log(`  - ${product.name || product.description}: ${product.quantity} unidades`);
                        if (product.code) console.log(`    Código: ${product.code}`);
                        if (product.price) console.log(`    Precio: $${product.price.toLocaleString('es-CO')}`);
                    });
                }
                
                // Mostrar totales si existen
                if (data.totals) {
                    console.log('\nTotales:');
                    console.log(`  Subtotal: $${data.totals.subtotal?.toLocaleString('es-CO') || '0'}`);
                    console.log(`  IVA (19%): $${data.totals.tax?.toLocaleString('es-CO') || '0'}`);
                    console.log(`  Total: $${data.totals.total?.toLocaleString('es-CO') || '0'}`);
                }
                
                // Si hay ID de cotización
                if (data.quotation_id) {
                    console.log(`\n📋 Cotización creada: ID ${data.quotation_id}`);
                    
                    // Intentar crear factura
                    console.log('\n4. Intentando crear factura con la cotización...');
                    try {
                        const invoiceResponse = await axios.post(
                            `${API_URL}/quotations/create-invoice`,
                            {
                                quotation_id: data.quotation_id
                            },
                            {
                                headers: { 'Authorization': `Bearer ${token}` }
                            }
                        );
                        
                        if (invoiceResponse.data.success) {
                            console.log('✓ Factura creada exitosamente!');
                            console.log(`  Número: ${invoiceResponse.data.invoice?.name || 'N/A'}`);
                            console.log(`  ID SIIGO: ${invoiceResponse.data.invoice?.id || 'N/A'}`);
                        }
                    } catch (invoiceError) {
                        if (invoiceError.response?.status === 422) {
                            console.log('\n⚠️ Error 422 al crear factura');
                            console.log('  Problema con el cálculo del pago en SIIGO');
                            if (invoiceError.response.data?.details) {
                                console.log('  Detalles:', JSON.stringify(invoiceError.response.data.details, null, 2));
                            }
                        } else {
                            console.log('\n✗ Error al crear factura:', invoiceError.response?.data?.message || invoiceError.message);
                        }
                    }
                }
            } else {
                console.log('\n⚠️ ChatGPT procesó el pedido pero la respuesta no contiene datos estructurados');
            }
            
        } else {
            console.log('✗ ChatGPT no pudo procesar el pedido');
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
testChatGPTWithSalProducts();
