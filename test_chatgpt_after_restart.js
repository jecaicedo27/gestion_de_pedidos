const axios = require('axios');
const mysql = require('mysql2/promise');

async function testChatGPTProcessing() {
  let connection;
  
  try {
    console.log('🔍 Probando procesamiento con ChatGPT después del reinicio...\n');
    
    // Configuración de base de datos
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos'
    });
    
    // 1. Login
    console.log('1. Iniciando sesión...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    const token = loginResponse.data.token;
    console.log('✅ Login exitoso\n');
    
    // 2. Buscar un cliente para la prueba
    console.log('2. Obteniendo cliente de prueba...');
    const [customers] = await connection.execute(
      `SELECT id, document, name, commercial_name 
       FROM customers 
       WHERE document IS NOT NULL 
       LIMIT 1`
    );
    
    if (customers.length === 0) {
      throw new Error('No se encontraron clientes con documento');
    }
    
    const customer = customers[0];
    console.log(`✅ Cliente encontrado: ${customer.name} (${customer.document})\n`);
    
    // 3. Probar procesamiento con ChatGPT
    console.log('3. Procesando con ChatGPT...');
    const order = `Quiero 5 helados de fruta, 3 helados de chocolate y 2 aguas`;
    
    const chatgptResponse = await axios.post(
      'http://localhost:3001/api/chatgpt/process',
      {
        natural_language_order: order,
        customer: {
          id: customer.id,
          document: customer.document,
          name: customer.name
        }
      },
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Procesamiento con ChatGPT exitoso!');
    console.log('\n📦 Respuesta de ChatGPT:');
    console.log(JSON.stringify(chatgptResponse.data, null, 2));
    
    // Verificar la estructura de la respuesta
    if (chatgptResponse.data.quotation_data && chatgptResponse.data.quotation_data.items) {
      console.log('\n✅ Productos identificados:');
      chatgptResponse.data.quotation_data.items.forEach(item => {
        console.log(`  - ${item.description}: ${item.quantity} unidad(es)`);
      });
    }
    
    // 4. Verificar el registro en la base de datos
    if (chatgptResponse.data.chatgpt_processing_id) {
      const [chatgptLogs] = await connection.execute(
        `SELECT * FROM chatgpt_logs WHERE id = ?`,
        [chatgptResponse.data.chatgpt_processing_id]
      );
      
      if (chatgptLogs.length > 0) {
        console.log('\n✅ Registro guardado en chatgpt_logs:');
        console.log(`  - ID: ${chatgptLogs[0].id}`);
        console.log(`  - Estado: ${chatgptLogs[0].status}`);
      }
    }
    
    console.log('\n✅ ChatGPT está funcionando correctamente después del reinicio!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 400) {
      console.log('\n⚠️ Error 400: Verificar validación de datos en el backend');
    } else if (error.response?.status === 401) {
      console.log('\n⚠️ Error 401: Problema de autenticación');
    } else if (error.response?.status === 500) {
      console.log('\n⚠️ Error 500: Error interno del servidor');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar la prueba
testChatGPTProcessing();
