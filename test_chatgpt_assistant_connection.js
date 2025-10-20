const path = require('path');

// Cargar variables de entorno ANTES de importar los servicios
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const { query } = require('./backend/config/database');

console.log('🤖 PROBANDO CONEXIÓN CON CHATGPT ASSISTANT');
console.log('===========================================');

async function testChatGPTAssistantConnection() {
  try {
    console.log('📋 1. VERIFICANDO VARIABLES DE ENTORNO:');
    console.log(`   ✓ OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configurado (' + process.env.OPENAI_API_KEY.substring(0, 20) + '...)' : '❌ No configurado'}`);
    console.log(`   ✓ USE_CUSTOM_ASSISTANT: ${process.env.USE_CUSTOM_ASSISTANT || '❌ No configurado'}`);
    console.log(`   ✓ CUSTOM_GPT_ASSISTANT_ID: ${process.env.CUSTOM_GPT_ASSISTANT_ID || '❌ No configurado'}`);
    console.log();

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no está configurado en las variables de entorno');
    }

    if (!process.env.CUSTOM_GPT_ASSISTANT_ID) {
      throw new Error('CUSTOM_GPT_ASSISTANT_ID no está configurado en las variables de entorno');
    }

    // Importar el servicio DESPUÉS de cargar las variables de entorno
    delete require.cache[require.resolve('./backend/services/chatgptService.js')];
    const chatgptService = require('./backend/services/chatgptService.js');
    
    console.log('🔧 2. CONFIGURACIÓN DEL SERVICIO CHATGPT:');
    console.log(`   ✓ API Key definido: ${chatgptService.apiKey ? '✅ Sí' : '❌ No'}`);
    console.log(`   ✓ Custom Assistant habilitado: ${chatgptService.useCustomAssistant ? '✅ Sí' : '❌ No'}`);
    console.log(`   ✓ Assistant ID: ${chatgptService.customAssistantId || '❌ No definido'}`);
    console.log();

    if (!chatgptService.apiKey) {
      throw new Error('El servicio ChatGPT no tiene API key configurada');
    }

    if (!chatgptService.useCustomAssistant) {
      throw new Error('El Custom Assistant no está habilitado en el servicio');
    }

    console.log('🧪 3. PROBANDO CONEXIÓN CON OPENAI ASSISTANT API:');
    
    // Probar conexión básica con la API de OpenAI
    const testResponse = await fetch('https://api.openai.com/v1/assistants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!testResponse.ok) {
      const errorData = await testResponse.json().catch(() => ({}));
      throw new Error(`Error conectando con OpenAI API: ${testResponse.status} - ${errorData.error?.message || 'Error desconocido'}`);
    }

    const assistants = await testResponse.json();
    console.log(`   ✅ Conexión exitosa con OpenAI Assistants API`);
    console.log(`   ✅ Assistants disponibles: ${assistants.data?.length || 0}`);
    
    // Buscar nuestro Assistant específico
    const ourAssistant = assistants.data?.find(a => a.id === process.env.CUSTOM_GPT_ASSISTANT_ID);
    
    if (ourAssistant) {
      console.log(`   ✅ Assistant encontrado: ${ourAssistant.name || 'Sin nombre'}`);
      console.log(`   ✅ Modelo: ${ourAssistant.model}`);
      console.log(`   ✅ Descripción: ${ourAssistant.description || 'Sin descripción'}`);
    } else {
      console.log(`   ⚠️  Assistant ID ${process.env.CUSTOM_GPT_ASSISTANT_ID} no encontrado en la lista`);
      console.log('   📋 Assistants disponibles:');
      assistants.data?.slice(0, 3).forEach(a => {
        console.log(`      - ${a.id}: ${a.name || 'Sin nombre'}`);
      });
    }
    console.log();

    console.log('🤖 4. PROBANDO PROCESAMIENTO DE PEDIDO COMPLETO:');
    
    const testOrder = "Hola, necesito para mi restaurante: 10 liquipops de maracuyá de 350ml y 5 skarcha limón de 250g";
    console.log(`   📝 Pedido de prueba: "${testOrder}"`);
    console.log('   🔄 Procesando con ChatGPT Assistant...');
    
    const startTime = Date.now();
    const result = await chatgptService.processNaturalLanguageOrder(null, testOrder);
    const endTime = Date.now();
    
    console.log('\n   📊 RESULTADO:');
    console.log(`   ✓ Éxito: ${result.success ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   ✓ Tiempo: ${endTime - startTime}ms`);
    console.log(`   ✓ Tokens usados: ${result.tokensUsed || 0}`);
    
    if (result.success) {
      console.log(`   ✓ Items procesados: ${result.processedOrder?.items?.length || 0}`);
      console.log(`   ✓ Confianza: ${result.processedOrder?.confidence || 0}`);
      
      if (result.processedOrder?.items?.length > 0) {
        console.log('\n   📦 ITEMS PROCESADOS:');
        result.processedOrder.items.forEach((item, index) => {
          console.log(`      ${index + 1}. ${item.product_name}`);
          console.log(`         Cantidad: ${item.quantity} ${item.unit}`);
          console.log(`         Confianza: ${item.confidence}`);
          if (item.product_code) {
            console.log(`         Código: ${item.product_code}`);
          }
        });
      }
      
      console.log('\n🎉 ¡CHATGPT ASSISTANT FUNCIONANDO CORRECTAMENTE!');
      console.log('===============================================');
      console.log('✅ Conexión establecida exitosamente');
      console.log('✅ Assistant personalizado respondiendo');
      console.log('✅ Procesamiento de pedidos operativo');
      
    } else {
      console.log(`   ❌ Error: ${result.error}`);
      throw new Error(`Fallo en procesamiento: ${result.error}`);
    }

  } catch (error) {
    console.error('\n💥 ERROR EN LA PRUEBA:', error.message);
    console.log('\n🔧 POSIBLES SOLUCIONES:');
    console.log('   1. Verificar que la API key sea válida en OpenAI Platform');
    console.log('   2. Confirmar que el Assistant ID existe en tu cuenta');
    console.log('   3. Verificar que el Assistant tenga permisos adecuados');
    console.log('   4. Comprobar conexión a internet');
    console.log('   5. Revisar límites de cuota en OpenAI');
    
    return false;
  }
  
  return true;
}

