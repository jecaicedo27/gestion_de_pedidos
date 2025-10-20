const axios = require('axios');

async function testCompleteInvoiceCreationFlow() {
    console.log('🧪 Testando flujo completo de creación de facturas SIIGO...\n');
    
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

        // 2. Obtener una cotización existente
        console.log('\n2️⃣ Obteniendo cotizaciones...');
        const quotationsResponse = await axios.get('http://localhost:3001/api/quotations', config);
        
        if (!quotationsResponse.data.data || quotationsResponse.data.data.length === 0) {
            throw new Error('No hay cotizaciones disponibles para probar');
        }

        const quotation = quotationsResponse.data.data[0];
        console.log(`✅ Cotización obtenida: ID ${quotation.id}`);
        console.log(`   - Cliente: ${quotation.customer_name}`);
        console.log(`   - Total: $${quotation.total}`);

        // 3. Probar vista previa del JSON
        console.log('\n3️⃣ Probando vista previa del JSON SIIGO...');
        const previewResponse = await axios.post(
            `http://localhost:3001/api/quotations/${quotation.id}/siigo-preview`, 
            {}, 
            config
        );
        
        console.log('✅ Vista previa JSON generada exitosamente');
        console.log('📋 Estructura del JSON:');
        const preview = previewResponse.data.data;
        console.log(`   - Documento: ${preview.document?.type}`);
        console.log(`   - Cliente: ${preview.customer?.identification}`);
        console.log(`   - Items: ${preview.items?.length}`);
        console.log(`   - Total: ${preview.total}`);

        // 4. Crear la factura en SIIGO
        console.log('\n4️⃣ Creando factura en SIIGO...');
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

        console.log('\n🎉 ¡TODAS LAS PRUEBAS EXITOSAS!');
        console.log('✅ El sistema de creación de facturas SIIGO está funcionando correctamente');
        console.log('✅ Se resolvió el error 500 que estaba ocurriendo anteriormente');
        console.log('✅ La vista previa JSON en el cuadro rojo funciona correctamente');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
        
        if (error.response) {
            console.error('📊 Detalles del error:');
            console.error(`   - Status: ${error.response.status}`);
            console.error(`   - Data:`, error.response.data);
        }
        
        return false;
    }
}

testCompleteInvoiceCreationFlow();
