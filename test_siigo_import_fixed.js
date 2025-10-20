const axios = require('axios');
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function testSiigoImportFixed() {
    let connection;
    try {
        console.log('🧪 PROBANDO IMPORTACIÓN SIIGO CORREGIDA...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // PASO 1: Verificar estado inicial
        console.log('\n📊 PASO 1: Estado inicial...');
        const [initialCount] = await connection.execute('SELECT COUNT(*) as count FROM orders');
        console.log(`   📦 Pedidos iniciales: ${initialCount[0].count}`);
        
        // PASO 2: Obtener facturas disponibles
        console.log('\n📋 PASO 2: Obteniendo facturas desde API...');
        
        const response = await axios.get('http://localhost:3001/api/siigo/invoices', {
            params: { page: 1, page_size: 5 },
            timeout: 10000
        });
        
        if (!response.data.success) {
            throw new Error(`Error API: ${response.data.message}`);
        }
        
        const invoices = response.data.data.results;
        console.log(`   ✅ ${invoices.length} facturas obtenidas`);
        
        // Encontrar una factura no importada
        const availableInvoice = invoices.find(inv => !inv.is_imported);
        
        if (!availableInvoice) {
            console.log('   ⚠️ No hay facturas disponibles para importar');
            console.log('   💡 Todas las facturas ya han sido importadas');
            return;
        }
        
        console.log(`   🎯 Factura a probar: ${availableInvoice.name} (ID: ${availableInvoice.id})`);
        console.log(`   👤 Cliente: ${availableInvoice.customer?.commercial_name || 'Sin nombre'}`);
        console.log(`   💰 Total: $${availableInvoice.total || 'N/A'}`);
        
        // PASO 3: Intentar importación
        console.log('\n💾 PASO 3: Intentando importación...');
        
        const importData = {
            invoice_ids: [availableInvoice.id],
            payment_method: 'transferencia',
            delivery_method: 'domicilio'
        };
        
        const importResponse = await axios.post('http://localhost:3001/api/siigo/import', importData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });
        
        console.log(`   📊 Respuesta:`, importResponse.data);
        
        // PASO 4: Verificar resultado
        console.log('\n🔍 PASO 4: Verificando resultado...');
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
        
        if (importResponse.data.success && importResponse.data.summary.successful > 0) {
            console.log(`   ✅ IMPORTACIÓN EXITOSA!`);
            console.log(`   📊 ${importResponse.data.summary.successful} de ${importResponse.data.summary.total} facturas importadas`);
            
            // Verificar en base de datos
            const [newCount] = await connection.execute('SELECT COUNT(*) as count FROM orders');
            const [newOrder] = await connection.execute(
                'SELECT * FROM orders WHERE siigo_invoice_id = ? ORDER BY created_at DESC LIMIT 1',
                [availableInvoice.id]
            );
            
            console.log(`   📦 Pedidos: ${initialCount[0].count} → ${newCount[0].count} (+${newCount[0].count - initialCount[0].count})`);
            
            if (newOrder.length > 0) {
                const order = newOrder[0];
                console.log(`   🎉 PEDIDO CREADO EXITOSAMENTE:`);
                console.log(`      🆔 ID: ${order.id}`);
                console.log(`      📄 Número: ${order.order_number}`);
                console.log(`      👤 Cliente: ${order.customer_name}`);
                console.log(`      💰 Total: $${order.total_amount}`);
                console.log(`      📊 Estado: ${order.status}`);
                console.log(`      👥 Creado por: ID ${order.created_by}`);
                
                // Verificar items
                const [items] = await connection.execute('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
                console.log(`      📋 Items: ${items.length}`);
                
            } else {
                console.log(`   ❌ ERROR: Pedido no encontrado en BD a pesar del éxito reportado`);
            }
            
        } else {
            console.log(`   ❌ IMPORTACIÓN FALLÓ`);
            if (importResponse.data.results && importResponse.data.results.length > 0) {
                const failedResult = importResponse.data.results[0];
                console.log(`   🚨 Error: ${failedResult.message}`);
                
                if (failedResult.message.includes('foreign key constraint')) {
                    console.log(`   ⚠️ PROBLEMA PERSISTENTE: El error de foreign key aún no está resuelto`);
                    console.log(`   💡 SOLUCIÓN: Verificar que getSystemUserId() funcione correctamente`);
                } else {
                    console.log(`   💡 Nuevo tipo de error - investigar`);
                }
            }
        }
        
        // PASO 5: Estado final
        console.log('\n📊 PASO 5: Estado final...');
        const [finalCount] = await connection.execute('SELECT COUNT(*) as count FROM orders');
        const [siigoCount] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE siigo_invoice_id IS NOT NULL');
        
        console.log(`   📦 Total pedidos: ${finalCount[0].count}`);
        console.log(`   🔗 Pedidos SIIGO: ${siigoCount[0].count}`);
        
        console.log('\n🎯 RESULTADO FINAL:');
        if (importResponse.data.success && importResponse.data.summary.successful > 0) {
            console.log('   ✅ ¡CORRECCIÓN EXITOSA! La importación SIIGO ahora funciona correctamente');
        } else {
            console.log('   ❌ La corrección aún necesita ajustes');
        }
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
        if (error.response) {
            console.error('📄 Respuesta del servidor:', error.response.data);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar prueba
testSiigoImportFixed();
