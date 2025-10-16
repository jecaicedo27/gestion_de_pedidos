const { query } = require('../backend/config/database');

const updateStatusEnum = async () => {
  try {
    console.log('✅ Conectado a la base de datos');
    console.log('🔄 Actualizando ENUM de status con nuevos valores...');

    // Verificar estructura actual
    const currentStructure = await query('DESCRIBE orders');
    const statusField = currentStructure.find(col => col.Field === 'status');
    
    console.log('\n📋 Estructura actual del campo status:');
    console.log(`   - Tipo: ${statusField.Type}`);
    console.log(`   - Default: ${statusField.Default}`);

    // Actualizar el ENUM para incluir los nuevos estados
    console.log('\n🔄 Modificando ENUM para incluir nuevos estados...');
    
    await query(`
      ALTER TABLE orders 
      MODIFY COLUMN status ENUM(
        'pendiente_facturacion',
        'revision_cartera', 
        'en_logistica',
        'en_reparto',
        'entregado_transportadora',
        'entregado_cliente',
        'cancelado',
        'pendiente',
        'confirmado',
        'en_preparacion',
        'listo',
        'enviado',
        'entregado'
      ) DEFAULT 'pendiente_facturacion'
    `);

    console.log('✅ ENUM actualizado exitosamente');

    // Verificar nueva estructura
    const newStructure = await query('DESCRIBE orders');
    const newStatusField = newStructure.find(col => col.Field === 'status');
    
    console.log('\n📋 Nueva estructura del campo status:');
    console.log(`   - Tipo: ${newStatusField.Type}`);
    console.log(`   - Default: ${newStatusField.Default}`);

    // Ahora actualizar todos los pedidos con estado vacío
    console.log('\n🔄 Actualizando pedidos con estado vacío a pendiente_facturacion...');
    
    const updateResult = await query(`
      UPDATE orders 
      SET status = 'pendiente_facturacion', updated_at = NOW()
      WHERE status = '' OR status IS NULL
    `);

    console.log(`✅ ${updateResult.affectedRows} pedidos actualizados`);

    // Verificar resultado
    const statusCount = await query(`
      SELECT status, COUNT(*) as count
      FROM orders 
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('\n📊 Estados después de la actualización:');
    statusCount.forEach(row => {
      const statusLabel = row.status || '(vacío)';
      console.log(`   - ${statusLabel}: ${row.count} pedidos`);
    });

    // Mostrar algunos pedidos de ejemplo
    const sampleOrders = await query(`
      SELECT id, order_number, customer_name, status
      FROM orders 
      WHERE status = 'pendiente_facturacion'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n🟡 Primeros 5 pedidos en pendiente_facturacion:');
    sampleOrders.forEach(order => {
      console.log(`   - ${order.order_number} - ${order.customer_name} (${order.status})`);
    });

  } catch (error) {
    console.error('❌ Error actualizando ENUM:', error);
    process.exit(1);
  }
};

// Ejecutar actualización
updateStatusEnum()
  .then(() => {
    console.log('\n✅ Actualización de ENUM completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en la actualización:', error);
    process.exit(1);
  });
