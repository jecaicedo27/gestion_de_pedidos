const axios = require('axios');

async function testMessengerAuthorizationFix() {
  try {
    console.log('🔧 Testing Messenger Authorization Fix After Backend Restart');
    console.log('='.repeat(80));
    
    const baseURL = 'http://localhost:3001/api';
    
    // Step 1: Login as mensajero1
    console.log('1. Logging in as mensajero1...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      username: 'mensajero1',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    const userId = loginResponse.data.user.id;
    console.log(`✅ Login successful - User ID: ${userId}, Role: ${loginResponse.data.user.role}`);
    
    // Step 2: Verify order 537 status
    console.log('\n2. Checking current status of order 537...');
    const orderResponse = await axios.get(`${baseURL}/orders/537`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const currentOrder = orderResponse.data.data;
    console.log(`📦 Order 537 Status: ${currentOrder.status}`);
    console.log(`📦 Order 537 Assigned Messenger: ${currentOrder.assigned_messenger || 'None'}`);
    console.log(`📦 Order Number: ${currentOrder.order_number}`);
    
    // Step 3: Attempt to update order from en_reparto to entregado_cliente
    console.log('\n3. Attempting to register delivery (en_reparto -> entregado_cliente)...');
    
    const updateData = {
      status: 'entregado_cliente',
      delivery_notes: 'Entrega realizada exitosamente por mensajero1 - Test after authorization fix'
    };
    
    console.log('📝 Update data:', JSON.stringify(updateData, null, 2));
    
    try {
      const updateResponse = await axios.put(`${baseURL}/orders/537`, updateData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ SUCCESS: Order updated successfully!');
      console.log('📊 Response:', JSON.stringify(updateResponse.data, null, 2));
      
      // Verify the update
      console.log('\n4. Verifying the update...');
      const verifyResponse = await axios.get(`${baseURL}/orders/537`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const updatedOrder = verifyResponse.data.data;
      console.log(`✅ Final Status: ${updatedOrder.status}`);
      console.log(`📝 Delivery Notes: ${updatedOrder.delivery_notes || 'None'}`);
      
    } catch (updateError) {
      console.log('❌ FAILED: Order update failed');
      console.log('HTTP Status:', updateError.response?.status);
      console.log('Error Message:', updateError.response?.data?.message);
      console.log('Full Error:', JSON.stringify(updateError.response?.data, null, 2));
      
      if (updateError.response?.data?.message?.includes('Solo se pueden actualizar pedidos que estén en reparto o enviados')) {
        console.log('\n🚨 PROBLEM IDENTIFIED: Old authorization logic is still active!');
        console.log('🔧 This suggests middleware caching or old controller still running.');
        console.log('💡 Solution: Backend needs to be completely restarted to clear cached middleware.');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testMessengerAuthorizationFix().then(() => {
  console.log('\n' + '='.repeat(80));
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test crashed:', error);
  process.exit(1);
});
