require('dotenv').config();
const axios = require('axios');

console.log('🚀 Búsqueda completa de facturas FV-1...\n');

async function buscarFacturasFV1Completo() {
    try {
        console.log('🎯 BÚSQUEDA COMPLETA DE FACTURAS FV-1');
        console.log('='.repeat(70));
        console.log('📋 Objetivo: Encontrar cualquier factura FV-1 para obtener document.id real');
        console.log('🎯 Estrategia: Búsqueda amplia por fechas y tipos de documento\n');

        // Paso 1: Autenticación
        console.log('📝 PASO 1: Autenticación con SIIGO');
        console.log('🔐 Autenticando con SIIGO API...');
        console.log('🔗 URL: https://api.siigo.com/auth');
        console.log('👤 Usuario: COMERCIAL@PERLAS-EXPLOSIVAS.COM');

        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME || 'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
            access_key: process.env.SIIGO_API_ACCESS_KEY || 'ODVjN2RlNDItY2I3MS00MmI5LWFiNjItMWM5MDkyZTFjMzY5Oih7IzdDMmU+RVk='
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');
        console.log('✅ Token obtenido\n');

        // Paso 2: Búsqueda de facturas en los últimos 7 días
        console.log('🔍 PASO 2: Búsqueda amplia de facturas');
        
        const fechaHoy = new Date();
        const fecha7DiasAtras = new Date();
        fecha7DiasAtras.setDate(fechaHoy.getDate() - 7);

        const fechaHoyStr = fechaHoy.toISOString().split('T')[0];
        const fecha7DiasAtrasStr = fecha7DiasAtras.toISOString().split('T')[0];

        console.log(`📅 Rango de fechas: ${fecha7DiasAtrasStr} a ${fechaHoyStr}`);

        // Búsqueda 1: Facturas de los últimos 7 días
        console.log('\n🔍 Búsqueda 1: Facturas de los últimos 7 días');
        
        const invoicesResponse = await axios.get('https://api.siigo.com/v1/invoices', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            },
            params: {
                created_start: fecha7DiasAtrasStr,
                created_end: fechaHoyStr,
                page_size: 50
            }
        });

        console.log(`✅ Consulta exitosa - ${invoicesResponse.data.results?.length || 0} facturas encontradas`);

        if (invoicesResponse.data.results && invoicesResponse.data.results.length > 0) {
            console.log('\n📋 ANÁLISIS DE FACTURAS ENCONTRADAS:');
            console.log('='.repeat(50));

            invoicesResponse.data.results.forEach((invoice, index) => {
                console.log(`\n📄 Factura ${index + 1}:`);
                console.log(`   🔢 Número: ${invoice.number}`);
                console.log(`   📅 Fecha: ${invoice.date}`);
                console.log(`   📋 Documento ID: ${invoice.document?.id}`);
                console.log(`   📋 Documento Nombre: ${invoice.document?.name}`);
                console.log(`   🏢 Cliente: ${invoice.customer?.commercial_name}`);
                console.log(`   💰 Total: ${invoice.total}`);

                // Verificar si es una factura FV-1
                if (invoice.number && String(invoice.number).includes('FV-1')) {
                    console.log('   🎯 ¡FACTURA FV-1 ENCONTRADA!');
                    console.log(`   ⭐ DOCUMENT.ID REAL: ${invoice.document?.id}`);
                    console.log(`   ⭐ NOMBRE DOCUMENTO: ${invoice.document?.name}`);
                }
            });

            // Buscar específicamente facturas FV-1
            const facturasFV1 = invoicesResponse.data.results.filter(invoice => 
                invoice.number && String(invoice.number).includes('FV-1')
            );

            if (facturasFV1.length > 0) {
                console.log('\n🎯 RESULTADOS FINALES - FACTURAS FV-1:');
                console.log('='.repeat(50));
                
                facturasFV1.forEach((invoice, index) => {
                    console.log(`\n⭐ FACTURA FV-1 #${index + 1}:`);
                    console.log(`   📄 Número: ${invoice.number}`);
                    console.log(`   🔑 DOCUMENT.ID: ${invoice.document?.id}`);
                    console.log(`   📋 DOCUMENTO: ${invoice.document?.name}`);
                    console.log(`   📅 Fecha: ${invoice.date}`);
                });

                console.log('\n🎉 ¡ÉXITO! Document.id para FV-1 encontrado');
                console.log(`🔑 ID a usar en el sistema: ${facturasFV1[0].document?.id}`);
                
            } else {
                console.log('\n❌ No se encontraron facturas FV-1 en el rango de fechas');
            }
        } else {
            console.log('❌ No se encontraron facturas en el rango de fechas');
        }

        // Paso 3: Búsqueda alternativa por documento específico
        console.log('\n🔍 PASO 3: Búsqueda por tipos de documento');
        
        try {
            const documentTypesResponse = await axios.get('https://api.siigo.com/v1/document-types', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'siigo'
                },
                params: {
                    type: 'FV'
                }
            });

            console.log('\n📋 TIPOS DE DOCUMENTO FV DISPONIBLES:');
            console.log('='.repeat(40));
            
            if (documentTypesResponse.data && documentTypesResponse.data.length > 0) {
                documentTypesResponse.data.forEach(docType => {
                    console.log(`🔸 ID: ${docType.id} - Nombre: ${docType.name} (Código: ${docType.code})`);
                    
                    // Identificar posibles candidatos para FV-1
                    if (docType.name.toLowerCase().includes('venta no') || 
                        docType.code === 1 ||
                        docType.name.toLowerCase().includes('factura') && !docType.name.toLowerCase().includes('electrónica')) {
                        console.log('   ⭐ POSIBLE CANDIDATO PARA FV-1');
                    }
                });
            }
        } catch (docError) {
            console.log('❌ Error consultando tipos de documento:', docError.message);
        }

        console.log('\n✅ Búsqueda completa finalizada');

    } catch (error) {
        console.error('❌ Error en la búsqueda:', error.message);
        if (error.response?.data) {
            console.error('📋 Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Ejecutar la búsqueda
buscarFacturasFV1Completo();
