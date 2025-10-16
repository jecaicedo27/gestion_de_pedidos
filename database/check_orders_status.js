const { query } = require('../backend/config/database');

const checkOrdersStatus = async () => {
  try {
    console.log('✅ Conectado a la base de datos');
    console.log('🔄 Verificando estado de pedidos...');

    // Obtener todos los pedidos con sus estados
    const orders = await query(`
      SELECT 
        id, order_number, customer_name, status, created_by, created_at
      FROM orders 
      ORDER BY created_at DESC
    `);

    console.log(`\n📊 Total de pedidos en la base de datos: ${orders.length}`);

    if (orders.length === 0) {
      console.log('⚠️  No hay pedidos en la base de datos');
      return;
    }

    // Agrupar por estado
    const statusGroups = {};
    orders.forEach(order => {
      if (!statusGroups[order.status]) {
        statusGroups[order.status] = [];
      }
      statusGroups[order.status].push(order);
    });

    console.log('\n📋 Pedidos por estado:');
    Object.keys(statusGroups).forEach(status => {
      console.log(`\n🔸 ${status.toUpperCase()} (${statusGroups[status].length} pedidos):`);
      statusGroups[status].forEach(order => {
        console.log(`   - ${order.order_number} - ${order.customer_name} (ID: ${order.id})`);
      });
    });

    // Verificar específicamente pedidos pendiente_facturacion
    const pendingBilling = orders.filter(order => order.status === 'pendiente_facturacion');
    console.log(`\n🟡 Pedidos PENDIENTE_FACTURACION: ${pendingBilling.length}`);
    
    if (pendingBilling.length > 0) {
      console.log('   Estos son los pedidos que debería ver el facturador:');
      pendingBilling.forEach(order => {
        console.log(`   - ${order.order_number} - ${order.customer_name}`);
      });
    }

    // Verificar usuarios
    const users = await query('SELECT id, username, role, active FROM users WHERE role = "facturador"');
    console.log(`\n👤 Usuarios facturadores: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ${user.username} (ID: ${user.id}) - ${user.active ? 'Activo' : 'Inactivo'}`);
    });

  } catch (error) {
    console.error('❌ Error verificando pedidos:', error);
    process.exit(1);
  }
};

// Ejecutar verificación
checkOrdersStatus()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en la verificación:', error);
    process.exit(1);
  });
