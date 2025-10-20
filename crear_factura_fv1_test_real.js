require('dotenv').config();
const axios = require('axios');

console.log('🚀 Creando factura de prueba FV-1 con datos reales...\n');

async function crearFacturaFV1TestReal() {
    try {
        console.log('🎯 CREACIÓN DE FACTURA FV-1 TEST');
        console.log('='.repeat(70));
        console.log('📋 Cliente: Cédula 1082746400');
        console.log('📦 Producto: Código IMPLE04');
        console.log('📄 Tipo: FV-1 (Document ID: 15047)');
        console.log('🎯 Objetivo: Validar document.id descubierto\n');

        // Paso 1: Autenticación
        console.log('📝 PASO 1: Autenticación con SIIGO');
        console.log('🔐 Autenticando con SIIGO API...');

        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME || 'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
            access_key: process.env.SIIGO_API_ACCESS_KEY || 'ODVjN2RlNDItY2I3MS00MmI5LWFiNjItMWM5MDkyZTFjMzY5Oih7IzdDMmU+RVk='
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa\n');

        // Paso 2: Buscar cliente por identificación
        console.log('📝 PASO 2: Buscar cliente con cédula 1082746400');
        
        const customerResponse = await axios.get('https://api.siigo.com/v1/customers', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            },
            params: {
                identification: '1082746400'
            }
        });

        if (!customerResponse.data.results || customerResponse.data.results.length === 0) {
            throw new Error('Cliente con cédula 1082746400 no encontrado');
        }

        const customer = customerResponse.data.results[0];
        console.log('✅ Cliente encontrado:');
        console.log(`   🏢 Nombre: ${customer.name || customer.commercial_name}`);
        console.log(`   🆔 ID SIIGO: ${customer.id}`);
        console.log(`   📄 Identificación: ${customer.identification}\n`);

        // Paso 3: Buscar producto por código
        console.log('📝 PASO 3: Buscar producto con código IMPLE04');
        
        const productResponse = await axios.get('https://api.siigo.com/v1/products', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            },
            params: {
                code: 'IMPLE04'
            }
        });

        if (!productResponse.data.results || productResponse.data.results.length === 0) {
            throw new Error('Producto con código IMPLE04 no encontrado');
        }

        const product = productResponse.data.results[0];
        console.log('✅ Producto encontrado:');
        console.log(`   📦 Nombre: ${product.name}`);
        console.log(`   🆔 ID SIIGO: ${product.id}`);
        console.log(`   💰 Precio: ${product.price}`);
        console.log(`   📋 Código: ${product.code}\n`);

        // Paso 4: Crear factura FV-1
        console.log('📝 PASO 4: Crear factura FV-1');
        console.log('🎯 Usando Document ID: 15047 (FV-1 - Factura No Electrónica)');

        const invoiceData = {
            document: {
                id: 15047  // FV-1 descubierto
            },
            date: new Date().toISOString().split('T')[0],
            customer: {
                identification: customer.identification,
                branch_office: 0
            },
            seller: 629, // Vendedor requerido para FV-1
            // Campo removido para FV-1: cost_center (no permitido según SIIGO)
            observations: `Factura de prueba FV-1 - Cliente ${customer.identification} - Producto ${product.code}`,
            items: [
                {
                    code: product.code,
                    description: product.name,
                    quantity: 1,
                    price: product.price || 50000
                }
            ],
            payments: [
                {
                    id: 5083, // Efectivo
                    value: product.price || 50000
                }
            ]
        };

        console.log('📋 Datos de la factura:', JSON.stringify(invoiceData, null, 2));

        const invoiceResponse = await axios.post('https://api.siigo.com/v1/invoices', invoiceData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            }
        });

        console.log('\n🎉 ¡FACTURA FV-1 CREADA EXITOSAMENTE!');
        console.log('='.repeat(50));
        console.log(`✅ ID Factura: ${invoiceResponse.data.id}`);
        console.log(`✅ Número: ${invoiceResponse.data.number}`);
        console.log(`✅ Documento ID: ${invoiceResponse.data.document?.id}`);
        console.log(`✅ Documento Nombre: ${invoiceResponse.data.document?.name}`);
        console.log(`✅ Fecha: ${invoiceResponse.data.date}`);
        console.log(`✅ Cliente: ${invoiceResponse.data.customer?.commercial_name}`);
        console.log(`✅ Total: ${invoiceResponse.data.total}`);
        
        if (invoiceResponse.data.public_url) {
            console.log(`📱 URL Pública: ${invoiceResponse.data.public_url}`);
        }

        // Verificación final
        if (invoiceResponse.data.document?.id === 15047) {
            console.log('\n🎯 ¡CONFIRMADO! La factura fue creada como FV-1');
            console.log('✅ Document ID 15047 verificado como FV-1');
        } else {
            console.log('\n⚠️ ADVERTENCIA: Document ID no coincide');
            console.log(`   Esperado: 15047`);
            console.log(`   Obtenido: ${invoiceResponse.data.document?.id}`);
        }

        console.log('\n📊 RESUMEN DE LA PRUEBA:');
        console.log('='.repeat(30));
        console.log(`📄 Tipo factura: FV-1 (No electrónica)`);
        console.log(`🔑 Document ID: ${invoiceResponse.data.document?.id}`);
        console.log(`👤 Cliente: ${customer.identification}`);
        console.log(`📦 Producto: ${product.code}`);
        console.log(`💰 Valor: ${invoiceResponse.data.total}`);

        return {
            success: true,
            invoice: invoiceResponse.data,
            verification: invoiceResponse.data.document?.id === 15047
        };

    } catch (error) {
        console.error('❌ Error creando factura FV-1:', error.message);
        if (error.response?.data) {
            console.error('📋 Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// Ejecutar la prueba
crearFacturaFV1TestReal()
    .then(result => {
        console.log('\n✅ Prueba completada exitosamente');
        if (result.verification) {
            console.log('🎯 FV-1 Document ID (15047) CONFIRMADO');
        }
    })
    .catch(error => {
        console.error('\n❌ Prueba fallida:', error.message);
    });
