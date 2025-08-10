const mysql = require('mysql2/promise');
const axios = require('axios');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function debugCompleteImportFlow() {
    let connection;
    try {
        console.log('🔍 INICIANDO DEBUG COMPLETO DEL FLUJO DE IMPORTACIÓN SIIGO...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // PASO 1: Verificar estado inicial
        console.log('\n📊 PASO 1: Verificando estado inicial...');
        
        const [ordersCount] = await connection.execute('SELECT COUNT(*) as count FROM orders');
        const [orderItemsCount] = await connection.execute('SELECT COUNT(*) as count FROM order_items');
        const [siigoOrders] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE siigo_invoice_id IS NOT NULL');
        
        console.log(`   📦 Pedidos totales: ${ordersCount[0].count}`);
        console.log(`   📋 Items de pedidos: ${orderItemsCount[0].count}`);
        console.log(`   🔗 Pedidos de SIIGO: ${siigoOrders[0].count}`);
        
        // PASO 2: Obtener facturas disponibles desde SIIGO API
        console.log('\n📋 PASO 2: Obteniendo facturas desde SIIGO API...');
        
        const apiResponse = await axios.get('http://localhost:3001/api/siigo/invoices', {
            params: {
                page: 1,
                page_size: 10
            }
        });
        
        if (!apiResponse.data.success) {
            throw new Error(`API Error: ${apiResponse.data.message}`);
        }
        
        const invoices = apiResponse.data.data.results;
        console.log(`   ✅ ${invoices.length} facturas obtenidas`);
        
        // Encontrar una factura no importada
        const availableInvoice = invoices.find(inv => !inv.is_imported);
        
        if (!availableInvoice) {
            console.log('   ⚠️  No hay facturas disponibles para importar');
            return;
        }
        
        console.log(`   🎯 Factura seleccionada: ${availableInvoice.name} (ID: ${availableInvoice.id})`);
        console.log(`   👤 Cliente: ${availableInvoice.customer?.commercial_name || availableInvoice.customer?.name || 'Sin nombre'}`);
        console.log(`   💰 Total: $${availableInvoice.total || 'Sin total'}`);
        
        // PASO 3: Simular importación manual
        console.log('\n💾 PASO 3: Simulando importación manual...');
        
        const importData = {
            invoice_ids: [availableInvoice.id],
            payment_method: 'transferencia',
            delivery_method: 'domicilio'
        };
        
        console.log(`   📤 Enviando solicitud de importación...`);
        console.log(`   📋 Datos:`, importData);
        
        try {
            const importResponse = await axios.post('http://localhost:3001/api/siigo/import', importData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            
            console.log(`   ✅ Respuesta de importación:`, importResponse.data);
            
            if (importResponse.data.success) {
                console.log(`   🎉 Importación exitosa!`);
                console.log(`   📊 Resumen: ${importResponse.data.summary?.successful || 'N/A'} exitosas de ${importResponse.data.summary?.total || 'N/A'}`);
            } else {
                console.log(`   ❌ Importación falló: ${importResponse.data.message}`);
            }
            
        } catch (importError) {
            console.error(`   ❌ Error en solicitud de importación:`, importError.message);
            if (importError.response) {
                console.error(`   📄 Respuesta del servidor:`, importError.response.data);
            }
            throw importError;
        }
        
        // PASO 4: Verificar cambios en la base de datos
        console.log('\n🔍 PASO 4: Verificando cambios en base de datos...');
        
        // Esperar un momento para que se complete la transacción
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const [newOrdersCount] = await connection.execute('SELECT COUNT(*) as count FROM orders');
        const [newOrderItemsCount] = await connection.execute('SELECT COUNT(*) as count FROM order_items');
        const [newSiigoOrders] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE siigo_invoice_id IS NOT NULL');
        
        console.log(`   📦 Pedidos totales: ${ordersCount[0].count} → ${newOrdersCount[0].count} (${newOrdersCount[0].count - ordersCount[0].count > 0 ? '+' : ''}${newOrdersCount[0].count - ordersCount[0].count})`);
        console.log(`   📋 Items de pedidos: ${orderItemsCount[0].count} → ${newOrderItemsCount[0].count} (${newOrderItemsCount[0].count - orderItemsCount[0].count > 0 ? '+' : ''}${newOrderItemsCount[0].count - orderItemsCount[0].count})`);
        console.log(`   🔗 Pedidos de SIIGO: ${siigoOrders[0].count} → ${newSiigoOrders[0].count} (${newSiigoOrders[0].count - siigoOrders[0].count > 0 ? '+' : ''}${newSiigoOrders[0].count - siigoOrders[0].count})`);
        
        // PASO 5: Buscar el pedido específico importado
        console.log('\n🔍 PASO 5: Buscando pedido importado específico...');
        
        const [importedOrder] = await connection.execute(
            'SELECT * FROM orders WHERE siigo_invoice_id = ? ORDER BY created_at DESC LIMIT 1',
            [availableInvoice.id]
        );
        
        if (importedOrder.length > 0) {
            const order = importedOrder[0];
            console.log(`   ✅ PEDIDO ENCONTRADO:`);
            console.log(`      🆔 ID: ${order.id}`);
            console.log(`      📄 Número: ${order.order_number}`);
            console.log(`      👤 Cliente: ${order.customer_name}`);
            console.log(`      📞 Teléfono: ${order.customer_phone}`);
            console.log(`      💰 Total: $${order.total_amount}`);
            console.log(`      📊 Estado: ${order.status}`);
            console.log(`      🏷️  SIIGO ID: ${order.siigo_invoice_id}`);
            
            // Buscar items del pedido
            const [orderItems] = await connection.execute(
                'SELECT * FROM order_items WHERE order_id = ?',
                [order.id]
            );
            
            console.log(`   📋 ITEMS DEL PEDIDO: ${orderItems.length}`);
            orderItems.forEach((item, index) => {
                console.log(`      ${index + 1}. ${item.name} (Cantidad: ${item.quantity}, Precio: $${item.price})`);
            });
            
        } else {
            console.log(`   ❌ PEDIDO NO ENCONTRADO en base de datos`);
            console.log(`   🔍 Buscando en sync_log...`);
            
            const [syncLog] = await connection.execute(
                'SELECT * FROM siigo_sync_log WHERE siigo_invoice_id = ? ORDER BY processed_at DESC LIMIT 1',
                [availableInvoice.id]
            );
            
            if (syncLog.length > 0) {
                console.log(`   📋 Log de sincronización encontrado:`);
                console.log(`      📊 Estado: ${syncLog[0].sync_status}`);
                console.log(`      ❌ Error: ${syncLog[0].error_message || 'Sin error'}`);
                console.log(`      ⏰ Procesado: ${syncLog[0].processed_at}`);
            } else {
                console.log(`   ❌ Sin registro en sync_log tampoco`);
            }
        }
        
        // PASO 6: Verificar disponibilidad en API después de importación
        console.log('\n🔄 PASO 6: Verificando disponibilidad en API después de importación...');
        
        const postImportResponse = await axios.get('http://localhost:3001/api/siigo/invoices', {
            params: {
                page: 1,
                page_size: 10
            }
        });
        
        const postImportInvoices = postImportResponse.data.data.results;
        const targetInvoice = postImportInvoices.find(inv => inv.id === availableInvoice.id);
        
        if (targetInvoice) {
            console.log(`   📋 Factura aún visible en API:`);
            console.log(`      🏷️  ID: ${targetInvoice.id}`);
            console.log(`      📄 Nombre: ${targetInvoice.name}`);
            console.log(`      ✅ Importada: ${targetInvoice.is_imported ? 'SÍ' : 'NO'}`);
            console.log(`      📊 Estado: ${targetInvoice.import_status}`);
        } else {
            console.log(`   ❌ Factura ya no está en la lista de API`);
        }
        
        console.log('\n🎯 DIAGNÓSTICO COMPLETO:');
        const wasImported = newSiigoOrders[0].count > siigoOrders[0].count;
        
        if (wasImported && importedOrder.length > 0) {
            console.log('   ✅ IMPORTACIÓN EXITOSA - Pedido creado correctamente');
        } else if (wasImported && importedOrder.length === 0) {
            console.log('   ⚠️  IMPORTACIÓN PARCIAL - Contador aumentó pero pedido no encontrado');
        } else {
            console.log('   ❌ IMPORTACIÓN FALLIDA - No se creó el pedido');
            console.log('   💡 Posibles causas:');
            console.log('      - Error en processInvoiceToOrder');
            console.log('      - Transacción revertida');
            console.log('      - Error de foreign key');
            console.log('      - Error de validación de datos');
        }
        
    } catch (error) {
        console.error('❌ Error en debug del flujo de importación:', error.message);
        if (error.response) {
            console.error('📄 Response data:', error.response.data);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar debug
debugCompleteImportFlow();
