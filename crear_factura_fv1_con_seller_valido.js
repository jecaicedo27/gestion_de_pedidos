require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function crearFacturaFV1ConSellerValido() {
    console.log('🚀 Creando factura FV-1 con seller válido...\n');
    
    console.log('🎯 CREACIÓN DE FACTURA FV-1 CON SELLER VÁLIDO');
    console.log('='.repeat(70));
    console.log('📋 Cliente: Cédula 1082746400');
    console.log('📦 Producto: Código IMPLE04');
    console.log('📄 Tipo: FV-1 (Document ID: 15047)');
    console.log('🎯 Objetivo: Crear factura exitosa con seller válido\n');

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

        // PASO 2: Obtener sellers válidos
        console.log('📝 PASO 2: Obtener sellers válidos');
        
        try {
            const sellersResponse = await axios.get('https://api.siigo.com/v1/users?type=seller', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'testPartner'
                }
            });

            console.log('📋 Debug - Respuesta sellers API:', JSON.stringify(sellersResponse.data, null, 2));

            // SIIGO API returns paginated response with 'results' array
            if (!sellersResponse.data || !sellersResponse.data.results || !Array.isArray(sellersResponse.data.results) || sellersResponse.data.results.length === 0) {
                console.log('⚠️  No se encontraron sellers en results, usando seller por defecto');
                var validSellerId = 388; // Usar Jhon Caicedo como fallback
            } else {
                console.log(`✅ ${sellersResponse.data.results.length} sellers encontrados:`);
                
                // Filtrar solo sellers activos
                const activeSellers = sellersResponse.data.results.filter(seller => seller.active);
                console.log(`📋 ${activeSellers.length} sellers activos:`);
                
                activeSellers.forEach((seller, index) => {
                    console.log(`   ${index + 1}. ID: ${seller.id} - ${seller.first_name} ${seller.last_name} (${seller.active ? 'ACTIVO' : 'INACTIVO'})`);
                });
                
                // Usar el primer seller activo
                var validSellerId = activeSellers.length > 0 ? activeSellers[0].id : 388;
            }
        } catch (sellersError) {
            console.log('⚠️  Error obteniendo sellers, usando seller por defecto del sistema');
            console.log('📋 Error details:', sellersError.message);
            
            // Intentar obtener usuario actual como fallback
            const currentUserResponse = await axios.get('https://api.siigo.com/v1/users/current-user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'testPartner'
                }
            });
            
            console.log('📋 Usuario actual encontrado:');
            console.log(`   🆔 ID: ${currentUserResponse.data.id}`);
            console.log(`   👤 Nombre: ${currentUserResponse.data.first_name} ${currentUserResponse.data.last_name}`);
            var validSellerId = currentUserResponse.data.id;
        }

        console.log(`🎯 Usando seller ID: ${validSellerId}\n`);

        // PASO 3: Buscar cliente
        console.log('📝 PASO 3: Buscar cliente con cédula 1082746400');
        
        const customersResponse = await axios.get('https://api.siigo.com/v1/customers?identification=1082746400', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'testPartner'
            }
        });

        console.log('📋 Debug - Respuesta customers API:', JSON.stringify(customersResponse.data, null, 2));

        // SIIGO customers API also might be paginated, check for results array
        let customersData;
        if (customersResponse.data && customersResponse.data.results && Array.isArray(customersResponse.data.results)) {
            customersData = customersResponse.data.results;
        } else if (Array.isArray(customersResponse.data)) {
            customersData = customersResponse.data;
        } else {
            throw new Error('Estructura de respuesta de clientes no reconocida');
        }

        if (!customersData || customersData.length === 0) {
            throw new Error('Cliente con cédula 1082746400 no encontrado');
        }

        const customer = customersData[0];
        console.log('✅ Cliente encontrado:');
        
        // Handle different name structures that might exist in SIIGO API
        let customerName = 'Sin nombre';
        if (customer.name && Array.isArray(customer.name) && customer.name[0]) {
            customerName = `${customer.name[0].first_name || ''} ${customer.name[0].last_name || ''}`.trim();
        } else if (customer.person_type === 'Person' && customer.first_name && customer.last_name) {
            customerName = `${customer.first_name} ${customer.last_name}`;
        } else if (customer.commercial_name) {
            customerName = customer.commercial_name;
        }
        
        console.log(`   🏢 Nombre: ${customerName}`);
        console.log(`   🆔 ID SIIGO: ${customer.id}`);
        console.log(`   📄 Identificación: ${customer.identification}\n`);

        // PASO 4: Buscar producto
        console.log('📝 PASO 4: Buscar producto con código IMPLE04');
        
        const productsResponse = await axios.get('https://api.siigo.com/v1/products?code=IMPLE04', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'testPartner'
            }
        });

        if (!productsResponse.data || productsResponse.data.length === 0) {
            throw new Error('Producto con código IMPLE04 no encontrado');
        }

        const product = productsResponse.data[0];
        console.log('✅ Producto encontrado:');
        console.log(`   📦 Nombre: ${product.name}`);
        console.log(`   🆔 ID SIIGO: ${product.id}`);
        console.log(`   💰 Precio: ${product.prices?.[0]?.price_list?.[0]?.value || 'undefined'}`);
        console.log(`   📋 Código: ${product.code}\n`);

        // PASO 5: Crear factura FV-1
        console.log('📝 PASO 5: Crear factura FV-1');
        console.log('🎯 Usando Document ID: 15047 (FV-1 - Factura No Electrónica)');
        
        const invoiceData = {
            document: {
                id: 15047 // FV-1 Document ID confirmado
            },
            date: '2025-08-21',
            customer: {
                identification: customer.identification,
                branch_office: 0
            },
            seller: validSellerId,
            observations: 'Factura de prueba FV-1 - Cliente 1082746400 - Producto IMPLE04',
            items: [
                {
                    code: product.code,
                    description: product.name,
                    quantity: 1,
                    price: 50000 // Precio fijo para prueba
                }
            ],
            payments: [
                {
                    id: 5083, // Efectivo
                    value: 50000
                }
            ]
        };

        console.log('📋 Datos de la factura:', JSON.stringify(invoiceData, null, 2));

        const invoiceResponse = await axios.post('https://api.siigo.com/v1/invoices', invoiceData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'testPartner'
            }
        });

        console.log('\n🎉 ¡FACTURA FV-1 CREADA EXITOSAMENTE!');
        console.log('='.repeat(70));
        console.log(`📄 Número de factura: ${invoiceResponse.data.number}`);
        console.log(`🆔 ID SIIGO: ${invoiceResponse.data.id}`);
        console.log(`📅 Fecha: ${invoiceResponse.data.date}`);
        console.log(`📋 Document ID: ${invoiceResponse.data.document.id}`);
        console.log(`📄 Tipo: ${invoiceResponse.data.document.name}`);
        console.log(`💰 Total: $${invoiceResponse.data.total}`);
        console.log('\n✅ CONFIRMADO: Document ID 15047 funciona correctamente para FV-1');
        console.log('✅ CONFIRMADO: Factura no electrónica creada exitosamente');
        
    } catch (error) {
        console.error('❌ Error creando factura FV-1:', error.message);
        if (error.response) {
            console.error('📋 Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
        console.log('\n❌ Prueba fallida:', error.message);
    }
}

crearFacturaFV1ConSellerValido();
