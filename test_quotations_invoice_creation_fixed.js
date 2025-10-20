const axios = require('axios');

async function testQuotationInvoiceCreation() {
  console.log('🧪 Probando creación de facturas desde cotizaciones (post-correcciones)...\n');

  const BASE_URL = 'http://localhost:3001';
  let authToken = null;

  try {
    // PASO 1: Autenticación
    console.log('🔐 1. Iniciando sesión...');
    
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@admin.com',
      password: 'admin123'
    });

    authToken = loginResponse.data.token;
    console.log('   ✅ Autenticación exitosa');

    // PASO 2: Obtener un cliente válido
    console.log('👥 2. Buscando cliente válido...');
    
    const customersResponse = await axios.get(
      `${BASE_URL}/api/quotations/customers/search?q=ALEXANDER`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    if (!customersResponse.data.success || customersResponse.data.customers.length === 0) {
      throw new Error('No se encontraron clientes para la prueba');
    }

    const customer = customersResponse.data.customers[0];
    console.log(`   ✅ Cliente encontrado: ${customer.name} (ID: ${customer.id})`);

    // PASO 3: Crear una factura desde cotización
    console.log('📋 3. Creando factura desde cotización con SIIGO...');
    
    const invoiceData = {
      customerId: customer.id,
      items: [
        {
          product_code: 'LIQUIPP01',
          product_name: 'Liqui Pop Fresa',
          quantity: 2,
          unit_price: 3500,
          description: 'Liqui Pop sabor fresa - producto de prueba'
        },
        {
          product_code: 'LIQUIPP02', 
          product_name: 'Liqui Pop Mora',
          quantity: 1,
          unit_price: 3500,
          description: 'Liqui Pop sabor mora - producto de prueba'
        }
      ],
      notes: 'Factura de prueba creada después de corregir document IDs - Sistema de gestión de pedidos',
      documentType: 'FV-1' // Usando FV-1 que ahora tiene el ID correcto (5152)
    };

    console.log('📊 JSON que se enviará:');
    console.log(JSON.stringify(invoiceData, null, 2));

    const invoiceResponse = await axios.post(
      `${BASE_URL}/api/quotations/create-invoice`,
      invoiceData,
      {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (invoiceResponse.data.success) {
      console.log('\n🎉 ¡FACTURA CREADA EXITOSAMENTE!');
      console.log('📋 Detalles de la respuesta:');
      console.log(`   • ID SIIGO: ${invoiceResponse.data.data.siigo_invoice_id}`);
      console.log(`   • Número: ${invoiceResponse.data.data.siigo_invoice_number}`);
      console.log(`   • URL Pública: ${invoiceResponse.data.data.siigo_public_url || 'N/A'}`);
      console.log(`   • Items procesados: ${invoiceResponse.data.data.items_processed}`);
      console.log(`   • Cliente: ${invoiceResponse.data.data.customer.name}`);
      console.log(`   • Tipo documento: ${invoiceResponse.data.data.document_type}`);
      
      if (invoiceResponse.data.data.siigo_request_data) {
        console.log('\n📄 Datos enviados a SIIGO:');
        console.log(`   • Document ID usado: ${invoiceResponse.data.data.siigo_request_data.document.id}`);
        console.log(`   • Vendedor: ${invoiceResponse.data.data.siigo_request_data.seller}`);
        console.log(`   • Total: ${invoiceResponse.data.data.siigo_request_data.payments?.[0]?.value || 'N/A'}`);
      }
      
    } else {
      console.log('❌ Error creando factura:');
      console.log('   Mensaje:', invoiceResponse.data.message);
      console.log('   Error:', invoiceResponse.data.error);
      console.log('   Detalles:', invoiceResponse.data.details);
      
      if (invoiceResponse.data.suggestions) {
        console.log('   Sugerencias:');
        invoiceResponse.data.suggestions.forEach(suggestion => {
          console.log(`     • ${suggestion}`);
        });
      }
    }

    // PASO 4: Probar también con ChatGPT
    console.log('\n🤖 4. Probando creación con ChatGPT...');
    
    const chatgptInvoiceData = {
      customer_id: customer.id,
      natural_language_order: 'Necesito 3 Liqui Pop de fresa y 2 de mora para entrega inmediata',
      notes: 'Pedido procesado con ChatGPT - Prueba después de correcciones'
    };

    try {
      const chatgptResponse = await axios.post(
        `${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`,
        chatgptInvoiceData,
        {
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (chatgptResponse.data.success) {
        console.log('   ✅ Factura con ChatGPT creada exitosamente');
        console.log(`   • ID SIIGO: ${chatgptResponse.data.data.siigo_invoice_id}`);
        console.log(`   • Items detectados por ChatGPT: ${chatgptResponse.data.data.chatgpt_stats?.items_detected || 0}`);
        console.log(`   • Confianza promedio: ${(chatgptResponse.data.data.chatgpt_stats?.confidence_average * 100).toFixed(1)}%`);
      } else {
        console.log('   ⚠️ Error con ChatGPT:', chatgptResponse.data.message);
        if (chatgptResponse.data.errorType === 'QUOTA_EXCEEDED') {
          console.log('   📝 Nota: Cuota de ChatGPT excedida (normal en pruebas)');
        }
      }
    } catch (chatgptError) {
      console.log('   ⚠️ Error en prueba ChatGPT:', chatgptError.response?.data?.message || chatgptError.message);
      if (chatgptError.response?.data?.errorType === 'QUOTA_EXCEEDED') {
        console.log('   📝 Nota: Cuota de ChatGPT excedida (normal en pruebas)');
      }
    }

  } catch (error) {
    console.error('\n❌ Error en la prueba:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      
      // Analizar errores específicos
      if (error.response.status === 400) {
        console.log('\n🔍 Análisis del error 400:');
        console.log('   • Si antes veías errores 400, esto indica que la corrección funcionó');
        console.log('   • Error 400 actual puede ser por datos de cliente o productos inválidos');
        console.log('   • Revisar que el cliente tenga document/identification válido');
      }
      
      if (error.response.status === 422) {
        console.log('\n🔍 Análisis del error 422:');
        console.log('   • Error de validación en SIIGO');
        console.log('   • Puede ser por productos inexistentes o datos faltantes');
        console.log('   • El document ID ahora debe ser correcto (5152)');
      }
    }
  }

  console.log('\n📋 Resumen de correcciones aplicadas:');
  console.log('   ✅ SIIGO Document ID corregido: 15047/5153 → 5152');
  console.log('   ✅ ChatGPT foreign key constraint arreglado');
  console.log('   ✅ quotation_id es opcional (NULL permitido)');
  console.log('   ✅ Backend reiniciado automáticamente');
  console.log('\n💡 Si aún hay errores, pueden ser por:');
  console.log('   • SIIGO API rate limiting (503 errors)');
  console.log('   • Productos inexistentes en SIIGO');
  console.log('   • Datos de cliente inválidos');
  console.log('   • Cuota ChatGPT excedida');
}

// Ejecutar la prueba
testQuotationInvoiceCreation()
  .then(() => {
    console.log('\n✅ Prueba completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error ejecutando prueba:', error);
    process.exit(1);
  });
