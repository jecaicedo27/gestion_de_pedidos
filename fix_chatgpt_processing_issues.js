const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixChatGPTIssues() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Verificando estructura de chatgpt_processing_log...');
    
    // 1. Verificar estructura actual de la tabla
    const [columns] = await connection.execute(`
      SHOW CREATE TABLE chatgpt_processing_log
    `);
    console.log('Estructura actual:', columns[0]['Create Table']);

    // 2. Eliminar la restricción de foreign key problemática
    console.log('\n🔧 Eliminando restricción de foreign key problemática...');
    try {
      await connection.execute(`
        ALTER TABLE chatgpt_processing_log 
        DROP FOREIGN KEY fk_chatgpt_quotation
      `);
      console.log('✅ Foreign key eliminada');
    } catch (error) {
      console.log('⚠️ Foreign key ya no existe o tiene otro nombre');
    }

    // 3. Modificar la columna quotation_id para permitir NULL sin restricción
    console.log('\n📝 Modificando columna quotation_id...');
    await connection.execute(`
      ALTER TABLE chatgpt_processing_log 
      MODIFY COLUMN quotation_id INT NULL
    `);
    console.log('✅ Columna quotation_id modificada para permitir NULL sin restricciones');

    // 4. Verificar la tabla quotations existe
    const [quotations] = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = '${process.env.DB_NAME || 'gestion_pedidos_dev'}' 
      AND table_name = 'quotations'
    `);
    
    if (quotations[0].count > 0) {
      console.log('\n📊 Tabla quotations existe');
      
      // Verificar si hay datos
      const [quotCount] = await connection.execute(`
        SELECT COUNT(*) as total FROM quotations
      `);
      console.log(`   - Total de cotizaciones: ${quotCount[0].total}`);
    } else {
      console.log('\n⚠️ Tabla quotations no existe, creándola...');
      
      // Crear tabla quotations si no existe
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS quotations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT,
          items JSON,
          total DECIMAL(10, 2),
          status ENUM('draft', 'sent', 'accepted', 'rejected') DEFAULT 'draft',
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✅ Tabla quotations creada');
    }

    // 5. Limpiar registros huérfanos si existen
    console.log('\n🧹 Limpiando registros huérfanos...');
    const [orphans] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM chatgpt_processing_log 
      WHERE quotation_id IS NOT NULL 
      AND quotation_id NOT IN (SELECT id FROM quotations)
    `);
    
    if (orphans[0].count > 0) {
      await connection.execute(`
        UPDATE chatgpt_processing_log 
        SET quotation_id = NULL 
        WHERE quotation_id IS NOT NULL 
        AND quotation_id NOT IN (SELECT id FROM quotations)
      `);
      console.log(`✅ ${orphans[0].count} registros huérfanos actualizados`);
    } else {
      console.log('✅ No hay registros huérfanos');
    }

    // 6. Verificar estructura final
    console.log('\n📋 Estructura final de chatgpt_processing_log:');
    const [finalColumns] = await connection.execute(`
      DESCRIBE chatgpt_processing_log
    `);
    
    console.table(finalColumns.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Key: col.Key,
      Default: col.Default
    })));

    console.log('\n✅ Problemas de ChatGPT solucionados exitosamente');
    console.log('\n📝 Notas importantes:');
    console.log('1. La restricción de foreign key fue eliminada para evitar errores');
    console.log('2. El campo quotation_id ahora permite NULL sin restricciones');
    console.log('3. El sistema debería funcionar correctamente ahora');
    console.log('\n⚠️ Para el error de facturación (total de pagos), verifique:');
    console.log('   - Que el cálculo del total incluya impuestos si aplica');
    console.log('   - Que el frontend esté enviando el total correcto');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

fixChatGPTIssues();
