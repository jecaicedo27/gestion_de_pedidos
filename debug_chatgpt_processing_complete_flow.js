const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function debugCompleteFlow() {
  try {
    console.log('🔍 DEBUG COMPLETO DEL FLUJO CHATGPT → SIIGO');
    console.log('='.repeat(60));

    // PASO 1: Autenticación
    console.log('\n📝 PASO 1: Autenticación');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    console.log('✅ Login exitoso');
    
    const token = loginResponse.data.data.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // PASO 2: Procesar texto con ChatGPT primero
    console.log('\n🤖 PASO 2: Procesamiento con ChatGPT');
    const naturalLanguageOrder = "Necesito 2 LIQUIPOPS SABOR A FRESA X 12000 GR a 25000 cada uno y 1 LIQUIPOPS SABOR A MANGO X 1200 GR a 27000";
    
    const chatgptData = {
      customer_id: "1",
      natural_language_order: naturalLanguageOrder
    };

    console.log('📤 Enviando a ChatGPT:', JSON.stringify(chatgptData, null, 2));
    
    try {
      const chatgptResponse = await axios.post(
        `${BASE_URL}/api/quotations/process-natural-order`, 
        chatgptData,
        { headers: authHeaders }
      );
      
      console.log('✅ ChatGPT procesó exitosamente');
      console.log('📊 Respuesta de ChatGPT:');
      console.log(JSON.stringify(chatgptResponse.data, null, 2));

      // PASO 3: Verificar estructura de items
      const items = chatgptResponse.data.data.structured_items;
      console.log(`\n📦 Items extraídos: ${items ? items.length : 0}`);
      
      if (items && items.length > 0) {
        items.forEach((item, index) => {
          console.log(`📌 Item ${index + 1}:`);
          console.log(`   - Nombre: ${item.product_name || 'N/A'}`);
          console.log(`   - Código: ${item.product_code || 'N/A'}`);
          console.log(`   - Cantidad: ${item.quantity || 0}`);
          console.log(`   - Precio: $${item.unit_price || 0}`);
          console.log(`   - Total: $${(item.quantity || 0) * (item.unit_price || 0)}`);
        });

        // PASO 4: Crear factura con items procesados
        console.log('\n🎯 PASO 4: Creando factura SIIGO con items procesados');
        
        const invoiceData = {
          customer_id: "1",
          natural_language_order: naturalLanguageOrder,
          items: items, // Usar los items procesados por ChatGPT
          notes: "Factura de prueba - debug completo"
        };

        console.log('📤 Enviando a SIIGO:', JSON.stringify(invoiceData, null, 2));

        const siigoResponse = await axios.post(
          `${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`,
          invoiceData,
          { headers: authHeaders }
        );

        console.log('✅ ÉXITO: Factura creada en SIIGO');
        console.log('📊 Respuesta de SIIGO:');
        console.log(JSON.stringify(siigoResponse.data, null, 2));

      } else {
        console.log('❌ ERROR: No se encontraron items en la respuesta de ChatGPT');
        console.log('🔍 Estructura completa de la respuesta:');
        console.log(JSON.stringify(chatgptResponse.data, null, 4));
      }

    } catch (chatgptError) {
      console.log('❌ ERROR en procesamiento ChatGPT:', chatgptError.response?.data || chatgptError.message);
      
      // PASO 3 ALTERNATIVO: Probar con items manuales
      console.log('\n⚙️ PASO 3 ALTERNATIVO: Probando con items manuales');
      
      const manualItems = [
        {
          product_name: "LIQUIPOPS SABOR A FRESA X 12000 GR",
          product_code: "LIQUIPP01", // Código ficticio
          quantity: 2,
          unit_price: 25000,
          unit: "unidades"
        },
        {
          product_name: "LIQUIPOPS SABOR A MANGO X 1200 GR", 
          product_code: "LIQUIPP02", // Código ficticio
          quantity: 1,
          unit_price: 27000,
          unit: "unidades"
        }
      ];

      console.log('📦 Items manuales:', JSON.stringify(manualItems, null, 2));

      const invoiceDataManual = {
        customer_id: "1",
        natural_language_order: naturalLanguageOrder,
        items: manualItems,
        notes: "Factura de prueba - items manuales"
      };

      try {
        const siigoResponse = await axios.post(
          `${BASE_URL}/api/quotations/create-siigo-invoice-with-chatgpt`,
          invoiceDataManual,
          { headers: authHeaders }
        );

        console.log('✅ ÉXITO CON ITEMS MANUALES: Factura creada en SIIGO');
        console.log('📊 Respuesta de SIIGO:');
        console.log(JSON.stringify(siigoResponse.data, null, 2));

      } catch (siigoError) {
        console.log('❌ ERROR también con items manuales:', siigoError.response?.data || siigoError.message);
        
        // Mostrar detalles del error
        if (siigoError.response?.data) {
          console.log('📊 Status:', siigoError.response.status);
          console.log('📊 Error data:', JSON.stringify(siigoError.response.data, null, 2));
        }
      }
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.response?.data) {
      console.log('📊 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

console.log('🚀 Iniciando debug completo del flujo ChatGPT → SIIGO...\n');
debugCompleteFlow();
