const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function runCompanyConfigMigration() {
  let connection;
  
  try {
    console.log('🏢 EJECUTANDO MIGRACIÓN - CONFIGURACIÓN DE EMPRESA');
    console.log('=' .repeat(60));
    
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });
    
    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'create_company_config.sql');
    const sqlContent = await fs.readFile(sqlFile, 'utf8');
    
    // Dividir por statements (punto y coma)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📄 Ejecutando ${statements.length} statements SQL...`);
    console.log('');
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.toLowerCase().includes('create table')) {
        console.log(`1️⃣ Creando tabla company_config...`);
        const [result] = await connection.execute(statement);
        console.log('   ✅ Tabla creada exitosamente');
      } else if (statement.toLowerCase().includes('insert ignore')) {
        console.log(`2️⃣ Insertando configuración inicial...`);
        const [result] = await connection.execute(statement);
        if (result.affectedRows > 0) {
          console.log('   ✅ Configuración inicial insertada');
        } else {
          console.log('   ℹ️  Configuración ya existe, no se insertó duplicado');
        }
      }
    }
    
    // Verificar la tabla creada
    console.log('');
    console.log('3️⃣ Verificando estructura de la tabla...');
    const [columns] = await connection.execute('DESCRIBE company_config');
    
    console.log('   📊 Columnas creadas:');
    columns.forEach(col => {
      console.log(`      • ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
    });
    
    // Verificar datos iniciales
    console.log('');
    console.log('4️⃣ Verificando datos iniciales...');
    const [config] = await connection.execute('SELECT * FROM company_config WHERE id = 1');
    
    if (config.length > 0) {
      console.log('   📋 Configuración inicial:');
      console.log(`      • Empresa: ${config[0].company_name}`);
      console.log(`      • NIT: ${config[0].nit}`);
      console.log(`      • Email: ${config[0].email}`);
      console.log(`      • Dirección: ${config[0].address}`);
      console.log(`      • WhatsApp: ${config[0].whatsapp}`);
      console.log(`      • Ciudad: ${config[0].city}`);
    }
    
    console.log('');
    console.log('🎯 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('');
    console.log('📋 PRÓXIMOS PASOS:');
    console.log('   1. Crear controlador backend para CRUD');
    console.log('   2. Crear rutas de API');
    console.log('   3. Actualizar frontend de configuración');
    console.log('   4. Integrar datos en guías de envío');
    
  } catch (error) {
    console.error('❌ ERROR EN MIGRACIÓN:', error.message);
    console.error('📋 Detalles:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runCompanyConfigMigration();
