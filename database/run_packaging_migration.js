const fs = require('fs');
const path = require('path');
const { query } = require('../backend/config/database');

const runPackagingMigration = async () => {
  try {
    console.log('🚀 INICIANDO MIGRACIÓN DEL SISTEMA DE EMPAQUE');
    console.log('=' .repeat(60));
    
    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'add_packaging_system.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Dividir en statements individuales
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📄 Ejecutando ${statements.length} statements SQL...`);
    
    // Ejecutar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`\n${i + 1}. Ejecutando: ${statement.substring(0, 50)}...`);
          await query(statement);
          console.log('   ✅ Ejecutado exitosamente');
        } catch (error) {
          if (error.message.includes('Duplicate entry') || error.message.includes('already exists')) {
            console.log('   ⚠️  Ya existe, saltando...');
          } else {
            console.error(`   ❌ Error: ${error.message}`);
            throw error;
          }
        }
      }
    }
    
    console.log('\n📊 VERIFICANDO MIGRACIÓN...');
    
    // Verificar que las tablas se crearon correctamente
    const tables = await query("SHOW TABLES LIKE '%packaging%'");
    console.log(`✅ Tablas de empaque creadas: ${tables.length}`);
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });
    
    // Verificar el ENUM actualizado
    const orderStructure = await query("DESCRIBE orders");
    const statusField = orderStructure.find(col => col.Field === 'status');
    console.log(`\n📋 Estado ENUM actualizado: ${statusField.Type}`);
    
    // Verificar plantillas insertadas
    const templates = await query("SELECT * FROM packaging_templates");
    console.log(`\n📦 Plantillas de empaque creadas: ${templates.length}`);
    templates.forEach(template => {
      console.log(`   - ${template.product_name} (${template.standard_weight}${template.weight_unit})`);
    });
    
    // Crear usuario de empaque de ejemplo si no existe
    console.log('\n👤 Verificando usuario de empaque...');
    const empacadores = await query("SELECT * FROM users WHERE role = 'empaque'");
    
    if (empacadores.length === 0) {
      console.log('   Creando usuario de empaque de ejemplo...');
      await query(`
        INSERT INTO users (username, full_name, email, password, role, is_active)
        VALUES ('empacador1', 'Usuario Empaque', 'empaque@empresa.com', '$2b$10$rHOGj3E4F8Rr.8nR6UJb2epQlD9Gm/x8Hn8L2d5NcT1wX3v5A6z8K', 'empaque', TRUE)
      `);
      console.log('   ✅ Usuario de empaque creado: empacador1');
    } else {
      console.log(`   ✅ Ya existen ${empacadores.length} usuarios de empaque`);
    }
    
    console.log('\n🎉 MIGRACIÓN DE EMPAQUE COMPLETADA EXITOSAMENTE');
    console.log('=' .repeat(60));
    console.log('📋 Próximos pasos:');
    console.log('   1. Reiniciar el backend para cargar nuevas rutas');
    console.log('   2. Actualizar frontend con páginas de empaque');
    console.log('   3. Configurar roles de usuario en la aplicación');
    console.log('   4. Entrenar al personal de empaque en el nuevo sistema');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
};

// Ejecutar migración
runPackagingMigration()
  .then(() => {
    console.log('\n✅ Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
