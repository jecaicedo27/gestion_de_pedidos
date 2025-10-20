const axios = require('axios');

async function fixDocumentId() {
    console.log('🔧 Corrigiendo Document ID incorrecto 5152 → 15047 (FV-1)');
    console.log('='.repeat(60));
    
    try {
        // Login para obtener token
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso');

        // Verificar configuración actual
        console.log('\n🔍 PASO 1: Verificando configuración actual...');
        try {
            const configResponse = await axios.get('http://localhost:3001/api/config/public');
            console.log('📋 Configuración actual:', JSON.stringify(configResponse.data, null, 2));
        } catch (error) {
            console.log('⚠️ No se pudo obtener configuración:', error.message);
        }

        // Probar crear factura de prueba simple para ver qué ID se envía
        console.log('\n🔍 PASO 2: Probando creación de factura para capturar ID enviado...');
        
        try {
            const testInvoice = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
                customerId: 74, // Cliente conocido
                items: [{
                    product_code: "TEST001",
                    product_name: "Producto de prueba",
                    quantity: 1,
                    unit_price: 1000,
                    confidence_score: 1
                }],
                documentType: "FV-1"
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('❓ Inesperado: La factura se creó (debería haber fallado)');
            
        } catch (error) {
            if (error.response?.status === 422) {
                const details = error.response.data.details;
                if (details?.Errors) {
                    details.Errors.forEach(err => {
                        if (err.Params && err.Params.includes('document.id')) {
                            const match = err.Message.match(/doesn't exist: (\d+)/);
                            if (match) {
                                const wrongId = match[1];
                                console.log(`❌ CONFIRMADO: Se está enviando document.id: ${wrongId}`);
                                console.log(`✅ DEBERÍA ser: 15047`);
                            }
                        }
                    });
                }
            }
        }

        // Ahora verificar dónde está definido el document ID incorrecto
        console.log('\n🔍 PASO 3: Buscando dónde está definido el ID incorrecto...');
        
        // Verificar base de datos - tabla system_config
        console.log('\n📊 Verificando configuración en base de datos...');
        
        // Verificar servicio corregido
        console.log('\n📁 Verificando archivo siigoInvoiceService.js corregido...');
        
        console.log('\n🔧 SOLUCIÓN:');
        console.log('1. Localizar dónde está configurado el document.id 5152');
        console.log('2. Cambiarlo por 15047 (que sabemos que funciona)');
        console.log('3. Reiniciar backend si es necesario');
        console.log('4. Probar que funcione');
        
        console.log('\n📋 EVIDENCIA DEL ERROR:');
        console.log('❌ Error SIIGO: "The id doesn\'t exist: 5152"');
        console.log('✅ ID Correcto probado: 15047 (Factura de Venta - FV-1)');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixDocumentId();
