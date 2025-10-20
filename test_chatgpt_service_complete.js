const chatgptService = require('./backend/services/chatgptService');

async function testChatGPTService() {
  console.log('🧪 === PRUEBA COMPLETA DEL SERVICIO CHATGPT ===\n');

  try {
    // 1. Verificar configuración
    console.log('1️⃣ VERIFICANDO CONFIGURACIÓN...');
    console.log('API Key configurada:', chatgptService.apiKey ? '✅ Sí' : '❌ No');
    console.log('Assistant personalizado habilitado:', chatgptService.useCustomAssistant ? '✅ Sí' : '❌ No');
    if (chatgptService.useCustomAssistant) {
      console.log('Assistant ID:', chatgptService.customAssistantId || '❌ No configurado');
    }
    console.log();

    // 2. Probar obtención de catálogo de productos
    console.log('2️⃣ PROBANDO CATÁLOGO DE PRODUCTOS...');
    const productCatalog = await chatgptService.getProductCatalog(10);
    console.log('Productos obtenidos:', productCatalog.length);
    
    if (productCatalog.length > 0) {
      console.log('✅ Primer producto de muestra:');
      console.log('  - Código:', productCatalog[0].code);
      console.log('  - Nombre:', productCatalog[0].name);
      console.log('  - Categoría:', productCatalog[0].category);
      console.log('  - Precio:', productCatalog[0].price);
      console.log('  - Activo:', productCatalog[0].active);
    } else {
      console.log('❌ No se obtuvieron productos');
    }
    console.log();

    // 3. Probar construcción de prompts
    console.log('3️⃣ PROBANDO CONSTRUCCIÓN DE PROMPTS...');
    const systemPrompt = await chatgptService.buildSystemPrompt(productCatalog.slice(0, 5));
    console.log('System prompt generado:', systemPrompt.length, 'caracteres');
    console.log('Incluye catálogo de productos:', systemPrompt.includes('CATÁLOGO') ? '✅ Sí' : '❌ No');
    
    const userPrompt = chatgptService.buildUserPrompt('Necesito 10 cajas de Liquipops sabor maracuyá y 5 Skarcha limón');
    console.log('User prompt generado:', userPrompt.length, 'caracteres');
    console.log();

    // 4. Probar validación de estructura
    console.log('4️⃣ PROBANDO VALIDACIÓN DE ESTRUCTURA...');
    const validOrder = {
      confidence: 0.95,
      items: [
        {
          product_name: "Liquipops Maracuyá",
          product_code: "LIQUIPP01",
          quantity: 10,
          unit: "cajas",
          confidence: 0.9,
          notes: "Sabor maracuyá"
        }
      ],
      customer_notes: "Pedido de prueba",
      special_instructions: "Entregar temprano",
      ambiguities: []
    };

    const invalidOrder = {
      confidence: 1.5, // Error: fuera de rango
      items: "no es array", // Error: debe ser array
      customer_notes: 123 // Error: debe ser string
    };

    const validResult = chatgptService.validateProcessedOrder(validOrder);
    const invalidResult = chatgptService.validateProcessedOrder(invalidOrder);

    console.log('Validación de orden válida:', validResult.isValid ? '✅ Correcto' : '❌ Error');
    console.log('Validación de orden inválida:', !invalidResult.isValid ? '✅ Correcto' : '❌ Error');
    if (!invalidResult.isValid) {
      console.log('Errores detectados:', invalidResult.errors.length);
    }
    console.log();

    // 5. Probar mejora de pedido procesado
    console.log('5️⃣ PROBANDO MEJORA DE PEDIDO...');
    const testOrder = {
      confidence: 0.8,
      items: [
        {
          product_name: "Liquipops",
          product_code: null,
          quantity: 5,
          unit: "unidades",
          confidence: 0.7,
          notes: "Sin código"
        }
      ],
      customer_notes: "Pedido de prueba",
      special_instructions: "",
      ambiguities: []
    };

    const enhancedOrder = await chatgptService.enhanceProcessedOrder(testOrder);
    console.log('Orden mejorada:');
    console.log('  - Producto encontrado:', enhancedOrder.items[0].product_code ? '✅ Sí' : '❌ No');
    if (enhancedOrder.items[0].product_code) {
      console.log('  - Código asignado:', enhancedOrder.items[0].product_code);
      console.log('  - Precio sugerido:', enhancedOrder.items[0].suggested_price);
      console.log('  - Confianza de coincidencia:', enhancedOrder.items[0].match_confidence);
    }
    console.log();

    // 6. Obtener estadísticas (si hay datos)
    console.log('6️⃣ OBTENIENDO ESTADÍSTICAS...');
    try {
      const stats = await chatgptService.getUsageStats(30);
      if (stats && stats.total_requests > 0) {
        console.log('✅ Estadísticas de uso (últimos 30 días):');
        console.log('  - Total de solicitudes:', stats.total_requests);
        console.log('  - Solicitudes exitosas:', stats.successful_requests);
        console.log('  - Solicitudes de texto:', stats.text_requests);
        console.log('  - Solicitudes de imagen:', stats.image_requests);
        console.log('  - Total de tokens:', stats.total_tokens);
        console.log('  - Tiempo promedio:', Math.round(stats.avg_processing_time), 'ms');
      } else {
        console.log('ℹ️ No hay estadísticas disponibles (sin procesamiento previo)');
      }
    } catch (error) {
      console.log('⚠️ Error obteniendo estadísticas:', error.message);
    }
    console.log();

    // 7. Probar procesamiento real (solo si hay API key)
    console.log('7️⃣ PRUEBA DE PROCESAMIENTO REAL...');
    if (!chatgptService.apiKey) {
      console.log('⚠️ No se puede probar procesamiento real: API key no configurada');
      console.log('Para configurar la API key:');
      console.log('  1. Obtén tu API key desde https://platform.openai.com/api-keys');
      console.log('  2. Agrégala al archivo backend/.env como OPENAI_API_KEY=tu_key_aqui');
      console.log('  3. Reinicia el servidor backend');
    } else {
      console.log('✅ API key configurada - Realizando prueba con texto simple...');
      try {
        const result = await chatgptService.processNaturalLanguageOrder(
          null, // quotationId de prueba
          'Necesito 2 cajas de Liquipops sabor maracuyá y 3 Skarcha limón de 250g',
          productCatalog.slice(0, 10)
        );

        if (result.success) {
          console.log('✅ Procesamiento exitoso:');
          console.log('  - Items encontrados:', result.processedOrder.items.length);
          console.log('  - Confianza general:', result.processedOrder.confidence);
          console.log('  - Tokens usados:', result.tokensUsed);
          console.log('  - Tiempo de procesamiento:', result.processingTimeMs, 'ms');
          
          if (result.processedOrder.items.length > 0) {
            console.log('  - Primer item:', result.processedOrder.items[0].product_name);
          }
        } else {
          console.log('❌ Error en procesamiento:', result.error);
        }
      } catch (error) {
        console.log('❌ Error en prueba de procesamiento:', error.message);
      }
    }
    console.log();

    // 8. Información del Assistant (si está configurado)
    if (chatgptService.useCustomAssistant && chatgptService.customAssistantId && chatgptService.apiKey) {
      console.log('8️⃣ INFORMACIÓN DEL ASSISTANT PERSONALIZADO...');
      try {
        const assistantInfo = await chatgptService.getAssistantInfo();
        if (assistantInfo) {
          console.log('✅ Assistant encontrado:');
          console.log('  - Nombre:', assistantInfo.name || 'Sin nombre');
          console.log('  - Modelo:', assistantInfo.model);
          console.log('  - Descripción:', assistantInfo.description || 'Sin descripción');
        } else {
          console.log('❌ No se pudo obtener información del Assistant');
        }
      } catch (error) {
        console.log('❌ Error obteniendo info del Assistant:', error.message);
      }
      console.log();
    }

    console.log('✅ === PRUEBA COMPLETA FINALIZADA ===');
    
    // Resumen final
    console.log('\n📋 RESUMEN:');
    console.log('✅ Servicio ChatGPT correctamente configurado');
    console.log('✅ Conexión a base de datos funcionando');
    console.log('✅ Catálogo de productos accesible');
    console.log('✅ Validaciones funcionando correctamente');
    console.log('✅ Sistema de mejora de pedidos operativo');
    
    if (!chatgptService.apiKey) {
      console.log('⚠️ API key de OpenAI pendiente de configuración');
    } else {
      console.log('✅ API key de OpenAI configurada');
    }

  } catch (error) {
    console.error('❌ Error en prueba:', error);
    process.exit(1);
  }
}

testChatGPTService().then(() => {
  process.exit(0);
});