// Función para probar también sin quotation_id (que causaba error de foreign key)
async function testDirectProcessing() {
  console.log('\n🧪 5. PROBANDO PROCESAMIENTO DIRECTO (SIN QUOTATION):');
  
  try {
    // Importar el servicio DESPUÉS de cargar las variables de entorno
    delete require.cache[require.resolve('./backend/services/chatgptService.js')];
    const chatgptService = require('./backend/services/chatgptService.js');
    
    // Probar sin quotation_id para evitar problemas de foreign key
    const result = await chatgptService.processNaturalLanguageOrder(
      null, // No quotation_id
      'necesito 3 pitillos especiales y 2 liquipops fresa 350ml'
    );
    
    console.log(`   ✅ Procesamiento directo: ${result.success ? 'EXITOSO' : 'FALLÓ'}`);
    
    if (result.success) {
      console.log(`   ✅ Items encontrados: ${result.processedOrder?.items?.length || 0}`);
    } else {
      console.log(`   ❌ Error: ${result.error}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error en procesamiento directo: ${error.message}`);
  }
}

async function main() {
  const success = await testChatGPTAssistantConnection();
  
  if (success) {
    await testDirectProcessing();
    
    console.log('\n🏁 PRUEBA COMPLETADA EXITOSAMENTE');
    console.log('================================');
    console.log('El sistema está listo para procesar pedidos con ChatGPT Assistant!');
  } else {
    console.log('\n❌ PRUEBA FALLÓ - Revisar configuración');
  }
  
  process.exit(success ? 0 : 1);
}

main();
