const mysql = require('mysql2/promise');

async function fixMessengerAssignmentSynchronization() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('🔧 SINCRONIZANDO ASIGNACIONES DE MENSAJEROS');
        console.log('==========================================');

        // 1. Identificar pedidos con discrepancia de asignación
        console.log('\n1. 🔍 IDENTIFICANDO PEDIDOS CON DISCREPANCIA:');
        const [discrepancies] = await connection.execute(`
            SELECT 
                id,
                order_number,
                status,
                assigned_messenger_id,
                assigned_messenger,
                messenger_status
            FROM orders 
            WHERE (assigned_messenger IS NOT NULL AND assigned_messenger_id IS NULL)
               OR (assigned_messenger IS NULL AND assigned_messenger_id IS NOT NULL)
               OR (assigned_messenger != assigned_messenger_id AND assigned_messenger IS NOT NULL AND assigned_messenger_id IS NOT NULL)
        `);

        console.log(`📋 Encontradas ${discrepancies.length} discrepancias:`);
        discrepancies.forEach(order => {
            console.log(`  - ${order.order_number}: assigned_messenger=${order.assigned_messenger}, assigned_messenger_id=${order.assigned_messenger_id}, status=${order.messenger_status}`);
        });

        // 2. Sincronizar asignaciones usando assigned_messenger_id como estándar
        console.log('\n2. 🔄 SINCRONIZANDO ASIGNACIONES:');
        
        for (const order of discrepancies) {
            let targetMessengerId = null;
            let action = '';

            // Determinar cuál valor usar como correcto
            if (order.assigned_messenger && !order.assigned_messenger_id) {
                // Usar assigned_messenger como fuente de verdad
                targetMessengerId = order.assigned_messenger;
                action = `Copiando assigned_messenger (${order.assigned_messenger}) a assigned_messenger_id`;
            } else if (!order.assigned_messenger && order.assigned_messenger_id) {
                // Usar assigned_messenger_id como fuente de verdad
                targetMessengerId = order.assigned_messenger_id;
                action = `Copiando assigned_messenger_id (${order.assigned_messenger_id}) a assigned_messenger`;
            } else if (order.assigned_messenger !== order.assigned_messenger_id) {
                // Conflicto: usar assigned_messenger_id como estándar (es el foreign key)
                targetMessengerId = order.assigned_messenger_id;
                action = `Resolviendo conflicto: usando assigned_messenger_id (${order.assigned_messenger_id})`;
            }

            if (targetMessengerId) {
                // Verificar que el mensajero existe
                const [messenger] = await connection.execute(
                    'SELECT id, full_name, role FROM users WHERE id = ? AND role = "mensajero"',
                    [targetMessengerId]
                );

                if (messenger.length > 0) {
                    console.log(`  ✅ ${order.order_number}: ${action}`);
                    
                    // Actualizar ambas columnas y el estado del mensajero
                    await connection.execute(`
                        UPDATE orders 
                        SET 
                            assigned_messenger_id = ?,
                            assigned_messenger = ?,
                            messenger_status = CASE 
                                WHEN messenger_status = 'pending_assignment' THEN 'assigned'
                                ELSE messenger_status
                            END,
                            updated_at = NOW()
                        WHERE id = ?
                    `, [targetMessengerId, targetMessengerId, order.id]);
                    
                    console.log(`     📝 Mensajero: ${messenger[0].full_name}`);
                } else {
                    console.log(`  ❌ ${order.order_number}: Mensajero ID ${targetMessengerId} no existe - limpiando asignación`);
                    
                    // Limpiar asignación si el mensajero no existe
                    await connection.execute(`
                        UPDATE orders 
                        SET 
                            assigned_messenger_id = NULL,
                            assigned_messenger = NULL,
                            messenger_status = 'pending_assignment',
                            updated_at = NOW()
                        WHERE id = ?
                    `, [order.id]);
                }
            }
        }

        // 3. Verificar resultado de la sincronización
        console.log('\n3. ✅ VERIFICANDO RESULTADO:');
        const [afterSync] = await connection.execute(`
            SELECT 
                id,
                order_number,
                status,
                assigned_messenger_id,
                assigned_messenger,
                messenger_status
            FROM orders 
            WHERE (assigned_messenger IS NOT NULL OR assigned_messenger_id IS NOT NULL)
            AND status IN ('en_reparto', 'listo_para_entrega')
            ORDER BY created_at DESC
        `);

        console.log(`📦 Pedidos con asignación después de sincronización: ${afterSync.length}`);
        afterSync.forEach(order => {
            const isConsistent = (order.assigned_messenger === order.assigned_messenger_id);
            const icon = isConsistent ? '✅' : '❌';
            console.log(`  ${icon} ${order.order_number}: assigned_messenger_id=${order.assigned_messenger_id}, assigned_messenger=${order.assigned_messenger}, status=${order.messenger_status}`);
        });

        // 4. Verificar específicamente el pedido FV-2-12844
        console.log('\n4. 🎯 VERIFICANDO PEDIDO FV-2-12844:');
        const [finalCheck] = await connection.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.assigned_messenger_id,
                o.assigned_messenger,
                o.messenger_status,
                u.full_name as messenger_name
            FROM orders o
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.order_number = 'FV-2-12844'
        `);

        if (finalCheck.length > 0) {
            const order = finalCheck[0];
            console.log('📋 Estado final del pedido FV-2-12844:');
            console.log(`   - Status: ${order.status}`);
            console.log(`   - assigned_messenger_id: ${order.assigned_messenger_id}`);
            console.log(`   - assigned_messenger: ${order.assigned_messenger}`);
            console.log(`   - messenger_status: ${order.messenger_status}`);
            console.log(`   - Mensajero: ${order.messenger_name || 'Sin asignar'}`);
            
            const isFixed = (order.assigned_messenger_id === order.assigned_messenger && order.assigned_messenger_id !== null);
            console.log(`   - Estado: ${isFixed ? '✅ SINCRONIZADO' : '❌ AÚN CON DISCREPANCIA'}`);
        }

        // 5. Estadísticas finales
        console.log('\n5. 📊 ESTADÍSTICAS FINALES:');
        
        // Contar pedidos por mensajero
        const [messengerStats] = await connection.execute(`
            SELECT 
                u.full_name as messenger_name,
                COUNT(o.id) as total_orders,
                SUM(CASE WHEN o.status = 'en_reparto' THEN 1 ELSE 0 END) as en_reparto,
                SUM(CASE WHEN o.messenger_status = 'assigned' THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN o.messenger_status = 'pending_assignment' THEN 1 ELSE 0 END) as pending
            FROM users u
            LEFT JOIN orders o ON u.id = o.assigned_messenger_id
            WHERE u.role = 'mensajero' AND u.active = 1
            GROUP BY u.id, u.full_name
            ORDER BY total_orders DESC
        `);

        console.log('📈 Pedidos por mensajero:');
        messengerStats.forEach(stat => {
            console.log(`   - ${stat.messenger_name}: ${stat.total_orders} total (${stat.en_reparto} en reparto, ${stat.assigned} asignados, ${stat.pending} pendientes)`);
        });

        console.log('\n🎉 SINCRONIZACIÓN COMPLETADA');

    } catch (error) {
        console.error('❌ Error durante sincronización:', error);
    } finally {
        await connection.end();
    }
}

fixMessengerAssignmentSynchronization();
