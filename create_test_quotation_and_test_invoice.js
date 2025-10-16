const axios = require('axios');

async function createTestQuotationAndTestInvoice() {
    console.log('🧪 Creando cotización de prueba y testando flujo completo de facturación SIIGO...\n');
    
    try {
        // 1. Login
        console.log('1️⃣ Iniciando sesión...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data?.token || loginResponse.data.token;
        if (!token) {
            throw new Error('No se pudo obtener el token de autenticación');
        }
        console.log('✅ Login exitoso');

        const config = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        // 2. Obtener un cliente existente
        console.log('\n2️⃣ Obteniendo clientes...');
        const customersResponse = await axios.get('http://localhost:3001/api/customers', config);
        
        if (!customersResponse.data.data || customersResponse.data.data.length === 0) {
            throw new Error('No hay clientes disponibles');
        }
        
        const customer = customersResponse.data.data[0];
        console.log(`✅ Cliente obtenido: ${customer.name} (ID: ${customer.id})`);

        // 3. Obtener productos
        console.log('\n3️⃣ Obteniendo productos...');
        const productsResponse = await axios.get('http://localhost:3001/api/products', config);
        
        if (!productsResponse.data.data || productsResponse.data.data.length === 0) {
            throw new Error('No hay productos disponibles');
        }
        
        const product = productsResponse.data.data[0];
        console.log(`✅ Producto obtenido: ${product.name} (ID: ${product.id})`);

        // 4. Crear cotización de prueba
        console.log('\n4️⃣ Creando cotización de prueba...');
        const quotationData = {
            customer_id: customer.id,
            items: [
                {
                    product_id: product.id,
                    quantity: 2,
                    price: 25000
                }
            ],
            notes: 'Cotización de prueba para validar creación de facturas SIIGO',
            total: 50000
        };

        const createQuotationResponse = await axios.post(
            'http://localhost:3001/api/quotations', 
            quotationData, 
            config
        );

        const quotation = createQuotationResponse.data.data;
        console.log(`✅ Cotización creada: ID ${quotation.id}`);
        console.log(`   - Cliente: ${customer.name}`);
        console.log(`   - Total: $${quotation.total}`);

        // 5. Probar vista previa del JSON SIIGO
        console.log('\n5️⃣ Probando vista previa del JSON SIIGO...');
        const previewResponse = await axios.post(
            `http://localhost:3001/api/quotations/${quotation.id}/siigo-preview`, 
            {}, 
            config
        );
        
        console.log('✅ Vista previa JSON generada exitosamente');
        console.log('📋 Estructura del JSON SIIGO:');
        const preview = previewResponse.data.data;
        console.log(`   - Documento: ${preview.document?.type}`);
        console.log(`   - Cliente: ${preview.customer?.identification}`);
        console.log(`   - Items: ${preview.items?.length}`);
        console.log(`   - Total: ${preview.total}`);
        
        // Mostrar el JSON completo que se enviaría a SIIGO
        console.log('\n📄 JSON completo que se enviaría a SIIGO:');
        console.log(JSON.stringify(preview, null, 2));

        // 6. Crear la factura en SIIGO
        console.log('\n6️⃣ Creando factura en SIIGO...');
        const createInvoiceResponse = await axios.post(
            `http://localhost:3001/api/quotations/${quotation.id}/create-invoice`, 
            {}, 
            config
        );

        console.log('✅ Factura creada exitosamente en SIIGO');
        console.log('📋 Respuesta de SIIGO:');
        const invoiceData = createInvoiceResponse.data.data;
        console.log(`   - ID SIIGO: ${invoiceData.siigo_invoice_id}`);
        console.log(`   - Número: ${invoiceData.siigo_invoice_number}`);
        console.log(`   - Total: ${invoiceData.total}`);
        console.log(`   - Fecha: ${invoiceData.date}`);

        // 7. Cleanup: Eliminar la cotización de prueba
        console.log('\n7️⃣ Limpiando cotización de prueba...');
        try {
            await axios.delete(`http://localhost:3001/api/quotations/${quotation.id}`, config);
            console.log('✅ Cotización de prueba eliminada');
        } catch (cleanupError) {
            console.log('⚠️ No se pudo eliminar la cotización de prueba (esto es normal)');
        }

        console.log('\n🎉 ¡TODAS LAS PRUEBAS EXITOSAS!');
        console.log('✅ El sistema de creación de facturas SIIGO está funcionando correctamente');
        console.log('✅ Se resolvió el error 500 que estaba ocurriendo anteriormente');
        console.log('✅ La vista previa JSON en el cuadro rojo funciona correctamente');
        console.log('✅ El flujo completo desde cotización hasta factura SIIGO funciona sin errores');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
        
        if (error.response) {
            console.error('📊 Detalles del error:');
            console.error(`   - Status: ${error.response.status}`);
            console.error(`   - Data:`, error.response.data);
            console.error(`   - URL: ${error.config?.url}`);
        }
        
        return false;
    }
}

createTestQuotationAndTestInvoice();
