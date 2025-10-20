const siigoService = require('./backend/services/siigoService');
const axios = require('axios');

async function verificarFacturaFV130() {
  try {
    console.log('🔍 VERIFICANDO FACTURA FV-1-30 EN SIIGO');
    console.log('='.repeat(60));
    console.log('📋 Buscando factura específica: FV-1-30');
    console.log('🎯 Objetivo: Confirmar document.id para FV-1');

    // PASO 1: Autenticar con SIIGO
    console.log('\n📝 PASO 1: Autenticación con SIIGO');
    const token = await siigoService.authenticate();
    console.log('✅ Autenticación exitosa');

    // PASO 2: Buscar la factura FV-1-30
    console.log('\n🔍 PASO 2: Buscando factura FV-1-30');
    
    try {
      // Buscar por número específico
      console.log('📋 Consultando facturas con número FV-1-30...');
      
      const today = new Date();
      const startDate = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)); // Últimos 30 días
      
      const response = await axios.get(
        `${siigoService.getBaseUrl()}/v1/invoices`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'siigo'
          },
          params: {
            created_start: startDate.toISOString().split('T')[0],
            created_end: today.toISOString().split('T')[0],
            page_size: 100
          }
        }
      );

      console.log(`✅ Consulta exitosa - ${response.data?.results?.length || 0} facturas encontradas`);
      
      if (response.data && response.data.results) {
        // Buscar específicamente FV-1-30
        const fv130 = response.data.results.find(factura => 
          factura.number && (
            factura.number === 'FV-1-30' || 
            factura.number === 'FV1-30' ||
            factura.number.includes('FV-1-30') ||
            factura.number.includes('FV1-30')
          )
        );
        
        if (fv130) {
          console.log('\n🎯 ¡FACTURA FV-1-30 ENCONTRADA!');
          console.log('='.repeat(50));
          console.log(`📄 Número: ${fv130.number}`);
          console.log(`🆔 ID en SIIGO: ${fv130.id}`);
          console.log(`📋 DOCUMENT ID: ${fv130.document?.id} ⭐`);
          console.log(`📋 Document Name: ${fv130.document?.name || 'N/A'}`);
          console.log(`👤 Cliente: ${fv130.customer?.identification || 'N/A'} - ${fv130.customer?.name || 'N/A'}`);
          console.log(`💰 Total: $${fv130.total || 'N/A'} COP`);
          console.log(`📅 Fecha: ${fv130.date || 'N/A'}`);
          console.log(`📊 Estado: ${fv130.status || 'N/A'}`);
          
          // CONFIRMACIÓN CRÍTICA
          if (fv130.document?.id === 15047) {
            console.log('\n🏆 ¡CONFIRMACIÓN PERFECTA!');
            console.log('✅ La factura FV-1-30 usa document.id = 15047');
            console.log('✅ Esto confirma que 15047 es el ID correcto para FV-1');
          } else {
            console.log('\n📋 DOCUMENT ID ENCONTRADO:');
            console.log(`🔍 El document.id de FV-1-30 es: ${fv130.document?.id}`);
            console.log('📝 Este es el ID real que debemos usar para FV-1');
          }
          
          // Mostrar toda la información de la factura
          console.log('\n📊 DATOS COMPLETOS DE LA FACTURA FV-1-30:');
          console.log('='.repeat(60));
          console.log(JSON.stringify(fv130, null, 2));
          
          // PASO 3: Consultar información detallada del documento
          if (fv130.document?.id) {
            console.log('\n🔍 PASO 3: Analizando tipo de documento');
            console.log(`📋 Document ID: ${fv130.document.id}`);
            console.log(`📄 Document Name: ${fv130.document.name || 'N/A'}`);
            
            // Verificar si coincide con nuestro hallazgo
            if (fv130.document.id === 15047) {
              console.log('\n🎉 ¡ÉXITO TOTAL!');
              console.log('✅ Nuestra investigación fue correcta');
              console.log('✅ FV-1 = Document ID 15047');
              console.log('✅ Sistema listo para crear facturas FV-1');
            } else {
              console.log('\n📝 ACTUALIZACIÓN NECESARIA:');
              console.log(`🔄 El ID real de FV-1 es: ${fv130.document.id}`);
              console.log('🔄 Actualizaremos el sistema con el ID correcto');
            }
          }
          
        } else {
          console.log('\n❌ No se encontró la factura FV-1-30 en los resultados');
          console.log('📋 Facturas encontradas:');
          response.data.results.slice(0, 10).forEach((factura, index) => {
            console.log(`   ${index + 1}. ${factura.number} - ${factura.document?.name || 'N/A'} (ID: ${factura.document?.id || 'N/A'})`);
          });
          
          // Intentar buscar cualquier FV-1
          const anyFV1 = response.data.results.find(f => 
            (f.number && f.number.includes('FV-1')) || 
            (f.document?.name?.toLowerCase().includes('factura') && 
            !f.document?.name?.toLowerCase().includes('electr'))
          );
          
          if (anyFV1) {
            console.log('\n🔍 ENCONTRADA OTRA FACTURA FV-1:');
            console.log(`📄 Número: ${anyFV1.number}`);
            console.log(`📋 Document ID: ${anyFV1.document?.id}`);
            console.log('💡 Podemos usar esta para verificar el document.id');
          }
        }
        
      } else {
        console.log('❌ No se obtuvieron resultados de la consulta');
      }

    } catch (searchError) {
      console.log('❌ Error buscando facturas:', searchError.response?.status || searchError.message);
      if (searchError.response?.data) {
        console.log('📊 Error details:', JSON.stringify(searchError.response.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.stack) {
      console.log('📊 Stack:', error.stack);
    }
  }
}

console.log('🚀 Verificando factura FV-1-30 creada por el usuario...\n');
verificarFacturaFV130();
