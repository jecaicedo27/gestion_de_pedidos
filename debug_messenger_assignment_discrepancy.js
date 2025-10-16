const mysql = require('mysql2/promise');

async function debugMessengerAssignmentDiscrepancy() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('🔍 INVESTIGANDO DISCREPANCIA DE ASIGNACIÓN DE MENSAJEROS');
        console.log('====================================================');

        // 1. Verificar el pedido FV-2-12844 específicamente
        console.log('\n1. 📋 CONSULTANDO PEDIDO FV-2-12844:');
        const [order] = await connection.execute(`
            SELECT 
                id,
                order_number,
                siigo_invoice_number,
                status,
                delivery_method,
                assigned_messenger_id,
                assigned_messenger,
                assigned_to,
                messenger_status
            FROM orders 
            WHERE siigo_invoice_number = 'FV-2-12844' OR order_number = 'FV-2-12844'
        `);
        
        if (order.length > 0) {
            console.log('✅ Pedido encontrado:', JSON.stringify(order[0], null, 2));
        } else {
            console.log('❌ Pedido FV-2-12844 no encontrado');
        }

        // 2. Verificar usuario Julian
        console.log('\n2. 👤 CONSULTANDO MENSAJERO JULIAN:');
        const [julian] = await connection.execute(`
            SELECT 
                id,
                full_name,
                username,
                role,
                active
            FROM users 
            WHERE full_name LIKE '%julian%' OR username LIKE '%julian%'
        `);
        
        if (julian.length > 0) {
            console.log('✅ Usuario Julian encontrado:', JSON.stringify(julian[0], null, 2));
        } else {
            console.log('❌ Usuario Julian no encontrado');
        }

        // 3. Verificar estructura de columnas en tabla orders
        console.log('\n3. 🏗️ ESTRUCTURA DE COLUMNAS EN ORDERS:');
        const [columns] = await connection.execute(`
            DESCRIBE orders
        `);
        
        console.log('📊 Columnas relacionadas con mensajero:');
        columns.forEach(col => {
            if (col.Field.toLowerCase().includes('messenger') || 
                col.Field.toLowerCase().includes('user') ||
                col.Field.toLowerCase().includes('assigned')) {
                console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
            }
        });

        // 4. Buscar todos los pedidos asignados al mensajero Julian
        if (julian.length > 0) {
            const julianId = julian[0].id;
            
            console.log(`\n4. 📦 PEDIDOS ASIGNADOS A JULIAN (ID: ${julianId}):`);
            
            // Buscar por assigned_messenger_id
            const [assignedByMessengerId] = await connection.execute(`
                SELECT 
                    id,
                    order_number,
                    siigo_invoice_number,
                    status,
                    assigned_messenger_id,
                    messenger_status
                FROM orders 
                WHERE assigned_messenger_id = ?
            `, [julianId]);
            
            console.log(`📋 Por assigned_messenger_id: ${assignedByMessengerId.length} pedidos`);
            assignedByMessengerId.forEach(order => {
                console.log(`  - ${order.order_number} / ${order.siigo_invoice_number} (Status: ${order.status}, Messenger Status: ${order.messenger_status})`);
            });

            // Buscar por assigned_messenger
            const [assignedByMessenger] = await connection.execute(`
                SELECT 
                    id,
                    order_number,
                    siigo_invoice_number,
                    status,
                    assigned_messenger,
                    messenger_status
                FROM orders 
                WHERE assigned_messenger = ?
            `, [julianId]);
            
            console.log(`📋 Por assigned_messenger: ${assignedByMessenger.length} pedidos`);
            assignedByMessenger.forEach(order => {
                console.log(`  - ${order.order_number} / ${order.siigo_invoice_number} (Status: ${order.status}, Messenger Status: ${order.messenger_status})`);
            });

            // Buscar por assigned_to
            const [assignedByTo] = await connection.execute(`
                SELECT 
                    id,
                    order_number,
                    siigo_invoice_number,
                    status,
                    assigned_to,
                    messenger_status
                FROM orders 
                WHERE assigned_to = ?
            `, [julianId]);
            
            console.log(`📋 Por assigned_to: ${assignedByTo.length} pedidos`);
            assignedByTo.forEach(order => {
                console.log(`  - ${order.order_number} / ${order.siigo_invoice_number} (Status: ${order.status}, Messenger Status: ${order.messenger_status})`);
            });
        }

        // 5. Verificar estado "en_reparto" 
        console.log('\n5. 🚚 PEDIDOS EN ESTADO "en_reparto":');
        const [enReparto] = await connection.execute(`
            SELECT 
                id,
                order_number,
                siigo_invoice_number,
                status,
                assigned_messenger_id,
                assigned_messenger,
                assigned_to,
                messenger_status
            FROM orders 
            WHERE status = 'en_reparto'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log(`📦 Encontrados ${enReparto.length} pedidos en reparto:`);
        enReparto.forEach(order => {
            console.log(`  - ${order.order_number}/${order.siigo_invoice_number}: assigned_messenger_id=${order.assigned_messenger_id}, assigned_messenger=${order.assigned_messenger}, assigned_to=${order.assigned_to}, messenger_status=${order.messenger_status}`);
        });

        // 6. Verificar qué consulta usa la API de logística
        console.log('\n6. 🔄 SIMULANDO CONSULTA DE LOGÍSTICA:');
        const [logisticsQuery] = await connection.execute(`
            SELECT DISTINCT
                o.id,
                o.order_number,
                o.siigo_invoice_number,
                o.customer_name,
                o.total_amount,
                o.status,
                o.delivery_method,
                o.assigned_messenger_id,
                o.assigned_messenger,
                o.assigned_to,
                o.messenger_status,
                u.full_name as messenger_name
            FROM orders o
            LEFT JOIN users u ON (o.assigned_messenger_id = u.id OR o.assigned_messenger = u.id OR o.assigned_to = u.id)
            WHERE o.status = 'en_logistica'
            ORDER BY o.created_at DESC
        `);
        
        console.log(`📊 Consulta logística devuelve ${logisticsQuery.length} pedidos`);
        logisticsQuery.slice(0, 5).forEach(order => {
            console.log(`  - ${order.order_number}/${order.siigo_invoice_number}: ${order.messenger_name || 'Sin asignar'} (assigned_messenger_id: ${order.assigned_messenger_id}, assigned_messenger: ${order.assigned_messenger}, assigned_to: ${order.assigned_to})`);
        });

        // 7. Verificar qué consulta usa la API de mensajería
        console.log('\n7. 📱 SIMULANDO CONSULTA DE MENSAJERÍA:');
        const [messengerQuery] = await connection.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.siigo_invoice_number,
                o.customer_name,
                o.total_amount,
                o.status,
                o.assigned_messenger_id,
                o.assigned_messenger,
                o.assigned_to,
                o.messenger_status
            FROM orders o
            WHERE o.status = 'en_reparto'
            AND (o.assigned_messenger_id IS NOT NULL OR o.assigned_messenger IS NOT NULL OR o.assigned_to IS NOT NULL)
            ORDER BY o.created_at DESC
        `);
        
        console.log(`📊 Consulta mensajería devuelve ${messengerQuery.length} pedidos asignados`);
        messengerQuery.slice(0, 5).forEach(order => {
            console.log(`  - ${order.order_number}/${order.siigo_invoice_number}: assigned_messenger_id=${order.assigned_messenger_id}, assigned_messenger=${order.assigned_messenger}, assigned_to=${order.assigned_to}, messenger_status=${order.messenger_status}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

debugMessengerAssignmentDiscrepancy();
