const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api';

async function testInvoiceCreation() {
    console.log('🧪 Probando creación de factura después de la corrección...\n');
    console.log('==================================================\n');
    
    try {
        // 1. Login
        console.log('1️⃣ Iniciando sesión...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso\n');
        
        // 2. Procesar pedido con ChatGPT
        console.log('2️⃣ Procesando pedido con ChatGPT...');
        const pedidoNatural = '3 sal limon x 250\n5 perlas de fresa x 350';
        
        const chatGPTResponse = await axios.post(
            `${API_URL}/quotations/process-natural-order`,
            {
                customer_id: 1,
                natural_language_order: pedidoNatural,
                processing_type: 'text'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        console.log('✅ Pedido procesado con ChatGPT');
        console.log(`   - Items detectados: ${chatGPTResponse.data.items.length}`);
        console.log(`   - Total: $${chatGPTResponse.data.total}\n`);
        
        // 3. Intentar crear factura
        console.log('3️⃣ Creando factura en SIIGO...');
        console.log('   📝 Items a facturar:');
        chatGPTResponse.data.items.forEach((item, index) => {
            console.log(`      ${index + 1}. ${item.product_name} x${item.quantity} @ $${item.price}`);
        });
        
        const invoiceData = {
            customer_id: 1,
            items: chatGPTResponse.data.items.map(item => ({
                product_code: item.product_code,
                code: item.product_code,
                description: item.product_name,
                quantity: item.quantity,
                price: item.price,
                unit_price: item.price
            })),
            document_type: 'FV-1'
        };
        
        console.log('\n   📊 Calculando totales:');
        const subtotal = invoiceData.items.reduce((sum, item) => {
            return sum + (item.quantity * item.price);
        }, 0);
        console.log(`      - Subtotal: $${subtotal}`);
        console.log(`      - IVA (19%): $${Math.round(subtotal * 0.19)}`);
        console.log(`      - Total con IVA: $${Math.round(subtotal * 1.19)}`);
        console.log(`      - Valor del pago (corregido): $${subtotal} (sin IVA)`);
        
        try {
            const invoiceResponse = await axios.post(
                `${API_URL}/quotations/create-invoice`,
                invoiceData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            console.log('\n✅ ¡FACTURA CREADA EXITOSAMENTE!');
            console.log(`   - Número: ${invoiceResponse.data.invoiceNumber || 'N/A'}`);
            console.log(`   - ID SIIGO: ${invoiceResponse.data.siigoId || 'N/A'}`);
            console.log('\n🎉 La corrección del cálculo de pagos funcionó correctamente');
            
        } catch (invoiceError) {
            if (invoiceError.response?.status === 422) {
                console.log('\n❌ Error 422 - Problema con el pago:');
                console.log('   ' + (invoiceError.response.data.message || 'Error desconocido'));
                
                if (invoiceError.response.data.details) {
                    const details = invoiceError.response.data.details;
                    if (details.Errors) {
                        details.Errors.forEach(error => {
                            console.log(`   ⚠️ ${error.Code}: ${error.Message}`);
                        });
                    }
                }
                console.log('\n💡 El error persiste - puede necesitar revisión adicional');
            } else {
                throw invoiceError;
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error en la prueba:', error.message);
        if (error.response?.data) {
            console.error('Detalles:', error.response.data);
        }
    }
    
    console.log('\n==================================================');
    console.log('✅ TEST COMPLETADO');
    console.log('==================================================\n');
}

// Ejecutar test
testInvoiceCreation();
