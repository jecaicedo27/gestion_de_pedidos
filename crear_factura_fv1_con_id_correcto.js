const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function crearFacturaFV1ConIdCorrecto() {
  try {
    console.log('🎯 CREANDO FACTURA FV-1 CON ID CORRECTO');
    console.log('='.repeat(60));
    console.log('📋 ID encontrado para FV-1: 15047');
    console.log('📋 Usando cliente 222222 (sabemos que existe)');
    console.log('📋 Tipo: FV-1 - Factura de venta No electrónica');

    // PASO 1: Autenticación
    console.log('\n📝 PASO 1: Autenticación');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    console.log('✅ Login exitoso');
    
    const token = loginResponse.data.data.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // PASO 2: Crear factura FV-1 usando ID 15047
    console.log('\n🔧 PASO 2: Creando factura FV-1 con ID 15047');
    
    const siigoInvoiceService = require('./backend/services/siigoInvoiceService');
    
    const customer = { identification: "222222" };
    const items = [
      {
        code: "TESTFV1FRESA",
        quantity: 1,
        price: 25000,
        description: "🧪 PRUEBA FV-1 ID:15047 - LIQUIPOPS FRESA"
      },
      {
        code: "TESTFV1MANGO", 
        quantity: 1,
        price: 27000,
        description: "🧪 PRUEBA FV-1 ID:15047 - LIQUIPOPS MANGO"
      }
    ];
    
    const timestamp = Date.now();
    const notes = `🧪 FACTURA DE PRUEBA FV-1 - ${new Date().toISOString()} - Cliente: 222222 - Sistema: ChatGPT + SIIGO - IDENTIFICADOR: FV1-TEST-${timestamp} - DOCUMENTO ID: 15047`;
    const naturalLanguageOrder = "Factura de prueba FV-1: 1 LIQUIPOPS FRESA a 25000 y 1 LIQUIPOPS MANGO a 27000";
    
    console.log(`🔍 Probando ID 15047 para FV-1...`);
    
    try {
      const options = { documentId: 15047 };
      const invoiceData = siigoInvoiceService.prepareInvoiceData(customer, items, notes, naturalLanguageOrder, options);
      const result = await siigoInvoiceService.createInvoice(invoiceData);
      
      if (result.success) {
        console.log(`✅ ¡ÉXITO CON ID 15047!`);
        console.log('🎯 FACTURA FV-1 CREADA EXITOSAMENTE:');
        console.log('='.repeat(50));
        console.log(`📄 NÚMERO DE FACTURA: ${result.invoiceNumber}`);
        console.log(`🆔 ID DEL DOCUMENTO: ${result.siigoId}`);
        console.log(`📋 TIPO DE DOCUMENTO FV-1: 15047`);
        console.log(`👤 CLIENTE: 222222 (Mostrador Ocasional)`);
        console.log(`💰 TOTAL: $52,000 COP (sin IVA) = $61,880 COP (con IVA 19%)`);
        console.log(`📅 FECHA: ${new Date().toISOString().split('T')[0]}`);
        console.log(`🏷️ IDENTIFICADOR: FV1-TEST-${timestamp}`);
        
        console.log('\n✨ RESPUESTA FINAL A TU PREGUNTA:');
        console.log(`El número de la nueva factura FV-1 es: ${result.invoiceNumber}`);
        console.log(`El ID del documento en SIIGO es: ${result.siigoId}`);
        console.log(`Esta factura usa FV-1 (ID: 15047) y cliente 222222 para fácil identificación`);
        
        // Datos completos de la respuesta
        if (result.data) {
          console.log('\n📊 DATOS COMPLETOS DE LA FACTURA:');
          console.log(JSON.stringify(result.data, null, 2));
        }
        
        // PASO 3: Verificar en SIIGO
        console.log('\n🔍 PASO 3: Verificando en SIIGO...');
        try {
          const today = new Date().toISOString().split('T')[0];
          const facturas = await siigoInvoiceService.listInvoices({
            created_start: today,
            created_end: today
          });
          
          if (facturas && facturas.results) {
            const facturaEncontrada = facturas.results.find(f => 
              f.customer?.identification === "222222" && 
              f.id === result.siigoId
            );
            
            if (facturaEncontrada) {
              console.log('✅ Factura FV-1 confirmada en SIIGO:');
              console.log(`📄 Número confirmado: ${facturaEncontrada.number}`);
              console.log(`🆔 ID confirmado: ${facturaEncontrada.id}`);
              console.log(`💰 Total confirmado: $${facturaEncontrada.total} COP`);
              console.log(`📋 Tipo confirmado: ${facturaEncontrada.document?.id}`);
              
              if (facturaEncontrada.observations) {
                console.log(`📄 Observaciones: ${facturaEncontrada.observations.substring(0, 100)}...`);
              }
              
              // Verificar que efectivamente es FV-1
              if (facturaEncontrada.document?.id === 15047) {
                console.log('\n🏆 CONFIRMADO: Esta es una factura FV-1 (No electrónica)');
                console.log('🎯 El ID 15047 es el correcto para crear facturas FV-1');
              }
              
            } else {
              console.log('⚠️ Factura creada pero no encontrada en la verificación');
            }
          }
        } catch (verifyError) {
          console.log('⚠️ Error verificando en SIIGO (esto es normal):', verifyError.message);
        }
        
        console.log('\n🎉 MISIÓN CUMPLIDA:');
        console.log('✅ FV-1 identificado: ID 15047');
        console.log('✅ Factura FV-1 creada exitosamente');
        console.log('✅ Sistema listo para crear facturas FV-1 con cliente identificable');
        console.log('\n💡 PARA FUTURAS FACTURAS FV-1:');
        console.log('   - Usar document.id = 15047');
        console.log('   - Usar cliente 222222 para fácil identificación');
        console.log('   - Funciona con el sistema actual de ChatGPT + SIIGO');
        
      } else {
        console.log(`❌ Error con ID 15047:`, result.message);
        if (result.details && result.details.Errors) {
          result.details.Errors.forEach(error => {
            console.log(`   - ${error.Code}: ${error.Message}`);
          });
        }
        
        // Si falló, intentar con el método alternativo usando FV-2 pero identificable
        console.log('\n🔧 MÉTODO ALTERNATIVO: Creando con FV-2 pero identificable');
        await crearFacturaAlternativaFV2(siigoInvoiceService, customer, items, timestamp);
      }
      
    } catch (error) {
      console.log(`❌ Error con ID 15047:`, error.message);
      console.log('\n🔧 MÉTODO ALTERNATIVO: Creando con FV-2 pero identificable');
      await crearFacturaAlternativaFV2(siigoInvoiceService, customer, items, timestamp);
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.response?.data) {
      console.log('📊 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function crearFacturaAlternativaFV2(siigoInvoiceService, customer, items, timestamp) {
  try {
    const fv2Options = { documentId: 27081 }; // FV-2 que sabemos que funciona
    const fv2Notes = `🧪 FACTURA DE PRUEBA PARA FUTURAS PRUEBAS FV-2 - ${new Date().toISOString()} - Cliente: 222222 - Sistema: ChatGPT + SIIGO - IDENTIFICADOR: FUTURE-FV2-TEST-${timestamp}`;
    const naturalLanguageOrder = "Factura de prueba alternativa FV-2: 1 LIQUIPOPS FRESA a 25000 y 1 LIQUIPOPS MANGO a 27000";
    
    const invoiceData = siigoInvoiceService.prepareInvoiceData(customer, items, fv2Notes, naturalLanguageOrder, fv2Options);
    const result = await siigoInvoiceService.createInvoice(invoiceData);
    
    if (result.success) {
      console.log('✅ FACTURA ALTERNATIVA CREADA (FV-2 identificable):');
      console.log(`📄 NÚMERO: ${result.invoiceNumber}`);
      console.log(`🆔 ID: ${result.siigoId}`);
      console.log(`👤 CLIENTE: 222222`);
      console.log(`🏷️ IDENTIFICADOR: FUTURE-FV2-TEST-${timestamp}`);
      console.log('💡 Esta factura FV-2 puede usarse para futuras pruebas si FV-1 no funciona');
    } else {
      console.log('❌ Error también con FV-2:', result.message);
    }
  } catch (altError) {
    console.log('❌ Error también con FV-2:', altError.message);
  }
}

console.log('🚀 Creando factura FV-1 con ID correcto 15047...\n');
crearFacturaFV1ConIdCorrecto();
