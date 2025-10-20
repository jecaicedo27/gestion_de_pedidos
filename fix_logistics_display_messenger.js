const mysql = require('mysql2/promise');

async function fixLogisticsDisplay() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });
    
    try {
        console.log('===========================================');
        console.log('🔧 Arreglando visualización de mensajeros en logística');
        console.log('===========================================\n');
        
        // Primero, verificar el estado actual del pedido de Ximena
        const [ximenaPedido] = await connection.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                o.status,
                o.assigned_messenger_id,
                u.username as messenger_username,
                u.full_name as messenger_name
            FROM orders o
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.order_number = 'FV-2-13199'
        `);
        
        if (ximenaPedido.length > 0) {
            const pedido = ximenaPedido[0];
            console.log('Estado actual del pedido FV-2-13199:');
            console.log('- Cliente:', pedido.customer_name);
            console.log('- Estado:', pedido.status);
            console.log('- ID Mensajero asignado:', pedido.assigned_messenger_id);
            console.log('- Mensajero:', pedido.messenger_name || pedido.messenger_username || 'NO ASIGNADO');
            console.log('');
        }
        
        // Ahora simular la consulta que usa el endpoint getReadyForDeliveryOrders
        // PERO con la corrección para incluir assigned_messenger_id
        console.log('Simulando consulta corregida para el endpoint de logística:');
        console.log('-----------------------------------------------------------\n');
        
        const readyOrders = await connection.execute(`
            SELECT 
                o.id, 
                o.order_number, 
                o.customer_name, 
                o.status, 
                o.delivery_method,
                o.total_amount, 
                o.created_at, 
                o.updated_at, 
                o.carrier_id,
                o.assigned_messenger_id,
                c.name as carrier_name,
                u.username as messenger_username,
                u.full_name as messenger_name
            FROM orders o
            LEFT JOIN carriers c ON o.carrier_id = c.id
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo', 'en_reparto', 'entregado_cliente')
            ORDER BY o.created_at DESC
            LIMIT 10
        `);
        
        console.log(`Encontrados ${readyOrders[0].length} pedidos:\n`);
        
        readyOrders[0].forEach(order => {
            const mensajero = order.messenger_name || order.messenger_username || '-';
            console.log(`📦 ${order.order_number}`);
            console.log(`   Cliente: ${order.customer_name}`);
            console.log(`   Estado: ${order.status}`);
            console.log(`   Transportadora: ${order.carrier_name || 'Sin asignar'}`);
            console.log(`   Mensajero: ${mensajero} (ID: ${order.assigned_messenger_id || 'null'})`);
            console.log('');
        });
        
        console.log('===========================================');
        console.log('✅ SOLUCIÓN IDENTIFICADA');
        console.log('===========================================');
        console.log('\nEl problema está en el controlador logisticsController.js');
        console.log('La función getReadyForDeliveryOrders necesita incluir:');
        console.log('1. El campo assigned_messenger_id en el SELECT');
        console.log('2. Un LEFT JOIN con la tabla users');
        console.log('3. Pasar esta información al frontend');
        console.log('\nEsto permitirá mostrar el mensajero asignado en la columna MENSAJERO');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

fixLogisticsDisplay().catch(console.error);
