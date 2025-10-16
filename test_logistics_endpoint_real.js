const axios = require('axios');

async function testLogisticsEndpoint() {
    try {
        console.log('=== TESTING LOGISTICS ENDPOINT REAL ===\n');
        
        // Primero hacer login para obtener el token
        console.log('1. Haciendo login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        if (!loginResponse.data.success) {
            throw new Error('Login failed');
        }
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso');
        
        // Configurar headers con token
        const config = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        
        console.log('\n2. Probando endpoint /api/logistics/ready-for-delivery...');
        
        const readyForDeliveryResponse = await axios.get('http://localhost:3001/api/logistics/ready-for-delivery', config);
        
        console.log('Status:', readyForDeliveryResponse.status);
        console.log('Success:', readyForDeliveryResponse.data.success);
        
        if (readyForDeliveryResponse.data.success) {
            const data = readyForDeliveryResponse.data.data;
            console.log('\nDatos obtenidos:');
            console.log('- Total Ready:', data.totalReady);
            console.log('- Stats:', JSON.stringify(data.stats, null, 2));
            
            console.log('\n🔍 GRUPOS DE PEDIDOS:');
            Object.keys(data.groupedOrders).forEach(key => {
                const orders = data.groupedOrders[key];
                console.log(`\n${key.toUpperCase()}:`, orders.length, 'pedidos');
                
                if (orders.length > 0) {
                    orders.forEach((order, index) => {
                        if (index < 3) { // Solo mostrar los primeros 3 de cada grupo
                            console.log(`  - ${order.order_number}: ${order.customer_name} (Status: ${order.status})`);
                        }
                    });
                    if (orders.length > 3) {
                        console.log(`  ... y ${orders.length - 3} pedidos más`);
                    }
                }
            });
            
            // Buscar específicamente el pedido de Ximena
            console.log('\n🔍 BUSCANDO PEDIDO DE XIMENA (FV-2-13199):');
            let ximenadFound = false;
            
            Object.keys(data.groupedOrders).forEach(key => {
                const orders = data.groupedOrders[key];
                orders.forEach(order => {
                    if (order.customer_name.includes('XIMENA') || order.order_number === 'FV-2-13199') {
                        console.log(`✅ ENCONTRADO en grupo '${key}':`, {
                            id: order.id,
                            order_number: order.order_number,
                            customer_name: order.customer_name,
                            status: order.status,
                            delivery_method: order.delivery_method
                        });
                        ximenadFound = true;
                    }
                });
            });
            
            if (!ximenadFound) {
                console.log('❌ Pedido de Ximena NO encontrado en el endpoint de logística');
                console.log('❗ ESTE ES EL PROBLEMA: El endpoint no devuelve pedidos en estado "en_reparto"');
            }
            
        } else {
            console.log('❌ Error en ready-for-delivery:', readyForDeliveryResponse.data);
        }
        
        console.log('\n3. Probando endpoint /api/logistics/orders (general)...');
        
        try {
            const logisticsOrdersResponse = await axios.get('http://localhost:3001/api/logistics/orders', config);
            
            console.log('Status:', logisticsOrdersResponse.status);
            console.log('Success:', logisticsOrdersResponse.data.success);
            
            if (logisticsOrdersResponse.data.success) {
                const orders = logisticsOrdersResponse.data.data.orders;
                console.log('Pedidos encontrados:', orders.length);
                
                // Buscar Ximena aquí también
                const ximenadOrder = orders.find(order => 
                    order.customer_name.includes('XIMENA') || order.order_number === 'FV-2-13199'
                );
                
                if (ximenadOrder) {
                    console.log('✅ Ximena encontrada en logistics/orders:', ximenadOrder);
                } else {
                    console.log('❌ Ximena NO encontrada en logistics/orders');
                }
            }
        } catch (error) {
            console.log('Error en logistics/orders:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.error('Error general:', error.response?.data || error.message);
    }
}

testLogisticsEndpoint();
