const axios = require('axios');

async function debugBarcodeEndpoint() {
    console.log('🔍 DEBUGGEANDO: Endpoint de escaneo de códigos de barras');
    console.log('=======================================================');
    
    const baseURL = 'http://localhost:3001';
    let authToken = null;
    
    try {
        // First, verify the backend is running
        const healthResponse = await axios.get(`${baseURL}/api/health`);
        console.log('✅ Backend health check:', healthResponse.status);
        
        // Login to get authentication token
        console.log('\n🔐 Obteniendo token de autenticación...');
        try {
            const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
                username: 'admin',
                password: 'admin123'
            });
            
            console.log('📊 Login response status:', loginResponse.status);
            console.log('📊 Login response data:', JSON.stringify(loginResponse.data, null, 2));
            
            if (loginResponse.data.token) {
                authToken = loginResponse.data.token;
                console.log('✅ Token obtenido exitosamente');
            } else if (loginResponse.data.success && loginResponse.data.data && loginResponse.data.data.token) {
                authToken = loginResponse.data.data.token;
                console.log('✅ Token obtenido exitosamente (estructura alternativa)');
            } else {
                console.log('❌ No se obtuvo token en respuesta de login');
                console.log('📊 Estructura de respuesta:', Object.keys(loginResponse.data));
                return;
            }
        } catch (loginError) {
            console.log('❌ Error en login:', loginError.message);
            if (loginError.response) {
                console.log('📊 Login response status:', loginError.response.status);
                console.log('📊 Login response data:', JSON.stringify(loginError.response.data, null, 2));
            }
            return;
        }
        
        // Set up headers with token
        const authHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        };
        
        // Test if we can get an order to work with
        const ordersResponse = await axios.get(`${baseURL}/api/orders?status=empacado&limit=1`, { headers: authHeaders });
        console.log('✅ Orders endpoint working:', ordersResponse.status);
        
        if (ordersResponse.data.orders && ordersResponse.data.orders.length > 0) {
            const order = ordersResponse.data.orders[0];
            console.log(`✅ Found order: #${order.invoice_number} (ID: ${order.id})`);
            
            // Try to get packaging checklist
            console.log('\n📋 Testing packaging checklist endpoint...');
            try {
                const checklistResponse = await axios.get(`${baseURL}/api/packaging/checklist/${order.id}`, { headers: authHeaders });
                console.log('✅ Checklist endpoint working:', checklistResponse.status);
                console.log('📦 Checklist items:', checklistResponse.data.items?.length || 0);
                
                if (checklistResponse.data.items && checklistResponse.data.items.length > 0) {
                    const item = checklistResponse.data.items[0];
                    console.log(`📦 First item: ${item.product_name} (Qty: ${item.quantity})`);
                    
                    // Test barcode scan endpoint
                    console.log('\n🔍 Testing barcode scan endpoint...');
                    const scanData = {
                        orderId: order.id,
                        itemId: item.id,
                        barcode: item.barcode || 'TEST_BARCODE'
                    };
                    
                    console.log('📨 Scan request data:', scanData);
                    
                    const scanResponse = await axios.post(`${baseURL}/api/packaging/scan-barcode`, scanData, { headers: authHeaders });
                    console.log('✅ Barcode scan successful:', scanResponse.status);
                    console.log('📊 Scan response:', JSON.stringify(scanResponse.data, null, 2));
                }
            } catch (checklistError) {
                console.log('❌ Checklist endpoint error:', checklistError.message);
                if (checklistError.response) {
                    console.log('📊 Response status:', checklistError.response.status);
                    console.log('📊 Response data:', JSON.stringify(checklistError.response.data, null, 2));
                }
            }
        } else {
            console.log('⚠️  No orders found in empacado status');
            
            // Try to get any order
            const anyOrderResponse = await axios.get(`${baseURL}/api/orders?limit=1`, { headers: authHeaders });
            if (anyOrderResponse.data.orders && anyOrderResponse.data.orders.length > 0) {
                const order = anyOrderResponse.data.orders[0];
                console.log(`📦 Using any available order: #${order.invoice_number} (ID: ${order.id})`);
                console.log(`📊 Order status: ${order.status}`);
            }
        }
        
    } catch (error) {
        console.log('❌ Error during debug:', error.message);
        if (error.response) {
            console.log('📊 Response status:', error.response.status);
            console.log('📊 Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugBarcodeEndpoint().catch(console.error);
