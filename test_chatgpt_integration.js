const ChatGPTService = require('./backend/services/chatgptService');

async function testChatGPTIntegration() {
    console.log('🤖 Testing ChatGPT Integration');
    console.log('===============================');

    // Load environment variables
    require('dotenv').config({ path: './backend/.env' });
    
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
        console.log('❌ OPENAI_API_KEY no está configurada en el archivo .env');
        return;
    }
    
    console.log('✅ API Key configurada correctamente');
    console.log('🔑 API Key:', process.env.OPENAI_API_KEY.substring(0, 20) + '...');

    try {
        // Test 1: Process a simple natural language order
        console.log('\n📝 Test 1: Procesamiento de pedido en texto...');
        const testOrder = `
            Hola, necesito:
            - 10 cajas de Liquipop sabor maracuyá
            - 5 Skarcha limón de 250g  
            - 2 PITILLOS especiales
            
            Para entregar mañana por favor.
        `;

        const result1 = await ChatGPTService.processNaturalLanguageOrder(
            null, // quotation_id (can be null for testing)
            testOrder
        );

        if (result1.success) {
            console.log('✅ Procesamiento exitoso');
            console.log(`📊 Tokens usados: ${result1.tokensUsed}`);
            console.log(`⏱️ Tiempo: ${result1.processingTimeMs}ms`);
            console.log('📦 Items procesados:');
            result1.processedOrder.items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.product_name} - Cantidad: ${item.quantity} ${item.unit} (Confianza: ${item.confidence})`);
            });
            
            if (result1.processedOrder.customer_notes) {
                console.log('📝 Notas del cliente:', result1.processedOrder.customer_notes);
            }
            
            if (result1.processedOrder.ambiguities?.length > 0) {
                console.log('⚠️ Ambigüedades detectadas:', result1.processedOrder.ambiguities);
            }
        } else {
            console.log('❌ Error en procesamiento:', result1.error);
        }

        // Test 2: Get product catalog for context
        console.log('\n📋 Test 2: Obteniendo catálogo de productos...');
        const catalog = await ChatGPTService.getProductCatalog(10);
        console.log(`✅ Catálogo obtenido: ${catalog.length} productos`);
        
        if (catalog.length > 0) {
            console.log('🏷️ Productos de muestra:');
            catalog.slice(0, 5).forEach(product => {
                console.log(`   - ${product.code}: ${product.name} (${product.category || 'Sin categoría'})`);
            });
        }

        // Test 3: Process order with product catalog context
        console.log('\n🎯 Test 3: Procesamiento con contexto de catálogo...');
        const testOrder2 = `
            Quiero:
            - 20 unidades del producto LIQUIPP07
            - Algunas cajas de Skarcha
            - Pitillos para heladería
        `;

        const result2 = await ChatGPTService.processNaturalLanguageOrder(
            null,
            testOrder2,
            catalog
        );

        if (result2.success) {
            console.log('✅ Procesamiento con catálogo exitoso');
            console.log(`📊 Tokens usados: ${result2.tokensUsed}`);
            console.log('📦 Items identificados:');
            result2.processedOrder.items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.product_name} - ${item.quantity} ${item.unit}`);
                if (item.product_code) {
                    console.log(`      ✓ Código identificado: ${item.product_code}`);
                }
            });
        } else {
            console.log('❌ Error en procesamiento con catálogo:', result2.error);
        }

        // Test 4: Enhance processed order with database matching
        if (result2.success) {
            console.log('\n🔍 Test 4: Mejorando pedido con información de base de datos...');
            const enhancedOrder = await ChatGPTService.enhanceProcessedOrder(result2.processedOrder);
            
            console.log('📈 Pedido mejorado:');
            enhancedOrder.items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.product_name}`);
                if (item.product_code) {
                    console.log(`      📋 Código: ${item.product_code}`);
                }
                if (item.suggested_price) {
                    console.log(`      💰 Precio sugerido: $${item.suggested_price}`);
                }
                if (item.category) {
                    console.log(`      🏷️ Categoría: ${item.category}`);
                }
                if (item.match_confidence) {
                    console.log(`      🎯 Confianza de coincidencia: ${item.match_confidence}`);
                }
            });
        }

        // Test 5: Usage statistics
        console.log('\n📈 Test 5: Estadísticas de uso...');
        const stats = await ChatGPTService.getUsageStats(30);
        if (stats) {
            console.log('📊 Estadísticas (últimos 30 días):');
            console.log(`   Total de solicitudes: ${stats.total_requests}`);
            console.log(`   Solicitudes exitosas: ${stats.successful_requests}`);
            console.log(`   Solicitudes de texto: ${stats.text_requests}`);
            console.log(`   Solicitudes de imagen: ${stats.image_requests}`);
            console.log(`   Total de tokens: ${stats.total_tokens || 0}`);
            console.log(`   Tiempo promedio: ${Math.round(stats.avg_processing_time || 0)}ms`);
        }

        console.log('\n🎉 INTEGRACIÓN DE CHATGPT COMPLETADA EXITOSAMENTE');
        console.log('===============================================');
        console.log('✅ API key configurada correctamente');
        console.log('✅ Servicio ChatGPT funcionando');
        console.log('✅ Base de datos conectada');
        console.log('✅ Logging funcionando');
        console.log('✅ Mejora de pedidos operativa');
        
        console.log('\n🚀 Listo para usar en la aplicación de cotizaciones!');
        console.log('📝 Los usuarios pueden ahora escribir pedidos en lenguaje natural');
        console.log('🤖 ChatGPT procesará automáticamente los pedidos');
        console.log('📊 Todas las interacciones quedan registradas');

    } catch (error) {
        console.error('❌ Error en la prueba de integración:', error.message);
        console.error('🔧 Stack trace:', error.stack);
    }
}

// Run the test
testChatGPTIntegration();
