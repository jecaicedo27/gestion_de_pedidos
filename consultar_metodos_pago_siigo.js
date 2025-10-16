require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function consultarMetodosPagoSiigo() {
    console.log('🔍 Consultando métodos de pago disponibles en SIIGO...\n');

    try {
        // Autenticación
        console.log('🔐 Autenticando con SIIGO API...');
        
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa\n');

        // Consultar métodos de pago
        console.log('📋 Consultando métodos de pago disponibles...');
        
        const paymentsResponse = await axios.get('https://api.siigo.com/v1/payment-types?type=Invoice', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'testPartner'
            }
        });

        console.log('✅ Métodos de pago encontrados:');
        console.log('='.repeat(50));
        
        const payments = paymentsResponse.data;
        payments.forEach((payment, index) => {
            console.log(`${index + 1}. ID: ${payment.id} - Nombre: ${payment.name}`);
            if (payment.name.toLowerCase().includes('efectivo') || payment.name.toLowerCase().includes('cash')) {
                console.log(`   ⭐ RECOMENDADO para facturas (Efectivo): ID ${payment.id}`);
            }
        });

        console.log('\n🎯 Usando el primer método de pago disponible...');
        console.log(`💳 ID de pago a usar: ${payments[0].id} (${payments[0].name})`);
        
        return payments[0].id;
        
    } catch (error) {
        console.error('❌ Error consultando métodos de pago:', error.message);
        if (error.response) {
            console.error('📋 Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

consultarMetodosPagoSiigo();
