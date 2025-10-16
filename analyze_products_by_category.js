const mysql = require('mysql2/promise');

async function analyzeProducts() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    console.log('📦 ANALIZANDO PRODUCTOS ACTIVOS POR CATEGORÍA');
    console.log('==============================================');

    const query = `
      SELECT 
        id,
        product_name,
        category,
        siigo_code,
        internal_code,
        product_code,
        available_quantity,
        standard_price,
        is_active
      FROM products 
      WHERE is_active = 1 
        AND category IN ('SKARCHA NO FABRICADOS 19%', 'YEXIS', 'GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%')
      ORDER BY category, product_name;
    `;

    const [results] = await connection.execute(query);
    
    console.log(`\n📊 TOTAL: ${results.length} productos encontrados\n`);
    
    // Agrupar por categoría
    const categories = {};
    results.forEach(product => {
      if (!categories[product.category]) {
        categories[product.category] = [];
      }
      categories[product.category].push(product);
    });

    // Mostrar por categoría
    Object.keys(categories).forEach(cat => {
      console.log(`\n🏷️ ${cat} (${categories[cat].length} productos):`);
      console.log('-------------------------------------------');
      
      categories[cat].forEach(product => {
        console.log(`  ID: ${product.id}`);
        console.log(`  Nombre: ${product.product_name}`);
        console.log(`  Código SIIGO: ${product.siigo_code || 'N/A'}`);
        console.log(`  Código Interno: ${product.internal_code || product.product_code || 'N/A'}`);
        console.log(`  Stock: ${product.available_quantity || 0}`);
        console.log(`  Precio: $${product.standard_price || 0}`);
        console.log(`  ---`);
      });
    });

    console.log('\n📈 RESUMEN POR CATEGORÍA:');
    Object.keys(categories).forEach(cat => {
      console.log(`  • ${cat}: ${categories[cat].length} productos`);
    });

    console.log('\n🔍 ANÁLISIS DE PRESENTACIONES:');
    Object.keys(categories).forEach(cat => {
      console.log(`\n${cat}:`);
      const presentations = {};
      
      categories[cat].forEach(product => {
        const name = product.product_name;
        
        // Extraer presentación
        const match = name.match(/(\d+\s*(?:GR|ML|KG|L))/i);
        const presentation = match ? match[1].toUpperCase() : 'SIN_PRESENTACION';
        
        if (!presentations[presentation]) {
          presentations[presentation] = [];
        }
        presentations[presentation].push(product.product_name);
      });
      
      Object.keys(presentations).forEach(pres => {
        console.log(`  ${pres}: ${presentations[pres].length} productos`);
        presentations[pres].forEach(name => {
          console.log(`    - ${name}`);
        });
      });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

analyzeProducts();
