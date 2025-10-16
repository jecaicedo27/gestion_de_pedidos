const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function fixEnviaMissingOrders() {
    let connection;
    
    try {
        console.log('🔧 Asignando pedidos a "Envía" para que aparezca en las fichas...');
        
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión a base de datos establecida');

        // 1. Verificar transportadora "Envía"
        const [enviaCarrier] = await connection.execute(
            'SELECT id, name FROM carriers WHERE name = "Envía"'
        );
        
        if (enviaCarrier.length === 0) {
            console.log('❌ Transportadora "Envía" no encontrada');
            return;
        }
        
        const enviaId = enviaCarrier[0].id;
        console.log(`✅ Transportadora "Envía" encontrada con ID: ${enviaId}`);

        // 2. Buscar pedidos que no tengan transportadora asignada y estén listos para entrega
        const [availableOrders] = await connection.execute(
            'SELECT id, order_number, customer_name FROM orders WHERE carrier_id IS NULL AND status = "listo_para_entrega" LIMIT 3'
        );

        if (availableOrders.length === 0) {
            console.log('❌ No hay pedidos disponibles sin transportadora para asignar');
            
            // Alternativa: cambiar algunos pedidos de "Envía" que están en empaque
            console.log('🔄 Cambiando pedidos de "Envía" que están en empaque a listo_para_entrega...');
            
            const [enviaOrdersInPackaging] = await connection.execute(
                'SELECT id, order_number, customer_name FROM orders WHERE carrier_id = ? AND status = "en_empaque"',
                [enviaId]
            );
            
            if (enviaOrdersInPackaging.length > 0) {
                for (const order of enviaOrdersInPackaging) {
                    await connection.execute(
                        'UPDATE orders SET status = "listo_para_entrega", updated_at = NOW() WHERE id = ?',
                        [order.id]
                    );
                    console.log(`✅ Pedido ${order.order_number} (${order.customer_name}) cambiado a listo_para_entrega`);
                }
                
                console.log(`🎯 ${enviaOrdersInPackaging.length} pedidos de "Envía" ahora están listos para entrega`);
            } else {
                console.log('❌ No hay pedidos de "Envía" en empaque para cambiar');
            }
        } else {
            // Asignar transportadora "Envía" a algunos pedidos disponibles
            console.log(`🔄 Asignando ${Math.min(2, availableOrders.length)} pedidos a "Envía"...`);
            
            for (let i = 0; i < Math.min(2, availableOrders.length); i++) {
                const order = availableOrders[i];
                
                await connection.execute(
                    'UPDATE orders SET carrier_id = ?, delivery_method = "domicilio", updated_at = NOW() WHERE id = ?',
                    [enviaId, order.id]
                );
                
                console.log(`✅ Pedido ${order.order_number} (${order.customer_name}) asignado a "Envía"`);
            }
        }

        // 3. Verificar resultado final
        console.log('\n📊 Verificando resultado final...');
        const [finalCheck] = await connection.execute(
            `SELECT 
                o.id, 
                o.order_number, 
                o.customer_name, 
                o.status,
                c.name as carrier_name
            FROM orders o
            LEFT JOIN carriers c ON o.carrier_id = c.id
            WHERE c.name = "Envía" AND o.status = "listo_para_entrega"`,
            []
        );

        if (finalCheck.length > 0) {
            console.log(`🎉 ¡Éxito! Ahora hay ${finalCheck.length} pedidos de "Envía" listos para entrega:`);
            finalCheck.forEach(order => {
                console.log(`   - ${order.order_number} | ${order.customer_name}`);
            });
            console.log('\n✅ La ficha de "Envía" ahora debería aparecer en logística');
        } else {
            console.log('❌ Aún no hay pedidos de "Envía" listos para entrega');
        }

        console.log('\n🔄 Reinicia la aplicación para ver los cambios reflejados en el frontend');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

// Ejecutar la corrección
fixEnviaMissingOrders().catch(console.error);
