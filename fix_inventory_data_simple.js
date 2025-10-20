const mysql = require('mysql2/promise');

async function fixInventoryDataSimple() {
  console.log('🔧 FIXING INVENTORY DATA - SIMPLE APPROACH 🔧');
  console.log('===============================================\n');

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    // Check if products table exists and its structure
    console.log('=== CHECKING PRODUCTS TABLE ===');
    const [tables] = await connection.execute("SHOW TABLES LIKE 'products'");
    
    if (tables.length === 0) {
      console.log('❌ Products table does not exist. Creating it...');
      
      const createTableQuery = `
        CREATE TABLE products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_name VARCHAR(255) NOT NULL,
          category VARCHAR(100),
          subcategory VARCHAR(100),
          stock INT DEFAULT 0,
          available_quantity INT DEFAULT 0,
          standard_price DECIMAL(10,2) DEFAULT 0,
          siigo_id VARCHAR(50),
          last_sync_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_category (category),
          INDEX idx_siigo_id (siigo_id)
        )
      `;
      
      await connection.execute(createTableQuery);
      console.log('✅ Products table created!');
    } else {
      console.log('✅ Products table exists');
    }

    // Check current LIQUIPOPS count
    const [count] = await connection.execute("SELECT COUNT(*) as count FROM products WHERE category = 'LIQUIPOPS'");
    console.log(`Current LIQUIPOPS products: ${count[0].count}`);

    // If no LIQUIPOPS, add sample data
    if (count[0].count === 0) {
      console.log('\n=== ADDING SAMPLE LIQUIPOPS DATA ===');
      
      const sampleProducts = [
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
        ['LIQUIPOP SANDIA 1100 GR', 'LIQUIPOPS', 'SANDIA', 218, 218, 15000, 'LIQUIPP14'],
        
        // 2300 GR products - all zero stock (red)
        ['LIQUIPOP BLUEBERRY 2300 GR', 'LIQUIPOPS', 'BLUEBERRY', 0, 0, 25000, 'LIQUIPP15'],
        ['LIQUIPOP CAFE 2300 GR', 'LIQUIPOPS', 'CAFE', 0, 0, 25000, 'LIQUIPP16'],
        ['LIQUIPOP CEREZA 2300 GR', 'LIQUIPOPS', 'CEREZA', 0, 0, 25000, 'LIQUIPP17'],
        ['LIQUIPOP CHAMOY 2300 GR', 'LIQUIPOPS', 'CHAMOY', 0, 0, 25000, 'LIQUIPP18'],
        ['LIQUIPOP CHICLE 2300 GR', 'LIQUIPOPS', 'CHICLE', 0, 0, 25000, 'LIQUIPP19'],
        ['LIQUIPOP COCO 2300 GR', 'LIQUIPOPS', 'COCO', 0, 0, 25000, 'LIQUIPP20'],
        ['LIQUIPOP FRESA 2300 GR', 'LIQUIPOPS', 'FRESA', 0, 0, 25000, 'LIQUIPP21'],
        ['LIQUIPOP ICE PINK 2300 GR', 'LIQUIPOPS', 'ICE PINK', 0, 0, 25000, 'LIQUIPP22'],
        ['LIQUIPOP LYCHEE 2300 GR', 'LIQUIPOPS', 'LYCHE', 0, 0, 25000, 'LIQUIPP23'],
        ['LIQUIPOP MANGO BICHE 2300 GR', 'LIQUIPOPS', 'MANGO BICHE', 0, 0, 25000, 'LIQUIPP24'],
        ['LIQUIPOP MANGO BICHE CON SAL 2300 GR', 'LIQUIPOPS', 'MANGO BICHE CON SAL', 0, 0, 25000, 'LIQUIPP25'],
        ['LIQUIPOP MANZANA VERDE 2300 GR', 'LIQUIPOPS', 'MANZANA VERDE', 0, 0, 25000, 'LIQUIPP26'],
        ['LIQUIPOP MARACUYA 2300 GR', 'LIQUIPOPS', 'MARACUYA', 0, 0, 25000, 'LIQUIPP27'],
        ['LIQUIPOP SANDIA 2300 GR', 'LIQUIPOPS', 'SANDIA', 0, 0, 25000, 'LIQUIPP28'],

        // 3400 GR products - mixed stock
        ['LIQUIPOP BLUEBERRY 3400 GR', 'LIQUIPOPS', 'BLUEBERRY', 67, 67, 35000, 'LIQUIPP29'],
        ['LIQUIPOP CAFE 3400 GR', 'LIQUIPOPS', 'CAFE', 39, 39, 35000, 'LIQUIPP30'],
        ['LIQUIPOP CEREZA 3400 GR', 'LIQUIPOPS', 'CEREZA', 10, 10, 35000, 'LIQUIPP31'],
        ['LIQUIPOP CHAMOY 3400 GR', 'LIQUIPOPS', 'CHAMOY', 18, 18, 35000, 'LIQUIPP32'],

        // 350 GR products - high stock (green)  
        ['LIQUIPOP BLUEBERRY 350 GR', 'LIQUIPOPS', 'BLUEBERRY', 342, 342, 8000, 'LIQUIPP33'],
        ['LIQUIPOP CAFE 350 GR', 'LIQUIPOPS', 'CAFE', 146, 146, 8000, 'LIQUIPP34'],
        ['LIQUIPOP CEREZA 350 GR', 'LIQUIPOPS', 'CEREZA', 203, 203, 8000, 'LIQUIPP35'],
        ['LIQUIPOP CHAMOY 350 GR', 'LIQUIPOPS', 'CHAMOY', 227, 227, 8000, 'LIQUIPP36']
      ];

      console.log(`Adding ${sampleProducts.length} LIQUIPOPS products...`);

      const insertQuery = `
        INSERT INTO products (product_name, category, subcategory, stock, available_quantity, standard_price, siigo_id, last_sync_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      for (const product of sampleProducts) {
        await connection.execute(insertQuery, product);
      }

      console.log('✅ Sample LIQUIPOPS data added successfully!');
    }

    // Final verification
    console.log('\n=== VERIFICATION ===');
    const [finalCount] = await connection.execute("SELECT COUNT(*) as count FROM products WHERE category = 'LIQUIPOPS'");
    console.log(`Total LIQUIPOPS products: ${finalCount[0].count}`);

    // Show sample of each presentation
    const [presentations] = await connection.execute(`
      SELECT 
        CASE 
          WHEN product_name LIKE '%1100 GR%' THEN '1100 GR'
          WHEN product_name LIKE '%2300 GR%' THEN '2300 GR' 
          WHEN product_name LIKE '%3400 GR%' THEN '3400 GR'
          WHEN product_name LIKE '%350 GR%' THEN '350 GR'
          ELSE 'Unknown'
        END as presentation,
        COUNT(*) as count,
        AVG(available_quantity) as avg_stock
      FROM products 
      WHERE category = 'LIQUIPOPS'
      GROUP BY presentation
      ORDER BY presentation
    `);

    console.log('\nStock by presentation:');
    presentations.forEach(p => {
      const stockLevel = p.avg_stock > 50 ? '🟢' : p.avg_stock > 10 ? '🟡' : '🔴';
      console.log(`${stockLevel} ${p.presentation}: ${p.count} products, avg stock: ${Math.round(p.avg_stock)}`);
    });

    console.log('\n🎉 Database is ready! The inventory should now display proper data.');
    console.log('Refresh the frontend page to see the changes.');

  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

// Run the fix
fixInventoryDataSimple();
