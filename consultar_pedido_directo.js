const { query, poolEnd } = require('./backend/config/database');

async function consultarPedidoDirecto() {
  try {
    const arg = process.argv[2];
    if (!arg) {
      console.log('Uso: node consultar_pedido_directo.js <order_id|order_number|siigo_invoice_number>');
      process.exit(1);
    }

    console.log('🔎 Consultando pedido...', arg);

    const isNumericId = /^\d+$/.test(arg);
    const idVal = isNumericId ? Number(arg) : 0;

    const orders = await query(
      `
      SELECT 
        o.id,
        o.order_number,
        o.siigo_invoice_number,
        o.status,
        o.messenger_status,
        o.delivery_method,
        o.carrier_id,
        o.assigned_messenger_id,
        o.assigned_messenger,
        o.assigned_to,
        o.shipping_payment_method,
        o.total_amount,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE (o.id = ?)
         OR (o.order_number = ?)
         OR (o.siigo_invoice_number = ?)
      ORDER BY o.id DESC
      LIMIT 1
      `,
      [idVal, arg, arg]
    );

    if (orders.length === 0) {
      console.log('❌ Pedido no encontrado');

      // Búsqueda de coincidencias parciales por número de pedido o factura SIIGO
      const likeArg = `%${arg}%`;
      const candidates = await query(
        `
        SELECT 
          id,
          order_number,
          siigo_invoice_number,
          status,
          messenger_status,
          delivery_method,
          assigned_messenger_id,
          created_at
        FROM orders
        WHERE order_number LIKE ?
           OR siigo_invoice_number LIKE ?
        ORDER BY id DESC
        LIMIT 10
        `,
        [likeArg, likeArg]
      );

      if (candidates.length > 0) {
        console.log(`\n🔎 Coincidencias parciales encontradas (${candidates.length}):`);
        candidates.forEach(c => {
          console.log(
            `  - id=${c.id} | order_number=${c.order_number || '-'} | siigo=${c.siigo_invoice_number || '-'} | status=${c.status} | messenger_status=${c.messenger_status || '-'} | assigned_messenger_id=${c.assigned_messenger_id || '-'}`
          );
        });
        console.log('\n💡 Vuelva a ejecutar con el id u order_number exacto de la lista anterior.');
      }
      return;
    }

    const order = orders[0];
    console.log('\n📋 Pedido encontrado:');
    console.log(JSON.stringify(order, null, 2));

    // Consultar información del mensajero asignado (si aplica)
    let messengerInfo = null;
    if (order.assigned_messenger_id) {
      const users = await query(
        'SELECT id, username, full_name, role, active FROM users WHERE id = ?',
        [order.assigned_messenger_id]
      );
      messengerInfo = users[0] || null;
    }

    if (messengerInfo) {
      console.log('\n👤 Mensajero asignado (users):');
      console.log(JSON.stringify(messengerInfo, null, 2));
    } else {
      console.log('\n👤 Mensajero asignado (users): Ninguno o no válido');
    }

    // Consultar tracking de entrega
    const tracking = await query(
      `
      SELECT 
        id,
        order_id,
        messenger_id,
        assigned_at,
        accepted_at,
        started_delivery_at,
        delivered_at,
        failed_at,
        rejection_reason,
        payment_collected,
        delivery_fee_collected,
        payment_method,
        delivery_notes
      FROM delivery_tracking
      WHERE order_id = ?
      ORDER BY id DESC
      `,
      [order.id]
    );

    console.log(`\n🧭 Registros en delivery_tracking (count=${tracking.length}):`);
    if (tracking.length) {
      console.log(JSON.stringify(tracking, null, 2));
    } else {
      console.log('No hay registros de tracking para este pedido');
    }

    // Resumen de consistencia esperada
    console.log('\n✅ Validaciones esperadas:');
    console.log('- assigned_messenger_id: Debe ser el ID del mensajero');
    console.log("- messenger_status: Debe ser \"assigned\" tras asignación, \"accepted\" al aceptar, \"in_delivery\" al iniciar, \"delivered\" al completar");
    console.log("- status: Debe estar en 'listo_para_entrega' para aparecer en la bandeja de mensajero o 'en_reparto' durante la entrega");
    console.log('- delivery_tracking: Debe tener assigned_at al asignar, accepted_at al aceptar, started_delivery_at al iniciar, delivered_at al completar');

  } catch (err) {
    console.error('❌ Error consultando pedido:', err);
  } finally {
    await poolEnd().catch(() => {});
  }
}

consultarPedidoDirecto();
