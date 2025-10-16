const { query } = require('./backend/config/database');

async function checkInvoiceStatus() {
  console.log('🔍 VERIFICANDO ESTADO DE FACTURAS IMPORTADAS');
  console.log('==========================================\n');

  try {
    // 1. Verificar facturas recién importadas
    console.log('📋 1. Últimas 5 facturas importadas (orders):');
    const recentOrders = await query(
      `SELECT id, order_number, siigo_invoice_id, customer_name, created_at, status
       FROM orders 
       WHERE siigo_invoice_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 5`
    );
    
    console.log('Facturas importadas encontradas:', recentOrders.length);
    recentOrders.forEach(order => {
      console.log(`- Pedido ${order.order_number} (ID: ${order.id})`);
      console.log(`  SIIGO Invoice ID: ${order.siigo_invoice_id}`);
      console.log(`  Cliente: ${order.customer_name}`);
      console.log(`  Estado: ${order.status}`);
      console.log(`  Creado: ${order.created_at}\n`);
    });

    // 2. Verificar si hay duplicados
    console.log('\n📋 2. Verificando duplicados:');
    const duplicates = await query(
      `SELECT siigo_invoice_id, COUNT(*) as count
       FROM orders
       WHERE siigo_invoice_id IS NOT NULL
       GROUP BY siigo_invoice_id
       HAVING COUNT(*) > 1`
    );
    
    if (duplicates.length > 0) {
      console.log('⚠️ DUPLICADOS ENCONTRADOS:');
      duplicates.forEach(dup => {
        console.log(`- Invoice ID ${dup.siigo_invoice_id}: ${dup.count} veces`);
      });
    } else {
      console.log('✅ No hay duplicados');
    }

    // 3. Buscar factura específica 12674
    console.log('\n📋 3. Buscando factura FV-2-12674:');
    const invoice12674 = await query(
      `SELECT * FROM orders 
       WHERE order_number LIKE '%12674%' 
          OR invoice_code LIKE '%12674%'
          OR siigo_invoice_id LIKE '%12674%'`
    );
    
    if (invoice12674.length > 0) {
      console.log('✅ Factura 12674 encontrada en la base de datos:');
      invoice12674.forEach(inv => {
        console.log(`- ID: ${inv.id}`);
        console.log(`- Order Number: ${inv.order_number}`);
        console.log(`- Invoice Code: ${inv.invoice_code}`);
        console.log(`- SIIGO Invoice ID: ${inv.siigo_invoice_id}`);
        console.log(`- Status: ${inv.status}`);
      });
    } else {
      console.log('❌ Factura 12674 NO encontrada en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

// Ejecutar verificación
checkInvoiceStatus();
