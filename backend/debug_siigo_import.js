const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugSiigoImport() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos'
  });
  
  console.log('🔍 DIAGNÓSTICO DE IMPORTACIÓN SIIGO');
  console.log('=====================================\n');
  
  try {
    // 1. Verificar logs de sincronización recientes
    console.log('1. 📋 LOGS DE SINCRONIZACIÓN RECIENTES:');
    const [logs] = await connection.execute(`
      SELECT 
        id,
        siigo_invoice_id,
        sync_type,
        sync_status,
        order_id,
        error_message,
        processed_at
      FROM siigo_sync_log 
      ORDER BY processed_at DESC 
      LIMIT 10
    `);
    
    if (logs.length === 0) {
      console.log('❌ No hay logs de sincronización');
    } else {
      logs.forEach(log => {
        console.log(`📄 Factura: ${log.siigo_invoice_id}`);
        console.log(`   Estado: ${log.sync_status}`);
        console.log(`   Tipo: ${log.sync_type}`);
        console.log(`   Pedido ID: ${log.order_id || 'N/A'}`);
        console.log(`   Fecha: ${log.processed_at}`);
        if (log.error_message) {
          console.log(`   Error: ${log.error_message}`);
        }
        console.log('');
      });
    }
    
    // 2. Verificar pedidos con siigo_invoice_id
    console.log('2. 📦 PEDIDOS IMPORTADOS DESDE SIIGO:');
    const [orders] = await connection.execute(`
      SELECT 
        id,
        order_number,
        customer_name,
        status,
        siigo_invoice_id,
        siigo_invoice_number,
        created_at
      FROM orders 
      WHERE siigo_invoice_id IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (orders.length === 0) {
      console.log('❌ No hay pedidos importados desde SIIGO');
    } else {
      orders.forEach(order => {
        console.log(`📦 Pedido: ${order.order_number}`);
        console.log(`   Cliente: ${order.customer_name}`);
        console.log(`   Estado: ${order.status}`);
        console.log(`   Factura SIIGO: ${order.siigo_invoice_id}`);
        console.log(`   Número Factura: ${order.siigo_invoice_number}`);
        console.log(`   Fecha: ${order.created_at}`);
        console.log('');
      });
    }
    
    // 3. Verificar logs con errores
    console.log('3. ❌ LOGS CON ERRORES:');
    const [errorLogs] = await connection.execute(`
      SELECT 
        siigo_invoice_id,
        error_message,
        processed_at
      FROM siigo_sync_log 
      WHERE sync_status = 'error'
      ORDER BY processed_at DESC 
      LIMIT 5
    `);
    
    if (errorLogs.length === 0) {
      console.log('✅ No hay errores recientes');
    } else {
      errorLogs.forEach(log => {
        console.log(`📄 Factura: ${log.siigo_invoice_id}`);
        console.log(`   Error: ${log.error_message}`);
        console.log(`   Fecha: ${log.processed_at}`);
        console.log('');
      });
    }
    
    // 4. Verificar estructura de tabla orders
    console.log('4. 🏗️ ESTRUCTURA DE TABLA ORDERS:');
    const [columns] = await connection.execute(`
      DESCRIBE orders
    `);
    
    const importantColumns = ['siigo_invoice_id', 'siigo_invoice_number', 'status'];
    importantColumns.forEach(col => {
      const column = columns.find(c => c.Field === col);
      if (column) {
        console.log(`✅ ${col}: ${column.Type} (${column.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      } else {
        console.log(`❌ ${col}: NO EXISTE`);
      }
    });
    
    // 5. Verificar si existe tabla siigo_sync_log
    console.log('\n5. 📋 VERIFICAR TABLA SIIGO_SYNC_LOG:');
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'siigo_sync_log'
    `);
    
    if (tables.length === 0) {
      console.log('❌ Tabla siigo_sync_log NO EXISTE');
      console.log('💡 Ejecutar: CREATE TABLE siigo_sync_log...');
    } else {
      console.log('✅ Tabla siigo_sync_log existe');
      
      // Verificar estructura
      const [syncColumns] = await connection.execute(`
        DESCRIBE siigo_sync_log
      `);
      
      console.log('   Columnas:');
      syncColumns.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type}`);
      });
    }
    
    // 6. Estadísticas generales
    console.log('\n6. 📊 ESTADÍSTICAS:');
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN siigo_invoice_id IS NOT NULL THEN 1 ELSE 0 END) as siigo_orders,
        COUNT(DISTINCT siigo_invoice_id) as unique_siigo_invoices
      FROM orders
    `);
    
    const stat = stats[0];
    console.log(`📦 Total pedidos: ${stat.total_orders}`);
    console.log(`📄 Pedidos desde SIIGO: ${stat.siigo_orders}`);
    console.log(`🔢 Facturas SIIGO únicas: ${stat.unique_siigo_invoices}`);
    
    // 7. Verificar logs de sincronización por estado
    const [syncStats] = await connection.execute(`
      SELECT 
        sync_status,
        COUNT(*) as count
      FROM siigo_sync_log
      GROUP BY sync_status
    `);
    
    console.log('\n📋 Estados de sincronización:');
    if (syncStats.length === 0) {
      console.log('❌ No hay logs de sincronización');
    } else {
      syncStats.forEach(stat => {
        console.log(`   ${stat.sync_status}: ${stat.count}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
  } finally {
    await connection.end();
  }
}

debugSiigoImport().catch(console.error);
