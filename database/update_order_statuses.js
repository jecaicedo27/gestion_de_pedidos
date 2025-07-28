const { query } = require('../backend/config/database');

const updateOrderStatuses = async () => {
  try {
    console.log('✅ Conectado a la base de datos');

    // Mapeo de estados antiguos a nuevos
    const statusMapping = {
      'pendiente': 'pendiente_facturacion',
      'confirmado': 'revision_cartera',
      'en_preparacion': 'en_logistica',
      'listo': 'en_logistica',
      'enviado': 'en_reparto',
      'entregado': 'entregado_cliente',
      'cancelado': 'cancelado'
    };

    console.log('🔄 Iniciando actualización de estados...');

    // Obtener todos los pedidos con sus estados actuales
    const orders = await query(
      'SELECT id, status FROM orders WHERE status IN (?, ?, ?, ?, ?, ?, ?)',
      ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'enviado', 'entregado', 'cancelado']
    );

    console.log(`📊 Encontrados ${orders.length} pedidos para actualizar`);

    // Actualizar cada pedido
    let updated = 0;
    for (const order of orders) {
      const newStatus = statusMapping[order.status];
      if (newStatus && newStatus !== order.status) {
        await query(
          'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
          [newStatus, order.id]
        );
        console.log(`✅ Pedido ${order.id}: ${order.status} → ${newStatus}`);
        updated++;
      }
    }

    console.log(`\n🎉 Actualización completada:`);
    console.log(`   - ${orders.length} pedidos procesados`);
    console.log(`   - ${updated} pedidos actualizados`);
    console.log(`   - ${orders.length - updated} pedidos sin cambios`);

    // Mostrar resumen de estados actuales
    const currentStats = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        CASE 
          WHEN status = 'pendiente_facturacion' THEN 'Pendiente por Facturación'
          WHEN status = 'revision_cartera' THEN 'Revisión por Cartera'
          WHEN status = 'en_logistica' THEN 'En Logística'
          WHEN status = 'en_reparto' THEN 'En Reparto'
          WHEN status = 'entregado_transportadora' THEN 'Entregado a Transportadora'
          WHEN status = 'entregado_cliente' THEN 'Entregado a Cliente'
          WHEN status = 'cancelado' THEN 'Cancelado'
          ELSE status
        END as label
      FROM orders 
      GROUP BY status 
      ORDER BY count DESC
    `);

    console.log('\n📈 Estados actuales en la base de datos:');
    currentStats.forEach(stat => {
      console.log(`   - ${stat.label}: ${stat.count} pedidos`);
    });

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
};

// Ejecutar migración
updateOrderStatuses()
  .then(() => {
    console.log('\n✅ Migración de estados completada exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  });
