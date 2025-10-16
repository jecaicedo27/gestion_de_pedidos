require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function crearFacturaFV1Final() {
    console.log('🚀 Creando factura FV-1 final con seller fijo...\n');
    
    console.log('🎯 CREACIÓN DE FACTURA FV-1 FINAL');
    console.log('='.repeat(70));
    console.log('📋 Cliente: Cédula 1082746400');
    console.log('📦 Producto: Código IMPLE04');
    console.log('📄 Tipo: FV-1 (Document ID: 15047)');
    console.log('👤 Seller: 388 (Jhon Caicedo) - FIJO');
    console.log('🎯 Objetivo: Crear factura exitosa siempre con seller 388\n');

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

        // PASO 2: Usar seller fijo 388
        console.log('📝 PASO 2: Usando seller fijo');
        const validSellerId = 388; // ID fijo de Jhon Caicedo como solicitaste
        console.log('🎯 Usando seller ID: 388 (Jhon Caicedo - COMERCIAL@PERLAS-EXPLOSIVAS.COM)\n');

        // PASO 3: Buscar cliente
        console.log('📝 PASO 3: Buscar cliente con cédula 1082746400');
        
        const customersResponse = await axios.get('https://api.siigo.com/v1/customers?identification=1082746400', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'testPartner'
            }
        });

        // SIIGO customers API puede ser paginado, verificar array results
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
        
        // Manejar diferentes estructuras de nombre que pueden existir en SIIGO API
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

        // SIIGO products API también puede ser paginado
        let productsData;
        if (productsResponse.data && productsResponse.data.results && Array.isArray(productsResponse.data.results)) {
            productsData = productsResponse.data.results;
        } else if (Array.isArray(productsResponse.data)) {
            productsData = productsResponse.data;
        } else {
            throw new Error('Estructura de respuesta de productos no reconocida');
        }

        if (!productsData || productsData.length === 0) {
            throw new Error('Producto con código IMPLE04 no encontrado');
        }

        const product = productsData[0];
        const productPrice = product.prices?.[0]?.price_list?.[0]?.value || 106;
        
        console.log('✅ Producto encontrado:');
        console.log(`   📦 Nombre: ${product.name}`);
        console.log(`   🆔 ID SIIGO: ${product.id}`);
        console.log(`   💰 Precio SIIGO: ${productPrice} pesos`);
        console.log(`   📋 Código: ${product.code}\n`);

        // PASO 5: Crear factura FV-1
        console.log('📝 PASO 5: Crear factura FV-1');
        console.log('🎯 Usando Document ID: 15047 (FV-1 - Factura No Electrónica)');
        console.log('👤 Usando Seller ID: 388 (Jhon Caicedo - FIJO)');
        
        const invoiceData = {
            document: {
                id: 15047 // FV-1 Document ID confirmado
            },
            date: '2025-08-21',
            customer: {
                identification: customer.identification,
                branch_office: 0
            },
            seller: validSellerId, // Siempre 388 como solicitaste
            observations: 'Factura de prueba FV-1 - Cliente 1082746400 - Producto IMPLE04 - Seller 388',
            items: [
                {
                    code: product.code,
                    description: product.name,
                    quantity: 1,
                    price: productPrice // Precio desde SIIGO (106 pesos)
                }
            ],
            payments: [
                {
                    id: 3467, // ID correcto de "Crédito" obtenido de factura 31
                    value: productPrice, // Valor total = precio * cantidad (106 * 1)
                    due_date: '2025-09-21' // Fecha de vencimiento (30 días después)
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
        console.log(`👤 Seller: ${validSellerId} (Jhon Caicedo)`);
        console.log(`💰 Total: $${invoiceResponse.data.total}`);
        console.log('\n✅ CONFIRMADO: Document ID 15047 funciona correctamente para FV-1');
        console.log('✅ CONFIRMADO: Seller 388 aplicado correctamente');
        console.log('✅ CONFIRMADO: Factura no electrónica creada exitosamente');
        
    } catch (error) {
        console.error('❌ Error creando factura FV-1:', error.message);
        if (error.response) {
            console.error('📋 Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
        console.log('\n❌ Prueba fallida:', error.message);
    }
}

crearFacturaFV1Final();
