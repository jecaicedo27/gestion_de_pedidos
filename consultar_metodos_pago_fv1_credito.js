require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function consultarMetodosPagoFV1() {
    try {
        console.log('🔍 CONSULTAR MÉTODOS DE PAGO PARA FV-1 - BUSCAR CRÉDITO');
        console.log('=======================================================');
        
        // Autenticarse
        console.log('🔐 Autenticando con SIIGO API...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        });
        
        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');
        
        // Consultar métodos de pago específicos para FV-1 (document_type = 15047)
        console.log('\n📋 Consultando métodos de pago para FV-1 (Document ID: 15047)...');
        
        const paymentsResponse = await axios.get('https://api.siigo.com/v1/payment-types', {
            params: {
                type: 'Invoice',
                document_type: 15047
            },
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            }
        });
        
        console.log('\n🎯 MÉTODOS DE PAGO VÁLIDOS PARA FV-1:');
        console.log('=====================================');
        
        let creditoPaymentId = null;
        
        if (paymentsResponse.data && paymentsResponse.data.results) {
            paymentsResponse.data.results.forEach((payment, index) => {
                console.log(`${index + 1}. ID: ${payment.id} | Nombre: ${payment.name} | Activo: ${payment.active}`);
                
                // Buscar método de pago que contenga "crédito" o similar
                if (payment.name && payment.name.toLowerCase().includes('crédito')) {
                    creditoPaymentId = payment.id;
                    console.log(`   🎯 ENCONTRADO CRÉDITO: ID ${payment.id}`);
                }
            });
            
            console.log('\n📊 RESUMEN:');
            console.log(`Total métodos de pago disponibles: ${paymentsResponse.data.results.length}`);
            
            if (creditoPaymentId) {
                console.log(`✅ ID del método "Crédito" encontrado: ${creditoPaymentId}`);
            } else {
                console.log('❌ No se encontró método de pago "Crédito"');
                console.log('📝 Métodos disponibles:');
                paymentsResponse.data.results.forEach(payment => {
                    console.log(`   - ${payment.name} (ID: ${payment.id})`);
                });
            }
            
        } else {
            console.log('❌ No se encontraron métodos de pago o estructura inesperada');
            console.log('📋 Respuesta completa:', JSON.stringify(paymentsResponse.data, null, 2));
        }
        
        return creditoPaymentId;
        
    } catch (error) {
        console.error('❌ Error consultando métodos de pago:', error.response ? error.response.data : error.message);
        return null;
    }
}

consultarMetodosPagoFV1();
