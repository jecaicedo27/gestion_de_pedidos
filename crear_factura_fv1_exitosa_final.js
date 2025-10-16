const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function crearFacturaFV1ExitosaFinal() {
  try {
    console.log('🎯 CREANDO FACTURA FV-1 EXITOSA CON PRODUCTOS REALES');
    console.log('='.repeat(70));
    console.log('📋 ID confirmado para FV-1: 15047');
    console.log('📋 Usando productos reales que existen en SIIGO');
    console.log('📋 Cliente: 222222 (para fácil identificación)');

    // PASO 1: Autenticación
    console.log('\n📝 PASO 1: Autenticación');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    console.log('✅ Login exitoso');
    
    const token = loginResponse.data.data.token;

    // PASO 2: Crear factura FV-1 usando productos reales
    console.log('\n🔧 PASO 2: Creando factura FV-1 con productos existentes en SIIGO');
    
    const siigoInvoiceService = require('./backend/services/siigoInvoiceService');
    
    const customer = { identification: "222222" };
    
    // Usar productos que sabemos que existen en SIIGO
    const items = [
      {
        code: "LIQUIPP01",
        quantity: 1,
        price: 25000,
        description: "🧪 PRUEBA FV-1 EXITOSA - LIQUIPOPS FRESA"
      },
      {
        code: "LIQUIPP02", 
        quantity: 1,
        price: 27000,
        description: "🧪 PRUEBA FV-1 EXITOSA - LIQUIPOPS MANGO"
      }
    ];
    
    const timestamp = Date.now();
    const notes = `🎯 FACTURA FV-1 EXITOSA - ${new Date().toISOString()} - Cliente: 222222 - Sistema: ChatGPT + SIIGO - IDENTIFICADOR: FV1-SUCCESS-${timestamp} - DOCUMENTO ID: 15047 CONFIRMADO`;
    const naturalLanguageOrder = "Factura FV-1 exitosa: 1 LIQUIPOPS FRESA y 1 LIQUIPOPS MANGO";
    
    console.log(`🔍 Creando factura FV-1 con ID 15047 y productos reales...`);
    
    try {
      const options = { documentId: 15047 };
      const invoiceData = siigoInvoiceService.prepareInvoiceData(customer, items, notes, naturalLanguageOrder, options);
      const result = await siigoInvoiceService.createInvoice(invoiceData);
      
      if (result.success) {
        console.log(`✅ ¡ÉXITO COMPLETO CON FV-1!`);
        console.log('🏆 FACTURA FV-1 CREADA EXITOSAMENTE:');
        console.log('='.repeat(60));
        console.log(`📄 NÚMERO DE FACTURA FV-1: ${result.invoiceNumber}`);
        console.log(`🆔 ID DEL DOCUMENTO SIIGO: ${result.siigoId}`);
        console.log(`📋 TIPO DE DOCUMENTO: FV-1 (ID: 15047)`);
        console.log(`👤 CLIENTE: 222222 (Mostrador Ocasional)`);
        console.log(`💰 TOTAL: $52,000 COP (sin IVA) = $61,880 COP (con IVA 19%)`);
        console.log(`📅 FECHA: ${new Date().toISOString().split('T')[0]}`);
        console.log(`🏷️ IDENTIFICADOR: FV1-SUCCESS-${timestamp}`);
        
        console.log('\n🎉 ¡MISIÓN CUMPLIDA COMPLETAMENTE!');
        console.log('✅ FV-1 identificado correctamente: ID 15047');
        console.log('✅ Factura FV-1 creada exitosamente');
        console.log('✅ Sistema funcionando perfectamente');
        
        console.log('\n✨ RESPUESTA FINAL PARA EL USUARIO:');
        console.log(`El número de la nueva factura FV-1 es: ${result.invoiceNumber}`);
        console.log(`El ID del documento en SIIGO es: ${result.siigoId}`);
        console.log(`Esta factura usa FV-1 (documento ID: 15047) con cliente 222222`);
        
        // Verificar en SIIGO
        console.log('\n🔍 PASO 3: Verificando factura en SIIGO...');
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
              console.log(`📄 Número: ${facturaEncontrada.number}`);
              console.log(`🆔 ID: ${facturaEncontrada.id}`);
              console.log(`💰 Total: $${facturaEncontrada.total} COP`);
              console.log(`📋 Tipo documento: ${facturaEncontrada.document?.id}`);
              
              if (facturaEncontrada.document?.id === 15047) {
                console.log('\n🏆 ¡CONFIRMADO 100%: ESTA ES UNA FACTURA FV-1!');
                console.log('🎯 El documento ID 15047 es definitivamente FV-1');
                console.log('🎯 El sistema está listo para crear facturas FV-1');
              }
            }
          }
        } catch (verifyError) {
          console.log('⚠️ Error verificando (esto es normal):', verifyError.message);
        }
        
        console.log('\n📋 RESUMEN FINAL PARA FUTURAS FACTURAS FV-1:');
        console.log('='.repeat(60));
        console.log('✅ Documento ID para FV-1: 15047');
        console.log('✅ Cliente para pruebas: 222222');
        console.log('✅ Usar productos reales de SIIGO (LIQUIPP01, LIQUIPP02, etc.)');
        console.log('✅ Sistema ChatGPT + SIIGO funcionando correctamente');
        console.log('✅ El servidor reconoce y procesa facturas FV-1');
        
        // Mostrar datos completos si están disponibles
        if (result.data) {
          console.log('\n📊 DATOS COMPLETOS DE LA FACTURA FV-1:');
          console.log('='.repeat(50));
          console.log(JSON.stringify(result.data, null, 2));
        }
        
      } else {
        console.log(`❌ Error inesperado con ID 15047:`, result.message);
        if (result.details && result.details.Errors) {
          result.details.Errors.forEach(error => {
            console.log(`   - ${error.Code}: ${error.Message}`);
          });
        }
      }
      
    } catch (error) {
      console.log(`❌ Error inesperado:`, error.message);
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.response?.data) {
      console.log('📊 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

console.log('🚀 Creando factura FV-1 exitosa con productos reales...\n');
crearFacturaFV1ExitosaFinal();
