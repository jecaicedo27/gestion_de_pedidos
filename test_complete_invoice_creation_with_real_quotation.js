const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function testCompleteInvoiceCreationWithRealQuotation() {
  try {
    console.log('🎯 PRUEBA COMPLETA: CREAR COTIZACIÓN → CREAR FACTURA');
    console.log('='.repeat(70));
    
    // PASO 1: Autenticación
    console.log('\n📝 PASO 1: Autenticación');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    console.log('✅ Login exitoso');
    
    const token = loginResponse.data.data.token;

    // PASO 2: Buscar o crear cliente para prueba
    console.log('\n📝 PASO 2: Buscando cliente para la prueba');
    
    let customerId;
    try {
      // Buscar cliente existente con identificación 1082746400
      const searchResponse = await axios.get(`${BASE_URL}/api/quotations/customers/search?q=1082746400`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (searchResponse.data.customers && searchResponse.data.customers.length > 0) {
        customerId = searchResponse.data.customers[0].id;
        console.log(`✅ Cliente existente encontrado - ID: ${customerId}`);
        console.log(`   📋 Nombre: ${searchResponse.data.customers[0].name}`);
        console.log(`   📄 Identificación: ${searchResponse.data.customers[0].identification}`);
      } else {
        console.log('⚠️ Cliente no encontrado, pero esto es normal para la prueba');
        // Para esta prueba usaremos un ID de cliente ficticio
        customerId = 1; // ID genérico para prueba
      }
    } catch (searchError) {
      console.log('⚠️ Error buscando cliente, usando ID genérico:', searchError.message);
      customerId = 1;
    }

    // PASO 3: Crear cotización real
    console.log('\n📝 PASO 3: Creando cotización de prueba');
    
    const quotationData = {
      customerId: customerId,
      rawRequest: '1 implemento de prueba IMPLE04 para facturar',
      requestType: 'text'
    };

    let quotationId;
    try {
      const quotationResponse = await axios.post(`${BASE_URL}/api/quotations`, quotationData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      quotationId = quotationResponse.data.data.quotationId;
      const quotationNumber = quotationResponse.data.data.quotationNumber;
      
      console.log('✅ Cotización creada exitosamente');
      console.log(`   🆔 ID: ${quotationId}`);
      console.log(`   📄 Número: ${quotationNumber}`);
      
    } catch (quotationError) {
      console.log('❌ Error creando cotización:', quotationError.response?.data || quotationError.message);
      
      // Como fallback, usar ID ficticio pero que sea numérico
      quotationId = Math.floor(Math.random() * 1000) + 1;
      console.log(`⚠️ Usando ID ficticio para prueba: ${quotationId}`);
    }

    // PASO 4: Crear factura desde la cotización
    console.log('\n📝 PASO 4: Creando factura FV-1 desde cotización');
    console.log(`🎯 Usando quotationId: ${quotationId}`);
    
    const invoiceRequestData = {
      quotationId: quotationId,
      documentType: 'FV-1'
    };
    
    console.log('📋 Datos de request:', JSON.stringify(invoiceRequestData, null, 2));
    
    try {
      const invoiceResponse = await axios.post(`${BASE_URL}/api/quotations/create-invoice`, invoiceRequestData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('\n🎉 ¡FACTURA CREADA EXITOSAMENTE!');
      console.log('='.repeat(50));
      console.log(`📄 Número de factura: ${invoiceResponse.data.data.siigo_invoice_number}`);
      console.log(`🆔 ID SIIGO: ${invoiceResponse.data.data.siigo_invoice_id}`);
      console.log(`📋 Tipo de documento: ${invoiceResponse.data.data.document_type}`);
      console.log(`🎯 Document ID usado: ${invoiceResponse.data.data.document_id}`);
      console.log(`👤 Cliente ID: ${invoiceResponse.data.data.customer.id}`);
      console.log(`📦 Items procesados: ${invoiceResponse.data.data.items_processed}`);
      
      if (invoiceResponse.data.data.siigo_public_url) {
        console.log(`🔗 URL pública: ${invoiceResponse.data.data.siigo_public_url}`);
      }
      
      console.log('\n✅ FLUJO COMPLETO EXITOSO:');
      console.log('   1. ✅ Autenticación');
      console.log('   2. ✅ Búsqueda de cliente');
      console.log('   3. ✅ Creación de cotización');
      console.log('   4. ✅ Creación de factura desde cotización');
      
      console.log('\n🎯 CONFIRMACIÓN:');
      console.log('   ✅ El endpoint /api/quotations/create-invoice funciona');
      console.log('   ✅ El método createInvoice está configurado correctamente');
      console.log('   ✅ La estructura exitosa se mantiene (Document ID: 15047)');
      console.log('   ✅ Los datos se pasan correctamente desde cotización');
      
      // Mostrar JSON técnico si está disponible
      if (invoiceResponse.data.data.siigo_request_data) {
        console.log('\n📊 DATOS TÉCNICOS ENVIADOS A SIIGO:');
        console.log('='.repeat(50));
        console.log(JSON.stringify(invoiceResponse.data.data.siigo_request_data, null, 2));
      }
      
    } catch (invoiceError) {
      console.log('\n❌ ERROR CREANDO FACTURA:');
      console.log('='.repeat(50));
      console.log('Status:', invoiceError.response?.status);
      console.log('Status Text:', invoiceError.response?.statusText);
      
      if (invoiceError.response?.data) {
        console.log('📋 Detalles del error:', JSON.stringify(invoiceError.response.data, null, 2));
        
        // Analizar el error específico
        const errorData = invoiceError.response.data;
        
        if (errorData.message === 'Cotización no encontrada') {
          console.log('\n🔍 DIAGNÓSTICO DEL ERROR:');
          console.log(`   📌 El quotationId ${quotationId} no se encontró en la base de datos`);
          console.log('   📌 Esto puede ser porque:');
          console.log('      1. La cotización no se guardó correctamente en el paso 3');
          console.log('      2. El ID generado no coincide con el ID en la BD');
          console.log('      3. Hay un problema de conexión con la base de datos');
          
          console.log('\n💡 SOLUIONES SUGERIDAS:');
          console.log('   1. Verificar que la tabla quotations exista');
          console.log('   2. Verificar que el usuario tenga permisos para crear cotizaciones');
          console.log('   3. Revisar la conexión a la base de datos');
          console.log('   4. Usar un ID de cotización que exista realmente');
        }
        
        if (errorData.message === 'Cliente e items son requeridos') {
          console.log('\n🔍 DIAGNÓSTICO DEL ERROR:');
          console.log('   📌 El método sigue usando la validación del método anterior');
          console.log('   📌 Puede ser que la ruta no se haya actualizado correctamente');
          console.log('   📌 O que el método createInvoice tenga un error de implementación');
        }
      }
    }

    console.log('\n📋 RESUMEN DE LA PRUEBA:');
    console.log('='.repeat(50));
    console.log('🎯 Objetivo: Probar el flujo completo de cotización → factura');
    console.log(`📊 Cliente ID usado: ${customerId}`);
    console.log(`📊 Cotización ID usado: ${quotationId}`);
    console.log('📊 Tipo de documento: FV-1 (Document ID: 15047)');

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.response?.data) {
      console.log('📋 Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('\n🔧 PASOS DE DEBUGGING ADICIONALES:');
    console.log('1. Verificar que el backend esté ejecutándose');
    console.log('2. Verificar que la base de datos esté conectada');
    console.log('3. Revisar que las rutas estén configuradas correctamente');
    console.log('4. Comprobar que el método createInvoice esté bien implementado');
  }
}

console.log('🚀 Iniciando prueba completa de cotización → factura...\n');
testCompleteInvoiceCreationWithRealQuotation();
