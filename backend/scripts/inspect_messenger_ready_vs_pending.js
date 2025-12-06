/**
 * Inspecciona pedidos con mensajero asignado y determina en qué ficha deberían estar:
 * - "Pendientes Entrega (con mensajero)" si messenger_status IN ('accepted','in_delivery')
 *   o si hay tracking accepted_at/started_delivery_at.
 * - "Listos para Entregar" si solo están asignados (messenger_status='assigned') y status='listo_para_entrega'.
 *
 * Uso:
 *   node backend/scripts/inspect_messenger_ready_vs_pending.js
 */
const { query } = require('../config/database');

(async () => {
  try {
    // Traer pedidos relevantes: listos/en reparto y que no estén entregados/cancelados
    const rows = await query(
      `
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.messenger_status,
        o.assigned_messenger_id,
        o.delivery_method,
        o.created_at
      FROM orders o
      WHERE o.deleted_at IS NULL
        AND o.status IN ('listo_para_entrega','en_reparto')
      ORDER BY o.id
      `,
      []
    );

    // Map de tracking (últimos hitos por order_id)
    const tracking = await query(
      `
      SELECT 
        order_id,
        MAX(assigned_at) AS assigned_at,
        MAX(accepted_at) AS accepted_at,
        MAX(started_delivery_at) AS started_delivery_at
      FROM delivery_tracking
      GROUP BY order_id
      `,
      []
    );
    const trackByOrder = new Map(tracking.map(t => [t.order_id, t]));

    const classify = (o) => {
      const t = trackByOrder.get(o.id) || {};
      const ms = String(o.messenger_status || '').toLowerCase();
      const accepted = !!t.accepted_at || ms === 'accepted';
      const started = !!t.started_delivery_at || ms === 'in_delivery';
      const onlyAssigned = ms === 'assigned' && !accepted && !started;

      if (String(o.status) === 'en_reparto') {
        return { bucket: 'pendiente_entrega', reason: 'status=en_reparto' };
      }
      if (accepted || started) {
        return { bucket: 'pendiente_entrega', reason: `mensajero ${ms} / tracking accepted:${!!t.accepted_at} started:${!!t.started_delivery_at}` };
      }
      if (onlyAssigned && String(o.status) === 'listo_para_entrega') {
        return { bucket: 'listos_para_entregar', reason: 'solo asignado' };
      }
      return { bucket: 'indefinido', reason: `status=${o.status} ms=${ms}` };
    };

    let shouldBePending = 0;
    let shouldBeReady = 0;
    const out = [];

    for (const o of rows) {
      const t = trackByOrder.get(o.id) || {};
      const r = classify(o);
      if (r.bucket === 'pendiente_entrega') shouldBePending++;
      if (r.bucket === 'listos_para_entregar') shouldBeReady++;
      out.push({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        status: o.status,
        messenger_status: o.messenger_status,
        assigned_messenger_id: o.assigned_messenger_id,
        accepted_at: t.accepted_at || null,
        started_delivery_at: t.started_delivery_at || null,
        delivery_method: o.delivery_method,
        should_be: r.bucket,
        reason: r.reason
      });
    }

    console.log('RESUMEN CLASIFICACIÓN (regla deseada por negocio)');
    console.log('  - Deberían estar en "Pendientes Entrega (con mensajero)":', shouldBePending);
    console.log('  - Deberían estar en "Listos para Entregar":', shouldBeReady);
    console.log('');
    console.table(out, [
      'id','order_number','status','messenger_status','assigned_messenger_id',
      'accepted_at','started_delivery_at','should_be','reason'
    ]);
    process.exit(0);
  } catch (e) {
    console.error('ERROR inspect_messenger_ready_vs_pending:', e && (e.sqlMessage || e.message) || e);
    process.exit(1);
  }
})();
