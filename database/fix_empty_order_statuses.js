const { query } = require('../backend/config/database');

const fixEmptyOrderStatuses = async () => {
  try {
    console.log('✅ Conectado a la base de datos');
    console.log('🔄 Corrigiendo estados vacíos de pedidos...');

    // Obtener pedidos con estado vacío o NULL
    const emptyStatusOrders = await query(`
      SELECT id, order_number, customer_name, status
      FROM orders 
      WHERE status IS NULL OR status = '' OR status = 'pendiente'
      ORDER BY created_at DESC
    `);

    console.log(`\n📊 Pedidos con estado vacío o 'pendiente': ${emptyStatusOrders.length}`);

    if (emptyStatusOrders.length === 0) {
      console.log('✅ No hay pedidos con estado vacío para corregir');
      return;
    }

    // Mostrar pedidos que se van a actualizar
    console.log('\n📋 Pedidos que se actualizarán:');
    emptyStatusOrders.forEach(order => {
      const currentStatus = order.status || '(vacío)';
      console.log(`   - ${order.order_number} - ${order.customer_name} (Estado actual: ${currentStatus})`);
    });

    // Actualizar todos los pedidos con estado vacío a 'pendiente_facturacion'
    const updateResult = await query(`
      UPDATE orders 
      SET status = 'pendiente_facturacion', updated_at = NOW()
      WHERE status IS NULL OR status = '' OR status = 'pendiente'
    `);

    console.log(`\n✅ ${updateResult.affectedRows} pedidos actualizados a 'pendiente_facturacion'`);

    // Verificar el resultado
    const updatedOrders = await query(`
      SELECT status, COUNT(*) as count
      FROM orders 
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('\n📊 Estados después de la corrección:');
    updatedOrders.forEach(row => {
      const statusLabel = row.status || '(vacío)';
      console.log(`   - ${statusLabel}: ${row.count} pedidos`);
    });

    // Verificar específicamente pedidos pendiente_facturacion
    const pendingBilling = await query(`
      SELECT id, order_number, customer_name
      FROM orders 
      WHERE status = 'pendiente_facturacion'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`\n🟡 Primeros 5 pedidos en 'pendiente_facturacion':`);
    pendingBilling.forEach(order => {
      console.log(`   - ${order.order_number} - ${order.customer_name}`);
    });

  } catch (error) {
    console.error('❌ Error corrigiendo estados:', error);
    process.exit(1);
  }
};

// Ejecutar corrección
fixEmptyOrderStatuses()
  .then(() => {
    console.log('\n✅ Corrección completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en la corrección:', error);
    process.exit(1);
  });
