/**
 * Asigna un pedido a un mensajero SIN cambiar el flujo de mensajería.
 * - Solo establece orders.assigned_messenger_id y orders.assigned_messenger (compatibilidad)
 * - NO modifica orders.messenger_status ni orders.status (para no romper in_delivery/accepted/etc.)
 * - Hace upsert "suave" en delivery_tracking para asegurar messenger_id y assigned_at si no existe
 * 
 * Uso:
 *   node assign_order_to_messenger.js 607 16
 *   (por defecto: orderId=607, messengerId=16)
 */
'use strict';

const { query, poolEnd } = require('./backend/config/database');

async function assignOrderToMessenger(orderId, messengerId) {
  console.log('🔧 Fijando asignación de pedido...');
  console.log(`🧾 orderId=${orderId} | 👤 messengerId=${messengerId}`);

  // Estado previo
  const beforeRows = await query(
    `SELECT id, order_number, status, messenger_status, assigned_messenger_id, assigned_messenger, updated_at
     FROM orders WHERE id = ?`, [orderId]
  );
  const before = beforeRows[0];
  console.log('📋 Estado ANTES:', before || 'No encontrado');
  if (!before) {
    throw new Error(`No existe el pedido con id=${orderId}`);
  }

  // Actualizar solo asignación
  await query(
    `UPDATE orders 
       SET assigned_messenger_id = ?, 
           assigned_messenger = ?, 
           updated_at = NOW()
     WHERE id = ?`,
    [messengerId, String(messengerId), orderId]
  );

  // Asegurar registro en delivery_tracking
  // Intentar obtener registro existente de tracking para este pedido
  const trackingRows = await query(
    `SELECT id, order_id, messenger_id, assigned_at, accepted_at, started_delivery_at, delivered_at, failed_at
       FROM delivery_tracking
      WHERE order_id = ?
      ORDER BY id ASC
      LIMIT 1`,
    [orderId]
  );

  if (trackingRows.length) {
    // Si existe, solo asegurar que messenger_id sea el correcto, y setear assigned_at si no está
    const t = trackingRows[0];
    await query(
      `UPDATE delivery_tracking
          SET messenger_id = ?,
              assigned_at = COALESCE(assigned_at, NOW())
        WHERE id = ?`,
      [messengerId, t.id]
    );
  } else {
    // Si no existe, crear uno nuevo
    await query(
      `INSERT INTO delivery_tracking (order_id, messenger_id, assigned_at)
       VALUES (?, ?, NOW())`,
      [orderId, messengerId]
    );
  }

  // Estado posterior
  const afterRows = await query(
    `SELECT id, order_number, status, messenger_status, assigned_messenger_id, assigned_messenger, updated_at
       FROM orders WHERE id = ?`,
    [orderId]
  );
  const after = afterRows[0];
  console.log('📋 Estado DESPUÉS:', after);

  if (after.assigned_messenger_id !== messengerId) {
    throw new Error(`Fallo actualizando assigned_messenger_id (esperado ${messengerId}, actual ${after.assigned_messenger_id})`);
  }
  if (String(after.assigned_messenger) !== String(messengerId)) {
    throw new Error(`Fallo actualizando assigned_messenger (esperado "${messengerId}", actual "${after.assigned_messenger}")`);
  }

  const trackingPost = await query(
    `SELECT id, order_id, messenger_id, assigned_at, accepted_at, started_delivery_at, delivered_at, failed_at
       FROM delivery_tracking
      WHERE order_id = ?`,
    [orderId]
  );
  console.log(`🚚 Registros tracking luego de la asignación (count=${trackingPost.length}):`, trackingPost);

  console.log('✅ Asignación aplicada correctamente sin alterar el flujo de mensajería.');
}

(async () => {
  try {
    const orderId = Number(process.argv[2] || 607);
    const messengerId = Number(process.argv[3] || 16);
    await assignOrderToMessenger(orderId, messengerId);
  } catch (err) {
    console.error('❌ Error aplicando asignación:', err.message);
    process.exitCode = 1;
  } finally {
    try {
      await poolEnd();
      console.log('✅ Pool de conexiones MySQL cerrado correctamente');
    } catch {
      // ignore
    }
  }
})();
