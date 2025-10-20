const siigoService = require('./backend/services/siigoService');
const axios = require('axios');

async function listarFacturasBuscarFV130() {
  try {
    console.log('🔍 LISTANDO TODAS LAS FACTURAS PARA ENCONTRAR FV-1-30');
    console.log('='.repeat(70));

    // PASO 1: Autenticar con SIIGO
    console.log('\n📝 PASO 1: Autenticación con SIIGO');
    const token = await siigoService.authenticate();
    console.log('✅ Autenticación exitosa');

    // PASO 2: Buscar facturas recientes
    console.log('\n🔍 PASO 2: Listando facturas recientes');
    
    try {
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
      
      if (response.data && response.data.results && response.data.results.length > 0) {
        console.log('\n📋 TODAS LAS FACTURAS ENCONTRADAS:');
        console.log('='.repeat(80));
        
        let fv130Found = null;
        
        response.data.results.forEach((factura, index) => {
          const numero = factura.number || 'N/A';
          const documentId = factura.document?.id || 'N/A';
          const documentName = factura.document?.name || 'N/A';
          const cliente = factura.customer?.identification || 'N/A';
          const total = factura.total || 'N/A';
          const fecha = factura.date || 'N/A';
          
          console.log(`${index + 1}. ${numero} | Doc ID: ${documentId} | ${documentName}`);
          console.log(`   Cliente: ${cliente} | Total: $${total} | Fecha: ${fecha}`);
          console.log('');
          
          // Buscar FV-1-30 de manera más flexible
          if (numero.toString().includes('FV-1-30') || numero.toString().includes('FV1-30')) {
            fv130Found = factura;
            console.log(`🎯 ¡ENCONTRADA FV-1-30 EN POSICIÓN ${index + 1}!`);
          }
        });
        
        // Si encontramos FV-1-30, mostrar detalles
        if (fv130Found) {
          console.log('\n🏆 ¡FACTURA FV-1-30 IDENTIFICADA!');
          console.log('='.repeat(60));
          console.log(`📄 Número: ${fv130Found.number}`);
          console.log(`🆔 ID en SIIGO: ${fv130Found.id}`);
          console.log(`📋 DOCUMENT ID: ${fv130Found.document?.id} ⭐⭐⭐`);
          console.log(`📋 Document Name: ${fv130Found.document?.name || 'N/A'}`);
          console.log(`👤 Cliente: ${fv130Found.customer?.identification || 'N/A'}`);
          console.log(`💰 Total: $${fv130Found.total || 'N/A'} COP`);
          console.log(`📅 Fecha: ${fv130Found.date || 'N/A'}`);
          
          // CONFIRMACIÓN CRÍTICA
          console.log('\n🎉 RESULTADO FINAL:');
          console.log(`🔍 El document.id de la factura FV-1-30 es: ${fv130Found.document?.id}`);
          
          if (fv130Found.document?.id === 15047) {
            console.log('✅ ¡PERFECTO! Coincide con nuestro hallazgo (ID: 15047)');
            console.log('✅ FV-1 = Document ID 15047 CONFIRMADO');
          } else {
            console.log(`🔄 ACTUALIZACIÓN: El ID real de FV-1 es ${fv130Found.document?.id}`);
            console.log(`🔄 Debemos actualizar de 15047 a ${fv130Found.document?.id}`);
          }
          
          // Mostrar toda la factura
          console.log('\n📊 DATOS COMPLETOS DE FV-1-30:');
          console.log('='.repeat(50));
          console.log(JSON.stringify(fv130Found, null, 2));
          
        } else {
          console.log('\n❌ No se encontró FV-1-30 en las facturas listadas');
          console.log('💡 Posibles razones:');
          console.log('   - La factura fue creada hace más de 30 días');
          console.log('   - El número de factura es diferente a "FV-1-30"');
          console.log('   - La factura está en una página posterior');
          
          // Buscar cualquier factura que parezca no electrónica
          console.log('\n🔍 BUSCANDO FACTURAS NO ELECTRÓNICAS:');
          const facturasNoElectronicas = response.data.results.filter(f => 
            f.document?.name && 
            !f.document.name.toLowerCase().includes('electr') &&
            f.document.name.toLowerCase().includes('factura')
          );
          
          if (facturasNoElectronicas.length > 0) {
            console.log(`📄 Encontradas ${facturasNoElectronicas.length} facturas no electrónicas:`);
            facturasNoElectronicas.forEach((f, i) => {
              console.log(`   ${i+1}. ${f.number} | Doc ID: ${f.document.id} | ${f.document.name}`);
            });
            
            // Usar la primera como ejemplo
            const ejemplo = facturasNoElectronicas[0];
            console.log(`\n💡 EJEMPLO - Factura no electrónica ${ejemplo.number}:`);
            console.log(`   Document ID: ${ejemplo.document.id}`);
            console.log(`   Document Name: ${ejemplo.document.name}`);
          }
        }
        
      } else {
        console.log('❌ No se encontraron facturas en el período consultado');
      }

    } catch (searchError) {
      console.log('❌ Error consultando facturas:', searchError.response?.status || searchError.message);
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

console.log('🚀 Buscando factura FV-1-30 en todas las facturas...\n');
listarFacturasBuscarFV130();
