const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugCategoriesTable() {
  let connection;
  
  try {
    console.log('🔄 Conectando a la base de datos...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    });
    
    console.log('✅ Conexión establecida');
    
    // Verificar si la tabla categories existe
    console.log('\n📋 Verificando si la tabla categories existe...');
    
    try {
      const [tables] = await connection.execute("SHOW TABLES LIKE 'categories'");
      
      if (tables.length === 0) {
        console.log('❌ La tabla categories NO existe');
        console.log('🔧 Creando tabla categories...');
        
        const createTableQuery = `
          CREATE TABLE categories (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL UNIQUE,
            is_active TINYINT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `;
        
        await connection.execute(createTableQuery);
        console.log('✅ Tabla categories creada exitosamente');
        
        // Insertar las categorías conocidas
        console.log('📝 Insertando categorías conocidas...');
        
        const categories = [
          'GENIALITY',
          'LIQUIPOPS',
          'MEZCLAS EN POLVO',
          'Productos No fabricados 19%',
          'YEXIS',
          'SKARCHA NO FABRICADOS 19%'
        ];
        
        for (const category of categories) {
          try {
            await connection.execute(
              'INSERT INTO categories (name) VALUES (?)',
              [category]
            );
            console.log(`✅ Categoría insertada: ${category}`);
          } catch (error) {
            console.log(`⚠️ Error insertando ${category}:`, error.message);
          }
        }
        
      } else {
        console.log('✅ La tabla categories SÍ existe');
        
        // Mostrar estructura de la tabla
        const [structure] = await connection.execute('DESCRIBE categories');
        console.log('\n📋 Estructura de la tabla categories:');
        structure.forEach(field => {
          console.log(`  ${field.Field}: ${field.Type} ${field.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${field.Key} ${field.Default || ''} ${field.Extra || ''}`);
        });
        
        // Mostrar contenido actual
        const [rows] = await connection.execute('SELECT * FROM categories ORDER BY name');
        console.log(`\n📊 Categorías actuales en la tabla (${rows.length} registros):`);
        
        if (rows.length === 0) {
          console.log('❌ La tabla categories está VACÍA');
          console.log('📝 Insertando categorías conocidas...');
          
          const categories = [
            'GENIALITY',
            'LIQUIPOPS', 
            'MEZCLAS EN POLVO',
            'Productos No fabricados 19%',
            'YEXIS',
            'SKARCHA NO FABRICADOS 19%'
          ];
          
          for (const category of categories) {
            try {
              await connection.execute(
                'INSERT INTO categories (name) VALUES (?)',
                [category]
              );
              console.log(`✅ Categoría insertada: ${category}`);
            } catch (error) {
              console.log(`⚠️ Error insertando ${category}:`, error.message);
            }
          }
        } else {
          rows.forEach((row, index) => {
            console.log(`  ${index + 1}. ${row.name} (activa: ${row.is_active ? 'Sí' : 'No'})`);
          });
        }
      }
      
      // Verificar si el endpoint debería funcionar ahora
      console.log('\n🧪 Probando query que usa el endpoint...');
      const [testRows] = await connection.execute(`
        SELECT name 
        FROM categories 
        WHERE is_active = 1
        ORDER BY name ASC
      `);
      
      console.log(`✅ Query del endpoint devolvería ${testRows.length} categorías:`);
      testRows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.name}`);
      });
      
    } catch (error) {
      console.error('❌ Error verificando tabla categories:', error);
    }
    
  } catch (error) {
    console.error('❌ Error de conexión a la base de datos:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔐 Conexión cerrada');
    }
  }
}

debugCategoriesTable();
