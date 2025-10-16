const mysql = require('mysql2/promise');

async function addMissing1100GrProducts() {
  console.log('🔧 ADDING MISSING 1100 GR PRODUCTS 🔧');
  console.log('=====================================\n');

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    // Check current 1100 GR products
    const [existing1100] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE category = 'LIQUIPOPS' AND product_name LIKE '%1100 GR%'
    `);
    
    console.log(`Current 1100 GR products: ${existing1100[0].count}`);

    if (existing1100[0].count < 14) {
      console.log('\n=== ADDING 1100 GR LIQUIPOPS PRODUCTS ===');
      
      // Clear any existing products to avoid duplicates
      await connection.execute("DELETE FROM products WHERE category = 'LIQUIPOPS' AND product_name LIKE '%1100 GR%'");
      
      const products1100GR = [
        ['LIQUIPOP BLUEBERRY 1100 GR', 'LIQUIPOPS', 'BLUEBERRY', 248, 248, 15000, 'LIQUIPP01'],
        ['LIQUIPOP CAFE 1100 GR', 'LIQUIPOPS', 'CAFE', 64, 64, 15000, 'LIQUIPP02'],
        ['LIQUIPOP CEREZA 1100 GR', 'LIQUIPOPS', 'CEREZA', 339, 339, 15000, 'LIQUIPP03'],
        ['LIQUIPOP CHAMOY 1100 GR', 'LIQUIPOPS', 'CHAMOY', 245, 245, 15000, 'LIQUIPP04'],
        ['LIQUIPOP CHICLE 1100 GR', 'LIQUIPOPS', 'CHICLE', 235, 235, 15000, 'LIQUIPP05'],
        ['LIQUIPOP COCO 1100 GR', 'LIQUIPOPS', 'COCO', 27, 27, 15000, 'LIQUIPP06'],
        ['LIQUIPOP FRESA 1100 GR', 'LIQUIPOPS', 'FRESA', 215, 215, 15000, 'LIQUIPP07'],
        ['LIQUIPOP ICE PINK 1100 GR', 'LIQUIPOPS', 'ICE PINK', 215, 215, 15000, 'LIQUIPP08'],
        ['LIQUIPOP LYCHEE 1100 GR', 'LIQUIPOPS', 'LYCHE', 274, 274, 15000, 'LIQUIPP09'],
        ['LIQUIPOP MANGO BICHE 1100 GR', 'LIQUIPOPS', 'MANGO BICHE', 21, 21, 15000, 'LIQUIPP10'],
        ['LIQUIPOP MANGO BICHE CON SAL 1100 GR', 'LIQUIPOPS', 'MANGO BICHE CON SAL', 0, 0, 15000, 'LIQUIPP11'],
        ['LIQUIPOP MANZANA VERDE 1100 GR', 'LIQUIPOPS', 'MANZANA VERDE', 251, 251, 15000, 'LIQUIPP12'],
        ['LIQUIPOP MARACUYA 1100 GR', 'LIQUIPOPS', 'MARACUYA', 250, 250, 15000, 'LIQUIPP13'],
        ['LIQUIPOP SANDIA 1100 GR', 'LIQUIPOPS', 'SANDIA', 218, 218, 15000, 'LIQUIPP14']
      ];

      console.log(`Adding ${products1100GR.length} x 1100 GR products...`);

      const insertQuery = `
        INSERT INTO products (product_name, category, subcategory, stock, available_quantity, standard_price, siigo_id, last_sync_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      for (const product of products1100GR) {
        await connection.execute(insertQuery, product);
      }

      console.log('✅ 1100 GR products added successfully!');
    }

    // Final verification - show all presentations with proper stock levels
    console.log('\n=== FINAL VERIFICATION ===');
    const [allProducts] = await connection.execute(`
      SELECT 
        CASE 
          WHEN product_name LIKE '%1100 GR%' THEN '1100 GR'
          WHEN product_name LIKE '%2300 GR%' THEN '2300 GR' 
          WHEN product_name LIKE '%3400 GR%' THEN '3400 GR'
          WHEN product_name LIKE '%350 GR%' THEN '350 GR'
          ELSE 'Other'
        END as presentation,
        COUNT(*) as count,
        AVG(available_quantity) as avg_stock,
        MIN(available_quantity) as min_stock,
        MAX(available_quantity) as max_stock
      FROM products 
      WHERE category = 'LIQUIPOPS'
      GROUP BY presentation
      ORDER BY presentation
    `);

    console.log('\nComplete inventory by presentation:');
    allProducts.forEach(p => {
      const stockLevel = p.avg_stock > 50 ? '🟢' : p.avg_stock > 10 ? '🟡' : '🔴';
      console.log(`${stockLevel} ${p.presentation}: ${p.count} products (${p.min_stock}-${p.max_stock} stock)`);
    });

    // Show sample products from each presentation
    console.log('\n=== SAMPLE PRODUCTS BY PRESENTATION ===');
    const [samples] = await connection.execute(`
      SELECT 
        product_name,
        CASE 
          WHEN product_name LIKE '%1100 GR%' THEN '1100 GR'
          WHEN product_name LIKE '%2300 GR%' THEN '2300 GR' 
          WHEN product_name LIKE '%3400 GR%' THEN '3400 GR'
          WHEN product_name LIKE '%350 GR%' THEN '350 GR'
          ELSE 'Other'
        END as presentation,
        subcategory,
        available_quantity as stock
      FROM products 
      WHERE category = 'LIQUIPOPS'
      ORDER BY presentation, subcategory
      LIMIT 20
    `);

    let currentPresentation = '';
    samples.forEach(product => {
      if (product.presentation !== currentPresentation) {
        currentPresentation = product.presentation;
        console.log(`\n${currentPresentation}:`);
      }
      const stockColor = product.stock > 50 ? '🟢' : product.stock > 10 ? '🟡' : '🔴';
      console.log(`  ${stockColor} ${product.subcategory}: ${product.stock}`);
    });

    console.log('\n🎉 Complete LIQUIPOPS inventory is now ready!');
    console.log('\nNext steps:');
    console.log('1. Refresh the frontend browser page');
    console.log('2. Navigate to "Inventario + Facturación"');
    console.log('3. You should now see the full inventory table with proper colors');

  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

// Run the fix
addMissing1100GrProducts();
