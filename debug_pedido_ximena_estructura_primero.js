const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function debugPedidoXimenaEstructura() {
    try {
        console.log('🔍 DIAGNÓSTICO DEL PEDIDO DE XIMENA (ESTRUCTURA PRIMERO)');
        console.log('=========================================================\n');

        const connection = await mysql.createConnection(dbConfig);

        // 1. Primero verificar la estructura de la tabla orders
        console.log('1. VERIFICANDO ESTRUCTURA DE TABLA ORDERS...');
        const [columns] = await connection.execute(`DESCRIBE orders`);

        console.log('📋 Estructura de la tabla orders:');
        columns.forEach(col => {
            console.log(`   ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });

        // 2. Buscar columnas relevantes para identificar pedidos
        const orderColumns = columns.map(col => col.Field);
        
        let idColumn = orderColumns.find(col => col === 'id') || 'id';
        let invoiceColumn = orderColumns.find(col => col.includes('invoice') || col.includes('number') || col.includes('factura'));
        let customerNameColumn = orderColumns.find(col => col.includes('customer') && col.includes('name')) || 'customer_name';
        let statusColumn = orderColumns.find(col => col === 'status') || 'status';
        let messengerStatusColumn = orderColumns.find(col => col.includes('messenger') && col.includes('status')) || 'messenger_status';
        let assignedMessengerColumn = orderColumns.find(col => col.includes('assigned') && col.includes('messenger')) || 'assigned_messenger_id';

        console.log(`\n📍 Columnas relevantes identificadas:`);
        console.log(`   ID: ${idColumn}`);
        console.log(`   Factura/Invoice: ${invoiceColumn || 'NO ENCONTRADA'}`);
        console.log(`   Nombre Cliente: ${customerNameColumn}`);
        console.log(`   Estado: ${statusColumn}`);
        console.log(`   Estado Mensajería: ${messengerStatusColumn || 'NO ENCONTRADA'}`);
        console.log(`   Mensajero Asignado: ${assignedMessengerColumn || 'NO ENCONTRADA'}`);

        // 3. Construir consulta dinámica basada en columnas existentes
        let selectColumns = [idColumn];
        
        if (invoiceColumn) selectColumns.push(invoiceColumn);
        if (orderColumns.includes(customerNameColumn)) selectColumns.push(customerNameColumn);
        if (orderColumns.includes('customer_document')) selectColumns.push('customer_document');
        if (orderColumns.includes(statusColumn)) selectColumns.push(statusColumn);
        if (messengerStatusColumn && orderColumns.includes(messengerStatusColumn)) selectColumns.push(messengerStatusColumn);
        if (assignedMessengerColumn && orderColumns.includes(assignedMessengerColumn)) selectColumns.push(assignedMessengerColumn);
        if (orderColumns.includes('created_at')) selectColumns.push('created_at');
        if (orderColumns.includes('shipping_date')) selectColumns.push('shipping_date');
        if (orderColumns.includes('delivery_method')) selectColumns.push('delivery_method');

        console.log(`\n2. BUSCANDO PEDIDO DE XIMENA CON COLUMNAS DISPONIBLES...`);

        const selectQuery = `
            SELECT ${selectColumns.join(', ')}
            FROM orders 
            WHERE ${customerNameColumn} LIKE '%XIMENA%' 
               OR ${customerNameColumn} LIKE '%BENAVIDES%'
               OR ${customerNameColumn} LIKE '%PABON%'
            ORDER BY ${orderColumns.includes('created_at') ? 'created_at' : idColumn} DESC
        `;

        console.log('📝 Ejecutando consulta:', selectQuery);

        const [orders] = await connection.execute(selectQuery);

        if (orders.length === 0) {
            console.log('❌ No se encontró el pedido de Ximena');
            
            // Mostrar algunos pedidos recientes para referencia
            console.log('\n📦 Mostrando últimos 5 pedidos para referencia:');
            const recentQuery = `SELECT ${selectColumns.join(', ')} FROM orders ORDER BY ${orderColumns.includes('created_at') ? 'created_at' : idColumn} DESC LIMIT 5`;
            const [recentOrders] = await connection.execute(recentQuery);
            
            recentOrders.forEach((order, index) => {
                console.log(`\n${index + 1}. Pedido ID: ${order[idColumn]}`);
                selectColumns.forEach(col => {
                    if (col !== idColumn && order[col] !== undefined) {
                        console.log(`   ${col}: ${order[col]}`);
                    }
                });
            });
        } else {
            console.log(`✅ Encontrado ${orders.length} pedido(s) de Ximena:`);
            orders.forEach((order, index) => {
                console.log(`\n📦 PEDIDO ${index + 1} (ID: ${order[idColumn]})`);
                selectColumns.forEach(col => {
                    if (order[col] !== undefined) {
                        console.log(`   ${col}: ${order[col]}`);
                    }
                });
            });

            // Analizar el problema específico
            const problemOrder = orders[0];
            console.log(`\n🔍 ANÁLISIS DEL PROBLEMA:`);
            
            if (messengerStatusColumn && problemOrder[messengerStatusColumn]) {
                console.log(`   Estado Mensajería: ${problemOrder[messengerStatusColumn]}`);
            }
            
            if (assignedMessengerColumn && problemOrder[assignedMessengerColumn]) {
                console.log(`   Mensajero Asignado: ${problemOrder[assignedMessengerColumn]}`);
            } else if (assignedMessengerColumn) {
                console.log(`   ⚠️  Mensajero Asignado: NULL - AQUÍ ESTÁ EL PROBLEMA`);
            }
            
            if (statusColumn && problemOrder[statusColumn]) {
                console.log(`   Estado General: ${problemOrder[statusColumn]}`);
                
                if (problemOrder[statusColumn] === 'en_reparto' && (!problemOrder[assignedMessengerColumn] || problemOrder[assignedMessengerColumn] === null)) {
                    console.log(`   🚨 PROBLEMA IDENTIFICADO: Pedido marcado como "en_reparto" pero sin mensajero asignado`);
                }
            }
        }

        // 4. Verificar mensajeros disponibles
        console.log('\n3. VERIFICANDO MENSAJEROS DISPONIBLES...');
        const [messengers] = await connection.execute(`
            SELECT id, username, full_name, role, is_active
            FROM users 
            WHERE role = 'mensajero' 
            ORDER BY full_name
        `);

        if (messengers.length > 0) {
            console.log(`✅ Encontrados ${messengers.length} mensajero(s):`);
            messengers.forEach(messenger => {
                console.log(`
👤 MENSAJERO ${messenger.id}
   Username: ${messenger.username}
   Nombre: ${messenger.full_name}
   Activo: ${messenger.is_active ? 'Sí' : 'No'}
                `);
            });
        } else {
            console.log('❌ No se encontraron mensajeros en el sistema');
        }

        await connection.end();

        console.log('\n=====================================');
        console.log('🔧 ANÁLISIS COMPLETADO');
        console.log('=====================================');

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
}

debugPedidoXimenaEstructura();
