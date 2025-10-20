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

    // Usar los nombres correctos de columnas
    const query = `
      SELECT 
        id,
        product_name,
        category,
        internal_code,
        siigo_id,
        available_quantity,
        standard_price,
        is_active
      FROM products 
      WHERE is_active = 1 
        AND category IN ('SKARCHA NO FABRICADOS 19%', 'YEXIS', 'GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%')
      ORDER BY category, product_name
      LIMIT 50;
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
        console.log(`  Código Interno: ${product.internal_code || 'N/A'}`);
        console.log(`  SIIGO ID: ${product.siigo_id || 'N/A'}`);
        console.log(`  Stock: ${product.available_quantity || 0}`);
        console.log(`  Precio: $${product.standard_price || 0}`);
        console.log(`  ---`);
      });
    });

    console.log('\n📈 RESUMEN POR CATEGORÍA:');
    Object.keys(categories).forEach(cat => {
      console.log(`  • ${cat}: ${categories[cat].length} productos`);
    });

    console.log('\n🔍 ANÁLISIS DE PRESENTACIONES ACTUALES:');
    Object.keys(categories).forEach(cat => {
      console.log(`\n${cat}:`);
      const presentations = {};
      
      categories[cat].forEach(product => {
        const name = product.product_name;
        
        // Extraer presentación usando regex mejorada
        const match = name.match(/(\d+\s*(?:GR?|ML|KG|L|G))/i);
        const presentation = match ? match[1].toUpperCase().replace(/GR?$/i, 'G') : 'SIN_PRESENTACION';
        
        if (!presentations[presentation]) {
          presentations[presentation] = [];
        }
        presentations[presentation].push({
          name: product.product_name,
          internal_code: product.internal_code
        });
      });
      
      Object.keys(presentations).forEach(pres => {
        console.log(`  📏 ${pres}: ${presentations[pres].length} productos`);
        presentations[pres].forEach(item => {
          console.log(`    - ${item.name} (${item.internal_code})`);
        });
      });
    });

    console.log('\n🎯 RECOMENDACIONES PARA MEJORAR ORGANIZACIÓN:');
    console.log('================================================');
    
    // Analizar patrones específicos
    if (categories['SKARCHA NO FABRICADOS 19%']) {
      console.log('\n📋 SKARCHAS - Patrones encontrados:');
      categories['SKARCHA NO FABRICADOS 19%'].forEach(product => {
        const name = product.product_name;
        
        // Extraer sabor
        const flavorMatch = name.match(/AZUCAR\s+([A-Z\s]+)\s+X\s+\d+/i);
        const flavor = flavorMatch ? flavorMatch[1].trim() : 'SABOR_NO_IDENTIFICADO';
        
        // Extraer presentación
        const presMatch = name.match(/X\s+(\d+\s*G)/i);
        const presentation = presMatch ? presMatch[1].replace(/\s+/g, '') : 'PRES_NO_IDENTIFICADA';
        
        console.log(`  • ${flavor} - ${presentation} → "${name}"`);
      });
    }

    if (categories['YEXIS']) {
      console.log('\n📋 YEXIS - Patrones encontrados:');
      categories['YEXIS'].forEach(product => {
        const name = product.product_name;
        console.log(`  • ${name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

analyzeProducts();
