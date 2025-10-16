const chatgptService = require('./backend/services/chatgptService');

async function testChatGPTDatabaseFix() {
  console.log('🧪 Probando funcionalidad ChatGPT después del fix de base de datos...');
  
  try {
    // 1. Probar obtener catálogo de productos
    console.log('\n📚 1. Probando obtener catálogo de productos...');
    const catalog = await chatgptService.getProductCatalog(10);
    console.log(`✅ Catálogo obtenido: ${catalog.length} productos`);
    if (catalog.length > 0) {
      console.log('📦 Primer producto:', catalog[0]);
    }

    // 2. Probar procesamiento de pedido simple
    console.log('\n🤖 2. Probando procesamiento de pedido con ChatGPT...');
    const testOrder = "20 sal limón de 250gr y 2 perlas de 350gr";
    
    const result = await chatgptService.processNaturalLanguageOrder(
      'test-quotation-' + Date.now(),
      testOrder,
      catalog.slice(0, 5) // Usar solo los primeros 5 productos
    );

    if (result.success) {
      console.log('✅ Procesamiento exitoso!');
      console.log('📊 Resultado:', JSON.stringify(result.processedOrder, null, 2));
      console.log(`⚡ Tokens usados: ${result.tokensUsed}`);
      console.log(`⏱️ Tiempo: ${result.processingTimeMs}ms`);
    } else {
      console.log('❌ Error en procesamiento:', result.error);
    }

    // 3. Probar mejora del pedido procesado
    if (result.success && result.processedOrder) {
      console.log('\n🔧 3. Probando mejora del pedido procesado...');
      const enhancedOrder = await chatgptService.enhanceProcessedOrder(result.processedOrder);
      console.log('✅ Pedido mejorado:', JSON.stringify(enhancedOrder, null, 2));
    }

    // 4. Probar estadísticas de uso
    console.log('\n📈 4. Probando estadísticas de uso...');
    const stats = await chatgptService.getUsageStats(7);
    if (stats) {
      console.log('✅ Estadísticas obtenidas:', stats);
    } else {
      console.log('ℹ️ No hay estadísticas disponibles');
    }

    console.log('\n✅ Todas las pruebas completadas exitosamente');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

// Ejecutar las pruebas
testChatGPTDatabaseFix();
