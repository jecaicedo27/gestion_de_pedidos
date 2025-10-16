const mysql = require('mysql2/promise');
const chatgptService = require('./backend/services/chatgptService');

async function testCustomGPTIntegration() {
  console.log('🧪 PROBANDO INTEGRACIÓN CON GPT PERSONALIZADO');
  console.log('=' .repeat(50));
  
  try {
    // 1. Verificar configuración actual
    console.log('\n📋 1. VERIFICANDO CONFIGURACIÓN ACTUAL:');
    console.log(`   ✓ OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   ✓ Usar Assistant Personalizado: ${process.env.USE_CUSTOM_ASSISTANT === 'true' ? '✅ HABILITADO' : '❌ DESHABILITADO'}`);
    console.log(`   ✓ Assistant ID: ${process.env.CUSTOM_GPT_ASSISTANT_ID || '❌ No configurado'}`);

    // 2. Obtener información del Assistant (si está configurado)
    if (process.env.USE_CUSTOM_ASSISTANT === 'true' && process.env.CUSTOM_GPT_ASSISTANT_ID) {
      console.log('\n🎯 2. OBTENIENDO INFORMACIÓN DEL ASSISTANT PERSONALIZADO:');
      const assistantInfo = await chatgptService.getAssistantInfo();
      if (assistantInfo) {
        console.log(`   ✓ Nombre: ${assistantInfo.name || 'Sin nombre'}`);
        console.log(`   ✓ Modelo: ${assistantInfo.model || 'No especificado'}`);
        console.log(`   ✓ Instrucciones: ${assistantInfo.instructions ? assistantInfo.instructions.substring(0, 100) + '...' : 'No especificadas'}`);
        console.log(`   ✓ Herramientas: ${assistantInfo.tools ? assistantInfo.tools.length : 0} herramientas`);
        console.log(`   ✓ Creado: ${assistantInfo.created_at ? new Date(assistantInfo.created_at * 1000).toLocaleString() : 'Desconocido'}`);
      } else {
        console.log('   ❌ No se pudo obtener información del Assistant');
      }
    }

    // 3. Probar procesamiento con el método actual (sin cambiar configuración)
    console.log('\n🤖 3. PROBANDO PROCESAMIENTO DE PEDIDO DE PRUEBA:');
    const testOrder = `
Hola, necesito hacer un pedido para mi restaurante:
- 10 cajas de Liquipops sabor maracuyá
- 5 Skarcha limón de 250g 
- 2 PITILLOS especiales para cóctel

Por favor prepárenlo para entrega el viernes.
¡Gracias!
    `.trim();

    console.log(`   📝 Pedido de prueba:\n   "${testOrder.substring(0, 100)}..."`);
    
    const startTime = Date.now();
    const result = await chatgptService.processNaturalLanguageOrder(
      'test-quotation-001',
      testOrder,
      [] // Sin catálogo para esta prueba
    );
    const processingTime = Date.now() - startTime;

    console.log(`\n   📊 RESULTADO DEL PROCESAMIENTO:`);
    console.log(`   ✓ Éxito: ${result.success ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   ✓ Tiempo: ${processingTime}ms`);
    console.log(`   ✓ Tokens usados: ${result.tokensUsed || 0}`);
    
    if (result.success) {
      console.log(`   ✓ Items encontrados: ${result.processedOrder.items?.length || 0}`);
      console.log(`   ✓ Confianza: ${(result.processedOrder.confidence * 100).toFixed(1)}%`);
      
      if (result.assistantId) {
        console.log(`   🎯 Procesado con Assistant personalizado: ${result.assistantId}`);
      } else {
        console.log(`   🤖 Procesado con ChatGPT estándar`);
      }
      
      // Mostrar items encontrados
      if (result.processedOrder.items) {
        console.log('\n   📦 ITEMS PROCESADOS:');
        result.processedOrder.items.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.product_name} - ${item.quantity} ${item.unit} (${(item.confidence * 100).toFixed(1)}%)`);
          if (item.notes) console.log(`        📌 ${item.notes}`);
        });
      }
      
      // Mostrar notas y instrucciones
      if (result.processedOrder.customer_notes) {
        console.log(`\n   📋 Notas del cliente: ${result.processedOrder.customer_notes}`);
      }
      
      if (result.processedOrder.special_instructions) {
        console.log(`   🚚 Instrucciones especiales: ${result.processedOrder.special_instructions}`);
      }
      
      if (result.processedOrder.ambiguities && result.processedOrder.ambiguities.length > 0) {
        console.log(`\n   ⚠️  AMBIGÜEDADES DETECTADAS:`);
        result.processedOrder.ambiguities.forEach((ambiguity, index) => {
          console.log(`     ${index + 1}. ${ambiguity}`);
        });
      }
    } else {
      console.log(`   ❌ Error: ${result.error}`);
    }

    // 4. Instrucciones para configurar GPT personalizado
    if (process.env.USE_CUSTOM_ASSISTANT !== 'true') {
      console.log('\n🔧 4. INSTRUCCIONES PARA USAR TU GPT PERSONALIZADO:');
      console.log('=' .repeat(50));
      console.log('Para conectar tu GPT personalizado con el sistema:');
      console.log('');
      console.log('1. Ve a https://platform.openai.com/assistants');
      console.log('2. Encuentra tu Assistant personalizado');
      console.log('3. Copia el Assistant ID (formato: asst_xxxxxxxxxxxxx)');
      console.log('4. Modifica el archivo backend/.env:');
      console.log('   USE_CUSTOM_ASSISTANT=true');
      console.log('   CUSTOM_GPT_ASSISTANT_ID=tu_assistant_id_aqui');
      console.log('5. Reinicia el servidor backend');
      console.log('');
      console.log('Tu GPT personalizado procesará todos los pedidos con tu');
      console.log('entrenamiento específico en lugar del ChatGPT estándar.');
    }

    // 5. Mostrar estadísticas de uso
    console.log('\n📊 5. ESTADÍSTICAS DE USO (ÚLTIMOS 30 DÍAS):');
    const stats = await chatgptService.getUsageStats(30);
    if (stats) {
      console.log(`   ✓ Total de solicitudes: ${stats.total_requests}`);
      console.log(`   ✓ Solicitudes exitosas: ${stats.successful_requests}`);
      console.log(`   ✓ Solicitudes de texto: ${stats.text_requests}`);
      console.log(`   ✓ Solicitudes de imagen: ${stats.image_requests}`);
      console.log(`   ✓ Total de tokens usados: ${stats.total_tokens}`);
      console.log(`   ✓ Tiempo promedio: ${stats.avg_processing_time?.toFixed(0)}ms`);
      console.log(`   ✓ Tiempo promedio exitoso: ${stats.avg_success_time?.toFixed(0)}ms`);
    } else {
      console.log('   ❌ No se pudieron obtener estadísticas');
    }

    console.log('\n✅ PRUEBA COMPLETADA EXITOSAMENTE');

  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:', error.message);
    if (error.stack) {
      console.error('📍 Stack trace:', error.stack);
    }
  }
}

// Ejecutar la prueba
if (require.main === module) {
  testCustomGPTIntegration()
    .then(() => {
      console.log('\n🏁 Prueba finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { testCustomGPTIntegration };
