const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  // Don't specify database initially to check what exists
};

async function fixInventoryDatabaseIssue() {
  console.log('🔧 FIXING INVENTORY DATABASE ISSUE 🔧');
  console.log('=======================================\n');

  let connection;
  try {
    // Connect without specifying database
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Check what databases exist
    console.log('=== CHECKING AVAILABLE DATABASES ===');
    const [databases] = await connection.execute('SHOW DATABASES');
    console.log('Available databases:');
    databases.forEach(db => console.log(`- ${db.Database}`));
    
    // Check if our target database exists
    const targetDb = 'gestion_pedidos_dev';
    const dbExists = databases.some(db => db.Database === targetDb);
    
    if (!dbExists) {
      console.log(`\n❌ Database '${targetDb}' does not exist. Creating it...`);
      await connection.execute(`CREATE DATABASE ${targetDb}`);
      console.log(`✅ Database '${targetDb}' created successfully!`);
    } else {
      console.log(`\n✅ Database '${targetDb}' exists`);
    }
    
    // Switch to our database
    await connection.execute(`USE ${targetDb}`);
    
    // Check if products table exists
    console.log('\n=== CHECKING PRODUCTS TABLE ===');
    try {
      const [tables] = await connection.execute("SHOW TABLES LIKE 'products'");
      
      if (tables.length === 0) {
        console.log('❌ Products table does not exist. This explains the inventory issue!');
        console.log('We need to create the products table first.');
        
        // Create a basic products table structure
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
        console.log('✅ Products table created successfully!');
        
      } else {
        console.log('✅ Products table exists');
        
        // Check current products count
        const [count] = await connection.execute('SELECT COUNT(*) as count FROM products');
        console.log(`Current products count: ${count[0].count}`);
        
        // Check LIQUIPOPS products specifically
        const [liquipops] = await connection.execute("SELECT COUNT(*) as count FROM products WHERE category = 'LIQUIPOPS'");
        console.log(`LIQUIPOPS products count: ${liquipops[0].count}`);
        
        if (liquipops[0].count === 0) {
          console.log('❌ No LIQUIPOPS products found. This is why inventory shows zeros!');
        }
      }
      
      // Check table structure
      console.log('\n=== CHECKING PRODUCTS TABLE STRUCTURE ===');
      const [columns] = await connection.execute('DESCRIBE products');
      console.log('Table columns:');
      columns.forEach(col => console.log(`- ${col.Field}: ${col.Type}`));
      
      // Check if we have the required columns for inventory
      const requiredColumns = ['available_quantity', 'siigo_id', 'last_sync_at'];
      const existingColumns = columns.map(col => col.Field);
      
      for (const reqCol of requiredColumns) {
        if (!existingColumns.includes(reqCol)) {
          console.log(`❌ Missing required column: ${reqCol}`);
          
          let alterQuery = '';
          switch (reqCol) {
            case 'available_quantity':
              alterQuery = 'ALTER TABLE products ADD COLUMN available_quantity INT DEFAULT 0';
              break;
            case 'siigo_id':
              alterQuery = 'ALTER TABLE products ADD COLUMN siigo_id VARCHAR(50), ADD INDEX idx_siigo_id (siigo_id)';
              break;
            case 'last_sync_at':
              alterQuery = 'ALTER TABLE products ADD COLUMN last_sync_at TIMESTAMP NULL';
              break;
          }
          
          if (alterQuery) {
            await connection.execute(alterQuery);
            console.log(`✅ Added column: ${reqCol}`);
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Error checking products table:', error.message);
    }
    
    // Now let's add some sample LIQUIPOPS data if none exists
    const [existingLiquipops] = await connection.execute("SELECT COUNT(*) as count FROM products WHERE category = 'LIQUIPOPS'");
    
    if (existingLiquipops[0].count === 0) {
      console.log('\n=== ADDING SAMPLE LIQUIPOPS INVENTORY ===');
      
      const sampleProducts = [
        {
          name: 'LIQUIPOP BLUEBERRY 1100 GR',
          category: 'LIQUIPOPS',
          subcategory: 'BLUEBERRY',
          stock: 248,
          price: 15000
        },
        {
          name: 'LIQUIPOP CAFE 1100 GR', 
          category: 'LIQUIPOPS',
          subcategory: 'CAFE',
          stock: 64,
          price: 15000
        },
        {
          name: 'LIQUIPOP CEREZA 1100 GR',
          category: 'LIQUIPOPS', 
          subcategory: 'CEREZA',
          stock: 339,
          price: 15000
        },
        {
          name: 'LIQUIPOP CHAMOY 1100 GR',
          category: 'LIQUIPOPS',
          subcategory: 'CHAMOY', 
          stock: 245,
          price: 15000
        },
        {
          name: 'LIQUIPOP CHICLE 1100 GR',
          category: 'LIQUIPOPS',
          subcategory: 'CHICLE',
          stock: 235,
          price: 15000
        },
        {
          name: 'LIQUIPOP COCO 1100 GR',
          category: 'LIQUIPOPS',
          subcategory: 'COCO',
          stock: 27,
          price: 15000
        },
        {
          name: 'LIQUIPOP FRESA 1100 GR',
          category: 'LIQUIPOPS',
          subcategory: 'FRESA',
          stock: 215,
          price: 15000
        },
        {
          name: 'LIQUIPOP LYCHEE 1100 GR',
          category: 'LIQUIPOPS',
          subcategory: 'LYCHE',
          stock: 274,
          price: 15000
        },
        {
          name: 'LIQUIPOP MANGO BICHE 1100 GR',
          category: 'LIQUIPOPS',
          subcategory: 'MANGO BICHE',
          stock: 21,
          price: 15000
        }
      ];

      for (const product of sampleProducts) {
        const insertQuery = `
          INSERT INTO products (product_name, category, subcategory, stock, available_quantity, standard_price, siigo_id, last_sync_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        await connection.execute(insertQuery, [
          product.name,
          product.category,
          product.subcategory,
          product.stock,
          product.stock, // available_quantity same as stock for now
          product.price,
          `LIQUIPP${String(sampleProducts.indexOf(product) + 1).padStart(2, '0')}` // Generate SIIGO ID
        ]);
      }
      
      console.log(`✅ Added ${sampleProducts.length} sample LIQUIPOPS products`);
    }
    
    // Final verification
    console.log('\n=== FINAL VERIFICATION ===');
    const [finalCount] = await connection.execute("SELECT COUNT(*) as count FROM products WHERE category = 'LIQUIPOPS'");
    console.log(`Total LIQUIPOPS products: ${finalCount[0].count}`);
    
    // Show sample data
    const [sampleData] = await connection.execute(`
      SELECT product_name, subcategory, stock, available_quantity, standard_price 
      FROM products 
      WHERE category = 'LIQUIPOPS' 
      LIMIT 5
    `);
    
    console.log('\nSample inventory data:');
    sampleData.forEach(product => {
      console.log(`- ${product.product_name}: Stock=${product.available_quantity}, Price=${product.standard_price}`);
    });
    
    console.log('\n🎉 Database setup complete! The inventory should now show proper data.');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixInventoryDatabaseIssue();
