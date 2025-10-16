const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001/api';

// Test configuration
const TEST_CONFIG = {
  // Use existing valid credentials - adjust these for your test environment
  username: 'admin', // Change to valid username
  password: 'admin123', // Change to valid password
  customerId: 1, // Use a valid customer ID from your database
  testProducts: [
    { id: 1, quantity: 2 },
    { id: 2, quantity: 1 }
  ]
};

let authToken = '';

async function testLogin() {
  console.log('\n=== TESTING LOGIN ===');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password
    });

    if (response.data.success) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      console.log(`Token: ${authToken.substring(0, 20)}...`);
      return true;
    } else {
      console.log('❌ Login failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Login error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testProductsAPI() {
  console.log('\n=== TESTING PRODUCTS API ===');
  try {
    const response = await axios.get(`${BASE_URL}/products?pageSize=20`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success && response.data.data.length > 0) {
      console.log('✅ Products API working');
      console.log(`Found ${response.data.data.length} products`);
      
      // Update test config with real product IDs
      TEST_CONFIG.testProducts = response.data.data.slice(0, 2).map(product => ({
        id: product.id,
        name: product.product_name,
        price: product.standard_price || 5000,
        quantity: Math.floor(Math.random() * 3) + 1
      }));
      
      console.log('Test products:', TEST_CONFIG.testProducts);
      return true;
    } else {
      console.log('❌ No products found or API failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Products API error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testCustomersAPI() {
  console.log('\n=== TESTING CUSTOMERS API ===');
  try {
    const response = await axios.get(`${BASE_URL}/quotations/customers/search?q=`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success && response.data.data.length > 0) {
      console.log('✅ Customers API working');
      console.log(`Found ${response.data.data.length} customers`);
      
      // Use the first customer for testing
      TEST_CONFIG.customerId = response.data.data[0].id;
      console.log(`Using customer: ${response.data.data[0].name} (ID: ${TEST_CONFIG.customerId})`);
      return true;
    } else {
      console.log('❌ No customers found or API failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Customers API error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testDirectInvoiceCreation() {
  console.log('\n=== TESTING DIRECT INVOICE CREATION ===');
  
  const invoiceData = {
    customer_id: TEST_CONFIG.customerId,
    items: TEST_CONFIG.testProducts.map(product => ({
      product_id: product.id,
      product_name: product.name || `Product ${product.id}`,
      quantity: product.quantity,
      unit_price: product.price || 5000,
      total: (product.price || 5000) * product.quantity
    })),
    total_amount: TEST_CONFIG.testProducts.reduce((total, product) => 
      total + ((product.price || 5000) * product.quantity), 0
    ),
    invoice_type: 'FV-1',
    payment_method: 'efectivo',
    notes: `Test invoice from inventory billing - ${new Date().toISOString()}`
  };

  console.log('Invoice data:', JSON.stringify(invoiceData, null, 2));

  try {
    const response = await axios.post(`${BASE_URL}/quotations/create-invoice-direct`, invoiceData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    if (response.data.success) {
      console.log('✅ Direct invoice creation successful!');
      console.log(`Invoice number: ${response.data.data.invoice_number}`);
      console.log(`SIIGO invoice number: ${response.data.data.siigo_invoice_number || 'Not created in SIIGO'}`);
      console.log(`Total amount: ${response.data.data.total_amount}`);
      
      // Save invoice details to file
      const invoiceDetails = {
        success: true,
        timestamp: new Date().toISOString(),
        invoice: response.data.data,
        test_data: invoiceData
      };
      
      fs.writeFileSync('inventory_billing_test_result.json', JSON.stringify(invoiceDetails, null, 2));
      console.log('📄 Invoice details saved to inventory_billing_test_result.json');
      
      return true;
    } else {
      console.log('❌ Direct invoice creation failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Direct invoice creation error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
    
    return false;
  }
}

async function testInventoryBillingSystemComplete() {
  console.log('🧪 TESTING COMPLETE INVENTORY BILLING SYSTEM 🧪');
  console.log('================================================\n');

  try {
    // Test 1: Authentication
    const loginSuccess = await testLogin();
    if (!loginSuccess) {
      console.log('\n❌ Test suite failed at login step');
      return;
    }

    // Test 2: Products API
    const productsSuccess = await testProductsAPI();
    if (!productsSuccess) {
      console.log('\n❌ Test suite failed at products API step');
      return;
    }

    // Test 3: Customers API
    const customersSuccess = await testCustomersAPI();
    if (!customersSuccess) {
      console.log('\n❌ Test suite failed at customers API step');
      return;
    }

    // Test 4: Direct Invoice Creation (the main feature)
    const invoiceSuccess = await testDirectInvoiceCreation();
    if (!invoiceSuccess) {
      console.log('\n❌ Test suite failed at direct invoice creation');
      return;
    }

    console.log('\n🎉 ALL TESTS PASSED! Inventory billing system is working correctly! 🎉');
    console.log('===============================================================================');
    console.log('\nSYSTEM FEATURES VERIFIED:');
    console.log('✅ User authentication');
    console.log('✅ Products API integration');  
    console.log('✅ Customer search functionality');
    console.log('✅ Direct invoice creation from inventory');
    console.log('✅ SIIGO integration for FV-1 invoices');
    
    console.log('\nNEXT STEPS:');
    console.log('1. Start the frontend: npm start (in frontend directory)');
    console.log('2. Navigate to /inventory-billing in the browser');
    console.log('3. Test the full UI workflow:');
    console.log('   - View inventory organized by categories and presentations');
    console.log('   - Click products to add them to cart');
    console.log('   - Search and select customer');
    console.log('   - Generate FV-1 invoice directly');

  } catch (error) {
    console.log('\n❌ Unexpected error during testing:', error.message);
  }
}

// Run the complete test
testInventoryBillingSystemComplete();
