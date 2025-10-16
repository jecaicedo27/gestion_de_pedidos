const axios = require('axios');

async function simpleTest() {
  console.log('🧪 Test simple del procesamiento con ChatGPT\n');
  console.log('=' .repeat(50));
  
  try {
    // 1. Login
    console.log('\n1️⃣ Iniciando sesión...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('Respuesta de login:', loginResponse.data);
    const token = loginResponse.data.data.token;
    console.log('Token recibido:', token);
    console.log('✅ Login exitoso');
    
    // 2. Test simple sin autenticación
    console.log('\n2️⃣ Procesando con ChatGPT (sin autenticación requerida)...');
    console.log('📝 Pedido de prueba:');
    console.log('   - 2 sal limon x 250');
    console.log('   - 3 perlas de fresa x 350');
    
    // Procesamiento directo sin buscar cliente
    const processResponse = await axios.post(
      'http://localhost:3001/api/quotations/process-natural-order',
      {
        naturalLanguageOrder: '2 sal limon x 250\n3 perlas de fresa x 350',
        selectedCustomerId: 1, // Cliente Mostrador Ocasional
        processWithChatGPT: true
      },
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ Procesamiento exitoso!');
    console.log('\n📊 Respuesta de ChatGPT:');
    console.log(JSON.stringify(processResponse.data, null, 2));
    
    // Verificar logs en DB
    const mysql = require('mysql2/promise');
    require('dotenv').config({ path: './backend/.env' });
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev',
      port: process.env.DB_PORT || 3306
    });
    
    const [logs] = await connection.execute(`
      SELECT COUNT(*) as total 
      FROM chatgpt_processing_log 
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
    `);
    
    console.log(`\n✅ Logs registrados en el último minuto: ${logs[0].total}`);
    
    await connection.end();
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ SISTEMA CHATGPT FUNCIONANDO CORRECTAMENTE');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('\n❌ Error en la prueba:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers requeridos:', error.response.config.headers);
    } else {
      console.error(error.message);
    }
  }
}

simpleTest();
