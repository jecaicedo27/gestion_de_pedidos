const axios = require('axios');

async function debugFrontendInventoryLoading() {
  console.log('🔍 DEBUGGING FRONTEND INVENTORY LOADING 🔍');
  console.log('============================================\n');

  try {
    // Simular la llamada exacta que hace el frontend
    const response = await axios.get('http://localhost:3001/api/products?pageSize=1000', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6ImFkbWluQHRlc3QuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzI0NDMxMjAwfQ.6kMcZWKf5XGEhvHPdJ_W-_3pIkMeGbf9_qUd5F5Mxk4',
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
        
        // Test frontend organization logic
        console.log('=== TESTING FRONTEND ORGANIZATION LOGIC ===');
        
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
        
        // Comparar subcategory vs extracted flavor
        console.log('\n=== SUBCATEGORY VS EXTRACTED FLAVOR COMPARISON ===');
        liquipopsProducts.slice(0, 10).forEach(product => {
          const extractedFlavor = extractFlavor(product.product_name);
          console.log(`${product.product_name}:`);
          console.log(`  Subcategory (DB): "${product.subcategory}"`);
          console.log(`  Extracted Flavor: "${extractedFlavor}"`);
          console.log(`  Match: ${product.subcategory === extractedFlavor}`);
          console.log('');
        });

      } else {
        console.log('❌ No LIQUIPOPS products found in API response');
      }
    } else {
      console.log('❌ API call failed:', response.data.message);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }
}

// Run the debug
debugFrontendInventoryLoading();
