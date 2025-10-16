const mysql = require('mysql2/promise');
const axios = require('axios');

const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_de_pedidos_dev'
};

const BASE_URL = 'http://localhost:3001/api';

async function debugInventoryDataLoading() {
  console.log('🔍 DEBUGGING INVENTORY DATA LOADING ISSUE 🔍');
  console.log('=================================================\n');

  try {
    // Test 1: Check database connection and products table
    console.log('=== TESTING DATABASE CONNECTION ===');
    const connection = await mysql.createConnection(DB_CONFIG);
    
    // Check if products table exists and has data
    const [products] = await connection.execute('SELECT COUNT(*) as count FROM products');
    console.log(`✅ Database connected. Products count: ${products[0].count}`);
    
    // Check specific products with available_quantity
    const [inventoryData] = await connection.execute(`
      SELECT 
        id, 
        product_name, 
        category, 
        subcategory, 
        stock,
        available_quantity,
        siigo_id,
        last_sync_at
      FROM products 
      WHERE category = 'LIQUIPOPS' 
      LIMIT 10
    `);
    
    console.log('\n=== SAMPLE INVENTORY DATA FROM DATABASE ===');
    inventoryData.forEach(product => {
      console.log(`${product.product_name}: Stock=${product.stock}, Available=${product.available_quantity}, SIIGO_ID=${product.siigo_id}`);
    });
    
    await connection.end();

    // Test 2: Check API response for products
    console.log('\n=== TESTING PRODUCTS API RESPONSE ===');
    try {
      const response = await axios.get(`${BASE_URL}/products?category=LIQUIPOPS&pageSize=10`);
      
      if (response.data && response.data.success) {
        console.log(`✅ Products API responding. Found ${response.data.data?.length || 0} products`);
        
        if (response.data.data && response.data.data.length > 0) {
          console.log('\nSample API response:');
          response.data.data.slice(0, 3).forEach(product => {
            console.log(`- ${product.product_name}: Stock=${product.stock}, Available=${product.available_quantity}`);
          });
        } else {
          console.log('❌ No products in API response');
        }
      } else {
        console.log('❌ Products API failed:', response.data?.message || 'Unknown error');
      }
    } catch (error) {
      console.log('❌ Products API error:', error.message);
      
      if (error.response?.status === 401) {
        console.log('   -> Authentication required. Testing with auth...');
        
        // Try with authentication
        try {
          const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
          });
          
          if (loginResponse.data?.success) {
            const authToken = loginResponse.data.token;
            const authResponse = await axios.get(`${BASE_URL}/products?category=LIQUIPOPS&pageSize=10`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            console.log('✅ Authenticated API call successful');
            if (authResponse.data?.data?.length > 0) {
              console.log('Sample authenticated response:');
              authResponse.data.data.slice(0, 3).forEach(product => {
                console.log(`- ${product.product_name}: Stock=${product.stock}, Available=${product.available_quantity}`);
              });
            }
          }
        } catch (authError) {
          console.log('❌ Authenticated call also failed:', authError.message);
        }
      }
    }

    // Test 3: Check if frontend is making correct API calls
    console.log('\n=== DEBUGGING FRONTEND DATA LOADING ===');
    console.log('Checking InventoryBillingPage.js data loading...');

    // Test 4: Verify the organizeProductsForInventory function logic
    console.log('\n=== TESTING DATA ORGANIZATION LOGIC ===');
    
    // Simulate what the frontend should receive
    const mockProducts = [
      {
        id: 1,
        product_name: 'LIQUIPOP BLUEBERRY 1100 GR',
        category: 'LIQUIPOPS',
        subcategory: 'BLUEBERRY',
        stock: 248,
        available_quantity: 248,
        standard_price: 15000
      },
      {
        id: 2,
        product_name: 'LIQUIPOP CAFE 1100 GR',
        category: 'LIQUIPOPS',
        subcategory: 'CAFE',
        stock: 64,
        available_quantity: 64,
        standard_price: 15000
      }
    ];

    console.log('Testing data organization with mock data:');
    const organizedData = organizeProductsForInventory(mockProducts);
    console.log('Organized result:', JSON.stringify(organizedData, null, 2));

  } catch (error) {
    console.log('\n❌ Debug error:', error.message);
  }
}

// Helper function to simulate frontend organization logic
function organizeProductsForInventory(products) {
  const organized = {};
  
  products.forEach(product => {
    if (!product.category || product.category !== 'LIQUIPOPS') return;
    
    // Extract presentation and flavor from product name
    const nameParts = product.product_name.split(' ');
    let presentation = 'Unknown';
    let flavor = product.subcategory || 'Unknown';
    
    // Find presentation (look for GR pattern)
    for (let part of nameParts) {
      if (part.includes('GR')) {
        presentation = part;
        break;
      }
    }
    
    if (!organized[presentation]) {
      organized[presentation] = {};
    }
    
    organized[presentation][flavor] = {
      stock: product.available_quantity || product.stock || 0,
      product_id: product.id,
      price: product.standard_price || 0
    };
  });
  
  return organized;
}

// Run the debug
debugInventoryDataLoading();
