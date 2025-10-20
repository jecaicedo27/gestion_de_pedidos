const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function fixPedidoXimenaAsignacion() {
    try {
        console.log('🔧 SOLUCIONANDO EL PROBLEMA DEL PEDIDO DE XIMENA');
        console.log('==================================================\n');

        const connection = await mysql.createConnection(dbConfig);

        // 1. Primero verificar la estructura de la tabla users
        console.log('1. VERIFICANDO ESTRUCTURA DE TABLA USERS...');
        const [userColumns] = await connection.execute(`DESCRIBE users`);
        
        console.log('📋 Columnas disponibles en users:');
        userColumns.forEach(col => {
            console.log(`   ${col.Field}: ${col.Type}`);
        });

        // 2. Buscar mensajeros disponibles (ajustar consulta según columnas disponibles)
        const availableColumns = userColumns.map(col => col.Field);
        let userSelectColumns = ['id', 'username'];
        
        if (availableColumns.includes('full_name')) userSelectColumns.push('full_name');
        if (availableColumns.includes('name')) userSelectColumns.push('name');
        if (availableColumns.includes('role')) userSelectColumns.push('role');
        if (availableColumns.includes('active')) userSelectColumns.push('active');
        if (availableColumns.includes('status')) userSelectColumns.push('status');

        console.log('\n2. BUSCANDO MENSAJEROS DISPONIBLES...');
        
        let messengerQuery = `SELECT ${userSelectColumns.join(', ')} FROM users WHERE role = 'mensajero'`;
        
        const [messengers] = await connection.execute(messengerQuery);

        if (messengers.length === 0) {
            console.log('❌ No se encontraron mensajeros. Buscando todos los usuarios para ver roles disponibles:');
            
            const [allUsers] = await connection.execute(`SELECT ${userSelectColumns.join(', ')} FROM users ORDER BY id`);
            allUsers.forEach(user => {
                console.log(`   ID: ${user.id}, Username: ${user.username}, Rol: ${user.role || 'N/A'}`);
            });
            
            console.log('\n⚠️ Sin mensajeros no podemos asignar el pedido. Creando mensajero de prueba...');
            
            // Crear mensajero de prueba si no existe
            await connection.execute(`
                INSERT INTO users (username, password, full_name, role, created_at, updated_at)
                VALUES ('mensajero1', '$2b$10$defaulthashedpassword', 'Mensajero 1', 'mensajero', NOW(), NOW())
                ON DUPLICATE KEY UPDATE username = username
            `);
            
            // Verificar si se creó
            const [newMessengers] = await connection.execute(messengerQuery);
            if (newMessengers.length > 0) {
                console.log('✅ Mensajero creado exitosamente');
                messengers.push(...newMessengers);
            }
        }

        if (messengers.length === 0) {
            console.log('❌ No se pudo crear ni encontrar mensajeros. Abortando.');
            await connection.end();
            return;
        }

        console.log(`✅ Encontrados ${messengers.length} mensajero(s):`);
        messengers.forEach(messenger => {
            console.log(`
👤 MENSAJERO ${messenger.id}
   Username: ${messenger.username}
   Nombre: ${messenger.full_name || messenger.name || 'N/A'}
   Rol: ${messenger.role}
   Estado: ${messenger.active || messenger.status || 'N/A'}
            `);
        });

        // 3. Identificar el pedido problemático de Ximena
        console.log('\n3. IDENTIFICANDO PEDIDO PROBLEMÁTICO DE XIMENA...');
        const [ximenaPedidos] = await connection.execute(`
            SELECT id, order_number, customer_name, status, messenger_status, assigned_messenger_id
            FROM orders 
            WHERE customer_name LIKE '%XIMENA%' 
              AND status = 'en_reparto' 
              AND (assigned_messenger_id IS NULL OR messenger_status = 'pending_assignment')
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (ximenaPedidos.length === 0) {
            console.log('❌ No se encontró el pedido problemático de Ximena');
            await connection.end();
            return;
        }

        const pedidoProblema = ximenaPedidos[0];
        console.log(`
🚨 PEDIDO PROBLEMÁTICO IDENTIFICADO:
   ID: ${pedidoProblema.id}
   Número: ${pedidoProblema.order_number}
   Cliente: ${pedidoProblema.customer_name}
   Estado: ${pedidoProblema.status}
   Estado Mensajería: ${pedidoProblema.messenger_status}
   Mensajero Asignado: ${pedidoProblema.assigned_messenger_id || 'NULL'}
        `);

        // 4. Asignar mensajero y corregir estados
        const mensajeroSeleccionado = messengers[0]; // Tomar el primer mensajero disponible
        
        console.log('\n4. CORRIGIENDO ASIGNACIÓN DE MENSAJERO...');
        console.log(`📋 Asignando mensajero: ${mensajeroSeleccionado.username} (ID: ${mensajeroSeleccionado.id})`);

        // Actualizar el pedido con la asignación correcta
        await connection.execute(`
            UPDATE orders 
            SET 
                assigned_messenger_id = ?,
                messenger_status = 'assigned',
                updated_at = NOW()
            WHERE id = ?
        `, [mensajeroSeleccionado.id, pedidoProblema.id]);

        // 5. Verificar que la corrección fue exitosa
        console.log('\n5. VERIFICANDO CORRECCIÓN...');
        const [pedidoCorregido] = await connection.execute(`
            SELECT id, order_number, customer_name, status, messenger_status, assigned_messenger_id
            FROM orders 
            WHERE id = ?
        `, [pedidoProblema.id]);

        if (pedidoCorregido.length > 0) {
            const pedido = pedidoCorregido[0];
            console.log(`
✅ PEDIDO CORREGIDO EXITOSAMENTE:
   ID: ${pedido.id}
   Número: ${pedido.order_number}
   Cliente: ${pedido.customer_name}
   Estado: ${pedido.status}
   Estado Mensajería: ${pedido.messenger_status}
   Mensajero Asignado: ${pedido.assigned_messenger_id}
            `);

            // Verificar si ahora aparece correctamente en logística
            console.log('\n6. VERIFICANDO VISTA DE LOGÍSTICA...');
            const [logisticaView] = await connection.execute(`
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
                WHERE o.id = ?
            `, [pedido.id]);

            if (logisticaView.length > 0) {
                const vista = logisticaView[0];
                console.log(`
📊 VISTA DE LOGÍSTICA:
   Pedido: ${vista.order_number} - ${vista.customer_name}
   Estado: ${vista.status}
   Estado Mensajería: ${vista.messenger_status}
   Mensajero: ${vista.mensajero_username} (${vista.mensajero_nombre || 'Sin nombre'})
                `);
            }
        }

        // 7. Verificar si hay otros pedidos con el mismo problema
        console.log('\n7. VERIFICANDO OTROS PEDIDOS CON EL MISMO PROBLEMA...');
        const [otrosPedidosProblema] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM orders 
            WHERE status = 'en_reparto' 
              AND (assigned_messenger_id IS NULL OR messenger_status = 'pending_assignment')
        `);

        if (otrosPedidosProblema[0].count > 0) {
            console.log(`⚠️ Se encontraron ${otrosPedidosProblema[0].count} pedido(s) adicional(es) con el mismo problema.`);
            
            const [pedidosAdicionales] = await connection.execute(`
                SELECT id, order_number, customer_name, status, messenger_status
                FROM orders 
                WHERE status = 'en_reparto' 
                  AND (assigned_messenger_id IS NULL OR messenger_status = 'pending_assignment')
                LIMIT 5
            `);
            
            console.log('📋 Primeros 5 pedidos adicionales con problema:');
            pedidosAdicionales.forEach(pedido => {
                console.log(`   ${pedido.order_number} - ${pedido.customer_name} (Estado: ${pedido.status}, Mensajería: ${pedido.messenger_status})`);
            });
        } else {
            console.log('✅ No se encontraron otros pedidos con el mismo problema');
        }

        await connection.end();

        console.log('\n=====================================');
        console.log('🎉 CORRECCIÓN COMPLETADA');
        console.log('=====================================');
        console.log('El pedido de Ximena ahora debería aparecer correctamente');
        console.log('asignado en la página de logística.');

    } catch (error) {
        console.error('❌ Error al corregir pedido:', error);
    }
}

fixPedidoXimenaAsignacion();
