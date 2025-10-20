const { query } = require('./backend/config/database');

async function fixChatGPTForeignKeyConstraint() {
  console.log('🔧 Corrigiendo constraint de clave foránea en chatgpt_processing_log...\n');

  try {
    // PASO 1: Verificar la estructura actual de la tabla
    console.log('📊 1. Verificando estructura de chatgpt_processing_log...');
    
    const tableExists = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'gestion_pedidos_dev' 
      AND table_name = 'chatgpt_processing_log'
    `);

    if (tableExists[0].count === 0) {
      console.log('   ℹ️ La tabla chatgpt_processing_log no existe, creándola...');
      
      await query(`
        CREATE TABLE chatgpt_processing_log (
          id INT PRIMARY KEY AUTO_INCREMENT,
          quotation_id INT NULL,
          processing_id VARCHAR(255),
          original_request TEXT,
          processed_response TEXT,
          tokens_used INT DEFAULT 0,
          processing_time_ms INT DEFAULT 0,
          success BOOLEAN DEFAULT TRUE,
          error_message TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);
      
      console.log('   ✅ Tabla chatgpt_processing_log creada exitosamente');
      return;
    }

    // PASO 2: Verificar si hay constraint problemático
    console.log('📊 2. Verificando constraints existentes...');
    
    const constraints = await query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE table_schema = 'gestion_pedidos_dev' 
      AND table_name = 'chatgpt_processing_log'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    console.log(`   ℹ️ Encontrados ${constraints.length} constraints de clave foránea`);

    // PASO 3: Eliminar constraint problemático si existe
    for (let constraint of constraints) {
      if (constraint.CONSTRAINT_NAME.includes('chatgpt_processing_log_ibfk_1')) {
        console.log(`   🔧 Eliminando constraint problemático: ${constraint.CONSTRAINT_NAME}`);
        
        await query(`
          ALTER TABLE chatgpt_processing_log 
          DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
        `);
        
        console.log('   ✅ Constraint problemático eliminado');
      }
    }

    // PASO 4: Limpiar registros con quotation_id inválidos
    console.log('🧹 3. Limpiando registros con quotation_id inválidos...');
    
    const invalidRecords = await query(`
      SELECT COUNT(*) as count
      FROM chatgpt_processing_log cpl
      WHERE cpl.quotation_id IS NOT NULL 
      AND cpl.quotation_id NOT IN (SELECT id FROM quotations)
    `);

    if (invalidRecords[0].count > 0) {
      console.log(`   ⚠️ Encontrados ${invalidRecords[0].count} registros con quotation_id inválidos`);
      
      await query(`
        UPDATE chatgpt_processing_log 
        SET quotation_id = NULL 
        WHERE quotation_id IS NOT NULL 
        AND quotation_id NOT IN (SELECT id FROM quotations)
      `);
      
      console.log('   ✅ Registros con quotation_id inválidos actualizados a NULL');
    } else {
      console.log('   ✅ No se encontraron registros con quotation_id inválidos');
    }

    // PASO 5: Recrear constraint con configuración correcta
    console.log('🔧 4. Recreando constraint con configuración segura...');
    
    await query(`
      ALTER TABLE chatgpt_processing_log 
      ADD CONSTRAINT fk_chatgpt_quotation
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) 
      ON DELETE SET NULL 
      ON UPDATE CASCADE
    `);
    
    console.log('   ✅ Nuevo constraint creado: fk_chatgpt_quotation');

    // PASO 6: Verificar que todo funcione correctamente
    console.log('🧪 5. Verificando funcionamiento del constraint...');
    
    const testConstraints = await query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME,
        DELETE_RULE,
        UPDATE_RULE
      FROM information_schema.REFERENTIAL_CONSTRAINTS rc
      JOIN information_schema.KEY_COLUMN_USAGE kcu 
        ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE rc.CONSTRAINT_SCHEMA = 'gestion_pedidos_dev' 
      AND rc.TABLE_NAME = 'chatgpt_processing_log'
    `);

    if (testConstraints.length > 0) {
      console.log('   ✅ Constraint verificado exitosamente:');
      testConstraints.forEach(constraint => {
        console.log(`      • ${constraint.CONSTRAINT_NAME}: ${constraint.DELETE_RULE}/${constraint.UPDATE_RULE}`);
      });
    }

    console.log('\n🎯 Corrección completada exitosamente:');
    console.log('   • Constraint de clave foránea corregido');
    console.log('   • quotation_id puede ser NULL (opcional)');
    console.log('   • ON DELETE SET NULL para evitar errores');
    console.log('   • ON UPDATE CASCADE para mantener consistencia');
    console.log('   • ChatGPT puede funcionar sin quotation_id específico');

  } catch (error) {
    console.error('❌ Error corrigiendo constraint:', error.message);
    
    // Solución de respaldo: hacer quotation_id opcional
    try {
      console.log('\n🆘 Aplicando solución de respaldo...');
      
      await query(`
        ALTER TABLE chatgpt_processing_log 
        MODIFY quotation_id INT NULL
      `);
      
      console.log('   ✅ quotation_id configurado como opcional (NULL)');
    } catch (backupError) {
      console.error('   ❌ Error en solución de respaldo:', backupError.message);
    }
  }
}

// Ejecutar la corrección
fixChatGPTForeignKeyConstraint()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });
