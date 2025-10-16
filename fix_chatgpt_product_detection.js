const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

console.log('🔧 INVESTIGANDO PROBLEMA DE DETECCIÓN DE PRODUCTOS EN CHATGPT');
console.log('============================================================\n');

async function authenticateAndGetToken() {
  try {
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data && loginResponse.data.data && loginResponse.data.data.token) {
      return loginResponse.data.data.token;
    }
    return null;
  } catch (error) {
    console.log('❌ Error en autenticación:', error.message);
    return null;
  }
}

async function investigateProductsDatabase(token) {
  console.log('🔍 1. INVESTIGANDO BASE DE DATOS DE PRODUCTOS');
  console.log('=============================================');
  
  try {
    // Obtener total de productos
    const totalResponse = await axios.get(`${BASE_URL}/api/products?page=1&page_size=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`📊 Total de productos en BD: ${totalResponse.data.total || 0}`);
    
    if (totalResponse.data.total === 0) {
      console.log('❌ NO HAY PRODUCTOS EN LA BASE DE DATOS');
      console.log('   Esto explica por qué ChatGPT encuentra 0 productos');
      return false;
    }
    
    // Buscar productos específicos
    const searches = ['liqui', 'pop', 'fresa', 'cola'];
    
    for (const search of searches) {
      try {
        const response = await axios.get(`${BASE_URL}/api/products?search=${search}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`🔍 Búsqueda "${search}": ${response.data.data?.length || 0} productos encontrados`);
        
        if (response.data.data?.length > 0) {
          console.log(`   Ejemplos:`);
          response.data.data.slice(0, 2).forEach(product => {
            console.log(`   - ${product.name} (ID: ${product.id}, Code: ${product.code})`);
          });
        }
      } catch (error) {
        console.log(`❌ Error buscando "${search}":`, error.message);
      }
    }
    
    return totalResponse.data.total > 0;
    
  } catch (error) {
    console.log('❌ Error investigando productos:', error.message);
    return false;
  }
}

async function testChatGPTProductIdentification(token) {
  console.log('\n🤖 2. PROBANDO IDENTIFICACIÓN DE PRODUCTOS CON CHATGPT');
  console.log('====================================================');
  
  // Primero probar con productos que sabemos que existen
  try {
    const productsResponse = await axios.get(`${BASE_URL}/api/products?page=1&page_size=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (productsResponse.data.data?.length > 0) {
      const firstProduct = productsResponse.data.data[0];
      console.log(`🎯 Producto existente para prueba: ${firstProduct.name}`);
      
      const testOrder = `Necesito 5 unidades de ${firstProduct.name}`;
      console.log(`📝 Orden de prueba: "${testOrder}"`);
      
      // Llamar al endpoint con producto conocido
      try {
        const testData = {
          customer_id: 1,
          natural_language_order: testOrder,
          notes: 'Prueba con producto existente'
        };
        
        console.log('🤖 Enviando a ChatGPT (timeout: 20s)...');
        const response = await axios.post(
          `${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`,
          testData,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 20000 // 20 segundos para evitar que se cuelgue
          }
        );
        
        console.log('✅ ChatGPT respondió exitosamente');
        console.log('📊 Status:', response.status);
        
        if (response.data.products) {
          console.log(`📦 Productos identificados: ${response.data.products.length}`);
          response.data.products.forEach(product => {
            console.log(`   - ${product.name} (${product.quantity} unidades)`);
          });
        } else {
          console.log('❌ No se encontraron productos en la respuesta');
        }
        
        return { success: true, productsFound: response.data.products?.length || 0 };
        
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          console.log('⏱️ TIMEOUT: ChatGPT tardó más de 20 segundos');
        } else {
          console.log('❌ Error en ChatGPT:', error.message);
          if (error.response?.data) {
            console.log('📋 Detalles:', JSON.stringify(error.response.data, null, 2));
          }
        }
        return { success: false, error: error.message };
      }
    } else {
      console.log('❌ No hay productos para probar');
      return { success: false, error: 'No products to test' };
    }
    
  } catch (error) {
    console.log('❌ Error obteniendo productos para prueba:', error.message);
    return { success: false, error: error.message };
  }
}

async function checkChatGPTConfiguration(token) {
  console.log('\n⚙️ 3. VERIFICANDO CONFIGURACIÓN DE CHATGPT');
  console.log('==========================================');
  
  try {
    // Verificar variables de entorno
    const envResponse = await axios.get(`${BASE_URL}/api/products?page=1&page_size=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ API de productos responde correctamente');
    
    // Intentar obtener configuración si existe endpoint
    try {
      const configResponse = await axios.get(`${BASE_URL}/api/system/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (configResponse.data.openai) {
        console.log('✅ Configuración OpenAI encontrada');
        console.log('🔑 API Key configurada:', configResponse.data.openai.apiKey ? 'Sí' : 'No');
        console.log('🤖 Assistant ID:', configResponse.data.openai.assistantId || 'No configurado');
      }
    } catch (error) {
      console.log('⚠️ No se pudo acceder a configuración del sistema');
    }
    
  } catch (error) {
    console.log('❌ Error verificando configuración:', error.message);
  }
}

async function investigateChatGPTProcessing() {
  console.log('⏰', new Date().toLocaleString());
  console.log('');
  
  // Verificar backend
  try {
    await axios.get(`${BASE_URL}/api/siigo/invoices?page=1&page_size=1`);
    console.log('✅ Backend está ejecutándose\n');
  } catch (error) {
    console.log('❌ Backend no está ejecutándose');
    console.log('   Ejecutar: node start_backend_simple.js');
    return;
  }
  
  // Autenticarse
  const token = await authenticateAndGetToken();
  if (!token) {
    console.log('❌ No se pudo autenticar');
    return;
  }
  
  console.log('✅ Autenticación exitosa\n');
  
  // Investigar productos
  const hasProducts = await investigateProductsDatabase(token);
  
  if (!hasProducts) {
    console.log('\n🔧 SOLUCIÓN RECOMENDADA:');
    console.log('========================');
    console.log('1. Cargar productos desde SIIGO:');
    console.log('   node load_all_products_from_siigo.js');
    console.log('2. O importar productos manualmente');
    return;
  }
  
  // Probar ChatGPT
  await testChatGPTProductIdentification(token);
  
  // Verificar configuración
  await checkChatGPTConfiguration(token);
  
  console.log('\n📋 RESUMEN Y RECOMENDACIONES:');
  console.log('=============================');
  console.log('Si ChatGPT no encuentra productos, las posibles causas son:');
  console.log('1. 🔍 Búsqueda de productos no está funcionando correctamente');
  console.log('2. 🤖 Configuración del Assistant de ChatGPT');
  console.log('3. ⏱️ Timeout en la comunicación con OpenAI');
  console.log('4. 🔑 Problemas con API Key de OpenAI');
  console.log('5. 📝 El Assistant no está entendiendo las descripciones de productos');
}

investigateChatGPTProcessing().catch(error => {
  console.error('❌ Error crítico:', error.message);
});
