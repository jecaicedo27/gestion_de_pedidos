const mysql = require('mysql2/promise');

console.log('🔍 INVESTIGACIÓN DIRECTA DE LA BASE DE DATOS DE PRODUCTOS');
console.log('=======================================================\n');

async function investigateProductsDatabase() {
  let connection;
  
  try {
    // Crear conexión directa a MySQL
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev',
      port: 3306
    });
    
    console.log('✅ Conexión a MySQL establecida\n');
    
    // 1. Verificar estructura de la tabla
    console.log('🔍 1. VERIFICANDO ESTRUCTURA DE LA TABLA PRODUCTS');
    console.log('================================================');
    const [structure] = await connection.execute('DESCRIBE products');
    console.log('Columnas en la tabla products:');
    structure.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // 2. Contar total de productos
    console.log('\n🔍 2. CONTANDO PRODUCTOS EN LA BASE DE DATOS');
    console.log('===========================================');
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM products');
    const totalProducts = countResult[0].total;
    console.log(`📊 Total de productos en BD: ${totalProducts}`);
    
    if (totalProducts === 0) {
      console.log('❌ NO HAY PRODUCTOS EN LA BASE DE DATOS');
      console.log('   El script de carga pudo haber fallado silenciosamente');
      return;
    }
    
    // 3. Verificar productos con nombres válidos
    console.log('\n🔍 3. VERIFICANDO CALIDAD DE LOS DATOS');
    console.log('=====================================');
    
    const [validNames] = await connection.execute(
      'SELECT COUNT(*) as count FROM products WHERE name IS NOT NULL AND name != "" AND name != "undefined"'
    );
    const [nullNames] = await connection.execute(
      'SELECT COUNT(*) as count FROM products WHERE name IS NULL OR name = "" OR name = "undefined"'
    );
    
    console.log(`✅ Productos con nombres válidos: ${validNames[0].count}`);
    console.log(`❌ Productos con nombres inválidos: ${nullNames[0].count}`);
    
    // 4. Mostrar ejemplos de productos
    console.log('\n🔍 4. EJEMPLOS DE PRODUCTOS EN LA BASE DE DATOS');
    console.log('==============================================');
    
    const [samples] = await connection.execute(
      'SELECT id, name, code, siigo_id FROM products LIMIT 10'
    );
    
    if (samples.length > 0) {
      console.log('Primeros 10 productos:');
      samples.forEach(product => {
        console.log(`  ID: ${product.id}, Nombre: "${product.name}", Código: "${product.code}", SIIGO: ${product.siigo_id}`);
      });
    } else {
      console.log('❌ No se encontraron productos');
    }
    
    // 5. Buscar productos específicos que deberían existir
    console.log('\n🔍 5. BUSCANDO PRODUCTOS ESPECÍFICOS');
    console.log('==================================');
    
    const searches = ['liqui', 'pop', 'fresa'];
    for (const search of searches) {
      const [results] = await connection.execute(
        'SELECT id, name, code FROM products WHERE name LIKE ? LIMIT 3',
        [`%${search}%`]
      );
      
      console.log(`\n🔍 Búsqueda "${search}": ${results.length} productos encontrados`);
      if (results.length > 0) {
        results.forEach(product => {
          console.log(`  - "${product.name}" (ID: ${product.id}, Code: ${product.code})`);
        });
      }
    }
    
    // 6. Verificar si hay problemas de codificación
    console.log('\n🔍 6. VERIFICANDO PROBLEMAS DE CODIFICACIÓN');
    console.log('==========================================');
    
    const [charset] = await connection.execute('SHOW TABLE STATUS WHERE Name = "products"');
    if (charset.length > 0) {
      console.log(`Charset de la tabla: ${charset[0].Collation}`);
    }
    
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    console.error('📋 Detalles:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Conexión cerrada');
    }
  }
}

investigateProductsDatabase().catch(error => {
  console.error('❌ Error crítico:', error.message);
});
