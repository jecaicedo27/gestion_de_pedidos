const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function debugEnviaCarrierIssue() {
    let connection;
    
    try {
        console.log('🔍 Debuggeando problema con transportadora "Envía"...');
        
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión a base de datos establecida');

        // 1. Verificar transportadoras existentes
        console.log('\n1️⃣ Transportadoras en la base de datos:');
        const [carriers] = await connection.execute(
            'SELECT id, name, code, active FROM carriers ORDER BY name'
        );
        
        carriers.forEach(carrier => {
            console.log(`   - ID: ${carrier.id} | Nombre: "${carrier.name}" | Código: "${carrier.code}" | Activa: ${carrier.active}`);
        });

        // 2. Buscar específicamente "Envía"
        console.log('\n2️⃣ Verificando transportadora "Envía":');
        const enviaCarrier = carriers.find(c => c.name.includes('Env'));
        if (enviaCarrier) {
            console.log(`✅ Encontrada: ID ${enviaCarrier.id} - "${enviaCarrier.name}" (${enviaCarrier.code})`);
        } else {
            console.log('❌ No se encontró transportadora que contenga "Env"');
        }

        // 3. Verificar pedidos que deberían estar listos para entrega
        console.log('\n3️⃣ Pedidos listos para entrega:');
        const [readyOrders] = await connection.execute(
            `SELECT 
                o.id, 
                o.order_number, 
                o.customer_name, 
                o.status, 
                o.delivery_method,
                o.carrier_id,
                c.name as carrier_name
            FROM orders o
            LEFT JOIN carriers c ON o.carrier_id = c.id
            WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
            ORDER BY o.created_at ASC`
        );
        
        console.log(`📦 Total pedidos listos: ${readyOrders.length}`);
        
        if (readyOrders.length === 0) {
            console.log('❌ No hay pedidos en estados: listo_para_entrega, empacado, listo');
            
            // Verificar qué estados tienen los pedidos
            const [allOrdersStatus] = await connection.execute(
                'SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC'
            );
            
            console.log('\n📊 Estados actuales de pedidos:');
            allOrdersStatus.forEach(status => {
                console.log(`   - ${status.status}: ${status.count} pedidos`);
            });
        } else {
            // Agrupar por transportadora
            const groups = {};
            readyOrders.forEach(order => {
                const carrier = order.carrier_name || 'Sin transportadora';
                if (!groups[carrier]) {
                    groups[carrier] = [];
                }
                groups[carrier].push(order);
            });
            
            console.log('\n📋 Pedidos agrupados por transportadora:');
            Object.keys(groups).forEach(carrierName => {
                const orders = groups[carrierName];
                console.log(`\n🚚 ${carrierName} (${orders.length} pedidos):`);
                orders.forEach(order => {
                    console.log(`   - ${order.order_number} | ${order.customer_name} | Estado: ${order.status} | carrier_id: ${order.carrier_id}`);
                });
            });
        }

        // 4. Verificar si hay pedidos asignados a "Envía"
        if (enviaCarrier) {
            console.log(`\n4️⃣ Pedidos asignados a "${enviaCarrier.name}" (ID: ${enviaCarrier.id}):`);
            const [enviaOrders] = await connection.execute(
                `SELECT 
                    id, 
                    order_number, 
                    customer_name, 
                    status,
                    delivery_method
                FROM orders 
                WHERE carrier_id = ?
                ORDER BY created_at DESC`,
                [enviaCarrier.id]
            );
            
            if (enviaOrders.length === 0) {
                console.log('❌ No hay pedidos asignados a "Envía"');
            } else {
                console.log(`✅ ${enviaOrders.length} pedidos asignados a "Envía":`);
                enviaOrders.forEach(order => {
                    console.log(`   - ${order.order_number} | ${order.customer_name} | Estado: ${order.status}`);
                });
            }
        }

        // 5. Simular la lógica de agrupación del backend
        console.log('\n5️⃣ Simulando lógica de agrupación del backend:');
        
        const groupedOrders = {
            recoge_bodega: [],
            interrapidisimo: [],
            transprensa: [], 
            envia: [],
            camion_externo: [],
            otros: []
        };

        readyOrders.forEach(order => {
            const { delivery_method, carrier_name } = order;
            
            // Normalizar texto para comparación (quitar acentos y convertir a minúsculas)
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
            
            const normalizedCarrier = normalizeText(carrier_name);
            const normalizedMethod = normalizeText(delivery_method);
            
            console.log(`\n📦 Pedido ${order.order_number}:`);
            console.log(`   - carrier_name: "${carrier_name}"`);
            console.log(`   - normalizedCarrier: "${normalizedCarrier}"`);
            console.log(`   - delivery_method: "${delivery_method}"`);
            console.log(`   - normalizedMethod: "${normalizedMethod}"`);
            
            if (normalizedMethod === 'recoge_bodega' || normalizedMethod === 'recogida_tienda') {
                console.log(`   ➡️  Asignado a: recoge_bodega`);
                groupedOrders.recoge_bodega.push(order);
            } else if (normalizedCarrier.includes('inter') && normalizedCarrier.includes('rapidisimo')) {
                console.log(`   ➡️  Asignado a: interrapidisimo`);
                groupedOrders.interrapidisimo.push(order);
            } else if (normalizedCarrier.includes('transprensa')) {
                console.log(`   ➡️  Asignado a: transprensa`);
                groupedOrders.transprensa.push(order);
            } else if (normalizedCarrier.includes('envia')) {
                console.log(`   ➡️  Asignado a: envia ✅`);
                groupedOrders.envia.push(order);
            } else if (normalizedCarrier.includes('camion') && normalizedCarrier.includes('externo')) {
                console.log(`   ➡️  Asignado a: camion_externo`);
                groupedOrders.camion_externo.push(order);
            } else {
                console.log(`   ➡️  Asignado a: otros`);
                groupedOrders.otros.push(order);
            }
        });

        // 6. Mostrar resultado final de agrupación
        console.log('\n6️⃣ Resultado final de agrupación:');
        Object.keys(groupedOrders).forEach(groupName => {
            const orders = groupedOrders[groupName];
            if (orders.length > 0) {
                console.log(`✅ ${groupName}: ${orders.length} pedidos`);
                orders.forEach(order => {
                    console.log(`   - ${order.order_number}`);
                });
            } else {
                console.log(`❌ ${groupName}: 0 pedidos`);
            }
        });

        console.log('\n🎯 DIAGNÓSTICO COMPLETO');

    } catch (error) {
        console.error('❌ Error debuggeando:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

// Ejecutar el debug
debugEnviaCarrierIssue().catch(console.error);
