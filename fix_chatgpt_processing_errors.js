const { query } = require('./backend/config/database');

async function fixChatGPTProcessingErrors() {
  console.log('🔧 Iniciando corrección de errores de procesamiento ChatGPT...');
  
  try {
    // 1. Modificar la tabla chatgpt_processing_log para permitir quotation_id null
    console.log('📊 Modificando tabla chatgpt_processing_log...');
    
    await query(`
      ALTER TABLE chatgpt_processing_log 
      MODIFY COLUMN quotation_id INT NULL,
      DROP FOREIGN KEY chatgpt_processing_log_ibfk_1
    `);
    console.log('✅ Foreign key constraint removida');

    // 2. Recrear la foreign key como opcional
    await query(`
      ALTER TABLE chatgpt_processing_log 
      ADD CONSTRAINT chatgpt_processing_log_ibfk_1 
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
    `);
    console.log('✅ Foreign key constraint recreada como opcional');

    // 3. Verificar la estructura actual
    const tableInfo = await query('DESCRIBE chatgpt_processing_log');
    console.log('📋 Estructura actual de chatgpt_processing_log:');
    tableInfo.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // 4. Probar inserción de log sin quotation_id
    console.log('🧪 Probando inserción de log sin quotation_id...');
    const testLogId = await query(`
      INSERT INTO chatgpt_processing_log (
        quotation_id, request_type, input_content, chatgpt_response,
        tokens_used, processing_time_ms, success, error_message
      ) VALUES (NULL, 'test', 'test input', '{"test": true}', 0, 100, false, 'test error')
    `);
    
    if (testLogId.insertId) {
      console.log('✅ Inserción de log sin quotation_id exitosa');
      
      // Limpiar el registro de prueba
      await query('DELETE FROM chatgpt_processing_log WHERE id = ?', [testLogId.insertId]);
      console.log('🧹 Registro de prueba eliminado');
    }

    console.log('✅ Corrección de errores de ChatGPT completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixChatGPTProcessingErrors()
    .then(() => {
      console.log('🎉 Proceso completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { fixChatGPTProcessingErrors };
