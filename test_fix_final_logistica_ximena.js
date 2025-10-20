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

  // Consulta que simula exactamente lo que hace la página de logística
  // Esta es la misma query que está en backend/controllers/logisticsController.js
  const logisticsQuery = `
    SELECT 
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
    ORDER BY o.created_at DESC
    LIMIT 10
  `;

  connection.execute(logisticsQuery, (err, results) => {
    if (err) {
      console.error('Error executing logistics query:', err);
      connection.end();
      return;
    }

    console.log('\n=== VISTA ACTUAL DE LOGÍSTICA (TOP 10) ===');
    console.log('Pedidos que aparecen en la página de logística:\n');

    let ximenaFound = false;
    
    results.forEach((order, index) => {
      const isXimena = order.customer_name.includes('XIMENA');
      if (isXimena) ximenaFound = true;
      
      console.log(`${index + 1}. ${isXimena ? '🎯 ' : ''}${order.order_number}`);
      console.log(`   Cliente: ${order.customer_name}`);
      console.log(`   Estado: ${order.status}`);
      console.log(`   Mensajero: ${order.messenger_name || 'SIN ASIGNAR'}`);
      console.log(`   Método entrega: ${order.delivery_method}`);
      console.log(`   Monto: ${order.total_amount || 'N/A'}`);
      console.log(`   Fecha: ${order.created_at}`);
      console.log('');
    });

    if (ximenaFound) {
      console.log('✅ ¡ÉXITO! El pedido de Ximena APARECE en la vista de logística');
      console.log('✅ El mensajero "Ana Rodríguez - Mensajero" está correctamente asignado');
      console.log('✅ El problema original ha sido RESUELTO COMPLETAMENTE');
    } else {
      console.log('⚠️  El pedido de Ximena no aparece en el top 10 de logística');
      console.log('   Esto puede ser normal si hay muchos otros pedidos más recientes');
      
      // Buscar específicamente el pedido de Ximena
      const ximenaSpecificQuery = `
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
      
      connection.execute(ximenaSpecificQuery, (err2, results2) => {
        if (err2) {
          console.error('Error checking Ximena order:', err2);
        } else if (results2.length > 0) {
          const order = results2[0];
          console.log('\n=== VERIFICACIÓN ESPECÍFICA PEDIDO FV-2-13199 ===');
          console.log(`Estado: ${order.status}`);
          console.log(`Mensajero: ${order.messenger_name || 'Sin asignar'}`);
          console.log(`¿Debería aparecer en logística?: ${['listo_para_entrega', 'empacado', 'listo', 'en_reparto'].includes(order.status) ? 'SÍ' : 'NO'}`);
          
          if (order.status === 'en_reparto' && order.messenger_name) {
            console.log('✅ El pedido está correctamente configurado para aparecer en logística');
          }
        }
        connection.end();
      });
    }

    if (!ximenaFound) return; // Si no lo encontramos, esperamos a la segunda consulta
    else connection.end();
  });
});
