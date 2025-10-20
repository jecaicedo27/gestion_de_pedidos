const mysql = require('mysql2/promise');

async function checkOrder() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    // Buscar el pedido de Ximena
    const [order] = await connection.execute(
      `SELECT 
        o.id, 
        o.order_number, 
        o.customer_name, 
        o.status,
        o.assigned_messenger_id,
        u.username as messenger_username,
        u.full_name as messenger_name
       FROM orders o
       LEFT JOIN users u ON o.assigned_messenger_id = u.id
       WHERE o.order_number = 'FV-2-13199' 
          OR o.customer_name LIKE '%XIMENA%BENAVIDES%'`
    );
    
    console.log('\n=== PEDIDO FV-2-13199 (XIMENA BENAVIDES) ===');
    if (order.length > 0) {
      order.forEach(o => {
        console.log('ID:', o.id);
        console.log('Número:', o.order_number);
        console.log('Cliente:', o.customer_name);
        console.log('Estado:', o.status);
        console.log('ID Mensajero Asignado:', o.assigned_messenger_id);
        console.log('Usuario Mensajero:', o.messenger_username || 'Sin asignar');
        console.log('Nombre Mensajero:', o.messenger_name || 'Sin asignar');
        console.log('---');
      });
    } else {
      console.log('Pedido no encontrado');
    }

    // Verificar qué pedidos están asignados al mensajero1
    const [messengerOrders] = await connection.execute(
      `SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status
       FROM orders o
       JOIN users u ON o.assigned_messenger_id = u.id
       WHERE u.username = 'mensajero1' 
          AND o.status IN ('listo_para_entrega', 'empacado', 'listo', 'en_reparto')`
    );
    
    console.log('\n=== PEDIDOS ASIGNADOS A MENSAJERO1 ===');
    console.log('Total:', messengerOrders.length);
    if (messengerOrders.length > 0) {
      messengerOrders.forEach(o => {
        console.log(`- ${o.order_number}: ${o.customer_name} (${o.status})`);
      });
    }

    // Verificar el endpoint de logística
    console.log('\n=== VERIFICANDO DATOS DEL ENDPOINT DE LOGÍSTICA ===');
    const [logisticsData] = await connection.execute(
      `SELECT 
        o.id, 
        o.order_number, 
        o.customer_name, 
        o.status, 
        o.delivery_method,
        o.total_amount, 
        o.created_at, 
        o.updated_at, 
        o.carrier_id,
        o.assigned_messenger_id,
        c.name as carrier_name,
        u.username as messenger_username,
        u.full_name as messenger_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       LEFT JOIN users u ON o.assigned_messenger_id = u.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo', 'en_reparto')
          AND o.order_number = 'FV-2-13199'`
    );

    if (logisticsData.length > 0) {
      console.log('Datos que debería mostrar el endpoint de logística:');
      logisticsData.forEach(order => {
        console.log({
          order_number: order.order_number,
          customer_name: order.customer_name,
          status: order.status,
          messenger_id: order.assigned_messenger_id,
          messenger_username: order.messenger_username,
          messenger_name: order.messenger_name
        });
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkOrder();
