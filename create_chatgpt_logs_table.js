const mysql = require('mysql2/promise');

async function createChatGPTLogsTable() {
  let connection;
  
  try {
    console.log('🔄 Creando tabla chatgpt_logs...\n');
    
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });
    
    // Crear la tabla chatgpt_logs si no existe
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS chatgpt_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        customer_id INT,
        natural_language_order TEXT,
        chatgpt_request TEXT,
        chatgpt_response TEXT,
        quotation_data JSON,
        status ENUM('processing', 'success', 'error') DEFAULT 'processing',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `;
    
    await connection.execute(createTableSQL);
    console.log('✅ Tabla chatgpt_logs creada exitosamente');
    
    // Verificar que la tabla se creó
    const [tables] = await connection.execute(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'gestion_pedidos_dev' 
       AND table_name = 'chatgpt_logs'`
    );
    
    if (tables.length > 0) {
      console.log('✅ Verificación: La tabla chatgpt_logs existe en la base de datos');
      
      // Describir la estructura
      const [structure] = await connection.execute('DESCRIBE chatgpt_logs');
      console.log('\n📋 Estructura de la tabla chatgpt_logs:');
      structure.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
    }
    
    console.log('\n✅ Tabla chatgpt_logs lista para usar!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
createChatGPTLogsTable();
