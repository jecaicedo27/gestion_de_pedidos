const siigoService = require('./backend/services/siigoService');
const axios = require('axios');

async function verificarFacturaFV131Real() {
  try {
    console.log('🎯 VERIFICANDO FACTURA FV-1-31 CREADA POR EL USUARIO');
    console.log('='.repeat(70));
    console.log('📋 Buscando factura específica: FV-1-31');
    console.log('🎯 Objetivo: Obtener el document.id REAL de FV-1');

    // PASO 1: Autenticar con SIIGO
    console.log('\n📝 PASO 1: Autenticación con SIIGO');
    const token = await siigoService.authenticate();
    console.log('✅ Autenticación exitosa');

    // PASO 2: Buscar la factura FV-1-31 recién creada
    console.log('\n🔍 PASO 2: Buscando factura FV-1-31');
    
    try {
      // Buscar en las facturas más recientes
      const today = new Date();
      const response = await axios.get(
        `${siigoService.getBaseUrl()}/v1/invoices`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'siigo'
          },
          params: {
            created_start: today.toISOString().split('T')[0],
            created_end: today.toISOString().split('T')[0],
            page_size: 50  // Primeras 50 facturas del día
          }
        }
      );

      console.log(`✅ Consulta exitosa - ${response.data?.results?.length || 0} facturas encontradas hoy`);
      
      if (response.data && response.data.results && response.data.results.length > 0) {
        console.log('\n📋 BUSCANDO FV-1-31 EN LAS FACTURAS DE HOY:');
        
        let fv131Found = null;
        
        // Buscar específicamente FV-1-31
        response.data.results.forEach((factura, index) => {
          const numero = factura.number || 'N/A';
          const documentId = factura.document?.id || 'N/A';
          const documentName = factura.document?.name || 'N/A';
          
          console.log(`${index + 1}. ${numero} | Doc ID: ${documentId} | ${documentName}`);
          
          // Buscar FV-1-31 específicamente
          if (numero === 'FV-1-31' || numero.includes('FV-1-31')) {
            fv131Found = factura;
            console.log(`🎯 ¡ENCONTRADA FV-1-31 EN POSICIÓN ${index + 1}!`);
          }
        });
        
        if (fv131Found) {
          console.log('\n🏆 ¡FACTURA FV-1-31 ENCONTRADA!');
          console.log('='.repeat(60));
          console.log(`📄 Número: ${fv131Found.number}`);
          console.log(`🆔 ID en SIIGO: ${fv131Found.id}`);
          console.log(`📋 DOCUMENT ID: ${fv131Found.document?.id} ⭐⭐⭐`);
          console.log(`📋 Document Name: ${fv131Found.document?.name || 'N/A'}`);
          console.log(`👤 Cliente: ${fv131Found.customer?.identification || 'N/A'} - ${fv131Found.customer?.name || 'N/A'}`);
          console.log(`💰 Total: $${fv131Found.total || 'N/A'} COP`);
          console.log(`📅 Fecha: ${fv131Found.date || 'N/A'}`);
          console.log(`📊 Estado: ${fv131Found.status || 'N/A'}`);
          
          console.log('\n🎉 RESULTADO DEFINITIVO:');
          console.log(`🔍 El document.id REAL de FV-1 es: ${fv131Found.document?.id}`);
          
          // Comparar con nuestro hallazgo anterior
          if (fv131Found.document?.id === 15047) {
            console.log('✅ ¡PERFECTA CONFIRMACIÓN!');
            console.log('✅ Nuestro hallazgo fue correcto: FV-1 = Document ID 15047');
            console.log('✅ El sistema está listo para crear facturas FV-1');
          } else {
            console.log('🔄 ACTUALIZACIÓN NECESARIA:');
            console.log(`🔄 ID real de FV-1: ${fv131Found.document?.id}`);
            console.log(`🔄 ID que habíamos encontrado: 15047`);
            console.log('🔄 Debemos actualizar el sistema con el ID correcto');
          }
          
          console.log('\n📊 INFORMACIÓN COMPLETA DE LA FACTURA FV-1-31:');
          console.log('='.repeat(70));
          console.log(JSON.stringify(fv131Found, null, 2));
          
          // PASO 3: Generar resumen final
          console.log('\n📋 RESUMEN FINAL PARA EL SISTEMA:');
          console.log('='.repeat(60));
          console.log(`✅ Factura FV-1 confirmada: ${fv131Found.number}`);
          console.log(`✅ Document ID definitivo para FV-1: ${fv131Found.document?.id}`);
          console.log(`✅ Document Name: ${fv131Found.document?.name}`);
          console.log(`✅ Cliente de prueba: ${fv131Found.customer?.identification}`);
          console.log(`✅ Sistema ChatGPT + SIIGO listo para FV-1`);
          
          return fv131Found;
          
        } else {
          console.log('\n❌ No se encontró FV-1-31 en las facturas de hoy');
          console.log('💡 Posibles razones:');
          console.log('   - La factura aún no se ha sincronizado');
          console.log('   - El número es ligeramente diferente');
          console.log('   - Se necesita un poco más de tiempo');
          
          // Mostrar las últimas facturas para debug
          console.log('\n📋 ÚLTIMAS 10 FACTURAS CREADAS HOY:');
          response.data.results.slice(0, 10).forEach((f, i) => {
            console.log(`   ${i+1}. ${f.number} | ID: ${f.document?.id} | ${f.document?.name || 'N/A'}`);
          });
        }
        
      } else {
        console.log('❌ No se encontraron facturas creadas hoy');
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

console.log('🚀 Verificando factura FV-1-31 creada por el usuario...\n');
verificarFacturaFV131Real();
