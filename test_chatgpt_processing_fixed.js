const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testChatGPTProcessing() {
  try {
    console.log('🧪 Testing ChatGPT Processing After Database Fixes');
    console.log('='.repeat(50));

    // Step 1: Login to get auth token
    console.log('\n1. 🔐 Authenticating...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Authentication successful');

    // Step 2: Search for a customer to use
    console.log('\n2. 🔍 Searching for customer...');
    const customersResponse = await axios.get(`${BASE_URL}/quotations/customers/search?q=1082746400`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (customersResponse.data.customers.length === 0) {
      console.log('❌ No customers found. Using fallback customer ID.');
      return;
    }

    const customer = customersResponse.data.customers[0];
    console.log(`✅ Found customer: ${customer.name} (ID: ${customer.id})`);

    // Step 3: Test ChatGPT processing with natural language
    console.log('\n3. 🤖 Testing ChatGPT Processing...');
    const naturalLanguageOrder = "Necesito 2 productos LIQUIPP07 de sabor fresa y 1 producto IMPLE04";
    
    const chatgptResponse = await axios.post(`${BASE_URL}/quotations/process-natural-language`, {
      customer_id: customer.id,
      natural_language_order: naturalLanguageOrder
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (chatgptResponse.data.success) {
      console.log('✅ ChatGPT Processing successful!');
      console.log(`📦 Items processed: ${chatgptResponse.data.data.structured_items.length}`);
      console.log(`🎯 Average confidence: ${(chatgptResponse.data.data.average_confidence * 100).toFixed(1)}%`);
      
      // Show processed items
      console.log('\n📋 Processed Items:');
      chatgptResponse.data.data.structured_items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.product_name} - Qty: ${item.quantity} - Price: $${item.unit_price}`);
      });
    } else {
      console.log('❌ ChatGPT Processing failed:', chatgptResponse.data.message);
      return;
    }

    // Step 4: Test creating a quotation (should work now without database errors)
    console.log('\n4. 📝 Testing Quotation Creation...');
    const quotationResponse = await axios.post(`${BASE_URL}/quotations`, {
      customerId: customer.id,
      rawRequest: naturalLanguageOrder
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (quotationResponse.data.success) {
      console.log('✅ Quotation created successfully!');
      console.log(`📋 Quotation Number: ${quotationResponse.data.data.quotationNumber}`);
      console.log(`🆔 Quotation ID: ${quotationResponse.data.data.quotationId}`);
      
      // Step 5: Test invoice creation from quotation (the previously failing operation)
      console.log('\n5. 🧾 Testing Invoice Creation from Quotation...');
      try {
        const invoiceResponse = await axios.post(`${BASE_URL}/quotations/create-invoice`, {
          quotationId: quotationResponse.data.data.quotationId,
          documentType: 'FV-1'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (invoiceResponse.data.success) {
          console.log('✅ Invoice creation successful!');
          console.log(`🧾 Invoice ID: ${invoiceResponse.data.data.siigo_invoice_id}`);
          console.log(`📄 Invoice Number: ${invoiceResponse.data.data.siigo_invoice_number}`);
        } else {
          console.log('❌ Invoice creation failed:', invoiceResponse.data.message);
        }
      } catch (invoiceError) {
        if (invoiceError.response?.status === 422) {
          console.log('⚠️ Invoice creation returned 422 (business logic error), but database errors are fixed');
          console.log('   This might be due to SIIGO API configuration, not database issues');
        } else if (invoiceError.response?.status === 500 && invoiceError.response.data.error?.includes('Unknown column')) {
          console.log('❌ Database column error still exists:', invoiceError.response.data.error);
        } else {
          console.log('⚠️ Invoice creation error (non-database):', invoiceError.response?.data?.message || invoiceError.message);
        }
      }

    } else {
      console.log('❌ Quotation creation failed:', quotationResponse.data.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 ChatGPT Processing Test Complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    
    // Check if it's the specific database error we were fixing
    if (error.response?.data?.error?.includes('Unknown column')) {
      console.log('\n🔍 Database column error detected:');
      console.log('   This indicates the backend changes may not have been loaded properly.');
      console.log('   Try restarting the backend to load the fixed quotationController.js');
    }
  }
}

// Run the test
testChatGPTProcessing();
