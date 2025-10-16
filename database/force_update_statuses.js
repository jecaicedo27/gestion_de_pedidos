const { query } = require('../backend/config/database');

const forceUpdateStatuses = async () => {
  try {
    console.log('✅ Conectado a la base de datos');
    console.log('🔄 Forzando actualización de estados...');

    // Primero, verificar la estructura de la tabla
    const tableStructure = await query('DESCRIBE orders');
    console.log('\n📋 Estructura de la tabla orders:');
    tableStructure.forEach(column => {
      if (column.Field === 'status') {
        console.log(`   - Campo status: ${column.Type} (${column.Null === 'YES' ? 'NULL permitido' : 'NOT NULL'}) Default: ${column.Default || 'ninguno'}`);
      }
    });

    // Obtener algunos pedidos específicos para verificar
    const sampleOrders = await query(`
      SELECT id, order_number, customer_name, status, CHAR_LENGTH(status) as status_length
      FROM orders 
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log('\n📊 Muestra de pedidos actuales:');
    sampleOrders.forEach(order => {
      console.log(`   - ID ${order.id}: ${order.order_number} - Status: "${order.status}" (longitud: ${order.status_length})`);
    });

    // Actualizar usando una estrategia diferente - actualizar todos los registros
    console.log('\n🔄 Actualizando TODOS los pedidos a pendiente_facturacion...');
    
    const updateResult = await query(`
      UPDATE orders 
      SET status = 'pendiente_facturacion', updated_at = NOW()
    `);

    console.log(`✅ Resultado de actualización: ${updateResult.affectedRows} filas afectadas`);

    // Verificar inmediatamente después de la actualización
    const verifyOrders = await query(`
      SELECT id, order_number, status, CHAR_LENGTH(status) as status_length
      FROM orders 
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log('\n📊 Verificación después de actualización:');
    verifyOrders.forEach(order => {
      console.log(`   - ID ${order.id}: ${order.order_number} - Status: "${order.status}" (longitud: ${order.status_length})`);
    });

    // Contar por estado
    const statusCount = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        CASE 
          WHEN status = '' THEN 'VACIO'
          WHEN status IS NULL THEN 'NULL'
          ELSE status
        END as status_display
      FROM orders 
      GROUP BY status
    `);

    console.log('\n📊 Conteo por estado:');
    statusCount.forEach(row => {
      console.log(`   - ${row.status_display}: ${row.count} pedidos`);
    });

  } catch (error) {
    console.error('❌ Error forzando actualización:', error);
    process.exit(1);
  }
};

// Ejecutar actualización forzada
forceUpdateStatuses()
  .then(() => {
    console.log('\n✅ Actualización forzada completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en la actualización forzada:', error);
    process.exit(1);
  });
