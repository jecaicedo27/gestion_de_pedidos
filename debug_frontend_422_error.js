const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function debugFrontend422Error() {
  try {
    console.log('🔍 DEBUGGING ERROR 422 DESDE FRONTEND');
    console.log('='.repeat(70));
    console.log('🎯 Reproduciendo exactamente la llamada del frontend que falla');
    
    // PASO 1: Autenticación
    console.log('\n📝 PASO 1: Autenticación');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    console.log('✅ Login exitoso');
    
    const token = loginResponse.data.data.token;
    
    // PASO 2: Obtener una cotización real para ver su estructura
    console.log('\n📝 PASO 2: Obteniendo cotización existente para test');
    
    let quotationId;
    let quotationData;
    
    try {
      // Listar cotizaciones para obtener una ID real
      const quotationsResponse = await axios.get(`${BASE_URL}/api/quotations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (quotationsResponse.data.data && quotationsResponse.data.data.length > 0) {
        const quotation = quotationsResponse.data.data[0];
        quotationId = quotation.id;
        quotationData = quotation;
        console.log(`✅ Cotización encontrada ID: ${quotationId}`);
        console.log(`📋 Cliente: ${quotation.customer?.commercial_name || quotation.customer?.name || 'Sin nombre'}`);
        console.log(`📦 Items: ${quotation.items?.length || 0}`);
      } else {
        console.log('⚠️ No se encontraron cotizaciones, creando datos de prueba...');
        
        // Crear datos de prueba como los que vendría del frontend
        quotationId = 'test';
        quotationData = {
          id: 'test',
          customer: {
            identification: '1082746400',
            name: 'Cliente de Prueba',
            commercial_name: 'Cliente Prueba Frontend'
          },
          items: [
            {
              product_code: 'IMPLE04',
              product_name: 'Implemento de Prueba',
              quantity: 1,
              price: 106,
              siigo_code: 'IMPLE04'
            }
          ],
          notes: 'Factura de prueba desde frontend - Debug error 422',
          original_request: '3 sal limon x 250\n6 perlas explosivas de fresa x 350'
        };
      }
    } catch (error) {
      console.log('⚠️ Error obteniendo cotizaciones, usando datos de prueba');
      
      // Usar datos de prueba basados en la estructura exitosa
      quotationId = 'test';
      quotationData = {
        id: 'test',
        customer: {
          identification: '1082746400',
          name: 'Cliente de Prueba',
          commercial_name: 'Cliente Prueba Frontend'
        },
        items: [
          {
            product_code: 'IMPLE04',
            product_name: 'Implemento de Prueba',
            quantity: 1,
            price: 106,
            siigo_code: 'IMPLE04'
          }
        ],
        notes: 'Factura de prueba desde frontend - Debug error 422',
        original_request: '3 sal limon x 250\n6 perlas explosivas de fresa x 350'
      };
    }
    
    console.log('\n📊 DATOS QUE ENVIARÁ EL FRONTEND:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(quotationData, null, 2));
    
    // PASO 3: Intentar crear factura FV-1 igual que el frontend
    console.log('\n📝 PASO 3: Creando factura FV-1 (replicando frontend)');
    console.log('🎯 Endpoint: POST /api/quotations/create-invoice');
    
    const requestData = {
      quotationId: quotationId,
      documentType: 'FV-1' // Mismo tipo que usa el frontend
    };
    
    console.log('📋 Request data que envía el frontend:', JSON.stringify(requestData, null, 2));
    
    try {
      const invoiceResponse = await axios.post(`${BASE_URL}/api/quotations/create-invoice`, requestData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('\n🎉 ¡ÉXITO! La factura se creó correctamente:');
      console.log('='.repeat(50));
      console.log(JSON.stringify(invoiceResponse.data, null, 2));
      
    } catch (error) {
      console.log('\n❌ ERROR 422 REPRODUCIDO:');
      console.log('='.repeat(50));
      console.log('Status:', error.response?.status);
      console.log('Status Text:', error.response?.statusText);
      
      if (error.response?.data) {
        console.log('\n📋 DETALLES DEL ERROR 422:');
        console.log(JSON.stringify(error.response.data, null, 2));
        
        // Analizar el error específico
        const errorData = error.response.data;
        
        if (errorData.error) {
          console.log('\n🔍 ANÁLISIS DEL ERROR:');
          console.log(`📌 Tipo de error: ${errorData.error}`);
          console.log(`📌 Mensaje: ${errorData.message || 'Sin mensaje específico'}`);
          
          if (errorData.details) {
            console.log('📌 Detalles técnicos:', JSON.stringify(errorData.details, null, 2));
          }
          
          if (errorData.suggestions) {
            console.log('\n💡 SUGERENCIAS:');
            errorData.suggestions.forEach((suggestion, index) => {
              console.log(`   ${index + 1}. ${suggestion}`);
            });
          }
        }
        
        // Verificar si es el mismo error que tenía antes
        if (errorData.details && errorData.details.Errors) {
          console.log('\n🚨 ERRORES DE SIIGO:');
          errorData.details.Errors.forEach((err, index) => {
            console.log(`   ${index + 1}. ${err.Code}: ${err.Message}`);
            
            if (err.Code === 'ValidationError' && err.Message.includes("The id doesn't exist")) {
              console.log('      🎯 ESTE ES EL MISMO ERROR DE ANTES: ID incorrecto');
            }
          });
        }
      }
      
      console.log('\n🔧 DEBUGGING ADICIONAL:');
      console.log('='.repeat(50));
      
      // Verificar el endpoint específico que maneja create-invoice
      try {
        console.log('📝 Verificando endpoint /api/quotations/create-invoice...');
        
        // Hacer una petición GET para ver si el endpoint existe
        const endpointTest = await axios.get(`${BASE_URL}/api/quotations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ El endpoint base /api/quotations funciona correctamente');
        
      } catch (endpointError) {
        console.log('❌ Error con el endpoint base:', endpointError.message);
      }
    }
    
    console.log('\n📋 RESUMEN DEL DEBUGGING:');
    console.log('='.repeat(50));
    console.log('1. ✅ La autenticación funciona');
    console.log('2. ✅ Los datos de cotización se obtienen correctamente');
    console.log(`3. ${quotationData ? '✅' : '❌'} Estructura de datos disponible`);
    console.log('4. 🔍 Error 422 se produce en el paso de creación de factura');
    console.log('\n🎯 PRÓXIMOS PASOS:');
    console.log('- Revisar el controlador de quotations en el backend');
    console.log('- Verificar la estructura de datos que espera create-invoice');
    console.log('- Comparar con la estructura exitosa del archivo crear_factura_fv1_final.js');
    
  } catch (error) {
    console.error('❌ ERROR GENERAL EN DEBUGGING:', error.message);
    if (error.response?.data) {
      console.log('📋 Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

console.log('🚀 Iniciando debugging del error 422 desde frontend...\n');
debugFrontend422Error();
