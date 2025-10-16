const mysql = require('mysql2/promise');

async function analyzeAllProducts() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    console.log('📦 ANÁLISIS COMPLETO DE PRODUCTOS POR CATEGORÍA');
    console.log('===============================================');

    // Consultar todos los productos de las categorías por defecto
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
        AND category IN (
          'SKARCHA NO FABRICADOS 19%', 
          'YEXIS', 
          'GENIALITY', 
          'LIQUIPOPS', 
          'MEZCLAS EN POLVO', 
          'Productos No fabricados 19%'
        )
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

    console.log('📈 RESUMEN POR CATEGORÍA:');
    Object.keys(categories).forEach(cat => {
      console.log(`  • ${cat}: ${categories[cat].length} productos`);
    });

    // Análisis específico para SKARCHAS (buscando 250G)
    if (categories['SKARCHA NO FABRICADOS 19%']) {
      console.log('\n🍰 ANÁLISIS DETALLADO - SKARCHA NO FABRICADOS 19%:');
      console.log('================================================');
      
      const skarchas = categories['SKARCHA NO FABRICADOS 19%'];
      const presentations = {};
      
      skarchas.forEach(product => {
        const name = product.product_name;
        
        // Extraer presentación más específica
        const match = name.match(/X\s*(\d+\s*G)/i);
        const presentation = match ? match[1].replace(/\s+/g, '').toUpperCase() : 'SIN_PRESENTACION';
        
        if (!presentations[presentation]) {
          presentations[presentation] = [];
        }
        presentations[presentation].push(product);
      });
      
      Object.keys(presentations).sort().forEach(pres => {
        console.log(`\n  📏 ${pres}:`);
        presentations[pres].forEach(product => {
          console.log(`    ✓ ${product.product_name}`);
          console.log(`      - Código: ${product.internal_code}`);
          console.log(`      - Stock: ${product.available_quantity}`);
          console.log(`      - Precio: $${product.standard_price}`);
        });
      });
    }

    // Análisis específico para YEXIS
    if (categories['YEXIS']) {
      console.log('\n🌟 ANÁLISIS DETALLADO - YEXIS:');
      console.log('===============================');
      
      categories['YEXIS'].forEach(product => {
        console.log(`  ✓ ${product.product_name}`);
        console.log(`    - Código: ${product.internal_code}`);
        console.log(`    - Stock: ${product.available_quantity}`);
        console.log(`    - Precio: $${product.standard_price}`);
      });
    }

    // Análisis de otras categorías
    ['MEZCLAS EN POLVO', 'Productos No fabricados 19%'].forEach(catName => {
      if (categories[catName]) {
        console.log(`\n🏭 ANÁLISIS DETALLADO - ${catName}:`);
        console.log('='.repeat(40 + catName.length));
        
        categories[catName].forEach(product => {
          console.log(`  ✓ ${product.product_name}`);
          console.log(`    - Código: ${product.internal_code}`);
          console.log(`    - Stock: ${product.available_quantity}`);
          console.log(`    - Precio: $${product.standard_price}`);
        });
      }
    });

    console.log('\n🎯 PATRONES IDENTIFICADOS PARA FRONTEND:');
    console.log('========================================');
    
    // Analizar patrones de presentación
    console.log('\n📏 PRESENTACIONES ENCONTRADAS:');
    const allPresentations = new Set();
    
    Object.keys(categories).forEach(catName => {
      categories[catName].forEach(product => {
        const name = product.product_name;
        const match = name.match(/(\d+\s*(?:GR?|ML|KG|L|G))/i);
        if (match) {
          allPresentations.add(match[1].toUpperCase().replace(/GR?$/i, 'G'));
        }
      });
    });
    
    console.log('Presentaciones únicas encontradas:');
    Array.from(allPresentations).sort().forEach(pres => {
      console.log(`  • ${pres}`);
    });

    // Analizar sabores para mejor organización
    console.log('\n🎨 SABORES IDENTIFICADOS:');
    const flavors = new Set();
    
    Object.keys(categories).forEach(catName => {
      categories[catName].forEach(product => {
        const name = product.product_name.toUpperCase();
        
        // Patrones de sabores comunes
        if (name.includes('BLUEBERRY')) flavors.add('BLUEBERRY');
        if (name.includes('CAFE')) flavors.add('CAFE');
        if (name.includes('CEREZA')) flavors.add('CEREZA');
        if (name.includes('CHAMOY')) flavors.add('CHAMOY');
        if (name.includes('CHICLE')) flavors.add('CHICLE');
        if (name.includes('COCO')) flavors.add('COCO');
        if (name.includes('FRESA')) flavors.add('FRESA');
        if (name.includes('ICE PINK')) flavors.add('ICE PINK');
        if (name.includes('LYCHE')) flavors.add('LYCHE');
        if (name.includes('MANGO BICHE')) flavors.add('MANGO BICHE');
        if (name.includes('MANZANA VERDE')) flavors.add('MANZANA VERDE');
        if (name.includes('MARACUYA')) flavors.add('MARACUYA');
        if (name.includes('SANDIA')) flavors.add('SANDIA');
        if (name.includes('TAMARINDO')) flavors.add('TAMARINDO');
        if (name.includes('VAINILLA')) flavors.add('VAINILLA');
        if (name.includes('CURAZAO')) flavors.add('CURAZAO');
        if (name.includes('CARAMELO')) flavors.add('CARAMELO');
        if (name.includes('GRANADINA')) flavors.add('GRANADINA');
        if (name.includes('ESCARCHADOR')) flavors.add('ESCARCHADOR');
      });
    });
    
    console.log('Sabores únicos encontrados:');
    Array.from(flavors).sort().forEach(flavor => {
      console.log(`  • ${flavor}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

analyzeAllProducts();
