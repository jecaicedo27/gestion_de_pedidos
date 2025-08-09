const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function debugLogisticsCarriers() {
    let connection;
    
    try {
        console.log('🔍 Iniciando debug de transportadoras en logística...');
        
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión a base de datos establecida');

        // 1. Verificar si existe la tabla carriers
        console.log('\n1️⃣ Verificando tabla carriers...');
        try {
            const [tables] = await connection.execute(
                "SHOW TABLES LIKE 'carriers'"
            );
            
            if (tables.length === 0) {
                console.log('❌ Tabla carriers no existe');
                return;
            }
            console.log('✅ Tabla carriers existe');
        } catch (error) {
            console.error('❌ Error verificando tabla carriers:', error.message);
            return;
        }

        // 2. Verificar estructura de la tabla carriers
        console.log('\n2️⃣ Verificando estructura de tabla carriers...');
        try {
            const [structure] = await connection.execute('DESCRIBE carriers');
            console.log('📋 Estructura de tabla carriers:');
            structure.forEach(column => {
                console.log(`   - ${column.Field}: ${column.Type} (${column.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        } catch (error) {
            console.error('❌ Error verificando estructura:', error.message);
            return;
        }

        // 3. Verificar datos en la tabla carriers
        console.log('\n3️⃣ Verificando datos en tabla carriers...');
        try {
            const [carriers] = await connection.execute(
                'SELECT id, name, code, active FROM carriers ORDER BY name'
            );
            
            if (carriers.length === 0) {
                console.log('❌ No hay transportadoras en la base de datos');
                console.log('💡 Creando transportadoras básicas...');
                
                // Crear transportadoras básicas
                const basicCarriers = [
                    { name: 'Interrapidísimo', code: 'INTER' },
                    { name: 'Transprensa', code: 'TRANS' },
                    { name: 'Envía', code: 'ENVIA' },
                    { name: 'Camión Externo', code: 'CAMION_EXT' }
                ];

                for (const carrier of basicCarriers) {
                    await connection.execute(
                        'INSERT INTO carriers (name, code, active, created_at) VALUES (?, ?, TRUE, NOW())',
                        [carrier.name, carrier.code]
                    );
                    console.log(`✅ Creada transportadora: ${carrier.name}`);
                }

                // Verificar de nuevo
                const [newCarriers] = await connection.execute(
                    'SELECT id, name, code, active FROM carriers ORDER BY name'
                );
                console.log(`✅ Total transportadoras creadas: ${newCarriers.length}`);
                newCarriers.forEach(carrier => {
                    console.log(`   - ${carrier.name} (${carrier.code}) - Activa: ${carrier.active}`);
                });
            } else {
                console.log(`✅ Encontradas ${carriers.length} transportadoras:`);
                carriers.forEach(carrier => {
                    console.log(`   - ${carrier.name} (${carrier.code}) - Activa: ${carrier.active}`);
                });
            }
        } catch (error) {
            console.error('❌ Error verificando datos carriers:', error.message);
            return;
        }

        // 4. Verificar pedidos en estado para logística
        console.log('\n4️⃣ Verificando pedidos en estado logística...');
        try {
            const [logisticsOrders] = await connection.execute(
                `SELECT 
                    o.id, o.order_number, o.status, o.delivery_method, 
                    c.name as carrier_name
                FROM orders o
                LEFT JOIN carriers c ON o.carrier_id = c.id
                WHERE o.status IN ('en_logistica', 'listo_para_entrega', 'empacado', 'listo')
                ORDER BY o.created_at DESC
                LIMIT 10`
            );
            
            console.log(`📦 Encontrados ${logisticsOrders.length} pedidos en estados de logística:`);
            logisticsOrders.forEach(order => {
                console.log(`   - ${order.order_number}: ${order.status} - ${order.delivery_method || 'Sin método'} - ${order.carrier_name || 'Sin transportadora'}`);
            });
        } catch (error) {
            console.error('❌ Error verificando pedidos logística:', error.message);
        }

        // 5. Probar el endpoint directamente
        console.log('\n5️⃣ Probando endpoint de transportadoras...');
        try {
            const fetch = require('node-fetch');
            
            const response = await fetch('http://localhost:3001/api/logistics/carriers', {
                headers: {
                    'Authorization': 'Bearer ' + process.env.TEST_TOKEN || 'fake-token'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Endpoint de transportadoras responde correctamente:');
                console.log(`   - Success: ${data.success}`);
                console.log(`   - Transportadoras encontradas: ${data.data?.length || 0}`);
                if (data.data) {
                    data.data.forEach(carrier => {
                        console.log(`     * ${carrier.name} (${carrier.code})`);
                    });
                }
            } else {
                console.log('❌ Endpoint de transportadoras no responde correctamente:', response.status);
                const errorText = await response.text();
                console.log('   Error:', errorText);
            }
        } catch (error) {
            console.log('⚠️  No se pudo probar el endpoint (servidor puede no estar corriendo):', error.message);
        }

        // 6. Probar endpoint de pedidos listos para entrega
        console.log('\n6️⃣ Probando endpoint de pedidos listos para entrega...');
        try {
            const fetch = require('node-fetch');
            
            const response = await fetch('http://localhost:3001/api/logistics/ready-for-delivery', {
                headers: {
                    'Authorization': 'Bearer ' + process.env.TEST_TOKEN || 'fake-token'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Endpoint de pedidos listos responde correctamente:');
                console.log(`   - Success: ${data.success}`);
                console.log(`   - Total pedidos: ${data.data?.totalReady || 0}`);
                if (data.data?.stats) {
                    console.log('   - Estadísticas:');
                    Object.entries(data.data.stats).forEach(([key, value]) => {
                        if (value > 0) {
                            console.log(`     * ${key}: ${value}`);
                        }
                    });
                }
            } else {
                console.log('❌ Endpoint de pedidos listos no responde correctamente:', response.status);
                const errorText = await response.text();
                console.log('   Error:', errorText);
            }
        } catch (error) {
            console.log('⚠️  No se pudo probar el endpoint (servidor puede no estar corriendo):', error.message);
        }

    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✅ Conexión cerrada');
        }
    }
}

// Ejecutar el debug
debugLogisticsCarriers().catch(console.error);
