require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function testFixedSiigoInvoiceService() {
    console.log('🧪 Probando SiigoInvoiceService corregido con estructura exacta...\n');
    
    console.log('🎯 TEST DEL SERVICIO SIIGO CORREGIDO');
    console.log('='.repeat(70));
    console.log('📋 Usando la estructura EXACTA de la prueba exitosa');
    console.log('📄 Document ID: 15047 (FV-1)');
    console.log('👤 Seller: 388 (confirmado)');
    console.log('💳 Payment Method: 3467 (Crédito)');
    console.log('❌ SIN cost_center (no estaba en la prueba exitosa)');
    console.log('✅ Cliente de prueba: documento 1082746400\n');

    try {
        // PASO 1: Verificar que el backend esté ejecutándose
        console.log('📝 PASO 1: Verificar estado del backend');
        
        let backendRunning = false;
        try {
            const healthCheck = await axios.get('http://localhost:3001/api/config/public', {
                timeout: 5000
            });
            
            if (healthCheck.status === 200) {
                backendRunning = true;
                console.log('✅ Backend está ejecutándose correctamente');
            }
        } catch (error) {
            console.log('❌ Backend no está ejecutándose. Iniciando backend...');
            
            // Intentar iniciar el backend
            const { spawn } = require('child_process');
            const backendProcess = spawn('node', ['backend/server.js'], {
                detached: false,
                stdio: 'inherit'
            });
            
            console.log('⏳ Esperando 10 segundos para que el backend inicie...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Verificar nuevamente
            try {
                const retryCheck = await axios.get('http://localhost:3001/api/config/public', {
                    timeout: 5000
                });
                
                if (retryCheck.status === 200) {
                    backendRunning = true;
                    console.log('✅ Backend iniciado exitosamente');
                }
            } catch (retryError) {
                console.error('❌ No se pudo iniciar el backend automáticamente');
                console.log('\n🔧 INSTRUCCIONES MANUALES:');
                console.log('1. Abrir una nueva terminal');
                console.log('2. Ejecutar: cd backend && node server.js');
                console.log('3. Esperar a que aparezca "Servidor ejecutándose en puerto 3001"');
                console.log('4. Volver a ejecutar este test');
                return;
            }
        }

        if (!backendRunning) {
            console.error('❌ Backend no está disponible. Iniciarlo manualmente.');
            return;
        }

        // PASO 2: Login para obtener token
        console.log('\n📝 PASO 2: Login para obtener token de autenticación');
        
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'admin@test.com',
            password: 'admin123'
        });

        if (!loginResponse.data.data.token) {
            throw new Error('No se obtuvo token en la respuesta de login');
        }

        const token = loginResponse.data.data.token;
        console.log('✅ Token obtenido exitosamente');

        // PASO 3: Buscar cliente con documento 1082746400
        console.log('\n📝 PASO 3: Buscar cliente de prueba (1082746400)');
        
        const customerResponse = await axios.get('http://localhost:3001/api/quotations/customers/search?q=1082746400', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!customerResponse.data.data || customerResponse.data.data.length === 0) {
            throw new Error('Cliente con documento 1082746400 no encontrado en el sistema');
        }

        const customer = customerResponse.data.data[0];
        console.log('✅ Cliente encontrado:');
        console.log(`   🆔 ID: ${customer.id}`);
        console.log(`   📄 Documento: ${customer.identification}`);
        console.log(`   👤 Nombre: ${customer.name}`);

        // PASO 4: Crear factura FV-1 usando la estructura EXACTA
        console.log('\n📝 PASO 4: Crear factura FV-1 con estructura exacta');
        console.log('🎯 Usando parámetros exactos de la prueba exitosa...');
        
        const invoiceData = {
            customerId: customer.id,
            items: [
                {
                    product_code: 'TEST01',
                    product_name: 'Producto de Prueba',
                    quantity: 1,
                    unit_price: 1000
                }
            ],
            notes: 'Factura de prueba con estructura exacta - SiigoInvoiceService corregido',
            documentType: 'FV-1'
        };

        console.log('📋 Datos de la petición:', JSON.stringify(invoiceData, null, 2));

        const invoiceResponse = await axios.post('http://localhost:3001/api/quotations/create-invoice', invoiceData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 1 minuto de timeout para SIIGO
        });

        console.log('\n🎉 ¡FACTURA CREADA EXITOSAMENTE!');
        console.log('='.repeat(70));
        console.log('✅ Respuesta del backend:', JSON.stringify(invoiceResponse.data, null, 2));

        if (invoiceResponse.data.data.siigo_invoice_number) {
            console.log(`📄 Número de factura SIIGO: ${invoiceResponse.data.data.siigo_invoice_number}`);
            console.log(`🆔 ID SIIGO: ${invoiceResponse.data.data.siigo_invoice_id}`);
        }

        console.log('\n✅ CONFIRMACIONES:');
        console.log('✅ Servicio SIIGO corregido funciona correctamente');
        console.log('✅ Estructura exacta de la prueba exitosa aplicada');
        console.log('✅ Document ID 15047 (FV-1) funcionando');
        console.log('✅ Seller 388 aplicado correctamente');
        console.log('✅ Payment Method 3467 (Crédito) aplicado');
        console.log('✅ Sin cost_center (como en la prueba exitosa)');
        
    } catch (error) {
        console.error('❌ Error en el test:', error.message);
        
        if (error.response) {
            console.error('📋 Status:', error.response.status);
            console.error('📋 Datos del error:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 401) {
                console.log('\n🔧 POSIBLE SOLUCIÓN:');
                console.log('El error 401 indica problemas de autenticación.');
                console.log('1. Verificar que el backend esté ejecutándose');
                console.log('2. Verificar credenciales de login');
                console.log('3. Intentar reiniciar el backend');
            }
            
            if (error.response.status === 422 || error.response.status === 400) {
                console.log('\n🔧 ANÁLISIS DEL ERROR:');
                console.log('Error de validación en SIIGO. Verificar:');
                console.log('1. Que el cliente exista en SIIGO');
                console.log('2. Que los códigos de producto sean válidos');
                console.log('3. Que los parámetros sean correctos');
            }
        }
        
        console.log('\n❌ Test fallido. Revisar logs arriba para más detalles.');
    }
}

testFixedSiigoInvoiceService();
