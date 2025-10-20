const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function crearFacturaPruebaIdentificable() {
  try {
    console.log('🔍 CREANDO FACTURA DE PRUEBA IDENTIFICABLE');
    console.log('='.repeat(60));
    console.log('📋 Cliente: 1082746400 (para identificar fácilmente en futuras pruebas)');
    console.log('📋 Usando FV-2 temporalmente hasta encontrar FV-1');

    // PASO 1: Autenticación
    console.log('\n📝 PASO 1: Autenticación');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    console.log('✅ Login exitoso');
    
    const token = loginResponse.data.data.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // PASO 2: Crear factura de prueba corrigiendo los errores anteriores
    console.log('\n🤖 PASO 2: Creando factura de prueba con datos corregidos');
    
    const naturalLanguageOrder = "Factura de prueba: 2 LIQUIPOPS SABOR A FRESA a 25000 cada uno y 1 LIQUIPOPS SABOR A MANGO a 27000";
    
    // CORREGIR: Usar customer_id en lugar de customer_identification
    const invoiceData = {
      customer_id: "1082746400", // Cambio clave: usar customer_id
      natural_language_order: naturalLanguageOrder,
      items: [
        {
          product_name: "LIQUIPOPS SABOR A FRESA X 12000 GR - PRUEBA",
          product_code: "TESTFRESA", // Código único de prueba
          quantity: 2,
          unit_price: 25000,
          unit: "unidades"
        },
        {
          product_name: "LIQUIPOPS SABOR A MANGO X 1200 GR - PRUEBA", 
          product_code: "TESTMANGO", // Código único de prueba
          quantity: 1,
          unit_price: 27000,
          unit: "unidades"
        }
      ],
      notes: `🧪 FACTURA DE PRUEBA IDENTIFICABLE - ${new Date().toISOString()} - Cliente: 1082746400 - Para testing del sistema ChatGPT + SIIGO`
    };

    console.log('📤 Datos corregidos de la factura de prueba:');
    console.log(JSON.stringify(invoiceData, null, 2));

    try {
      const siigoResponse = await axios.post(
        `${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`,
        invoiceData,
        { headers: authHeaders }
      );

      console.log('✅ ÉXITO: Factura de prueba creada');
      console.log('📊 Respuesta completa:');
      console.log(JSON.stringify(siigoResponse.data, null, 2));

      // Extraer información clave de la respuesta
      const responseData = siigoResponse.data;
      
      if (responseData.success) {
        console.log('\n🎯 ¡FACTURA DE PRUEBA CREADA EXITOSAMENTE!');
        console.log('='.repeat(50));
        
        // Intentar extraer información de diferentes estructuras posibles
        let invoiceNumber = 'N/A';
        let invoiceId = 'N/A';
        let documentType = 'N/A';
        
        if (responseData.siigo_response) {
          invoiceNumber = responseData.siigo_response.number || responseData.siigo_response.id || 'N/A';
          invoiceId = responseData.siigo_response.id || 'N/A';
          documentType = responseData.siigo_response.document?.id || 'N/A';
        } else if (responseData.data) {
          invoiceNumber = responseData.data.invoice_number || responseData.data.number || 'N/A';
          invoiceId = responseData.data.invoice_id || responseData.data.id || 'N/A';
        } else if (responseData.invoice_number) {
          invoiceNumber = responseData.invoice_number;
        }
        
        console.log(`📄 NÚMERO DE FACTURA: ${invoiceNumber}`);
        console.log(`🆔 ID DEL DOCUMENTO: ${invoiceId}`);
        console.log(`📋 TIPO DE DOCUMENTO: ${documentType}`);
        console.log(`👤 CLIENTE: 1082746400 (fácil de identificar)`);
        console.log(`💰 TOTAL ESPERADO: $${(2 * 25000) + (1 * 27000)} = $77,000 COP (sin IVA)`);
        console.log(`📅 FECHA: ${new Date().toISOString().split('T')[0]}`);
        
        console.log('\n✨ RESPUESTA A TU PREGUNTA ORIGINAL:');
        console.log(`El número de la factura creada es: ${invoiceNumber}`);
        console.log(`El ID del documento en SIIGO es: ${invoiceId}`);
        
        // Ahora busquemos esta factura en SIIGO para confirmar
        console.log('\n🔍 PASO 3: Verificando la factura creada en SIIGO');
        
        // Usar el servicio directo para buscar facturas del cliente 1082746400
        const siigoInvoiceService = require('./backend/services/siigoInvoiceService');
        
        try {
          const today = new Date().toISOString().split('T')[0];
          const facturas = await siigoInvoiceService.listInvoices({
            created_start: today,
            created_end: today
          });
          
          if (facturas && facturas.results) {
            const facturaCliente = facturas.results.find(f => f.customer?.identification === "1082746400");
            
            if (facturaCliente) {
              console.log('✅ Factura encontrada en SIIGO:');
              console.log(`📄 Número confirmado: ${facturaCliente.number}`);
              console.log(`🆔 ID confirmado: ${facturaCliente.id}`);
              console.log(`💰 Total: $${facturaCliente.total} COP`);
              console.log(`📋 Tipo: ${facturaCliente.document?.id}`);
            } else {
              console.log('⚠️ Factura no encontrada inmediatamente en SIIGO (puede tardar unos minutos en sincronizar)');
            }
          }
          
        } catch (searchError) {
          console.log('⚠️ Error buscando factura en SIIGO:', searchError.message);
        }

      } else {
        console.log('❌ Respuesta indica error:', responseData.message || 'Error desconocido');
      }

    } catch (siigoError) {
      console.log('❌ ERROR creando factura:', siigoError.response?.data || siigoError.message);
      
      if (siigoError.response?.data) {
        console.log('📊 Detalles completos del error:');
        console.log(JSON.stringify(siigoError.response.data, null, 2));
        
        // Sugerencias específicas basadas en el error
        if (siigoError.response.data.message?.includes('Cliente')) {
          console.log('\n💡 SUGERENCIA: Problema con el cliente');
          console.log('- Verificar que el cliente 1082746400 existe en SIIGO');
          console.log('- Verificar formato del customer_id');
        }
        
        if (siigoError.response.data.message?.includes('requeridos')) {
          console.log('\n💡 SUGERENCIA: Campos faltantes');
          console.log('- Verificar que todos los campos requeridos estén presentes');
          console.log('- Verificar estructura del objeto enviado');
        }
      }
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.response?.data) {
      console.log('📊 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

console.log('🚀 Creando factura de prueba identificable con cliente 1082746400...\n');
crearFacturaPruebaIdentificable();
