const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to database successfully');

  // Primero verificar el estado actual del pedido
  const checkQuery = `
    SELECT 
      o.id, 
      o.order_number, 
      o.customer_name, 
      o.status, 
      o.assigned_messenger_id,
      u.full_name as messenger_name
    FROM orders o
    LEFT JOIN users u ON o.assigned_messenger_id = u.id
    WHERE o.order_number = 'FV-2-13199'
  `;

  connection.execute(checkQuery, (err, results) => {
    if (err) {
      console.error('Error checking order status:', err);
      connection.end();
      return;
    }

    if (results.length === 0) {
      console.log('❌ No se encontró el pedido FV-2-13199');
      connection.end();
      return;
    }

    const order = results[0];
    console.log('\n=== ESTADO ACTUAL DEL PEDIDO FV-2-13199 ===');
    console.log(`ID: ${order.id}`);
    console.log(`Cliente: ${order.customer_name}`);
    console.log(`Estado actual: ${order.status}`);
    console.log(`Mensajero asignado: ${order.messenger_name || 'Sin asignar'}`);

    if (order.status === 'entregado_cliente') {
      console.log('\n🔄 CAMBIANDO ESTADO DE "entregado_cliente" A "en_reparto"');
      console.log('Motivo: El pedido fue entregado al mensajero, no al cliente final');

      // Actualizar el estado del pedido
      const updateQuery = `
        UPDATE orders 
        SET status = 'en_reparto', 
            updated_at = NOW() 
        WHERE order_number = 'FV-2-13199'
      `;

      connection.execute(updateQuery, (updateErr, updateResult) => {
        if (updateErr) {
          console.error('❌ Error updating order status:', updateErr);
        } else {
          console.log('✅ Estado del pedido actualizado exitosamente');
          console.log(`Registros afectados: ${updateResult.affectedRows}`);
          
          // Verificar el cambio
          connection.execute(checkQuery, (verifyErr, verifyResults) => {
            if (verifyErr) {
              console.error('Error verifying update:', verifyErr);
            } else {
              const updatedOrder = verifyResults[0];
              console.log('\n=== ESTADO DESPUÉS DE LA ACTUALIZACIÓN ===');
              console.log(`Estado nuevo: ${updatedOrder.status}`);
              console.log(`Mensajero asignado: ${updatedOrder.messenger_name || 'Sin asignar'}`);
              console.log('\n✅ Ahora el pedido DEBERÍA aparecer en la vista de logística');
              console.log('   con el mensajero "Ana Rodríguez - Mensajero" asignado');
            }
            connection.end();
          });
        }
      });
    } else {
      console.log(`\nℹ️  El pedido ya está en estado "${order.status}"`);
      console.log('No se requiere cambio de estado.');
      connection.end();
    }
  });
});
