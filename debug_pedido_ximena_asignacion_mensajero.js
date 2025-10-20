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

  // Buscar el pedido específico de Ximena
  const query = `
    SELECT 
      o.id, 
      o.order_number, 
      o.customer_name, 
      o.status, 
      o.assigned_messenger_id,
      o.delivery_method,
      o.created_at,
      o.updated_at,
      u.username as messenger_username,
      u.full_name as messenger_name,
      u.role as messenger_role
    FROM orders o
    LEFT JOIN users u ON o.assigned_messenger_id = u.id
    WHERE o.customer_name LIKE '%XIMENA%' OR o.customer_name LIKE '%BENAVIDES%'
    ORDER BY o.id DESC
    LIMIT 10
  `;

  connection.execute(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      connection.end();
      return;
    }

    console.log('\n=== PEDIDOS DE XIMENA BENAVIDES ===');
    console.log('Total encontrados:', results.length);
    
    if (results.length === 0) {
      console.log('No se encontraron pedidos con ese nombre.');
    } else {
      results.forEach(order => {
        console.log(`\n--- Pedido ${order.order_number} ---`);
        console.log(`ID: ${order.id}`);
        console.log(`Cliente: ${order.customer_name}`);
        console.log(`Estado: ${order.status}`);
        console.log(`Método de entrega: ${order.delivery_method}`);
        console.log(`Mensajero asignado ID: ${order.assigned_messenger_id || 'NULL'}`);
        console.log(`Usuario mensajero: ${order.messenger_username || 'N/A'}`);
        console.log(`Nombre mensajero: ${order.messenger_name || 'N/A'}`);
        console.log(`Rol mensajero: ${order.messenger_role || 'N/A'}`);
        console.log(`Fecha creación: ${order.created_at}`);
        console.log(`Fecha actualización: ${order.updated_at}`);
      });

      // Buscar específicamente FV-2-13199
      const specificOrder = results.find(order => order.order_number === 'FV-2-13199');
      if (specificOrder) {
        console.log('\n=== ANÁLISIS PEDIDO FV-2-13199 ===');
        console.log('Este es el pedido que aparece sin mensajero en logística');
        console.log(`Estado actual: ${specificOrder.status}`);
        console.log(`¿Debería aparecer en logística?: ${['listo_para_entrega', 'empacado', 'listo', 'en_reparto'].includes(specificOrder.status) ? 'SÍ' : 'NO'}`);
        console.log(`¿Tiene mensajero asignado?: ${specificOrder.assigned_messenger_id ? 'SÍ' : 'NO'}`);
        console.log(`Nombre mensajero: ${specificOrder.messenger_name || 'NO ASIGNADO'}`);
        
        if (specificOrder.status === 'entregado_cliente') {
          console.log('\n⚠️  PROBLEMA IDENTIFICADO: El pedido está en estado "entregado_cliente"');
          console.log('   Por eso NO aparece en la vista de logística (solo muestra pedidos activos)');
        }
      } else {
        console.log('\n⚠️  No se encontró el pedido FV-2-13199 específicamente');
      }
    }

    // Verificar también todos los pedidos que están en logística actualmente
    console.log('\n=== VERIFICANDO PEDIDOS ACTUALES EN LOGÍSTICA ===');
    const logisticsQuery = `
      SELECT 
        o.id, 
        o.order_number, 
        o.customer_name, 
        o.status, 
        o.assigned_messenger_id,
        u.username as messenger_username,
        u.full_name as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo', 'en_reparto')
      ORDER BY o.id DESC
      LIMIT 5
    `;

    connection.execute(logisticsQuery, (err, logisticsResults) => {
      if (err) {
        console.error('Error executing logistics query:', err);
      } else {
        console.log('Pedidos que deberían aparecer en logística:');
        logisticsResults.forEach(order => {
          console.log(`- ${order.order_number} (${order.customer_name}) - Estado: ${order.status} - Mensajero: ${order.messenger_name || 'SIN ASIGNAR'}`);
        });
      }

      connection.end();
    });
  });
});
