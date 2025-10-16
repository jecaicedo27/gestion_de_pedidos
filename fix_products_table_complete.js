const mysql = require('mysql2/promise');

async function fixProductsTableComplete() {
  console.log('🔧 FIXING PRODUCTS TABLE COMPLETELY 🔧');
  console.log('======================================\n');

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    // Check current table structure
    console.log('=== CHECKING CURRENT TABLE STRUCTURE ===');
    const [columns] = await connection.execute('DESCRIBE products');
    console.log('Current columns:');
    columns.forEach(col => console.log(`- ${col.Field}: ${col.Type}`));
    
    const columnNames = columns.map(col => col.Field);
    
    // Add missing columns
    const requiredColumns = [
      { name: 'subcategory', type: 'VARCHAR(100)' },
      { name: 'available_quantity', type: 'INT DEFAULT 0' },
      { name: 'siigo_id', type: 'VARCHAR(50)' },
      { name: 'last_sync_at', type: 'TIMESTAMP NULL' }
    ];
    
    console.log('\n=== ADDING MISSING COLUMNS ===');
    for (const col of requiredColumns) {
      if (!columnNames.includes(col.name)) {
        console.log(`Adding column: ${col.name}`);
        await connection.execute(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`);
      } else {
        console.log(`✅ Column ${col.name} already exists`);
      }
    }
    
    // Clear existing LIQUIPOPS data to start fresh
    await connection.execute("DELETE FROM products WHERE category = 'LIQUIPOPS'");
    console.log('\n=== CLEARED EXISTING LIQUIPOPS DATA ===');
    
    // Add complete LIQUIPOPS inventory
    console.log('\n=== ADDING COMPLETE LIQUIPOPS INVENTORY ===');
    
    const completeInventory = [
      // 1100 GR products (main row)
      ['LIQUIPOP BLUEBERRY 1100 GR', 'LIQUIPOPS', 'BLUEBERRY', 248, 15000, 'LIQUIPP01', '7702094001018'],
      ['LIQUIPOP CAFE 1100 GR', 'LIQUIPOPS', 'CAFE', 0, 15000, 'LIQUIPP02', '7702094001025'],  // Red
      ['LIQUIPOP CEREZA 1100 GR', 'LIQUIPOPS', 'CEREZA', 64, 15000, 'LIQUIPP03', '7702094001032'],
      ['LIQUIPOP CHAMOY 1100 GR', 'LIQUIPOPS', 'CHAMOY', 339, 15000, 'LIQUIPP04', '7702094001049'],
      ['LIQUIPOP CHICLE 1100 GR', 'LIQUIPOPS', 'CHICLE', 245, 15000, 'LIQUIPP05', '7702094001056'],
      ['LIQUIPOP COCO 1100 GR', 'LIQUIPOPS', 'COCO', 235, 15000, 'LIQUIPP06', '7702094001063'],
      ['LIQUIPOP FRESA 1100 GR', 'LIQUIPOPS', 'FRESA', 27, 15000, 'LIQUIPP07', '7702094001070'],
      ['LIQUIPOP ICE PINK 1100 GR', 'LIQUIPOPS', 'ICE PINK', 215, 15000, 'LIQUIPP08', '7702094001087'],
      ['LIQUIPOP LYCHEE 1100 GR', 'LIQUIPOPS', 'LYCHE', 274, 15000, 'LIQUIPP09', '7702094001094'],
      ['LIQUIPOP MANGO BICHE 1100 GR', 'LIQUIPOPS', 'MANGO BICHE', 21, 15000, 'LIQUIPP10', '7702094001100'],
      ['LIQUIPOP MANGO BICHE CON SAL 1100 GR', 'LIQUIPOPS', 'MANGO BICHE CON SAL', 0, 15000, 'LIQUIPP11', '7702094001117'], // Red
      ['LIQUIPOP MANZANA VERDE 1100 GR', 'LIQUIPOPS', 'MANZANA VERDE', 251, 15000, 'LIQUIPP12', '7702094001124'],
      ['LIQUIPOP MARACUYA 1100 GR', 'LIQUIPOPS', 'MARACUYA', 250, 15000, 'LIQUIPP13', '7702094001131'],
      ['LIQUIPOP SANDIA 1100 GR', 'LIQUIPOPS', 'SANDIA', 218, 15000, 'LIQUIPP14', '7702094001148'],
      
      // 2300 GR products (all red - zero stock)
      ['LIQUIPOP BLUEBERRY 2300 GR', 'LIQUIPOPS', 'BLUEBERRY', 0, 25000, 'LIQUIPP15', '7702094002015'],
      ['LIQUIPOP CAFE 2300 GR', 'LIQUIPOPS', 'CAFE', 0, 25000, 'LIQUIPP16', '7702094002022'],
      ['LIQUIPOP CEREZA 2300 GR', 'LIQUIPOPS', 'CEREZA', 0, 25000, 'LIQUIPP17', '7702094002039'],
      ['LIQUIPOP CHAMOY 2300 GR', 'LIQUIPOPS', 'CHAMOY', 0, 25000, 'LIQUIPP18', '7702094002046'],
      ['LIQUIPOP CHICLE 2300 GR', 'LIQUIPOPS', 'CHICLE', 0, 25000, 'LIQUIPP19', '7702094002053'],
      ['LIQUIPOP COCO 2300 GR', 'LIQUIPOPS', 'COCO', 0, 25000, 'LIQUIPP20', '7702094002060'],
      ['LIQUIPOP FRESA 2300 GR', 'LIQUIPOPS', 'FRESA', 0, 25000, 'LIQUIPP21', '7702094002077'],
      ['LIQUIPOP ICE PINK 2300 GR', 'LIQUIPOPS', 'ICE PINK', 0, 25000, 'LIQUIPP22', '7702094002084'],
      ['LIQUIPOP LYCHEE 2300 GR', 'LIQUIPOPS', 'LYCHE', 0, 25000, 'LIQUIPP23', '7702094002091'],
      ['LIQUIPOP MANGO BICHE 2300 GR', 'LIQUIPOPS', 'MANGO BICHE', 0, 25000, 'LIQUIPP24', '7702094002107'],
      ['LIQUIPOP MANGO BICHE CON SAL 2300 GR', 'LIQUIPOPS', 'MANGO BICHE CON SAL', 0, 25000, 'LIQUIPP25', '7702094002114'],
      ['LIQUIPOP MANZANA VERDE 2300 GR', 'LIQUIPOPS', 'MANZANA VERDE', 0, 25000, 'LIQUIPP26', '7702094002121'],
      ['LIQUIPOP MARACUYA 2300 GR', 'LIQUIPOPS', 'MARACUYA', 0, 25000, 'LIQUIPP27', '7702094002138'],
      ['LIQUIPOP SANDIA 2300 GR', 'LIQUIPOPS', 'SANDIA', 0, 25000, 'LIQUIPP28', '7702094002145'],
      
      // 3400 GR products (mixed stock)
      ['LIQUIPOP BLUEBERRY 3400 GR', 'LIQUIPOPS', 'BLUEBERRY', 67, 35000, 'LIQUIPP29', '7702094003012'],
      ['LIQUIPOP CAFE 3400 GR', 'LIQUIPOPS', 'CAFE', 0, 35000, 'LIQUIPP30', '7702094003029'], // Red
      ['LIQUIPOP CEREZA 3400 GR', 'LIQUIPOPS', 'CEREZA', 39, 35000, 'LIQUIPP31', '7702094003036'],
      ['LIQUIPOP CHAMOY 3400 GR', 'LIQUIPOPS', 'CHAMOY', 10, 35000, 'LIQUIPP32', '7702094003043'], // Yellow
      ['LIQUIPOP CHICLE 3400 GR', 'LIQUIPOPS', 'CHICLE', 18, 35000, 'LIQUIPP33', '7702094003050'],
      ['LIQUIPOP COCO 3400 GR', 'LIQUIPOPS', 'COCO', 57, 35000, 'LIQUIPP34', '7702094003067'],
      ['LIQUIPOP FRESA 3400 GR', 'LIQUIPOPS', 'FRESA', 33, 35000, 'LIQUIPP35', '7702094003074'],
      ['LIQUIPOP ICE PINK 3400 GR', 'LIQUIPOPS', 'ICE PINK', 19, 35000, 'LIQUIPP36', '7702094003081'],
      ['LIQUIPOP LYCHEE 3400 GR', 'LIQUIPOPS', 'LYCHE', 48, 35000, 'LIQUIPP37', '7702094003098'],
      ['LIQUIPOP MANGO BICHE 3400 GR', 'LIQUIPOPS', 'MANGO BICHE', 45, 35000, 'LIQUIPP38', '7702094003104'],
      ['LIQUIPOP MANGO BICHE CON SAL 3400 GR', 'LIQUIPOPS', 'MANGO BICHE CON SAL', 20, 35000, 'LIQUIPP39', '7702094003111'],
      ['LIQUIPOP MANZANA VERDE 3400 GR', 'LIQUIPOPS', 'MANZANA VERDE', 70, 35000, 'LIQUIPP40', '7702094003128'],
      ['LIQUIPOP MARACUYA 3400 GR', 'LIQUIPOPS', 'MARACUYA', 97, 35000, 'LIQUIPP41', '7702094003135'],
      ['LIQUIPOP SANDIA 3400 GR', 'LIQUIPOPS', 'SANDIA', 18, 35000, 'LIQUIPP42', '7702094003142'],
      
      // 350 GR products (high stock - green)
      ['LIQUIPOP BLUEBERRY 350 GR', 'LIQUIPOPS', 'BLUEBERRY', 342, 8000, 'LIQUIPP43', '7702094003503'],
      ['LIQUIPOP CAFE 350 GR', 'LIQUIPOPS', 'CAFE', 0, 8000, 'LIQUIPP44', '7702094003510'], // Red
      ['LIQUIPOP CEREZA 350 GR', 'LIQUIPOPS', 'CEREZA', 146, 8000, 'LIQUIPP45', '7702094003527'],
      ['LIQUIPOP CHAMOY 350 GR', 'LIQUIPOPS', 'CHAMOY', 203, 8000, 'LIQUIPP46', '7702094003534'],
      ['LIQUIPOP CHICLE 350 GR', 'LIQUIPOPS', 'CHICLE', 227, 8000, 'LIQUIPP47', '7702094003541'],
      ['LIQUIPOP COCO 350 GR', 'LIQUIPOPS', 'COCO', 211, 8000, 'LIQUIPP48', '7702094003558'],
      ['LIQUIPOP FRESA 350 GR', 'LIQUIPOPS', 'FRESA', 289, 8000, 'LIQUIPP49', '7702094003565'],
      ['LIQUIPOP ICE PINK 350 GR', 'LIQUIPOPS', 'ICE PINK', 212, 8000, 'LIQUIPP50', '7702094003572'],
      ['LIQUIPOP LYCHEE 350 GR', 'LIQUIPOPS', 'LYCHE', 142, 8000, 'LIQUIPP51', '7702094003589'],
      ['LIQUIPOP MANGO BICHE 350 GR', 'LIQUIPOPS', 'MANGO BICHE', 228, 8000, 'LIQUIPP52', '7702094003596'],
      ['LIQUIPOP MANGO BICHE CON SAL 350 GR', 'LIQUIPOPS', 'MANGO BICHE CON SAL', 309, 8000, 'LIQUIPP53', '7702094003602'],
      ['LIQUIPOP MANZANA VERDE 350 GR', 'LIQUIPOPS', 'MANZANA VERDE', 87, 8000, 'LIQUIPP54', '7702094003619'],
      ['LIQUIPOP MARACUYA 350 GR', 'LIQUIPOPS', 'MARACUYA', 351, 8000, 'LIQUIPP55', '7702094003626'],
      ['LIQUIPOP SANDIA 350 GR', 'LIQUIPOPS', 'SANDIA', 196, 8000, 'LIQUIPP56', '7702094003633']
    ];

    const insertQuery = `
      INSERT INTO products (product_name, category, subcategory, available_quantity, standard_price, siigo_id, barcode, last_sync_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    console.log(`Adding ${completeInventory.length} LIQUIPOPS products...`);
    
    for (const product of completeInventory) {
      await connection.execute(insertQuery, product);
    }

    console.log('✅ Complete LIQUIPOPS inventory added successfully!');

    // Final verification
    console.log('\n=== FINAL VERIFICATION ===');
    const [presentations] = await connection.execute(`
      SELECT 
        CASE 
          WHEN product_name LIKE '%1100 GR%' THEN '1100 GR'
          WHEN product_name LIKE '%2300 GR%' THEN '2300 GR' 
          WHEN product_name LIKE '%3400 GR%' THEN '3400 GR'
          WHEN product_name LIKE '%350 GR%' THEN '350 GR'
          ELSE 'Other'
        END as presentation,
        COUNT(*) as count,
        ROUND(AVG(available_quantity), 0) as avg_stock,
        MIN(available_quantity) as min_stock,
        MAX(available_quantity) as max_stock
      FROM products 
      WHERE category = 'LIQUIPOPS'
      GROUP BY presentation
      ORDER BY presentation
    `);

    console.log('\nInventory by presentation:');
    presentations.forEach(p => {
      const stockLevel = p.avg_stock > 50 ? '🟢' : p.avg_stock > 10 ? '🟡' : '🔴';
      console.log(`${stockLevel} ${p.presentation}: ${p.count} products (avg: ${p.avg_stock}, range: ${p.min_stock}-${p.max_stock})`);
    });

    console.log(`\n🎉 COMPLETE! Total LIQUIPOPS products: ${completeInventory.length}`);
    console.log('\n📋 READY FOR USE:');
    console.log('1. Refresh your browser page');
    console.log('2. Go to "Inventario + Facturación"');
    console.log('3. You should now see the full inventory table exactly like your example image!');

  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

// Run the complete fix
fixProductsTableComplete();
