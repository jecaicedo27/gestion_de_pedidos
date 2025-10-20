const { query } = require('./backend/config/database');

async function fixChatGPTForeignKeyConstraint() {
  console.log('🔧 Iniciando corrección completa de restricción de clave foránea ChatGPT...');
  
  try {
    // 1. Primero verificar la estructura actual
    console.log('🔍 Verificando estructura actual de la tabla...');
    const tableStructure = await query('DESCRIBE chatgpt_processing_log');
    console.log('📋 Estructura actual:', tableStructure.map(col => `${col.Field} - ${col.Type} - NULL: ${col.Null}`));
    
    // 2. Eliminar la restricción de clave foránea actual si existe
    console.log('🗑️ Eliminando restricción de clave foránea existente...');
    try {
      await query('ALTER TABLE chatgpt_processing_log DROP FOREIGN KEY chatgpt_processing_log_ibfk_1');
      console.log('✅ Restricción eliminada exitosamente');
    } catch (error) {
      console.log('ℹ️ Restricción no existía o ya fue eliminada:', error.message);
    }
    
    // 3. Modificar la columna quotation_id para permitir NULL
    console.log('🔄 Modificando columna quotation_id para permitir NULL...');
    await query('ALTER TABLE chatgpt_processing_log MODIFY COLUMN quotation_id INT NULL');
    console.log('✅ Columna quotation_id modificada para permitir NULL');
    
    // 4. Añadir columnas nuevas si no existen
    console.log('➕ Verificando y añadiendo nuevas columnas...');
    
    // Verificar si processing_session_id existe
    const hasSessionId = tableStructure.some(col => col.Field === 'processing_session_id');
    if (!hasSessionId) {
      await query('ALTER TABLE chatgpt_processing_log ADD COLUMN processing_session_id VARCHAR(100) DEFAULT NULL');
      console.log('✅ Columna processing_session_id añadida');
    } else {
      console.log('ℹ️ Columna processing_session_id ya existe');
    }
    
    // Verificar si request_source existe
    const hasRequestSource = tableStructure.some(col => col.Field === 'request_source');
    if (!hasRequestSource) {
      await query('ALTER TABLE chatgpt_processing_log ADD COLUMN request_source VARCHAR(50) DEFAULT "api"');
      console.log('✅ Columna request_source añadida');
    } else {
      console.log('ℹ️ Columna request_source ya existe');
    }
    
    // 5. Limpiar registros con quotation_id inválidos
    console.log('🧹 Limpiando registros con quotation_id inválidos...');
    const invalidRecords = await query(`
      SELECT COUNT(*) as count FROM chatgpt_processing_log 
      WHERE quotation_id IS NOT NULL 
      AND quotation_id NOT IN (SELECT id FROM quotations)
    `);
    
    if (invalidRecords[0].count > 0) {
      console.log(`⚠️ Encontrados ${invalidRecords[0].count} registros con quotation_id inválidos`);
      await query(`
        UPDATE chatgpt_processing_log 
        SET quotation_id = NULL 
        WHERE quotation_id IS NOT NULL 
        AND quotation_id NOT IN (SELECT id FROM quotations)
      `);
      console.log('✅ Registros inválidos corregidos (quotation_id establecido como NULL)');
    } else {
      console.log('✅ No hay registros con quotation_id inválidos');
    }
    
    // 6. Recrear la restricción de clave foránea con ON DELETE SET NULL
    console.log('🔗 Recreando restricción de clave foránea con SET NULL...');
    await query(`
      ALTER TABLE chatgpt_processing_log 
      ADD CONSTRAINT chatgpt_processing_log_ibfk_1 
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) 
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
    console.log('✅ Nueva restricción de clave foránea creada con ON DELETE SET NULL');
    
    // 7. Añadir índices para optimización
    console.log('📊 Añadiendo índices de rendimiento...');
    try {
      await query('CREATE INDEX idx_chatgpt_quotation_id ON chatgpt_processing_log(quotation_id)');
      console.log('✅ Índice en quotation_id creado');
    } catch (error) {
      console.log('ℹ️ Índice ya existe o no pudo crearse:', error.message);
    }
    
    try {
      await query('CREATE INDEX idx_chatgpt_session_id ON chatgpt_processing_log(processing_session_id)');
      console.log('✅ Índice en processing_session_id creado');
    } catch (error) {
      console.log('ℹ️ Índice ya existe o no pudo crearse:', error.message);
    }
    
    // 8. Verificar la estructura final
    console.log('🔍 Verificando estructura final...');
    const finalStructure = await query('DESCRIBE chatgpt_processing_log');
    console.log('📋 Estructura final:');
    finalStructure.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} - NULL: ${col.Null} - Default: ${col.Default}`);
    });
    
    // 9. Probar inserción con quotation_id nulo
    console.log('🧪 Probando inserción con quotation_id NULL...');
    const testSessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await query(`
      INSERT INTO chatgpt_processing_log (
        quotation_id, processing_session_id, request_source, request_type, 
        input_content, chatgpt_response, tokens_used, processing_time_ms, 
        success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      null, // quotation_id nulo para prueba
      testSessionId,
      'test',
      'text',
      'Test de inserción con quotation_id NULL',
      JSON.stringify({ test: true }),
      0,
      100,
      true,
      null
    ]);
    
    // Verificar que se insertó correctamente
    const testRecord = await query('SELECT * FROM chatgpt_processing_log WHERE processing_session_id = ?', [testSessionId]);
    if (testRecord.length > 0) {
      console.log('✅ Prueba de inserción exitosa - quotation_id NULL permitido');
      
      // Limpiar registro de prueba
      await query('DELETE FROM chatgpt_processing_log WHERE processing_session_id = ?', [testSessionId]);
      console.log('🧹 Registro de prueba eliminado');
    } else {
      throw new Error('No se pudo insertar registro de prueba');
    }
    
    console.log('\n🎉 ¡CORRECCIÓN COMPLETA EXITOSA!');
    console.log('✅ La tabla chatgpt_processing_log ahora permite quotation_id NULL');
    console.log('✅ Restricción de clave foránea configurada con ON DELETE SET NULL');
    console.log('✅ Columnas adicionales añadidas para mejor tracking');
    console.log('✅ Índices de rendimiento creados');
    console.log('\n📝 Ahora el ChatGPT Service puede guardar logs sin quotation_id válido');
    
  } catch (error) {
    console.error('❌ Error en la corrección:', error);
    throw error;
  }
}

// Ejecutar la corrección
fixChatGPTForeignKeyConstraint()
  .then(() => {
    console.log('🏁 Script completado exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
