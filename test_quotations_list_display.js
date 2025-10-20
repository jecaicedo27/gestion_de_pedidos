const axios = require('axios');

// Test para verificar la lista de cotizaciones/facturas
async function testQuotationsList() {
    console.log('🔍 Verificando lista de cotizaciones/facturas...\n');

    try {
        // Simular autenticación (usar token válido si está disponible)
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer your-jwt-token-here' // Placeholder
        };

        // Test 1: Obtener lista de cotizaciones
        console.log('📋 1. Probando endpoint de lista de cotizaciones...');
        try {
            const response = await axios.get('http://localhost:3001/api/quotations', { 
                headers,
                timeout: 5000
            });
            
            console.log('✅ Status:', response.status);
            console.log('📊 Cotizaciones encontradas:', response.data.length || 0);
            
            if (response.data && response.data.length > 0) {
                console.log('\n📝 Primeras 3 cotizaciones:');
                response.data.slice(0, 3).forEach((quotation, index) => {
                    console.log(`   ${index + 1}. ID: ${quotation.id || 'N/A'}`);
                    console.log(`      Cliente: ${quotation.customer_name || 'N/A'}`);
                    console.log(`      Estado: ${quotation.status || 'N/A'}`);
                    console.log(`      Creada: ${quotation.created_at || 'N/A'}`);
                    console.log(`      SIIGO ID: ${quotation.siigo_id || 'No creada en SIIGO'}`);
                    console.log('      ---');
                });
            } else {
                console.log('ℹ️  No se encontraron cotizaciones en la base de datos.');
            }
        } catch (error) {
            if (error.response) {
                console.log('❌ Error del servidor:', error.response.status, error.response.statusText);
                if (error.response.status === 401) {
                    console.log('🔒 Error de autenticación - probando sin token...');
                    
                    // Intentar sin autenticación
                    try {
                        const response = await axios.get('http://localhost:3001/api/quotations', { timeout: 5000 });
                        console.log('✅ Sin token - Status:', response.status);
                        console.log('📊 Cotizaciones encontradas:', response.data.length || 0);
                    } catch (noAuthError) {
                        console.log('❌ Error sin autenticación también:', noAuthError.message);
                    }
                }
            } else {
                console.log('❌ Error de conexión:', error.message);
        console.log('💡 ¿Está ejecutándose el backend en puerto 3001?');
            }
        }

        // Test 2: Verificar estructura de respuesta esperada
        console.log('\n🔧 2. Verificando estructura de respuesta esperada...');
        console.log('   La respuesta debería incluir:');
        console.log('   - id: ID único de la cotización');
        console.log('   - customer_id: ID del cliente');
        console.log('   - customer_name: Nombre del cliente');
        console.log('   - status: Estado (draft, sent, invoiced)');
        console.log('   - chatgpt_result: Resultado del procesamiento ChatGPT');
        console.log('   - siigo_id: ID en SIIGO (si fue creada como factura)');
        console.log('   - created_at: Fecha de creación');
        console.log('   - updated_at: Fecha de actualización');

        // Test 3: Verificar si hay un problema con el frontend
        console.log('\n🎨 3. Posibles causas si no se ve la lista en el frontend:');
        console.log('   ❓ El componente no está llamando al endpoint correctamente');
        console.log('   ❓ Hay un error de autenticación en el frontend');
        console.log('   ❓ El estado de React no se está actualizando');
        console.log('   ❓ Hay un error de renderizado en la lista');
        console.log('   ❓ Las cotizaciones se están creando con status incorrecto');

        // Test 4: Verificar backend status
        console.log('\n🚀 4. Verificando estado del backend...');
        try {
            const healthResponse = await axios.get('http://localhost:3001/health', { timeout: 5000 });
            console.log('✅ Backend funcionando:', healthResponse.status === 200 ? 'OK' : 'ERROR');
        } catch (healthError) {
            console.log('❌ Backend no responde en http://localhost:3001');
            console.log('💡 Ejecutar: npm start en la carpeta backend/');
        }

    } catch (error) {
        console.log('❌ Error general:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN DE VERIFICACIÓN:');
    console.log('1. Verificar que el backend esté ejecutándose');
    console.log('2. Verificar que existan cotizaciones en la BD');
    console.log('3. Verificar autenticación en el frontend');
    console.log('4. Verificar componente QuotationsPage.js');
    console.log('='.repeat(60));
}

testQuotationsList().catch(console.error);
