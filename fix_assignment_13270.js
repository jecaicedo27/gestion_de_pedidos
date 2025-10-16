/**
 * Corrige la asignación del pedido FV-2-13270 (id=587) al mensajero Julián (id=16)
 * - orders.assigned_messenger_id = 16
 * - orders.assigned_messenger = '16' (compat por frontend heredado)
 * - orders.messenger_status = 'assigned'
 * - orders.status = 'listo_para_entrega'
 * - Upsert en delivery_tracking con assigned_at = NOW()
 */
'use strict';

const { query, poolEnd } = require('./backend/config/database');

async function fixAssignment({ orderId, messengerId }) {
  console.log('Iniciando corrección de asignación...');
  console.log(`Pedido ID: ${orderId}  | Mensajero ID: ${messengerId}`);

  // Mostrar estado previo
  const beforeRows = await query(
    `SELECT id, order_number, status, messenger_status, assigned_messenger_id, assigned_messenger, delivery_method, updated_at
     FROM orders WHERE id = ?`, [orderId]
  );
  const before = beforeRows[0];
  console.log('Estado ANTES:', before || 'No encontrado');

  if (!before) {
    throw new Error(`No existe el pedido con id=${orderId}`);
  }

  // Update principal en orders
  await query(
    `UPDATE orders 
     SET 
       assigned_messenger_id = ?, 
       assigned_messenger = ?, 
       messenger_status = 'assigned',
       status = 'listo_para_entrega',
       updated_at = NOW()
     WHERE id = ?`,
    [messengerId, String(messengerId), orderId]
  );

  // Upsert tracking
  await query(
    `INSERT INTO delivery_tracking (order_id, messenger_id, assigned_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE 
       messenger_id = VALUES(messenger_id),
       assigned_at = NOW()`,
    [orderId, messengerId]
  );

  // Mostrar estado posterior
  const afterRows = await query(
    `SELECT id, order_number, status, messenger_status, assigned_messenger_id, assigned_messenger, delivery_method, updated_at
     FROM orders WHERE id = ?`, [orderId]
  );
  const after = afterRows[0];
  console.log('Estado DESPUÉS:', after);

  // Validaciones mínimas
  const errors = [];
  if (after.assigned_messenger_id !== messengerId) {
    errors.push(`assigned_messenger_id esperado ${messengerId}, actual ${after.assigned_messenger_id}`);
  }
  if (String(after.assigned_messenger) !== String(messengerId)) {
    errors.push(`assigned_messenger esperado "${messengerId}", actual "${after.assigned_messenger}"`);
  }
  if (after.messenger_status !== 'assigned') {
    errors.push(`messenger_status esperado "assigned", actual "${after.messenger_status}"`);
  }
  if (after.status !== 'listo_para_entrega') {
    errors.push(`status esperado "listo_para_entrega", actual "${after.status}"`);
  }

  const trackingRows = await query(
    `SELECT order_id, messenger_id, assigned_at, accepted_at, started_delivery_at, delivered_at 
     FROM delivery_tracking WHERE order_id = ?`, [orderId]
  );
  console.log(`Tracking posterior (count=${trackingRows.length}):`, trackingRows);

  if (trackingRows.length === 0) {
    errors.push('No existe registro en delivery_tracking tras el upsert');
  } else {
    const t = trackingRows[0];
    if (!t.assigned_at) {
      errors.push('assigned_at no fue seteado en delivery_tracking');
    }
    if (t.messenger_id !== messengerId) {
      errors.push(`delivery_tracking.messenger_id esperado ${messengerId}, actual ${t.messenger_id}`);
    }
  }

  if (errors.length) {
    console.error('Validaciones fallidas:', errors);
    throw new Error('La corrección no pasó las validaciones.');
  }

  console.log('✅ Corrección aplicada y validada correctamente.');
}

(async () => {
  try {
    await fixAssignment({ orderId: 587, messengerId: 16 });
  } catch (err) {
    console.error('❌ Error aplicando la corrección:', err.message);
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
