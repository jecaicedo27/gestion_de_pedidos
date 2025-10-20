const axios = require('axios');
const mysql = require('mysql2/promise');

async function debugFrontendInventoryLoadingWithAuth() {
  console.log('🔍 DEBUGGING FRONTEND INVENTORY LOADING WITH AUTH 🔍');
  console.log('=======================================================\n');

  // Database connection
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    // Step 1: Login to get valid token
    console.log('Step 1: Logging in to get valid token...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@test.com',
      password: 'admin123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, token obtained');

    // Step 2: Call products API with valid token
    console.log('\nStep 2: Calling products API...');
    const response = await axios.get('http://localhost:3001/api/products?pageSize=1000', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('=== API RESPONSE STATUS ===');
    console.log(`Status: ${response.status}`);
    console.log(`Data success: ${response.data.success}`);
    
    if (response.data.success) {
      const products = response.data.data;
      console.log(`Total products received: ${products.length}`);
      
      // Filtrar solo LIQUIPOPS
      const liquipopsProducts = products.filter(p => p.category === 'LIQUIPOPS');
      console.log(`LIQUIPOPS products: ${liquipopsProducts.length}`);
      
      if (liquipopsProducts.length > 0) {
        console.log('\n=== SAMPLE LIQUIPOPS PRODUCTS ===');
        liquipopsProducts.slice(0, 5).forEach((product, index) => {
          console.log(`${index + 1}. ${product.product_name}`);
          console.log(`   - Category: ${product.category}`);
          console.log(`   - Subcategory: ${product.subcategory}`);
          console.log(`   - Available quantity: ${product.available_quantity}`);
          console.log(`   - Stock: ${product.stock}`);
          console.log(`   - Standard price: ${product.standard_price}`);
          console.log('');
        });
        
        // Step 3: Check database directly
        console.log('\n=== COMPARING WITH DATABASE DATA ===');
        const [dbRows] = await connection.execute(`
          SELECT product_name, category, subcategory, available_quantity, stock, standard_price
          FROM products 
          WHERE category = 'LIQUIPOPS' 
          ORDER BY product_name 
          LIMIT 5
        `);
        
        console.log('Database data:');
        dbRows.forEach((row, index) => {
          console.log(`${index + 1}. ${row.product_name}`);
          console.log(`   - Category: ${row.category}`);
          console.log(`   - Subcategory: ${row.subcategory}`);
          console.log(`   - Available quantity: ${row.available_quantity}`);
          console.log(`   - Stock: ${row.stock}`);
          console.log(`   - Standard price: ${row.standard_price}`);
          console.log('');
        });

        // Step 4: Test frontend organization logic
        console.log('\n=== TESTING FRONTEND ORGANIZATION LOGIC ===');
        
        // Función extractPresentation (copiada del frontend)
        const extractPresentation = (productName) => {
          const match = productName.match(/(\d+\s*(?:GR|ML|KG|L))/i);
          return match ? match[1].toUpperCase() : 'STANDARD';
        };

        // Función extractFlavor (copiada del frontend) 
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
        
        // Organizar productos como hace el frontend
        const grouped = {};
        
        liquipopsProducts.forEach(product => {
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
            stock: product.available_quantity || product.stock || 0,
            presentation,
            flavor
          };
        });

        console.log('Grouped structure:');
        Object.keys(grouped).forEach(category => {
          console.log(`\nCategory: ${category}`);
          Object.keys(grouped[category]).forEach(presentation => {
            console.log(`  Presentation: ${presentation} (${Object.keys(grouped[category][presentation]).length} products)`);
            Object.keys(grouped[category][presentation]).forEach(flavor => {
              const product = grouped[category][presentation][flavor];
              console.log(`    ${flavor}: ${product.stock} units`);
            });
          });
        });

        // Step 5: Direct stock analysis
        console.log('\n=== STOCK ANALYSIS ===');
        let zeroStock = 0;
        let nonZeroStock = 0;
        
        liquipopsProducts.forEach(product => {
          const stock = product.available_quantity || product.stock || 0;
          if (stock === 0) {
            zeroStock++;
          } else {
            nonZeroStock++;
          }
        });
        
        console.log(`Products with zero stock: ${zeroStock}`);
        console.log(`Products with non-zero stock: ${nonZeroStock}`);
        
        if (zeroStock === liquipopsProducts.length) {
          console.log('\n❌ ALL PRODUCTS HAVE ZERO STOCK - This is the issue!');
          console.log('The frontend is showing zeros because the API is returning zeros.');
          
          // Check if database has non-zero values
          const [stockCheck] = await connection.execute(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN available_quantity > 0 THEN 1 ELSE 0 END) as with_stock
            FROM products 
            WHERE category = 'LIQUIPOPS'
          `);
          
          console.log(`Database check: ${stockCheck[0].with_stock} out of ${stockCheck[0].total} products have stock`);
        }

      } else {
        console.log('❌ No LIQUIPOPS products found in API response');
      }
    } else {
      console.log('❌ API call failed:', response.data.message);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  } finally {
    await connection.end();
  }
}

// Run the debug
debugFrontendInventoryLoadingWithAuth();
