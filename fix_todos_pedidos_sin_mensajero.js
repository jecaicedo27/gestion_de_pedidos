const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function fixTodosPedidosSinMensajero() {
    try {
        console.log('🔧 CORRIGIENDO TODOS LOS PEDIDOS SIN MENSAJERO ASIGNADO');
        console.log('======================================================\n');

        const connection = await mysql.createConnection(dbConfig);

        // 1. Obtener mensajeros disponibles
        console.log('1. OBTENIENDO MENSAJEROS DISPONIBLES...');
        const [messengers] = await connection.execute(`
            SELECT id, username, full_name 
            FROM users 
            WHERE role = 'mensajero' AND active = 1
            ORDER BY id
        `);

        if (messengers.length === 0) {
            console.log('❌ No hay mensajeros disponibles');
            await connection.end();
            return;
        }

        console.log(`✅ ${messengers.length} mensajero(s) disponible(s):`);
        messengers.forEach(m => {
            console.log(`   ${m.id}: ${m.username} (${m.full_name})`);
        });

        // 2. Encontrar todos los pedidos problemáticos
        console.log('\n2. IDENTIFICANDO PEDIDOS PROBLEMÁTICOS...');
        const [pedidosProblema] = await connection.execute(`
            SELECT id, order_number, customer_name, status, messenger_status, assigned_messenger_id
            FROM orders 
            WHERE status = 'en_reparto' 
              AND (assigned_messenger_id IS NULL OR messenger_status = 'pending_assignment')
            ORDER BY created_at DESC
        `);

        if (pedidosProblema.length === 0) {
            console.log('✅ No se encontraron pedidos problemáticos');
            await connection.end();
            return;
        }

        console.log(`⚠️ Encontrados ${pedidosProblema.length} pedido(s) problemático(s):`);
        pedidosProblema.forEach(pedido => {
            console.log(`   ${pedido.order_number} - ${pedido.customer_name} (ID: ${pedido.id})`);
        });

        // 3. Asignar mensajeros automáticamente (distribución balanceada)
        console.log('\n3. ASIGNANDO MENSAJEROS AUTOMÁTICAMENTE...');
        
        for (let i = 0; i < pedidosProblema.length; i++) {
            const pedido = pedidosProblema[i];
            const mensajero = messengers[i % messengers.length]; // Distribución circular
            
            console.log(`📋 Asignando ${pedido.order_number} a ${mensajero.username}...`);
            
            await connection.execute(`
                UPDATE orders 
                SET 
                    assigned_messenger_id = ?,
                    messenger_status = 'assigned',
                    updated_at = NOW()
                WHERE id = ?
            `, [mensajero.id, pedido.id]);
        }

        // 4. Verificar las correcciones
        console.log('\n4. VERIFICANDO CORRECCIONES...');
        const [pedidosCorregidos] = await connection.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                o.status,
                o.messenger_status,
                o.assigned_messenger_id,
                u.username as mensajero_username,
                u.full_name as mensajero_nombre
            FROM orders o
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.id IN (${pedidosProblema.map(p => p.id).join(',')})
            ORDER BY o.order_number
        `);

        console.log(`✅ ${pedidosCorregidos.length} pedido(s) corregido(s):`);
        pedidosCorregidos.forEach(pedido => {
            console.log(`
📦 ${pedido.order_number} - ${pedido.customer_name}
   Estado: ${pedido.status}
   Estado Mensajería: ${pedido.messenger_status}
   Mensajero: ${pedido.mensajero_username} (${pedido.mensajero_nombre})
            `);
        });

        // 5. Estadísticas finales
        console.log('\n5. ESTADÍSTICAS DE ASIGNACIÓN...');
        const [stats] = await connection.execute(`
            SELECT 
                u.username,
                u.full_name,
                COUNT(o.id) as pedidos_asignados
            FROM users u
            LEFT JOIN orders o ON u.id = o.assigned_messenger_id 
                AND o.status = 'en_reparto' 
                AND o.messenger_status = 'assigned'
            WHERE u.role = 'mensajero' AND u.active = 1
            GROUP BY u.id, u.username, u.full_name
            ORDER BY pedidos_asignados DESC
        `);

        console.log('📊 Distribución actual de pedidos por mensajero:');
        stats.forEach(stat => {
            console.log(`   ${stat.username}: ${stat.pedidos_asignados} pedido(s) en reparto`);
        });

        // 6. Verificar que no quedan pedidos problemáticos
        console.log('\n6. VERIFICACIÓN FINAL...');
        const [verificacion] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM orders 
            WHERE status = 'en_reparto' 
              AND (assigned_messenger_id IS NULL OR messenger_status = 'pending_assignment')
        `);

        if (verificacion[0].count === 0) {
            console.log('✅ No quedan pedidos problemáticos');
        } else {
            console.log(`⚠️ Aún quedan ${verificacion[0].count} pedido(s) problemático(s)`);
        }

        await connection.end();

        console.log('\n=====================================');
        console.log('🎉 CORRECCIÓN MASIVA COMPLETADA');
        console.log('=====================================');
        console.log('Todos los pedidos en reparto ahora tienen');
        console.log('mensajeros asignados correctamente.');

    } catch (error) {
        console.error('❌ Error al corregir pedidos:', error);
    }
}

fixTodosPedidosSinMensajero();
