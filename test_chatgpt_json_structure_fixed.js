const axios = require('axios');

// Configuración
const API_BASE = 'http://localhost:3001/api';

async function authenticateUser() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('🔍 Respuesta de login completa:', JSON.stringify(response.data, null, 2));
    
    // Extraer el token de la respuesta (nested structure: response.data.data.token)
    const token = response.data.data?.token || response.data.token || response.data.access_token || response.data.jwt;
    
    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación');
    }
    
    console.log('🔑 Token extraído:', token);
    return token;
  } catch (error) {
    console.error('❌ Error de autenticación:', error.message);
    if (error.response) {
      console.error('📄 Respuesta del servidor:', error.response.data);
    }
    throw error;
  }
}

async function testChatGptJsonStructure() {
  console.log('🧪 Probando estructura JSON corregida de ChatGPT...\n');

  try {
    // Primero autenticarse para obtener token válido
    console.log('🔐 Autenticando usuario...');
    const AUTH_TOKEN = await authenticateUser();
    console.log('✅ Autenticación exitosa!\n');
    // Datos de prueba
    const testData = {
      customer_id: 1, // ID de cliente existente
      natural_language_order: 'dame porfa 15 perlas de 350 sabor fresa, 8 sal limon de 250g, y 5 liquipops de mango'
    };

    console.log('📋 Datos de prueba:');
    console.log(`- Cliente ID: ${testData.customer_id}`);
    console.log(`- Pedido: "${testData.natural_language_order}"`);
    console.log('');

    // Realizar petición
    console.log('🚀 Enviando pedido a ChatGPT...');
    
    const response = await axios.post(
      `${API_BASE}/quotations/process-natural-order`,
      testData,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Respuesta recibida exitosamente!\n');

    // Analizar la estructura de respuesta
    console.log('📊 ESTRUCTURA DE RESPUESTA:');
    console.log('='.repeat(50));
    
    const { data } = response.data;
    
    console.log('🎯 JSON de ChatGPT (preparado para SIIGO):');
    console.log(JSON.stringify(data.chatgpt_response, null, 2));
    
    console.log('\n📈 Metadatos del procesamiento:');
    console.log(JSON.stringify(data.processing_metadata, null, 2));

    // Validar estructura
    console.log('\n✅ VALIDACIONES:');
    console.log('='.repeat(30));
    
    const chatgptResponse = data.chatgpt_response;
    
    console.log(`✓ Tiene campo 'confidence': ${typeof chatgptResponse.confidence === 'number'}`);
    console.log(`✓ Tiene array 'items': ${Array.isArray(chatgptResponse.items)}`);
    console.log(`✓ Número de items encontrados: ${chatgptResponse.items?.length || 0}`);
    
    if (chatgptResponse.items && chatgptResponse.items.length > 0) {
      console.log('\n📦 ITEMS PROCESADOS:');
      chatgptResponse.items.forEach((item, index) => {
        console.log(`\nItem ${index + 1}:`);
        console.log(`  - Producto: ${item.product_name}`);
        console.log(`  - Código: ${item.product_code || 'No identificado'}`);
        console.log(`  - Cantidad: ${item.quantity} ${item.unit}`);
        console.log(`  - Confianza: ${(item.confidence * 100).toFixed(1)}%`);
        if (item.suggested_price) {
          console.log(`  - Precio sugerido: $${item.suggested_price}`);
        }
        if (item.notes) {
          console.log(`  - Notas: ${item.notes}`);
        }
      });
    }
    
    // Verificar estructura para SIIGO
    console.log('\n🎯 PREPARACIÓN PARA SIIGO:');
    console.log('='.repeat(40));
    
    const siigoItems = chatgptResponse.items?.map((item, index) => ({
      code: item.product_code || `ITEM-${index + 1}`,
      description: item.product_name,
      quantity: item.quantity,
      price: item.suggested_price || 1000,
      discount: 0
    }));
    
    console.log('Estructura preparada para SIIGO:');
    console.log(JSON.stringify(siigoItems, null, 2));
    
    console.log('\n🎊 ¡Prueba completada exitosamente!');
    console.log(`⏱️  Tiempo de procesamiento: ${data.processing_metadata.processing_time_ms}ms`);
    console.log(`🪙 Tokens utilizados: ${data.processing_metadata.tokens_used}`);

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    
    if (error.response) {
      console.error('📄 Respuesta del servidor:', error.response.data);
      console.error('📊 Status:', error.response.status);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 El backend no está corriendo en localhost:3001');
    }
    
    process.exit(1);
  }
}

// Ejecutar prueba
console.log('🚀 Iniciando prueba de estructura JSON corregida...\n');
testChatGptJsonStructure();
