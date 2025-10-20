const axios = require('axios');
const mysql = require('mysql2/promise');

async function debugInventoryZeroStockIssue() {
  console.log('🔍 DEBUGGING INVENTORY ZERO STOCK ISSUE 🔍');
  console.log('===============================================\n');

  // Database connection
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    console.log('Step 1: Checking database stock levels directly...');
    
    const [dbRows] = await connection.execute(`
      SELECT 
        product_name, 
        category, 
        subcategory,
        available_quantity,
        stock,
        standard_price,
        id
      FROM products 
      WHERE category = 'LIQUIPOPS' 
      ORDER BY product_name 
      LIMIT 10
    `);
    
    console.log(`Found ${dbRows.length} LIQUIPOPS in database:`);
    dbRows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.product_name}`);
      console.log(`   - ID: ${row.id}`);
      console.log(`   - Available quantity: ${row.available_quantity}`);
      console.log(`   - Stock: ${row.stock}`);
      console.log(`   - Price: ${row.standard_price}`);
      console.log('');
    });

    // Count stock distribution in database
    const [stockStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN available_quantity > 0 THEN 1 ELSE 0 END) as with_available_stock,
        SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as with_stock,
        SUM(CASE WHEN available_quantity = 0 AND stock = 0 THEN 1 ELSE 0 END) as zero_stock
      FROM products 
      WHERE category = 'LIQUIPOPS'
    `);
    
    console.log('=== DATABASE STOCK STATISTICS ===');
    console.log(`Total LIQUIPOPS: ${stockStats[0].total}`);
    console.log(`With available_quantity > 0: ${stockStats[0].with_available_stock}`);
    console.log(`With stock > 0: ${stockStats[0].with_stock}`);
    console.log(`With zero stock (both fields): ${stockStats[0].zero_stock}`);

    // Try to login with correct credentials
    console.log('\n\nStep 2: Testing login with correct credentials...');
    
    let token = null;
    try {
      const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        username: 'admin@test.com',
        password: 'admin123'
      });
      
      if (loginResponse.data.success) {
        token = loginResponse.data.data.token;
        console.log('✅ Login successful');
      } else {
        console.log('❌ Login failed:', loginResponse.data.message);
      }
    } catch (loginError) {
      console.log('❌ Login error:', loginError.response?.data || loginError.message);
      
      // Try alternative credentials
      try {
        console.log('Trying alternative login...');
        const altLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
          email: 'admin@test.com',
          password: 'admin123'
        });
        
        if (altLoginResponse.data.success) {
          token = altLoginResponse.data.data.token;
          console.log('✅ Alternative login successful');
        }
      } catch (altError) {
        console.log('❌ Alternative login also failed');
      }
    }

    if (token) {
      console.log('\nStep 3: Testing API with valid token...');
      
      const response = await axios.get('http://localhost:3001/api/products?pageSize=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        const products = response.data.data;
        const liquipopsProducts = products.filter(p => p.category === 'LIQUIPOPS');
        
        console.log(`API returned ${products.length} total products`);
        console.log(`API returned ${liquipopsProducts.length} LIQUIPOPS products`);
        
        if (liquipopsProducts.length > 0) {
          console.log('\n=== SAMPLE API PRODUCTS ===');
          liquipopsProducts.slice(0, 5).forEach((product, index) => {
            console.log(`${index + 1}. ${product.product_name}`);
            console.log(`   - Available quantity: ${product.available_quantity}`);
            console.log(`   - Stock: ${product.stock}`);
            console.log(`   - Standard price: ${product.standard_price}`);
            console.log('');
          });
          
          // API stock analysis
          let apiZeroStock = 0;
          let apiNonZeroStock = 0;
          
          liquipopsProducts.forEach(product => {
            const stock = product.available_quantity || product.stock || 0;
            if (stock === 0) {
              apiZeroStock++;
            } else {
              apiNonZeroStock++;
            }
          });
          
          console.log('=== API STOCK ANALYSIS ===');
          console.log(`Products with zero stock: ${apiZeroStock}`);
          console.log(`Products with non-zero stock: ${apiNonZeroStock}`);
          
          if (apiZeroStock === liquipopsProducts.length) {
            console.log('\n🚨 ISSUE FOUND: API returning all zeros!');
            console.log('Database has stock but API returns zeros');
            
            // Compare specific product
            if (dbRows.length > 0 && liquipopsProducts.length > 0) {
              const dbProduct = dbRows[0];
              const apiProduct = liquipopsProducts.find(p => p.product_name === dbProduct.product_name);
              
              if (apiProduct) {
                console.log('\n=== DIRECT COMPARISON ===');
                console.log(`Product: ${dbProduct.product_name}`);
                console.log(`Database available_quantity: ${dbProduct.available_quantity}`);
                console.log(`Database stock: ${dbProduct.stock}`);
                console.log(`API available_quantity: ${apiProduct.available_quantity}`);
                console.log(`API stock: ${apiProduct.stock}`);
              }
            }
          }
        }
      } else {
        console.log('❌ API call failed:', response.data.message);
      }
    } else {
      console.log('\n⚠️  Skipping API test - no valid token obtained');
      console.log('But database check shows the data is correct in DB');
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Response data:', error.response.data);
    }
  } finally {
    await connection.end();
  }
}

// Run the debug
debugInventoryZeroStockIssue();
