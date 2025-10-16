require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function debug422ErrorRealData() {
    console.log('🔍 Debuggeando error 422 con datos reales del frontend...\n');
    
    console.log('🎯 DEBUG ERROR 422 - DATOS REALES');
    console.log('='.repeat(70));
    console.log('📋 Reproduciendo el error exacto del frontend');
    console.log('📊 CustomerId: 74');
    console.log('📦 Items: SKARCHA18 y LIQUIPP02');
    console.log('📄 DocumentType: FV-1\n');

    try {
        // PASO 1: Login para obtener token
        console.log('📝 PASO 1: Login para obtener token');
        
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Token obtenido exitosamente');

        // PASO 2: Probar con los datos exactos del frontend
        console.log('\n📝 PASO 2: Probando con datos exactos del error 422');
        
        // Datos EXACTOS del error del frontend
        const invoiceData = {
            customerId: 74,
            items: [
                {
                    product_code: "SKARCHA18",
                    product_name: "SKARCHA SAL LIMON X250G",
                    quantity: 2,
                    unit_price: 13000,
                    confidence_score: 0.8
                },
                {
                    product_code: "LIQUIPP02",
                    product_name: "LIQUIPOPS SABOR A CEREZA X 350 GR",
                    quantity: 6,
                    unit_price: 16000,
                    confidence_score: 0.8
                }
            ],
            notes: "",
            documentType: "FV-1"
        };

        console.log('📋 Datos exactos del frontend:', JSON.stringify(invoiceData, null, 2));
        console.log('\n⏳ Enviando petición y capturando respuesta detallada...');

        try {
            const invoiceResponse = await axios.post('http://localhost:3001/api/quotations/create-invoice', invoiceData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            console.log('\n🎉 ¡ÉXITO! La factura se creó correctamente');
            console.log('✅ Respuesta:', JSON.stringify(invoiceResponse.data, null, 2));
            
        } catch (error422) {
            console.error('\n❌ ERROR 422 CAPTURADO:');
            console.error('📋 Status:', error422.response?.status);
            console.error('📋 Status Text:', error422.response?.statusText);
            console.error('📋 Response Data:', JSON.stringify(error422.response?.data, null, 2));
            
            // PASO 3: Interceptar los logs del backend para ver qué se envía a SIIGO
            console.log('\n🔍 ANÁLISIS DETALLADO DEL ERROR:');
            
            if (error422.response?.data?.details) {
                console.log('📊 Detalles específicos de SIIGO:');
                console.log(JSON.stringify(error422.response.data.details, null, 2));
            }
            
            if (error422.response?.data?.siigo_request_data) {
                console.log('📤 Datos enviados a SIIGO:');
                console.log(JSON.stringify(error422.response.data.siigo_request_data, null, 2));
            }
            
            if (error422.response?.data?.siigo_response) {
                console.log('📥 Respuesta de SIIGO:');
                console.log(JSON.stringify(error422.response.data.siigo_response, null, 2));
            }
            
            // Identificar problemas específicos
            console.log('\n🔧 DIAGNÓSTICO:');
            if (error422.response?.data?.details?.errors) {
                const errors = error422.response.data.details.errors;
                Object.keys(errors).forEach(field => {
                    console.log(`❌ Error en campo "${field}": ${errors[field]}`);
                });
            }
            
            // PASO 4: Comparar con la estructura exitosa
            console.log('\n📊 COMPARACIÓN CON PRUEBA EXITOSA:');
            console.log('❌ Frontend muestra Vendedor ID: 629');
            console.log('✅ Prueba exitosa usaba Vendedor ID: 388');
            console.log('❌ Frontend muestra Método Pago ID: 8887 (Efectivo)');
            console.log('✅ Prueba exitosa usaba Método Pago ID: 3467 (Crédito)');
            console.log('❌ Frontend muestra Centro de Costos: 235');
            console.log('✅ Prueba exitosa NO incluía cost_center');
        }
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n🔧 INSTRUCCIONES:');
            console.log('1. Iniciar backend: cd backend && node server.js');
            console.log('2. Esperar a que inicie completamente');
            console.log('3. Volver a ejecutar este debug');
        }
    }
}

debug422ErrorRealData();
