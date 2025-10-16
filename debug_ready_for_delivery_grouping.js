const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function debugReadyForDeliveryGrouping() {
    let connection;
    
    try {
        console.log('🚚 Iniciando debug de agrupación de pedidos listos para entrega...');
        
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión a base de datos establecida');

        // 1. Verificar pedidos en estados correctos para logística
        console.log('\n1️⃣ Verificando pedidos en estados listos para entrega...');
        const [readyOrders] = await connection.execute(
            `SELECT 
                o.id, o.order_number, o.status, o.delivery_method, o.carrier_id,
                o.total_amount, o.created_at,
                c.name as carrier_name, c.code as carrier_code
            FROM orders o
            LEFT JOIN carriers c ON o.carrier_id = c.id
            WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
            ORDER BY o.created_at DESC`,
            []
        );
        
        console.log(`📦 Encontrados ${readyOrders.length} pedidos listos para entrega:`);
        
        if (readyOrders.length === 0) {
            console.log('❌ No hay pedidos en estados: listo_para_entrega, empacado, listo');
            console.log('💡 Creando pedidos de prueba para debug...');
            
            // Crear pedidos de prueba con diferentes transportadoras
            const testOrders = [
                { method: 'recoge_bodega', carrier: null, status: 'listo_para_entrega' },
                { method: 'nacional', carrier: 1, status: 'listo_para_entrega' }, // Camión Externo
                { method: 'nacional', carrier: 7, status: 'empacado' }, // Interrapidísimo
                { method: 'nacional', carrier: 11, status: 'listo' }  // Transprensa
            ];
            
            for (let i = 0; i < testOrders.length; i++) {
                const test = testOrders[i];
                await connection.execute(
                    `INSERT INTO orders 
                    (order_number, customer_name, customer_phone, customer_address, 
                     total_amount, status, delivery_method, carrier_id, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        `TEST-${Date.now()}-${i}`,
                        `Cliente Test ${i + 1}`,
                        `300555000${i}`,
                        `Dirección Test ${i + 1}`,
                        100000 + (i * 50000),
                        test.status,
                        test.method,
                        test.carrier
                    ]
                );
            }
            
            console.log('✅ Pedidos de prueba creados');
            return; // Salir para que se ejecute de nuevo con datos
        }

        readyOrders.forEach(order => {
            console.log(`   - ${order.order_number}: ${order.status} | ${order.delivery_method || 'Sin método'} | ${order.carrier_name || 'Sin transportadora'}`);
        });

        // 2. Probar la lógica de agrupación manualmente
        console.log('\n2️⃣ Simulando lógica de agrupación...');
        
        const groupedOrders = {
            recoge_bodega: [],
            interrapidisimo: [],
            transprensa: [], 
            envia: [],
            camion_externo: [],
            mensajero_julian: [],
            mensajero_juan: [],
            otros: []
        };

        // Función para normalizar texto (igual que en el controlador)
        const normalizeText = (text) => {
            if (!text) return '';
            return text.toLowerCase()
                      .replace(/á/g, 'a')
                      .replace(/é/g, 'e') 
                      .replace(/í/g, 'i')
                      .replace(/ó/g, 'o')
                      .replace(/ú/g, 'u')
                      .replace(/ñ/g, 'n')
                      .trim();
        };

        readyOrders.forEach(order => {
            const { delivery_method, carrier_name } = order;
            
            const normalizedCarrier = normalizeText(carrier_name);
            const normalizedMethod = normalizeText(delivery_method);
            
            console.log(`\n   🔍 Analizando ${order.order_number}:`);
            console.log(`      - delivery_method: "${delivery_method}" → normalizado: "${normalizedMethod}"`);
            console.log(`      - carrier_name: "${carrier_name}" → normalizado: "${normalizedCarrier}"`);
            
            if (normalizedMethod === 'recoge_bodega' || normalizedMethod === 'recogida_tienda') {
                groupedOrders.recoge_bodega.push(order);
                console.log(`      → Asignado a: RECOGE_BODEGA`);
            } else if (normalizedCarrier.includes('inter') && normalizedCarrier.includes('rapidisimo')) {
                groupedOrders.interrapidisimo.push(order);
                console.log(`      → Asignado a: INTERRAPIDISIMO`);
            } else if (normalizedCarrier.includes('transprensa')) {
                groupedOrders.transprensa.push(order);
                console.log(`      → Asignado a: TRANSPRENSA`);
            } else if (normalizedCarrier.includes('envia')) {
                groupedOrders.envia.push(order);
                console.log(`      → Asignado a: ENVIA`);
            } else if (normalizedCarrier.includes('camion') && normalizedCarrier.includes('externo')) {
                groupedOrders.camion_externo.push(order);
                console.log(`      → Asignado a: CAMION_EXTERNO`);
            } else if (normalizedMethod === 'mensajero') {
                groupedOrders.otros.push(order);
                console.log(`      → Asignado a: OTROS (mensajero sin asignar)`);
            } else {
                groupedOrders.otros.push(order);
                console.log(`      → Asignado a: OTROS (no coincide con ningún criterio)`);
            }
        });

        // 3. Mostrar estadísticas finales
        console.log('\n3️⃣ Estadísticas de agrupación:');
        Object.entries(groupedOrders).forEach(([group, orders]) => {
            if (orders.length > 0) {
                console.log(`   📊 ${group}: ${orders.length} pedidos`);
                orders.forEach(order => {
                    console.log(`      - ${order.order_number} (${order.carrier_name || 'Sin transportadora'})`);
                });
            }
        });

        // 4. Verificar si el endpoint responde correctamente
        console.log('\n4️⃣ Verificando endpoint ready-for-delivery...');
        try {
            // Simular el controlador manualmente
            const stats = {
                total: readyOrders.length,
                recoge_bodega: groupedOrders.recoge_bodega.length,
                interrapidisimo: groupedOrders.interrapidisimo.length,
                transprensa: groupedOrders.transprensa.length,
                envia: groupedOrders.envia.length,
                camion_externo: groupedOrders.camion_externo.length,
                mensajero_julian: groupedOrders.mensajero_julian.length,
                mensajero_juan: groupedOrders.mensajero_juan.length,
                otros: groupedOrders.otros.length
            };

            console.log('✅ Datos que debería devolver el endpoint:');
            console.log('   📊 Estadísticas:', JSON.stringify(stats, null, 4));
            
            // Verificar que hay datos que mostrar
            const hasDataToShow = Object.values(stats).some(count => count > 0);
            if (hasDataToShow) {
                console.log('✅ HAY DATOS PARA MOSTRAR - Las fichas deberían aparecer');
            } else {
                console.log('❌ NO HAY DATOS PARA MOSTRAR - Por eso no aparecen las fichas');
            }

        } catch (error) {
            console.error('❌ Error simulando endpoint:', error.message);
        }

        // 5. Verificar problemas comunes
        console.log('\n5️⃣ Verificando problemas comunes...');
        
        // Verificar si hay pedidos sin transportadora
        const ordersWithoutCarrier = readyOrders.filter(o => !o.carrier_id && o.delivery_method !== 'recoge_bodega');
        if (ordersWithoutCarrier.length > 0) {
            console.log(`⚠️  ${ordersWithoutCarrier.length} pedidos sin transportadora asignada:`);
            ordersWithoutCarrier.forEach(order => {
                console.log(`      - ${order.order_number}: método "${order.delivery_method}" pero sin transportadora`);
            });
        }

        // Verificar si hay pedidos sin método de envío
        const ordersWithoutMethod = readyOrders.filter(o => !o.delivery_method);
        if (ordersWithoutMethod.length > 0) {
            console.log(`⚠️  ${ordersWithoutMethod.length} pedidos sin método de envío:`);
            ordersWithoutMethod.forEach(order => {
                console.log(`      - ${order.order_number}: transportadora "${order.carrier_name}" pero sin método`);
            });
        }

        // Verificar transportadoras con nombres que no coinciden
        const carriersNotMatching = readyOrders
            .filter(o => o.carrier_name)
            .filter(o => {
                const normalized = normalizeText(o.carrier_name);
                return !normalized.includes('inter') && 
                       !normalized.includes('transprensa') && 
                       !normalized.includes('envia') && 
                       !normalized.includes('camion');
            });
        
        if (carriersNotMatching.length > 0) {
            console.log(`⚠️  ${carriersNotMatching.length} pedidos con transportadoras que no coinciden con la lógica:`);
            carriersNotMatching.forEach(order => {
                console.log(`      - ${order.order_number}: "${order.carrier_name}" → no coincide con patrones`);
            });
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
debugReadyForDeliveryGrouping().catch(console.error);
