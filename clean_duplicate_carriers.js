const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function cleanDuplicateCarriers() {
    let connection;
    
    try {
        console.log('🧹 Limpiando transportadoras duplicadas...');
        
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión a base de datos establecida');

        // 1. Mostrar estado actual
        console.log('\n1️⃣ Estado actual de transportadoras:');
        const [currentCarriers] = await connection.execute(
            'SELECT id, name, code, active FROM carriers ORDER BY name'
        );
        
        currentCarriers.forEach(carrier => {
            console.log(`   - ${carrier.name} (${carrier.code}) - ID: ${carrier.id} - Activa: ${carrier.active}`);
        });

        // 2. Identificar duplicados a eliminar
        const carriersToDelete = [];
        
        // Buscar "Envia" (sin acento) para eliminar
        const envia = currentCarriers.find(c => c.name === 'Envia' && c.code === 'ENVIA');
        if (envia) {
            carriersToDelete.push(envia);
            console.log(`\n❌ Para eliminar: ${envia.name} (${envia.code}) - ID: ${envia.id}`);
        }

        // Buscar "Inter Rapidísimo" para eliminar (mantener "Interrapidísimo")
        const interRapido = currentCarriers.find(c => c.name === 'Inter Rapidísimo' && c.code === 'INTER_RAPIDSIMO');
        if (interRapido) {
            carriersToDelete.push(interRapido);
            console.log(`❌ Para eliminar: ${interRapido.name} (${interRapido.code}) - ID: ${interRapido.id}`);
        }

        if (carriersToDelete.length === 0) {
            console.log('\n✅ No hay duplicados para eliminar');
            return;
        }

        // 3. Verificar si hay pedidos usando estas transportadoras
        console.log('\n2️⃣ Verificando pedidos que usan estas transportadoras...');
        
        for (const carrier of carriersToDelete) {
            const [orders] = await connection.execute(
                'SELECT id, order_number FROM orders WHERE carrier_id = ?',
                [carrier.id]
            );
            
            if (orders.length > 0) {
                console.log(`⚠️  ${carrier.name} tiene ${orders.length} pedidos asignados:`);
                orders.forEach(order => {
                    console.log(`     - ${order.order_number} (ID: ${order.id})`);
                });
                
                // Encontrar la transportadora correcta a la que migrar
                let targetCarrier = null;
                if (carrier.name === 'Envia') {
                    targetCarrier = currentCarriers.find(c => c.name === 'Envía' && c.code === 'ENVA');
                } else if (carrier.name === 'Inter Rapidísimo') {
                    targetCarrier = currentCarriers.find(c => c.name === 'Interrapidísimo' && c.code === 'INTER');
                }
                
                if (targetCarrier) {
                    console.log(`🔄 Migrando pedidos a: ${targetCarrier.name} (ID: ${targetCarrier.id})`);
                    
                    await connection.execute(
                        'UPDATE orders SET carrier_id = ? WHERE carrier_id = ?',
                        [targetCarrier.id, carrier.id]
                    );
                    
                    console.log(`✅ ${orders.length} pedidos migrados exitosamente`);
                }
            } else {
                console.log(`✅ ${carrier.name} no tiene pedidos asignados`);
            }
        }

        // 4. Eliminar transportadoras duplicadas
        console.log('\n3️⃣ Eliminando transportadoras duplicadas...');
        
        for (const carrier of carriersToDelete) {
            await connection.execute(
                'DELETE FROM carriers WHERE id = ?',
                [carrier.id]
            );
            console.log(`🗑️  Eliminada: ${carrier.name} (${carrier.code}) - ID: ${carrier.id}`);
        }

        // 5. Mostrar estado final
        console.log('\n4️⃣ Estado final de transportadoras:');
        const [finalCarriers] = await connection.execute(
            'SELECT id, name, code, active FROM carriers ORDER BY name'
        );
        
        finalCarriers.forEach(carrier => {
            console.log(`   - ${carrier.name} (${carrier.code}) - ID: ${carrier.id} - Activa: ${carrier.active}`);
        });

        console.log('\n✅ Limpieza completada exitosamente');
        console.log('📋 Transportadoras finales:');
        console.log('   - Envía (sin duplicado Envia)');
        console.log('   - Interrapidísimo (sin duplicado Inter Rapidísimo)');

    } catch (error) {
        console.error('❌ Error limpiando duplicados:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

// Ejecutar la limpieza
cleanDuplicateCarriers().catch(console.error);
