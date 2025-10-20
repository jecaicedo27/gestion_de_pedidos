require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function consultarFactura31MetodoPago() {
    console.log('🔍 Consultando factura 31 para obtener ID del método de pago crédito...\n');

    try {
        // PASO 1: Autenticación
        console.log('📝 PASO 1: Autenticación con SIIGO');
        console.log('🔐 Autenticando con SIIGO API...');
        
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa\n');

        // PASO 2: Buscar factura 31
        console.log('📝 PASO 2: Buscando factura 31 en SIIGO');
        
        // Primero intentamos obtener facturas recientes y buscar la #31
        const invoicesResponse = await axios.get('https://api.siigo.com/v1/invoices?page=1&page_size=50', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'testPartner'
            }
        });

        let invoicesData;
        if (invoicesResponse.data && invoicesResponse.data.results && Array.isArray(invoicesResponse.data.results)) {
            invoicesData = invoicesResponse.data.results;
        } else if (Array.isArray(invoicesResponse.data)) {
            invoicesData = invoicesResponse.data;
        } else {
            throw new Error('Estructura de respuesta de facturas no reconocida');
        }

        console.log(`📋 Total de facturas encontradas: ${invoicesData.length}`);

        // Buscar factura con número 31 o similar
        let factura31 = null;
        
        for (const invoice of invoicesData) {
            console.log(`🔍 Revisando factura: ${invoice.number || invoice.name || 'Sin número'} - ID: ${invoice.id}`);
            
            if (invoice.number && (String(invoice.number).includes('31') || invoice.number === 31 || invoice.number === '31')) {
                factura31 = invoice;
                break;
            }
        }

        if (!factura31) {
            console.log('⚠️ No se encontró factura 31 en las facturas recientes.');
            console.log('📋 Mostrando las primeras facturas para referencia:');
            
            invoicesData.slice(0, 10).forEach((invoice, index) => {
                console.log(`   ${index + 1}. Número: ${invoice.number || 'N/A'} - ID: ${invoice.id} - Estado: ${invoice.status || 'N/A'}`);
                if (invoice.payments && invoice.payments.length > 0) {
                    console.log(`      💰 Pagos: ${JSON.stringify(invoice.payments, null, 2)}`);
                }
            });
            
            throw new Error('Factura 31 no encontrada en las facturas recientes');
        }

        console.log('\n🎯 FACTURA 31 ENCONTRADA:');
        console.log('='.repeat(50));
        console.log(`📄 Número: ${factura31.number}`);
        console.log(`🆔 ID SIIGO: ${factura31.id}`);
        console.log(`📅 Fecha: ${factura31.date}`);
        console.log(`💰 Total: ${factura31.total}`);
        console.log(`📋 Estado: ${factura31.status}`);

        // PASO 3: Obtener detalles completos de la factura
        console.log('\n📝 PASO 3: Obteniendo detalles completos de la factura 31');
        
        const invoiceDetailsResponse = await axios.get(`https://api.siigo.com/v1/invoices/${factura31.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'testPartner'
            }
        });

        const invoiceDetails = invoiceDetailsResponse.data;

        console.log('\n💳 MÉTODOS DE PAGO DE LA FACTURA 31:');
        console.log('='.repeat(50));

        if (invoiceDetails.payments && Array.isArray(invoiceDetails.payments)) {
            invoiceDetails.payments.forEach((payment, index) => {
                console.log(`🔹 Pago ${index + 1}:`);
                console.log(`   💳 ID: ${payment.id}`);
                console.log(`   💰 Valor: ${payment.value}`);
                console.log(`   📋 Nombre: ${payment.name || 'N/A'}`);
                console.log(`   🏷️ Tipo: ${payment.type || 'N/A'}`);
                console.log('');
            });

            // Buscar el método que sea de crédito
            const creditPayment = invoiceDetails.payments.find(payment => 
                payment.name && (
                    payment.name.toLowerCase().includes('credito') ||
                    payment.name.toLowerCase().includes('crédito') ||
                    payment.name.toLowerCase().includes('credit') ||
                    payment.type && payment.type.toLowerCase().includes('credit')
                )
            );

            if (creditPayment) {
                console.log('🎉 ¡MÉTODO DE PAGO CRÉDITO ENCONTRADO!');
                console.log('='.repeat(50));
                console.log(`💳 ID del método de pago crédito: ${creditPayment.id}`);
                console.log(`📋 Nombre: ${creditPayment.name}`);
                console.log(`💰 Valor: ${creditPayment.value}`);
                console.log('');
                console.log('✅ Este es el ID que debes usar en el script de creación de facturas FV-1');
            } else {
                console.log('⚠️ No se encontró método de pago específicamente de crédito');
                console.log('💡 Todos los métodos de pago mostrados arriba son candidatos');
            }

        } else {
            console.log('❌ No se encontraron métodos de pago en la factura 31');
        }

        // Mostrar estructura completa para análisis
        console.log('\n📊 ESTRUCTURA COMPLETA DE PAGOS (para análisis):');
        console.log('='.repeat(50));
        console.log(JSON.stringify(invoiceDetails.payments, null, 2));

    } catch (error) {
        console.error('❌ Error consultando factura 31:', error.message);
        if (error.response) {
            console.error('📋 Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
        console.log('\n❌ Consulta fallida:', error.message);
    }
}

consultarFactura31MetodoPago();
