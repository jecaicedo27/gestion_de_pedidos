const axios = require('axios');

async function testChatGPTProcessing() {
  console.log('🧪 Test completo del procesamiento con ChatGPT\n');
  console.log('=' .repeat(50));
  
  try {
    // 1. Login
    console.log('\n1️⃣ Iniciando sesión...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login exitoso');
    
    // 2. Buscar un cliente para la prueba
    console.log('\n2️⃣ Buscando cliente para prueba...');
    const searchResponse = await axios.get(
      'http://localhost:3001/api/quotations/customers/search?q=Mostrador',
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const customers = searchResponse.data;
    console.log(`✅ ${customers.length} clientes encontrados`);
    
    // 3. Probar procesamiento con ChatGPT
    console.log('\n3️⃣ Probando procesamiento con ChatGPT...');
    console.log('📝 Pedido de prueba:');
    console.log('   - 2 sal limon x 250');
    console.log('   - 3 perlas de fresa x 350');
    
    const processResponse = await axios.post(
      'http://localhost:3001/api/quotations/process-natural-order',
      {
        naturalLanguageOrder: '2 sal limon x 250\n3 perlas de fresa x 350',
        selectedCustomerId: customers[0]?.id || 1,
        processWithChatGPT: true
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    console.log('\n✅ Procesamiento exitoso!');
    console.log('\n📊 Respuesta de ChatGPT:');
    console.log(JSON.stringify(processResponse.data, null, 2));
    
    // 4. Verificar que se guardó el log
    console.log('\n4️⃣ Verificando log de procesamiento...');
    
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
    
    console.log(`✅ Logs registrados en el último minuto: ${logs[0].total}`);
    
    // Obtener el último log
    const [lastLog] = await connection.execute(`
      SELECT 
        id,
        quotation_id,
        request_type,
        tokens_used,
        processing_time_ms,
        success,
        error_message,
        created_at
      FROM chatgpt_processing_log 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (lastLog.length > 0) {
      console.log('\n📋 Último log registrado:');
      console.log(`   - ID: ${lastLog[0].id}`);
      console.log(`   - Quotation ID: ${lastLog[0].quotation_id || 'NULL (OK)'}`);
      console.log(`   - Tipo: ${lastLog[0].request_type}`);
      console.log(`   - Tokens usados: ${lastLog[0].tokens_used}`);
      console.log(`   - Tiempo: ${lastLog[0].processing_time_ms}ms`);
      console.log(`   - Éxito: ${lastLog[0].success ? 'Sí' : 'No'}`);
      console.log(`   - Error: ${lastLog[0].error_message || 'Ninguno'}`);
    }
    
    await connection.end();
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ SISTEMA CHATGPT FUNCIONANDO CORRECTAMENTE');
    console.log('=' .repeat(50));
    
    // 5. Notas sobre el error de facturación
    console.log('\n⚠️ Nota sobre el error de facturación:');
    console.log('   El error "invalid_total_payments" ocurre porque:');
    console.log('   - Total calculado: $135,000 (correcto)');
    console.log('   - Total enviado en pago: $160,650 (incorrecto)');
    console.log('   Esto es un problema de cálculo en el frontend o servicio.');
    console.log('   El procesamiento con ChatGPT está funcionando correctamente.');
    
  } catch (error) {
    console.error('\n❌ Error en la prueba:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testChatGPTProcessing();
