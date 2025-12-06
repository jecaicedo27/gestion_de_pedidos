#!/usr/bin/env node
/**
 * Corrige casos donde un pedido pagado por transferencia quedó aceptado en el acta como EFECTIVO.
 *
 * Uso:
 *   node backend/scripts/fix_transfer_accepted_as_cash_for_order.js FV-2-15214          (solo vista previa)
 *   node backend/scripts/fix_transfer_accepted_as_cash_for_order.js FV-2-15214 --apply  (aplica cambios)
 *
 * Qué hace:
 * - Detecta detalles en cash_closing_details para ese pedido con payment_method != 'cash'
 *   y collection_status = 'collected' y montos > 0 (aceptados por error).
 * - Elimina esos detalles y recalcula los agregados del cierre (messenger_cash_closings).
 *   - Si el cierre queda sin ítems: elimina el cierre.
 *   - Si quedan ítems: actualiza expected_amount/declared_amount y status ('completed' o 'partial').
 *
 * Notas:
 * - No toca delivery_tracking ni orders, solo limpia el acta para que no cuente transferencias como efectivo.
 * - Ejecuta en modo lectura por defecto. Requiere flag --apply para escribir.
 */

const { query, poolEnd } = require('../config/database');

async function main() {
  const key = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!key) {
    console.error('Uso: node backend/scripts/fix_transfer_accepted_as_cash_for_order.js <order_number|id> [--apply]');
    process.exit(1);
  }

  try {
    // 1) Resolver order_id
    let orderRow;
    if (/^\d+$/.test(String(key))) {
      const [byId] = await query('SELECT id, order_number FROM orders WHERE id = ? LIMIT 1', [Number(key)]);
      orderRow = byId;
    } else {
      const [byNum] = await query('SELECT id, order_number FROM orders WHERE order_number = ? LIMIT 1', [key]);
      orderRow = byNum;
    }
    if (!orderRow) {
      console.log('❌ Pedido no encontrado:', key);
      return;
    }
    const orderId = orderRow.id;
    console.log(`🔎 Pedido: id=${orderId}, número=${orderRow.order_number}`);

    // 2) Mostrar tracking (para diagnóstico)
    const [dt] = await query(
      `SELECT id, payment_method, payment_collected, delivery_fee_payment_method, delivery_fee_collected, delivered_at
         FROM delivery_tracking
        WHERE order_id = ?
        ORDER BY id DESC
        LIMIT 1`,
      [orderId]
    );
    console.log('\n📦 Último delivery_tracking:');
    console.log(dt || '(no tracking)');

    // 3) Cargar detalles de caja relacionados
    const details = await query(
      `SELECT id, closing_id, payment_method, order_amount, collected_amount, collection_status, collected_at
         FROM cash_closing_details
        WHERE order_id = ?
        ORDER BY id DESC`,
      [orderId]
    );

    if (!details.length) {
      console.log('\nℹ️ No hay detalles en cash_closing_details para este pedido.');
      return;
    }

    console.log('\n🧾 Detalles en cash_closing_details (antes):');
    details.forEach(d => console.log(d));

    // 4) Detectar candidatos a limpiar (transfer aceptada como efectivo)
    const toRemove = details.filter(d => {
      const pm = String(d.payment_method || '').toLowerCase().trim();
      const isCash = pm === 'cash';
      const amountsPositive = Number(d.order_amount || 0) > 0 || Number(d.collected_amount || 0) > 0;
      return !isCash && String(d.collection_status || '').toLowerCase() === 'collected' && amountsPositive;
    });

    if (!toRemove.length) {
      console.log('\n✅ No hay detalles aceptados por error (transferencias con montos>0). No se requiere acción.');
      return;
    }

    console.log('\n⚠️ Detalles a ELIMINAR (transfer aceptada como efectivo):');
    toRemove.forEach(d => console.log(d));

    // 5) Agrupar por cierre
    const closingIds = [...new Set(toRemove.map(d => d.closing_id).filter(Boolean))];

    if (!apply) {
      console.log('\n🟡 Vista previa: no se aplican cambios (use --apply para ejecutar).');
      console.log('Cierres afectados:', closingIds);
      return;
    }

    // 6) Aplicar: eliminar detalles y recalcular cierres
    console.log('\n🛠  Aplicando corrección...');
    // Eliminar detalles erróneos
    const idsToDelete = toRemove.map(d => d.id);
    if (idsToDelete.length) {
      const placeholders = idsToDelete.map(() => '?').join(',');
      await query(`DELETE FROM cash_closing_details WHERE id IN (${placeholders})`, idsToDelete);
      console.log(`   - Eliminados ${idsToDelete.length} detalle(s) erróneo(s) de cash_closing_details`);
    }

    // Recalcular cada cierre
    for (const cid of closingIds) {
      const [agg] = await query(
        `SELECT 
           COUNT(*) AS total_count,
           SUM(order_amount) AS expected_amount,
           SUM(collected_amount) AS declared_amount,
           SUM(CASE WHEN collection_status = 'collected' THEN 1 ELSE 0 END) AS accepted_count
         FROM cash_closing_details
         WHERE closing_id = ?`,
        [cid]
      );

      const total = Number(agg?.total_count || 0);
      if (total === 0) {
        // Sin ítems: borrar el cierre
        await query('DELETE FROM messenger_cash_closings WHERE id = ?', [cid]);
        console.log(`   - Cierre ${cid} eliminado (quedó sin ítems)`);
      } else {
        const expected = Number(agg?.expected_amount || 0);
        const declared = Number(agg?.declared_amount || 0);
        const allAccepted = Number(agg?.accepted_count || 0) === total;
        const newStatus = allAccepted ? 'completed' : 'partial';
        await query(
          `UPDATE messenger_cash_closings
              SET status = ?, 
                  approved_by = CASE WHEN ? = 'completed' THEN approved_by ELSE NULL END,
                  approved_at = CASE WHEN ? = 'completed' THEN approved_at ELSE NULL END,
                  expected_amount = ?, 
                  declared_amount = ?
            WHERE id = ?`,
          [newStatus, newStatus, newStatus, expected, declared, cid]
        );
        console.log(`   - Cierre ${cid} actualizado: status=${newStatus}, expected=${expected}, declared=${declared}`);
      }
    }

    // 7) Mostrar estado final de detalles del pedido
    const after = await query(
      `SELECT id, closing_id, payment_method, order_amount, collected_amount, collection_status, collected_at
         FROM cash_closing_details
        WHERE order_id = ?
        ORDER BY id DESC`,
      [orderId]
    );

    console.log('\n✅ Detalles en cash_closing_details (después):');
    after.forEach(d => console.log(d));

    console.log('\n✅ Corrección completada. Las transferencias ya no aparecerán como efectivo en el acta.');
  } catch (e) {
    console.error('❌ Error en la corrección:', e.sqlMessage || e.message || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

main();
