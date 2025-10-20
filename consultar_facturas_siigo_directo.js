const siigoInvoiceService = require('./backend/services/siigoInvoiceService');

async function consultarFacturasSiigoDirecto() {
  try {
    console.log('🔍 CONSULTA DIRECTA DE FACTURAS EN SIIGO');
    console.log('='.repeat(60));

    // PASO 1: Intentar listar facturas directamente del servicio
    console.log('\n📋 PASO 1: Listando facturas recientes de SIIGO (servicio directo)');
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`🗓️ Buscando facturas creadas entre ${yesterdayStr} y ${todayStr}`);
    
    try {
      const filtros = {
        created_start: yesterdayStr,
        created_end: todayStr
      };
      
      const facturas = await siigoInvoiceService.listInvoices(filtros);
      
      if (facturas && facturas.results && facturas.results.length > 0) {
        console.log('✅ Facturas encontradas en SIIGO');
        console.log(`📊 Total de facturas: ${facturas.results.length}`);
        
        facturas.results.forEach((factura, index) => {
          console.log(`\n${index + 1}. 📄 FACTURA:`);
          console.log(`   🏷️ Número: ${factura.number || 'N/A'}`);
          console.log(`   🆔 ID SIIGO: ${factura.id || 'N/A'}`);
          console.log(`   📅 Fecha: ${factura.date || 'N/A'}`);
          console.log(`   👤 Cliente: ${factura.customer?.identification || 'N/A'} - ${factura.customer?.name || 'N/A'}`);
          console.log(`   💰 Total: $${factura.total || 0} COP`);
          console.log(`   📋 Estado: ${factura.status || 'N/A'}`);
          console.log(`   📝 Tipo: ${factura.document?.id || 'N/A'} (${factura.document?.name || 'N/A'})`);
          
          if (factura.observations) {
            const obs = factura.observations.substring(0, 100);
            console.log(`   📄 Obs: ${obs}${factura.observations.length > 100 ? '...' : ''}`);
          }
        });

        // Obtener detalles de la primera factura (más reciente)
        const ultimaFactura = facturas.results[0];
        
        console.log('\n🎯 RESPUESTA A TU PREGUNTA:');
        console.log('='.repeat(50));
        console.log(`📄 NÚMERO DE FACTURA: ${ultimaFactura.number}`);
        console.log(`🆔 ID DEL DOCUMENTO: ${ultimaFactura.id}`);
        console.log(`📋 TIPO DE DOCUMENTO: ${ultimaFactura.document?.id} - ${ultimaFactura.document?.name}`);
        console.log(`📅 FECHA: ${ultimaFactura.date}`);
        console.log(`💰 TOTAL: $${ultimaFactura.total} COP`);
        console.log(`👤 CLIENTE: ${ultimaFactura.customer?.identification} - ${ultimaFactura.customer?.name}`);

        // Intentar obtener más detalles
        console.log('\n🔍 PASO 2: Obteniendo detalles completos de la factura');
        
        try {
          const detallesFactura = await siigoInvoiceService.getInvoice(ultimaFactura.id);
          
          console.log('✅ Detalles completos obtenidos');
          console.log('\n📊 INFORMACIÓN COMPLETA DE LA FACTURA:');
          console.log('='.repeat(50));
          console.log(JSON.stringify(detallesFactura, null, 2));
          
        } catch (detallesError) {
          console.log('⚠️ Error al obtener detalles completos:', detallesError.message);
        }

      } else {
        console.log('❌ No se encontraron facturas en el período especificado');
        
        // Intentar búsqueda más amplia
        console.log('\n🔍 Intentando búsqueda más amplia (últimos 7 días)...');
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        
        try {
          const filtrosAmplio = {
            created_start: weekAgoStr,
            created_end: todayStr
          };
          
          const facturasAmplio = await siigoInvoiceService.listInvoices(filtrosAmplio);
          
          if (facturasAmplio && facturasAmplio.results && facturasAmplio.results.length > 0) {
            console.log(`✅ ${facturasAmplio.results.length} facturas encontradas en los últimos 7 días:`);
            
            facturasAmplio.results.forEach((factura, index) => {
              console.log(`${index + 1}. ${factura.number} - ${factura.date} - $${factura.total} - Cliente: ${factura.customer?.identification}`);
            });
            
            // Mostrar la más reciente
            const masReciente = facturasAmplio.results[0];
            console.log('\n🎯 FACTURA MÁS RECIENTE ENCONTRADA:');
            console.log(`📄 Número: ${masReciente.number}`);
            console.log(`🆔 ID: ${masReciente.id}`);
            console.log(`📅 Fecha: ${masReciente.date}`);
            console.log(`💰 Total: $${masReciente.total} COP`);
            
          } else {
            console.log('❌ Tampoco se encontraron facturas en los últimos 7 días');
          }
          
        } catch (amplioError) {
          console.log('❌ Error en búsqueda amplia:', amplioError.message);
        }
      }
      
    } catch (listError) {
      console.log('❌ Error listando facturas:', listError.message);
      
      // PASO 3: Intentar sin filtros
      console.log('\n🔍 PASO 3: Intentando listar facturas sin filtros...');
      
      try {
        const facturasSinFiltros = await siigoInvoiceService.listInvoices({});
        
        if (facturasSinFiltros && facturasSinFiltros.results && facturasSinFiltros.results.length > 0) {
          console.log(`✅ ${facturasSinFiltros.results.length} facturas obtenidas sin filtros:`);
          
          // Mostrar las primeras 10
          const facturasMostrar = facturasSinFiltros.results.slice(0, 10);
          facturasMostrar.forEach((factura, index) => {
            console.log(`${index + 1}. ${factura.number || factura.id} - ${factura.date} - $${factura.total || 0} - ${factura.customer?.identification || 'N/A'}`);
          });
          
          // Buscar factura que coincida con nuestro test
          const facturaTestEncontrada = facturasSinFiltros.results.find(f => 
            f.customer?.identification === "222222" ||
            f.total === 91630 ||
            f.total === 25000 ||
            f.total === 27000 ||
            (f.observations && f.observations.includes('ChatGPT'))
          );
          
          if (facturaTestEncontrada) {
            console.log('\n🎯 ¡FACTURA DE PRUEBA ENCONTRADA!');
            console.log('='.repeat(50));
            console.log(`📄 NÚMERO DE FACTURA: ${facturaTestEncontrada.number}`);
            console.log(`🆔 ID DEL DOCUMENTO: ${facturaTestEncontrada.id}`);
            console.log(`📅 FECHA: ${facturaTestEncontrada.date}`);
            console.log(`💰 TOTAL: $${facturaTestEncontrada.total} COP`);
            console.log(`👤 CLIENTE: ${facturaTestEncontrada.customer?.identification} - ${facturaTestEncontrada.customer?.name}`);
            
            if (facturaTestEncontrada.observations) {
              console.log(`📄 OBSERVACIONES: ${facturaTestEncontrada.observations}`);
            }
            
            // Esta es la respuesta a tu pregunta
            console.log('\n✨ RESPUESTA A TU PREGUNTA:');
            console.log(`El número de la factura creada es: ${facturaTestEncontrada.number}`);
            console.log(`El ID del documento en SIIGO es: ${facturaTestEncontrada.id}`);
            console.log(`Tipo de documento: ${facturaTestEncontrada.document?.id} - ${facturaTestEncontrada.document?.name}`);
          } else {
            console.log('\n⚠️ No se encontró la factura de prueba entre las facturas existentes');
            
            // Mostrar la primera factura como referencia
            const primeraFactura = facturasSinFiltros.results[0];
            console.log('\n📋 PRIMERA FACTURA COMO REFERENCIA:');
            console.log(`📄 Número: ${primeraFactura.number}`);
            console.log(`🆔 ID: ${primeraFactura.id}`);
            console.log(`📅 Fecha: ${primeraFactura.date}`);
            console.log(`💰 Total: $${primeraFactura.total} COP`);
          }
          
        } else {
          console.log('❌ No se encontraron facturas sin filtros');
        }
        
      } catch (sinFiltrosError) {
        console.log('❌ Error también sin filtros:', sinFiltrosError.message);
        console.log('🔍 Detalles del error:', sinFiltrosError);
      }
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    console.log('🔍 Stack trace:', error.stack);
    
    // PASO FINAL: Explicación del problema
    console.log('\n📝 EXPLICACIÓN DEL PROBLEMA:');
    console.log('='.repeat(50));
    console.log('Es posible que:');
    console.log('1. La factura se creó exitosamente pero la respuesta no se capturó correctamente');
    console.log('2. La factura está en SIIGO pero nuestro filtro de fechas no la encuentra');
    console.log('3. Hay un problema de autenticación con SIIGO');
    console.log('4. El endpoint que consultamos anteriormente no tenía la ruta correcta');
    console.log('\nPor favor verifica directamente en tu cuenta de SIIGO en https://app.siigo.com');
    console.log('Busca facturas creadas hoy con el cliente "222222" (Mostrador Ocasional)');
  }
}

console.log('🚀 Consultando facturas de SIIGO directamente...\n');
consultarFacturasSiigoDirecto();
