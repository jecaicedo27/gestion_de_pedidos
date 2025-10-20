const axios = require('axios');

async function testLogisticsDisplay() {
    const API_URL = 'http://localhost:3001/api';
    
    try {
        console.log('🔍 Testing Logistics API Display for Order 537 (Ximena)');
        console.log('==========================================================');
        
        // 1. Login as admin to see logistics view
        console.log('\n1. Logging in as admin...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'password123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Admin login successful');
        
        // 2. Get logistics orders
        console.log('\n2. Getting logistics orders (ready for delivery)...');
        const logisticsResponse = await axios.get(`${API_URL}/logistics/ready-for-delivery`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log(`\n📦 Total orders in logistics view: ${logisticsResponse.data.orders.length}`);
        
        // Look for Ximena's order
        const ximenaOrder = logisticsResponse.data.orders.find(order => order.id === 537);
        
        if (ximenaOrder) {
            console.log('\n✅ Found Order 537 in logistics view:');
            console.log(`   Order Number: ${ximenaOrder.order_number}`);
            console.log(`   Customer: ${ximenaOrder.customer_name}`);
            console.log(`   Status: ${ximenaOrder.status}`);
            console.log(`   Delivery Method: ${ximenaOrder.delivery_method}`);
            console.log(`   Assigned Messenger ID: ${ximenaOrder.assigned_messenger_id || 'NULL'}`);
            console.log(`   Messenger Name: ${ximenaOrder.messenger_name || 'Not shown'}`);
        } else {
            console.log('\n⚠️ Order 537 NOT found in logistics view');
            console.log('   This might be because it\'s already delivered (entregado_cliente)');
        }
        
        // 3. Get ALL orders to see if 537 appears
        console.log('\n3. Getting ALL orders...');
        const allOrdersResponse = await axios.get(`${API_URL}/orders`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const order537 = allOrdersResponse.data.orders.find(order => order.id === 537);
        
        if (order537) {
            console.log('\n✅ Order 537 found in ALL orders:');
            console.log(`   Order Number: ${order537.order_number}`);
            console.log(`   Customer: ${order537.customer_name}`);
            console.log(`   Status: ${order537.status}`);
            console.log(`   Delivery Method: ${order537.delivery_method}`);
            console.log(`   Assigned Messenger ID: ${order537.assigned_messenger_id || 'NULL'}`);
            console.log(`   Messenger Name: ${order537.messenger_name || 'Not shown'}`);
            
            // Check what fields are available
            console.log('\n   Available fields in order object:');
            Object.keys(order537).forEach(key => {
                if (key.toLowerCase().includes('messenger') || key.toLowerCase().includes('assign')) {
                    console.log(`     ${key}: ${order537[key]}`);
                }
            });
        }
        
        // 4. Check orders in "en_reparto" status
        console.log('\n4. Checking orders in "en_reparto" status...');
        const enRepartoOrders = allOrdersResponse.data.orders.filter(order => order.status === 'en_reparto');
        console.log(`   Found ${enRepartoOrders.length} orders in delivery`);
        
        enRepartoOrders.forEach(order => {
            console.log(`\n   📦 Order ${order.order_number}:`);
            console.log(`      Customer: ${order.customer_name}`);
            console.log(`      Assigned Messenger ID: ${order.assigned_messenger_id || 'NULL'}`);
            console.log(`      Messenger Name: ${order.messenger_name || 'Not shown'}`);
        });
        
        // 5. Check delivered orders
        console.log('\n5. Checking recently delivered orders...');
        const deliveredOrders = allOrdersResponse.data.orders.filter(order => 
            order.status === 'entregado_cliente' || order.status === 'entregado_transportadora'
        ).slice(0, 5); // Get last 5 delivered
        
        console.log(`   Found ${deliveredOrders.length} recently delivered orders`);
        
        deliveredOrders.forEach(order => {
            console.log(`\n   ✅ Order ${order.order_number}:`);
            console.log(`      Customer: ${order.customer_name}`);
            console.log(`      Status: ${order.status}`);
            console.log(`      Assigned Messenger ID: ${order.assigned_messenger_id || 'NULL'}`);
            console.log(`      Messenger Name: ${order.messenger_name || 'Not shown'}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

testLogisticsDisplay();
