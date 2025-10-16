const axios = require('axios');
const mysql = require('mysql2/promise');

async function testCompleteInventoryApiFlow() {
  console.log('🔍 TESTING COMPLETE INVENTORY API FLOW 🔍');
  console.log('===============================================\n');

  let connection;
  try {
    // Database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    // Step 1: Check database data directly
    console.log('Step 1: Database verification...');
    const [dbRows] = await connection.execute(`
      SELECT id, product_name, category, available_quantity, standard_price
      FROM products 
      WHERE category = 'LIQUIPOPS' 
      ORDER BY product_name 
      LIMIT 5
    `);
    
    console.log(`✅ Database has ${dbRows.length} LIQUIPOPS products:`);
    dbRows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.product_name}`);
      console.log(`   - Available quantity: ${row.available_quantity}`);
      console.log(`   - Price: ${row.standard_price}`);
      console.log('');
    });

    // Step 2: Try to login
    console.log('Step 2: Login attempt...');
    let token = null;
    
    try {
      // Try with username
      const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        username: 'admin@test.com',
        password: 'admin123'
      });
      
      if (loginResponse.data.success) {
        token = loginResponse.data.data.token;
        console.log('✅ Login successful with username');
      }
    } catch (loginError) {
      console.log('❌ Login with username failed, trying with email...');
      
      try {
        // Try with email
        const altLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
          email: 'admin@test.com',
          password: 'admin123'
        });
        
        if (altLoginResponse.data.success) {
          token = altLoginResponse.data.data.token;
          console.log('✅ Login successful with email');
        }
      } catch (altError) {
        console.log('❌ Both login methods failed:');
        console.log('Username error:', loginError.response?.data || loginError.message);
        console.log('Email error:', altError.response?.data || altError.message);
      }
    }

    if (!token) {
      console.log('\n⚠️  Cannot proceed without authentication. Checking if backend is running...');
      
      try {
        await axios.get('http://localhost:3001');
        console.log('✅ Backend server is responding');
      } catch (serverError) {
        console.log('❌ Backend server is not responding:', serverError.message);
        console.log('Please make sure the backend is running on port 3001');
        return;
      }
      
      return;
    }

    // Step 3: Test products API
    console.log('\nStep 3: Testing Products API...');
    
    try {
      const apiResponse = await axios.get('http://localhost:3001/api/products?pageSize=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (apiResponse.data.success) {
        const apiProducts = apiResponse.data.data;
        const apiLiquipops = apiProducts.filter(p => p.category === 'LIQUIPOPS');
        
        console.log(`✅ API returned ${apiProducts.length} total products`);
        console.log(`✅ API returned ${apiLiquipops.length} LIQUIPOPS products`);
        
        if (apiLiquipops.length > 0) {
          console.log('\n=== API DATA SAMPLE ===');
          apiLiquipops.slice(0, 5).forEach((product, index) => {
            console.log(`${index + 1}. ${product.product_name}`);
            console.log(`   - API available_quantity: ${product.available_quantity}`);
            console.log(`   - API stock: ${product.stock}`);
            console.log(`   - API standard_price: ${product.standard_price}`);
            console.log('');
          });

          // Step 4: Compare database vs API data
          console.log('Step 4: Database vs API comparison...');
          let foundMismatches = false;
          
          dbRows.forEach(dbProduct => {
            const apiProduct = apiLiquipops.find(p => p.id === dbProduct.id);
            
            if (apiProduct) {
              const dbStock = dbProduct.available_quantity;
              const apiStock = apiProduct.available_quantity || apiProduct.stock || 0;
              
              if (dbStock !== apiStock) {
                foundMismatches = true;
                console.log(`❌ MISMATCH: ${dbProduct.product_name}`);
                console.log(`   Database available_quantity: ${dbStock}`);
                console.log(`   API available_quantity: ${apiProduct.available_quantity}`);
                console.log(`   API stock: ${apiProduct.stock}`);
                console.log(`   Final stock (frontend logic): ${apiStock}`);
                console.log('');
              } else {
                console.log(`✅ MATCH: ${dbProduct.product_name} - Stock: ${dbStock}`);
              }
            } else {
              foundMismatches = true;
              console.log(`❌ MISSING: ${dbProduct.product_name} not found in API response`);
            }
          });

          if (!foundMismatches) {
            console.log('\n🎉 ALL DATA MATCHES! Database and API are consistent.');
          } else {
            console.log('\n🚨 FOUND MISMATCHES! There is a data inconsistency.');
          }

          // Step 5: Test frontend organization logic
          console.log('\nStep 5: Testing frontend organization logic...');
          
          const extractPresentation = (productName) => {
            const match = productName.match(/(\d+\s*(?:GR|ML|KG|L))/i);
            return match ? match[1].toUpperCase() : 'STANDARD';
          };

          const extractFlavor = (productName) => {
            const commonFlavors = [
              'BLUEBERRY', 'CAFE', 'CEREZA', 'CHAMOY', 'CHICLE', 'COCO', 'FRESA',
              'ICE PINK', 'LYCHE', 'MANGO BICHE', 'MANGO BICHE CON SAL', 'MANZANA VERDE',
              'MARACUYA', 'SANDIA'
            ];
            
            const upperName = productName.toUpperCase();
            
            for (const flavor of commonFlavors) {
              if (upperName.includes(flavor)) {
                return flavor;
              }
            }
            
            const parts = productName.split(' ');
            return parts[parts.length - 1] || 'CLASICO';
          };
          
          // Organize like the frontend
          const grouped = {};
          
          apiLiquipops.forEach(product => {
            if (!product.category || !product.product_name) return;
            
            const presentation = extractPresentation(product.product_name);
            const flavor = extractFlavor(product.product_name);
            
            if (!grouped[product.category]) {
              grouped[product.category] = {};
            }
            
            if (!grouped[product.category][presentation]) {
              grouped[product.category][presentation] = {};
            }
            
            grouped[product.category][presentation][flavor] = {
              ...product,
              stock: product.available_quantity || product.stock || 0, // This is what frontend does
              presentation,
              flavor
            };
          });

          console.log('Frontend organized data:');
          Object.keys(grouped).forEach(category => {
            console.log(`\nCategory: ${category}`);
            Object.keys(grouped[category]).forEach(presentation => {
              console.log(`  Presentation: ${presentation}`);
              Object.keys(grouped[category][presentation]).forEach(flavor => {
                const product = grouped[category][presentation][flavor];
                console.log(`    ${flavor}: ${product.stock} units (${product.stock === 0 ? 'RED' : product.stock < 50 ? 'YELLOW' : 'GREEN'})`);
              });
            });
          });

          // Final diagnosis
          console.log('\n=== FINAL DIAGNOSIS ===');
          let zeroCount = 0;
          let nonZeroCount = 0;
          
          apiLiquipops.forEach(product => {
            const finalStock = product.available_quantity || product.stock || 0;
            if (finalStock === 0) {
              zeroCount++;
            } else {
              nonZeroCount++;
            }
          });
          
          console.log(`Products showing as zero stock: ${zeroCount}`);
          console.log(`Products showing with stock: ${nonZeroCount}`);
          
          if (zeroCount === apiLiquipops.length) {
            console.log('\n🚨 ISSUE CONFIRMED: ALL products show zero stock in the API response');
            console.log('This explains why the frontend shows all red cells');
            
            // Check if API is returning the right fields
            const sampleProduct = apiLiquipops[0];
            console.log('\nSample API product fields:');
            Object.keys(sampleProduct).forEach(key => {
              console.log(`  ${key}: ${sampleProduct[key]}`);
            });
          } else {
            console.log('\n✅ API is returning correct stock data');
            console.log('The issue might be in the frontend display logic');
          }

        } else {
          console.log('❌ No LIQUIPOPS products found in API response');
        }
      } else {
        console.log('❌ API call failed:', apiResponse.data.message);
      }
    } catch (apiError) {
      console.log('❌ API call error:', apiError.response?.data || apiError.message);
    }

  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testCompleteInventoryApiFlow();
