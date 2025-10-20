const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function debugPedidoXimena() {
    try {
        console.log('🔍 DIAGNÓSTICO DEL PEDIDO DE XIMENA');
        console.log('=====================================\n');

        const connection = await mysql.createConnection(dbConfig);

        // 1. Buscar el pedido de Ximena
        console.log('1. BUSCANDO PEDIDO DE XIMENA...');
        const [orders] = await connection.execute(`
            SELECT 
                id,
                invoice_number,
                customer_name,
                customer_document,
                status,
                messenger_status,
                assigned_messenger_id,
                created_at,
                shipping_date,
                delivery_method
            FROM orders 
            WHERE customer_name LIKE '%XIMENA%' 
               OR customer_name LIKE '%BENAVIDES%'
               OR customer_name LIKE '%PABON%'
            ORDER BY created_at DESC
        `);

        if (orders.length === 0) {
            console.log('❌ No se encontró el pedido de Ximena');
            return;
        }

        console.log(`✅ Encontrado ${orders.length} pedido(s):`);
        orders.forEach(order => {
            console.log(`
📦 PEDIDO ${order.invoice_number}
   Cliente: ${order.customer_name}
   Documento: ${order.customer_document}
   Estado: ${order.status}
   Estado Mensajería: ${order.messenger_status || 'NULL'}
   Mensajero Asignado ID: ${order.assigned_messenger_id || 'NULL'}
   Método de Entrega: ${order.delivery_method}
   Fecha Creación: ${order.created_at}
   Fecha Envío: ${order.shipping_date || 'NULL'}
            `);
        });

        // 2. Verificar mensajeros disponibles
        console.log('\n2. VERIFICANDO MENSAJEROS DISPONIBLES...');
        const [messengers] = await connection.execute(`
            SELECT 
                id,
                username,
                full_name,
                role,
                is_active
            FROM users 
            WHERE role = 'mensajero' 
            ORDER BY full_name
        `);

        console.log(`✅ Encontrado ${messengers.length} mensajero(s):`);
        messengers.forEach(messenger => {
            console.log(`
👤 MENSAJERO ${messenger.id}
   Username: ${messenger.username}
   Nombre: ${messenger.full_name}
   Activo: ${messenger.is_active ? 'Sí' : 'No'}
            `);
        });

        // 3. Verificar estructura de la tabla orders
        console.log('\n3. VERIFICANDO ESTRUCTURA DE TABLA ORDERS...');
        const [columns] = await connection.execute(`
            DESCRIBE orders
        `);

        const relevantColumns = columns.filter(col => 
            col.Field.includes('messenger') || 
            col.Field.includes('assigned') || 
            col.Field === 'status' ||
            col.Field === 'delivery_method'
        );

        console.log('📋 Columnas relevantes para mensajería:');
        relevantColumns.forEach(col => {
            console.log(`   ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL permitido' : 'NOT NULL'})`);
        });

        // 4. Verificar si existe la tabla delivery_tracking
        console.log('\n4. VERIFICANDO TABLA DELIVERY_TRACKING...');
        try {
            const [trackingData] = await connection.execute(`
                SELECT COUNT(*) as count FROM delivery_tracking
            `);
            console.log(`✅ Tabla delivery_tracking existe con ${trackingData[0].count} registros`);

            // Buscar tracking del pedido de Ximena
            if (orders.length > 0) {
                const orderId = orders[0].id;
                const [trackingOrders] = await connection.execute(`
                    SELECT * FROM delivery_tracking WHERE order_id = ?
                `, [orderId]);

                if (trackingOrders.length > 0) {
                    console.log(`📍 Tracking encontrado para pedido ${orders[0].invoice_number}:`);
                    trackingOrders.forEach(track => {
                        console.log(`
   ID Tracking: ${track.id}
   Mensajero ID: ${track.messenger_id}
   Asignado: ${track.assigned_at || 'No'}
   Aceptado: ${track.accepted_at || 'No'}
   Rechazado: ${track.rejected_at || 'No'}
   En Entrega: ${track.started_delivery_at || 'No'}
   Entregado: ${track.delivered_at || 'No'}
                        `);
                    });
                } else {
                    console.log(`❌ No hay tracking para pedido ${orders[0].invoice_number}`);
                }
            }
        } catch (error) {
            console.log('❌ Tabla delivery_tracking no existe o hay error:', error.message);
        }

        // 5. Verificar pedidos "En Reparto" sin mensajero
        console.log('\n5. VERIFICANDO PEDIDOS "EN REPARTO" SIN MENSAJERO...');
        const [problematicOrders] = await connection.execute(`
            SELECT 
                id,
                invoice_number,
                customer_name,
                status,
                messenger_status,
                assigned_messenger_id,
                delivery_method
            FROM orders 
            WHERE status = 'en_reparto' 
              AND (assigned_messenger_id IS NULL OR messenger_status = 'pending_assignment')
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (problematicOrders.length > 0) {
            console.log(`⚠️ Encontrados ${problematicOrders.length} pedidos problemáticos:`);
            problematicOrders.forEach(order => {
                console.log(`
🚨 PROBLEMA: ${order.invoice_number}
   Cliente: ${order.customer_name}
   Estado: ${order.status}
   Estado Mensajería: ${order.messenger_status || 'NULL'}
   Mensajero ID: ${order.assigned_messenger_id || 'NULL'}
   Método: ${order.delivery_method}
                `);
            });
        } else {
            console.log('✅ No se encontraron pedidos problemáticos');
        }

        await connection.end();

        console.log('\n=====================================');
        console.log('🔧 ANÁLISIS COMPLETADO');
        console.log('=====================================');

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
}

debugPedidoXimena();
