/**
 * Event Bus de Postventa (simple + outbox persistente).
 * - Inserta eventos en tabla postventa_events (outbox).
 * - Ejecuta handlers inmediatos best-effort (no críticos).
 *
 * Uso:
 *   const eventBus = require('../postventa/eventBusService');
 *   await eventBus.emit('order.delivered', { orderId, customerId, ... });
 */
const { query } = require('../../config/database');

function safeJson(obj) {
  try {
    return JSON.stringify(obj || {});
  } catch (_) {
    return JSON.stringify({ _invalid_payload: true });
  }
}

/**
 * Handler inmediato para ciertos eventos clave.
 * Nota: Best-effort, no bloquear flujo principal.
 */
async function handleImmediate(eventType, payload) {
  try {
    if (eventType === 'order.delivered') {
      // Disparar encuesta post-entrega
      const surveyService = require('./surveyService'); // carga diferida para evitar ciclos
      const orderId = Number(payload?.orderId || payload?.id || 0) || null;
      const customerId = Number(payload?.customerId || 0) || null;

      if (orderId && customerId) {
        await surveyService.sendPostDeliverySurvey({
          orderId,
          customerId,
          channel: 'whatsapp', // por defecto (puede cambiarse según consentimientos)
          attributes: {
            source: 'event.order.delivered',
            deliveredAt: payload?.deliveredAt || null,
            city: payload?.city || null,
            carrier: payload?.carrier || null,
            paymentMethod: payload?.paymentMethod || null,
            total: payload?.total || null
          }
        });
      }

      // Disparar Journey Post-Entrega (best-effort)
      try {
        const journeyService = require('./journeyService'); // carga diferida para evitar ciclos
        await journeyService.handleEvent('order.delivered', payload || {});
      } catch (e) {
        console.warn('⚠️  Error disparando journey post-entrega:', e?.message || e);
      }
    }

    if (eventType === 'delivery.incident') {
      // Crear ticket por incidencia de entrega
      const ticketService = require('./ticketService');
      const orderId = Number(payload?.orderId || 0) || null;
      const customerId = Number(payload?.customerId || 0) || null;
      await ticketService.createTicket({
        customerId,
        orderId,
        source: 'logistica',
        category: 'entrega',
        priority: 'alta',
        initialNote: `[Incidencia de entrega] ${payload?.incident || 'sin_detalle'} - ${payload?.notes || ''}`.trim()
      });
    }
  } catch (err) {
    console.warn('⚠️  Error en handler inmediato EventBus (continuando):', err?.message || err);
  }
}

/**
 * Publica un evento en el bus y lo persiste en outbox.
 * @param {string} eventType
 * @param {object} payload
 * @returns {Promise<number>} id del evento en outbox
 */
async function emit(eventType, payload = {}) {
  const id = await query(
    `INSERT INTO postventa_events (event_type, payload, processed, created_at) VALUES (?, ?, 0, NOW())`,
    [String(eventType), safeJson(payload)]
  ).then(r => r.insertId);

  // Best-effort: ejecutar handler inmediato
  handleImmediate(eventType, payload).catch(() => {});

  return id;
}

module.exports = {
  emit
};
