const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔍 Depurando error 500 en endpoints de categorías...\n');

async function debugCategoriesError() {
  let connection;
  
  try {
    // Test 1: Database connection
    console.log('1. ⚡ Testeando conexión a la base de datos...');
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    };
    
    console.log('📋 Configuración DB:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      password: dbConfig.password ? '***' : 'EMPTY'
    });

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a MySQL exitosa\n');

    // Test 2: Check if categories table exists
    console.log('2. 🔍 Verificando existencia de tabla categories...');
    const [tables] = await connection.execute("SHOW TABLES LIKE 'categories'");
    
    if (tables.length === 0) {
      console.log('❌ La tabla "categories" NO EXISTE');
      console.log('💡 Esto explicaría el error 500');
      return;
    }
    
    console.log('✅ Tabla "categories" existe\n');

    // Test 3: Check table structure
    console.log('3. 📊 Verificando estructura de tabla categories...');
    const [columns] = await connection.execute("DESCRIBE categories");
    console.log('📋 Columnas encontradas:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log();

    // Test 4: Check if data exists
    console.log('4. 📦 Verificando datos en tabla categories...');
    const [countResult] = await connection.execute("SELECT COUNT(*) as total FROM categories");
    const totalRecords = countResult[0].total;
    console.log(`📊 Total de registros: ${totalRecords}\n`);

    if (totalRecords === 0) {
      console.log('⚠️  La tabla categories está VACÍA');
      console.log('💡 Esto podría causar problemas en el frontend');
    }

    // Test 5: Test the actual query used in the backend
    console.log('5. 🔍 Ejecutando consulta exacta del backend...');
    const backendQuery = `
      SELECT name 
      FROM categories 
      WHERE is_active = 1
      ORDER BY name ASC
    `;
    
    try {
      const [results] = await connection.execute(backendQuery);
      console.log(`✅ Consulta ejecutada exitosamente`);
      console.log(`📊 Registros encontrados: ${results.length}`);
      
      if (results.length > 0) {
        console.log('📋 Primeras 5 categorías:');
        results.slice(0, 5).forEach((row, index) => {
          console.log(`  ${index + 1}. ${row.name}`);
        });
      }
      console.log();
      
    } catch (queryError) {
      console.log('❌ Error ejecutando consulta del backend:', queryError.message);
      console.log('📄 Stack:', queryError.stack);
      return;
    }

    // Test 6: Test the database module
    console.log('6. 🧪 Testeando módulo database.js...');
    try {
      const db = require('./backend/config/database');
      console.log('✅ Módulo database.js cargado correctamente');
      
      // Test the query function directly
      const testResults = await db.query(backendQuery);
      console.log(`✅ db.query() funcionando: ${testResults.length} resultados`);
      console.log();
      
    } catch (moduleError) {
      console.log('❌ Error en módulo database.js:', moduleError.message);
      console.log('📄 Stack:', moduleError.stack);
      return;
    }

    // Test 7: Test backend route simulation
    console.log('7. 🎭 Simulando lógica del endpoint backend...');
    try {
      const db = require('./backend/config/database');
      
      const query = `
        SELECT name 
        FROM categories 
        WHERE is_active = 1
        ORDER BY name ASC
      `;

      const results = await db.query(query);
      const categories = results.map(row => row.name);
      
      console.log(`✅ Simulación exitosa: ${categories.length} categorías`);
      console.log('📋 Resultado simulado:', categories.slice(0, 5));
      console.log();
      
    } catch (simulationError) {
      console.log('❌ Error en simulación del endpoint:', simulationError.message);
      console.log('📄 Stack:', simulationError.stack);
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error('📄 Stack completo:', error.stack);
    
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

debugCategoriesError();
