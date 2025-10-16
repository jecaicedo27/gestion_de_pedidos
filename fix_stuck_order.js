// Reparación manual de pedido "pegado": asigna mensajero, crea tracking y cierra como entregado
// Uso:
//   node fix_stuck_order.js <order_id|order_number> [messengerId] [paymentCollected]
//
// Ejemplos:
//   node fix_stuck_order.js 1237 16 156000
//   node fix_stuck_order.js FV-2-14313 16 156000
//
// Nota: Por defecto asigna mensajero 16 (julian) y toma paymentCollected = total_amount del pedido.
//       No registra flete (delivery_fee_collected = 0).

const { query, poolEnd } = require('./backend/config/database');

async function main() {
  try {
    const arg = process.argv[2];
    const messengerIdArg = process.argv[3];
    const paymentCollectedArg = process.argv[4];

    if (!arg) {
      console.log('Uso: node fix_stuck_order.js <order_id|order_number> [messengerId] [paymentCollected]');
      process.exit(1);
    }

    const isNumericId = /^\d+$/.test(arg);
    const idVal = isNumericId ? Number(arg) : 0;

    // 1) Obtener pedido
    const orders = await query(
      `
      SELECT 
        o.id, o.order_number, o.status, o.messenger_status,
        o.delivery_method, o.shipping_payment_method,
        o.assigned_messenger_id, o.assigned_messenger,
        o.total_amount, o.payment_method, o.delivery_fee_exempt, o.delivery_fee
      FROM orders o
      WHERE (o.id = ?) OR (o.order_number = ?)
      LIMIT 1
      `,
      [idVal, arg]
    );

    if (!orders.length) {
      console.log('❌ Pedido no encontrado');
      return;
    }

    const order = orders[0];
    console.log('📋 Pedido encontrado:', order.order_number, 'ID:', order.id);
    console.log('⏳ Estado actual -> status:', order.status, '| messenger_status:', order.messenger_status, '| assigned_messenger_id:', order.assigned_messenger_id);

    // 2) Determinar mensajero y montos
    const messengerId = messengerIdArg ? Number(messengerIdArg) : 16; // default: julian (id 16)
    const paymentCollected = paymentCollectedArg ? Number(paymentCollectedArg) : Number(order.total_amount || 0);
    const deliveryFeeCollected = 0; // no forzamos flete retroactivamente en reparación
    const productPaymentMethod = order.payment_method && String(order.payment_method).trim() !== '' ? order.payment_method : 'efectivo';

    // 3) Asignar mensajero si no está asignado
    if (!order.assigned_messenger_id) {
      await query(
        `UPDATE orders 
           SET assigned_messenger_id = ?, assigned_messenger = ?, updated_at = NOW()
         WHERE id = ?`,
        [messengerId, String(messengerId), order.id]
      );
      console.log(`👤 Mensajero asignado retroactivamente: ID ${messengerId}`);
    } else if (order.assigned_messenger_id !== messengerId) {
      await query(
        `UPDATE orders 
           SET assigned_messenger_id = ?, assigned_messenger = ?, updated_at = NOW()
         WHERE id = ?`,
        [messengerId, String(messengerId), order.id]
      );
      console.log(`👤 Mensajero reasignado a ID ${messengerId}`);
    }

    // 4) Crear/actualizar tracking con todos los hitos poblados
    const existingTracking = await query(
      'SELECT id FROM delivery_tracking WHERE order_id = ? AND messenger_id = ? ORDER BY id DESC LIMIT 1',
      [order.id, messengerId]
    );

    if (existingTracking.length) {
      await query(
        `UPDATE delivery_tracking SET
           assigned_at = COALESCE(assigned_at, NOW()),
           accepted_at = COALESCE(accepted_at, NOW()),
           started_delivery_at = COALESCE(started_delivery_at, NOW()),
           delivered_at = NOW(),
           payment_collected = ?,
           delivery_fee_collected = ?,
           payment_method = ?,
           delivery_notes = CONCAT(IFNULL(delivery_notes,''), ?)
         WHERE id = ?`,
        [
          paymentCollected,
          deliveryFeeCollected,
          productPaymentMethod,
          '\n[REPAIR] Cierre manual por script fix_stuck_order.js',
          existingTracking[0].id
        ]
      );
      console.log('🧭 Tracking existente actualizado a entregado');
    } else {
      await query(
        `INSERT INTO delivery_tracking (
           order_id, messenger_id, assigned_at, accepted_at, started_delivery_at, delivered_at,
           payment_collected, delivery_fee_collected, payment_method, delivery_notes
         ) VALUES (?, ?, NOW(), NOW(), NOW(), NOW(), ?, ?, ?, ?)`,
        [
          order.id,
          messengerId,
          paymentCollected,
          deliveryFeeCollected,
          productPaymentMethod,
          '[REPAIR] Cierre manual por script fix_stuck_order.js'
        ]
      );
      console.log('🧭 Tracking creado y marcado como entregado');
    }

    // 5) Marcar pedido como entregado a cliente y messenger_status delivered
    //    Nota: En el sistema conviven 'entregado' y 'entregado_cliente'; mantenemos 'entregado' (consistente con completeDelivery)
    await query(
      `UPDATE orders 
         SET messenger_status = 'delivered',
             status = 'entregado',
             payment_method = COALESCE(NULLIF(payment_method,''), ?),
             updated_at = NOW()
       WHERE id = ?`,
      [productPaymentMethod, order.id]
    );

    console.log('✅ Pedido actualizado a entregado (status=entregado, messenger_status=delivered)');
    console.log(`💵 Cobro registrado en tracking: producto=${paymentCollected.toLocaleString('es-CO')} | flete=${deliveryFeeCollected.toLocaleString('es-CO')}`);

    // 6) Mostrar resumen final
    const final = await query(
      `SELECT id, order_number, status, messenger_status, assigned_messenger_id FROM orders WHERE id = ?`,
      [order.id]
    );
    console.log('\n📦 Estado final del pedido:');
    console.log(final[0]);

    console.log('\nℹ️ Si deseas registrar y aceptar el efectivo en caja, puedes usar luego el endpoint de aceptación de caja o scripts relacionados (cash closings).');

  } catch (err) {
    console.error('❌ Error reparando pedido:', err);
  } finally {
    await poolEnd().catch(() => {});
  }
}

main();
