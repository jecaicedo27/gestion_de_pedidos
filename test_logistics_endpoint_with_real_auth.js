const fetch = require('node-fetch');

async function testLogisticsEndpoint() {
    try {
        console.log('🧪 Probando endpoint de pedidos listos para entrega con autenticación...');

        // Primero, hacer login para obtener un token real
        console.log('\n1️⃣ Haciendo login...');
        const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123' // Usar la contraseña por defecto
            })
        });

        if (!loginResponse.ok) {
            console.log('❌ Login falló:', loginResponse.status);
            const error = await loginResponse.text();
            console.log('Error:', error);
            return;
        }

        const loginData = await loginResponse.json();
        console.log('✅ Login exitoso');
        console.log('📋 Respuesta completa del login:', JSON.stringify(loginData, null, 2));
        
        if (!loginData.token) {
            console.log('❌ No se recibió token');
            // Intentar diferentes nombres de campo
            if (loginData.access_token) {
                console.log('🔄 Encontrado access_token en lugar de token');
                loginData.token = loginData.access_token;
            } else if (loginData.data && loginData.data.token) {
                console.log('🔄 Encontrado token en data.token');
                loginData.token = loginData.data.token;
            } else {
                console.log('❌ No se encontró token en ningún formato conocido');
                return;
            }
        }

        const token = loginData.token;
        console.log('📝 Token obtenido (primeros 20 chars):', token.substring(0, 20) + '...');

        // Probar el endpoint de pedidos listos
        console.log('\n2️⃣ Probando endpoint ready-for-delivery...');
        const readyResponse = await fetch('http://localhost:3001/api/logistics/ready-for-delivery', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📡 Status del endpoint:', readyResponse.status);

        if (readyResponse.ok) {
            const data = await readyResponse.json();
            console.log('✅ Endpoint responde correctamente');
            console.log('📊 Success:', data.success);
            
            if (data.success && data.data) {
                console.log('📈 Total pedidos:', data.data.totalReady || data.data.stats?.total || 'No especificado');
                
                if (data.data.stats) {
                    console.log('📊 Estadísticas:');
                    Object.entries(data.data.stats).forEach(([key, value]) => {
                        if (value > 0) {
                            console.log(`   - ${key}: ${value} pedidos`);
                        }
                    });
                }

                if (data.data.groupedOrders) {
                    console.log('📦 Grupos con pedidos:');
                    Object.entries(data.data.groupedOrders).forEach(([group, orders]) => {
                        if (orders && orders.length > 0) {
                            console.log(`   - ${group}: ${orders.length} pedidos`);
                            orders.slice(0, 3).forEach(order => {
                                console.log(`     * ${order.order_number} - ${order.customer_name}`);
                            });
                            if (orders.length > 3) {
                                console.log(`     ... y ${orders.length - 3} más`);
                            }
                        }
                    });
                }

                // Verificar si realmente hay datos que mostrar
                const totalInGroups = Object.values(data.data.groupedOrders || {})
                    .reduce((sum, group) => sum + (group?.length || 0), 0);
                
                if (totalInGroups > 0) {
                    console.log('✅ HAY FICHAS PARA MOSTRAR EN EL FRONTEND');
                    console.log(`📊 Total de pedidos en grupos: ${totalInGroups}`);
                } else {
                    console.log('❌ NO HAY FICHAS PARA MOSTRAR');
                }

            } else {
                console.log('⚠️  Respuesta exitosa pero sin datos esperados');
                console.log('Datos recibidos:', JSON.stringify(data, null, 2));
            }
        } else {
            console.log('❌ Endpoint falló:', readyResponse.status);
            const errorText = await readyResponse.text();
            console.log('Error:', errorText);
        }

        // Probar también el endpoint de transportadoras
        console.log('\n3️⃣ Probando endpoint de transportadoras...');
        const carriersResponse = await fetch('http://localhost:3001/api/logistics/carriers', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (carriersResponse.ok) {
            const carriersData = await carriersResponse.json();
            console.log('✅ Endpoint de transportadoras funciona');
            console.log(`📦 Transportadoras encontradas: ${carriersData.data?.length || 0}`);
            
            if (carriersData.data && carriersData.data.length > 0) {
                console.log('🚚 Primeras 5 transportadoras:');
                carriersData.data.slice(0, 5).forEach(carrier => {
                    console.log(`   - ${carrier.name} (${carrier.code})`);
                });
            }
        } else {
            console.log('❌ Endpoint de transportadoras falló:', carriersResponse.status);
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

// Ejecutar el test
testLogisticsEndpoint().catch(console.error);
