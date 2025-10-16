const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function crearFacturaPruebaFV1() {
  try {
    console.log('🔍 CREANDO FACTURA DE PRUEBA FV-1 (NO ELECTRÓNICA)');
    console.log('='.repeat(60));

    // PASO 1: Autenticación
    console.log('\n📝 PASO 1: Autenticación');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    console.log('✅ Login exitoso');
    
    const token = loginResponse.data.data.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // PASO 2: Crear factura de prueba con ChatGPT
    console.log('\n🤖 PASO 2: Creando factura de prueba con ChatGPT y FV-1');
    console.log('📋 Cliente: 1082746400 (para identificar fácilmente)');
    console.log('📋 Tipo: FV-1 (factura no electrónica)');
    
    const naturalLanguageOrder = "Necesito 2 LIQUIPOPS SABOR A FRESA a 25000 cada uno y 1 LIQUIPOPS SABOR A MANGO a 27000";
    
    const invoiceData = {
      customer_identification: "1082746400", // Cliente específico para pruebas
      natural_language_order: naturalLanguageOrder,
      items: [
        {
          product_name: "LIQUIPOPS SABOR A FRESA X 12000 GR",
          product_code: "LIQUIPP01", // Código de prueba
          quantity: 2,
          unit_price: 25000,
          unit: "unidades"
        },
        {
          product_name: "LIQUIPOPS SABOR A MANGO X 1200 GR", 
          product_code: "LIQUIPP02", // Código de prueba
          quantity: 1,
          unit_price: 27000,
          unit: "unidades"
        }
      ],
      document_type: "FV1", // Especificar FV-1 para facturas no electrónicas
      notes: `FACTURA DE PRUEBA FV-1 - ${new Date().toISOString()} - Creada para testing del sistema ChatGPT + SIIGO. Cliente identificador: 1082746400`
    };

    console.log('📤 Datos de la factura de prueba:');
    console.log(JSON.stringify(invoiceData, null, 2));

    try {
      const siigoResponse = await axios.post(
        `${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`,
        invoiceData,
        { headers: authHeaders }
      );

      console.log('✅ ÉXITO: Factura de prueba FV-1 creada');
      console.log('📊 Respuesta completa de SIIGO:');
      console.log(JSON.stringify(siigoResponse.data, null, 2));

      // Extraer información clave
      const responseData = siigoResponse.data;
      if (responseData.success && responseData.siigo_response) {
        console.log('\n🎯 INFORMACIÓN DE LA FACTURA CREADA:');
        console.log('='.repeat(50));
        console.log(`📄 NÚMERO DE FACTURA: ${responseData.siigo_response.number || 'N/A'}`);
        console.log(`🆔 ID DEL DOCUMENTO: ${responseData.siigo_response.id || 'N/A'}`);
        console.log(`📋 TIPO DE DOCUMENTO: ${responseData.siigo_response.document?.id || 'N/A'}`);
        console.log(`👤 CLIENTE: 1082746400`);
        console.log(`💰 TOTAL: $${(2 * 25000) + (1 * 27000)} COP (sin IVA)`);
        console.log(`📅 FECHA: ${responseData.siigo_response.date || new Date().toISOString().split('T')[0]}`);
      } else {
        console.log('⚠️ Respuesta exitosa pero estructura inesperada');
        
        // Intentar extraer datos de otra forma
        if (responseData.data && responseData.data.invoice_number) {
          console.log(`📄 Número de factura: ${responseData.data.invoice_number}`);
        }
        if (responseData.data && responseData.data.invoice_id) {
          console.log(`🆔 ID de factura: ${responseData.data.invoice_id}`);
        }
      }

    } catch (siigoError) {
      console.log('❌ ERROR creando factura FV-1:', siigoError.response?.data || siigoError.message);
      
      if (siigoError.response?.data) {
        console.log('📊 Detalles del error:');
        console.log(JSON.stringify(siigoError.response.data, null, 2));
      }

      // PASO 3 ALTERNATIVO: Crear directamente con servicio SIIGO si el endpoint falla
      console.log('\n🔧 PASO 3: Intentando crear factura directamente con servicio SIIGO');
      
      try {
        const siigoInvoiceService = require('./backend/services/siigoInvoiceService');
        
        // Preparar datos para el servicio directo
        const customer = { identification: "1082746400" };
        const items = [
          {
            code: "LIQUIPP01",
            quantity: 2,
            price: 25000,
            description: "LIQUIPOPS SABOR A FRESA X 12000 GR"
          },
          {
            code: "LIQUIPP02",
            quantity: 1,
            price: 27000,
            description: "LIQUIPOPS SABOR A MANGO X 1200 GR"
          }
        ];
        
        const notes = `FACTURA DE PRUEBA FV-1 DIRECTA - ${new Date().toISOString()} - Cliente: 1082746400`;
        
        // Configurar para FV-1 (factura no electrónica)
        const options = {
          documentId: 5153 // FV-1 - Factura de Venta (no electrónica)
        };
        
        const invoiceData = siigoInvoiceService.prepareInvoiceData(customer, items, notes, naturalLanguageOrder, options);
        const result = await siigoInvoiceService.createInvoice(invoiceData);
        
        if (result.success) {
          console.log('✅ ÉXITO con servicio directo:');
          console.log(`📄 NÚMERO DE FACTURA: ${result.invoiceNumber}`);
          console.log(`🆔 ID DEL DOCUMENTO: ${result.siigoId}`);
          console.log(`📋 DATOS COMPLETOS:`, JSON.stringify(result.data, null, 2));
        } else {
          console.log('❌ Error también con servicio directo:', result.message);
          console.log('📊 Detalles:', JSON.stringify(result, null, 2));
        }
        
      } catch (directError) {
        console.log('❌ Error con servicio directo:', directError.message);
      }
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.response?.data) {
      console.log('📊 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

console.log('🚀 Creando factura de prueba FV-1 con cliente 1082746400...\n');
crearFacturaPruebaFV1();
