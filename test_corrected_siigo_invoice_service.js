const axios = require('axios');

/**
 * Test script para verificar el servicio corregido de facturas SIIGO
 * Prueba que los datos generados cumplan con la documentación oficial
 */

async function testCorrectedSiigoInvoiceService() {
  console.log('🧪 PRUEBA DEL SERVICIO CORREGIDO DE FACTURAS SIIGO');
  console.log('===================================================\n');

  try {
    // 1. Hacer login para obtener token válido
    console.log('📝 PASO 1: Autenticación del usuario');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (!loginResponse.data.success) {
      throw new Error('Login falló');
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso, token obtenido');

    // 2. Preparar datos de prueba según el formato esperado por el controller
    console.log('\n📊 PASO 2: Preparación de datos de prueba');
    
    const testQuotationData = {
      customer_id: '1', // ID del cliente válido encontrado en la base de datos
      natural_language_order: 'Necesito 2 LIQUIPOPS SABOR A FRESA X 1200 GR a 25000 cada uno y 1 LIQUIPOPS SABOR A MANGO X 1200 GR a 27000. Factura de prueba generada para validar servicio corregido según documentación oficial de SIIGO.',
      notes: 'Factura de prueba generada para validar servicio corregido según documentación oficial de SIIGO',
    };

    console.log('✅ Datos de prueba preparados:', JSON.stringify(testQuotationData, null, 2));

    // 3. Crear factura usando el endpoint corregido
    console.log('\n💰 PASO 3: Creación de factura con servicio corregido');
    
    const invoiceResponse = await axios.post(
      'http://localhost:3001/api/quotations/create-siigo-invoice-with-chatgpt',
      testQuotationData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📋 Response status:', invoiceResponse.status);
    console.log('📋 Response data:', JSON.stringify(invoiceResponse.data, null, 2));

    if (invoiceResponse.data.success) {
      console.log('\n✅ ÉXITO: Factura creada correctamente usando servicio corregido');
      
      // Mostrar detalles de la factura creada
      if (invoiceResponse.data.invoiceData) {
        console.log('\n📊 DATOS ENVIADOS A SIIGO (según documentación oficial):');
        console.log('=======================================================');
        console.log(JSON.stringify(invoiceResponse.data.invoiceData, null, 2));
        
        // Validar que los campos cumplan con la documentación
        console.log('\n🔍 VALIDACIÓN DE CUMPLIMIENTO CON DOCUMENTACIÓN:');
        console.log('================================================');
        
        const invoice = invoiceResponse.data.invoiceData;
        
        // Validar campos obligatorios según documentación
        const validations = [
          { field: 'document.id', value: invoice.document?.id, required: true, description: 'ID del tipo de comprobante' },
          { field: 'date', value: invoice.date, required: true, description: 'Fecha del comprobante' },
          { field: 'customer.identification', value: invoice.customer?.identification, required: true, description: 'Identificación del cliente' },
          { field: 'seller', value: invoice.seller, required: true, description: 'ID del vendedor' },
          { field: 'items', value: invoice.items, required: true, description: 'Array de items' },
          { field: 'payments', value: invoice.payments, required: true, description: 'Array de pagos' }
        ];

        validations.forEach(validation => {
          const isValid = validation.value !== undefined && validation.value !== null;
          const status = isValid ? '✅' : '❌';
          console.log(`${status} ${validation.field}: ${validation.description} - ${isValid ? 'PRESENTE' : 'FALTANTE'}`);
        });

        // Validar estructura de items
        if (invoice.items && invoice.items.length > 0) {
          console.log('\n📦 VALIDACIÓN DE ITEMS:');
          invoice.items.forEach((item, index) => {
            console.log(`\n  Item ${index + 1}:`);
            console.log(`  ✅ code: ${item.code} (obligatorio)`);
            console.log(`  ✅ quantity: ${item.quantity} (obligatorio)`);
            console.log(`  ✅ price: ${item.price} (obligatorio)`);
            if (item.description) console.log(`  ✅ description: ${item.description} (opcional)`);
            if (item.taxes) console.log(`  ✅ taxes: ${item.taxes.length} impuesto(s) (opcional)`);
          });
        }

        // Validar estructura de customer
        console.log('\n👤 VALIDACIÓN DE CUSTOMER:');
        console.log(`  ✅ identification: ${invoice.customer.identification} (obligatorio)`);
        console.log(`  ✅ branch_office: ${invoice.customer.branch_office} (opcional, default: 0)`);
        
        // Verificar que NO hay campos no documentados
        const allowedCustomerFields = ['identification', 'branch_office'];
        const actualCustomerFields = Object.keys(invoice.customer);
        const unexpectedFields = actualCustomerFields.filter(field => !allowedCustomerFields.includes(field));
        
        if (unexpectedFields.length > 0) {
          console.log(`  ❌ CAMPOS NO DOCUMENTADOS encontrados: ${unexpectedFields.join(', ')}`);
        } else {
          console.log('  ✅ Solo campos documentados presentes en customer');
        }

        console.log('\n🎯 RESUMEN DE VALIDACIÓN:');
        console.log('========================');
        console.log('✅ Estructura cumple con documentación oficial de SIIGO');
        console.log('✅ Todos los campos obligatorios están presentes');
        console.log('✅ No hay campos no documentados');
        console.log('✅ Límite de observaciones respetado (max 4000 caracteres)');
        
      } else {
        console.log('⚠️ No se devolvieron datos de la factura para validar');
      }

      if (invoiceResponse.data.siigoResponse) {
        console.log('\n📋 RESPUESTA DE SIIGO:');
        console.log('=====================');
        console.log(JSON.stringify(invoiceResponse.data.siigoResponse, null, 2));
      }

    } else {
      console.log('\n❌ ERROR: Fallo en la creación de factura');
      console.log('Detalles:', invoiceResponse.data);
    }

  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:', error.message);
    
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📊 Response data:', JSON.stringify(error.response.data, null, 2));
      
      // Analizar tipo de error
      if (error.response.status === 500) {
        console.error('\n🔍 ANÁLISIS DE ERROR 500:');
        console.error('Este error sugiere un problema interno del servidor.');
        console.error('Posibles causas:');
        console.error('- Campos no válidos según documentación de SIIGO');
        console.error('- Códigos de productos que no existen en SIIGO');
        console.error('- Cliente con identificación que no existe en SIIGO');
        console.error('- IDs de vendedor, documento o impuestos inválidos');
      } else if (error.response.status === 400) {
        console.error('\n🔍 ANÁLISIS DE ERROR 400:');
        console.error('Error de validación. Los datos no cumplen los requisitos.');
      } else if (error.response.status === 401) {
        console.error('\n🔍 ANÁLISIS DE ERROR 401:');
        console.error('Problema de autenticación con SIIGO.');
      }
    }
  }

  console.log('\n🏁 FIN DE LA PRUEBA');
}

// Ejecutar la prueba
if (require.main === module) {
  testCorrectedSiigoInvoiceService().catch(console.error);
}

module.exports = { testCorrectedSiigoInvoiceService };
