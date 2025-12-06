/**
 * journeyService (Fase 2): Motor simple de journeys (stub) con Post-Entrega v1.
 * - Usa tablas journeys y journey_executions para activar/pausar y registrar ejecuciones.
 * - Maneja evento 'order.delivered' para journey 'post_entrega_v1':
 *    1) Enviar mensaje de agradecimiento (transaccional) por WhatsApp (stub messagingService).
 *    2) La encuesta NPS/CSAT ya es disparada por eventBus/surveyService.
 */
const { query } = require('../../config/database');
const messagingService = require('./messagingService');

const POST_ENTREGA = 'post_entrega_v1';

async function getJourneyByName(name) {
  const rows = await query(`SELECT id, name, definition_json, active FROM journeys WHERE name = ? LIMIT 1`, [name]);
  return rows.length ? rows[0] : null;
}

async function ensureJourney(name, definition = {}) {
  const j = await getJourneyByName(name);
  if (j) return j;
  const ins = await query(
    `INSERT INTO journeys (name, definition_json, active, created_at) VALUES (?, ?, 0, NOW())`,
    [name, JSON.stringify(definition || {})]
  );
  return { id: ins.insertId, name, definition_json: JSON.stringify(definition || {}), active: 0 };
}

async function activate(name, definition = null) {
  await ensureJourney(name, definition || {});
  if (definition) {
    await query(`UPDATE journeys SET active = 1, definition_json = ?, updated_at = NOW() WHERE name = ?`, [
      JSON.stringify(definition || {}),
      name
    ]);
  } else {
    await query(`UPDATE journeys SET active = 1, updated_at = NOW() WHERE name = ?`, [name]);
  }
  return { name, active: true };
}

async function pause(name) {
  await query(`UPDATE journeys SET active = 0, updated_at = NOW() WHERE name = ?`, [name]);
  return { name, active: false };
}

async function isActive(name) {
  const j = await getJourneyByName(name);
  return !!(j && (j.active === 1 || j.active === true));
}

async function logExecution(journeyName, customerId, state = 'completed', stepIndex = 1, metadata = null) {
  try {
    const j = await getJourneyByName(journeyName);
    const journeyId = j ? j.id : null;
    await query(
      `INSERT INTO journey_executions (journey_id, customer_id, state, step_index, last_event_at, metadata, created_at)
       VALUES (?, ?, ?, ?, NOW(), ?, NOW())`,
      [journeyId, customerId || null, state, stepIndex, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (e) {
    // no-op
  }
}

/**
 * Manejar evento de negocio y ejecutar pasos del journey si aplica.
 * @param {string} eventType
 * @param {object} payload  Ej: { orderId, customerId, orderNumber, deliveryMethod, ... }
 */
async function handleEvent(eventType, payload = {}) {
  // Por ahora solo atender post entrega
  if (eventType !== 'order.delivered') return;

  const active = await isActive(POST_ENTREGA);
  if (!active) return;

  const orderId = Number(payload.orderId || 0) || null;
  let customerId = Number(payload.customerId || 0) || null;
  let customerName = null;

  try {
    if (orderId) {
      const rows = await query(
        `SELECT id, customer_name, customer_identification, customer_email
           FROM orders WHERE id = ? LIMIT 1`,
        [orderId]
      );
      if (rows.length) {
        customerName = rows[0].customer_name || null;
      }
    }
  } catch (_) {
    // no-op
  }

  // Paso 1: Mensaje de agradecimiento (transaccional) inmediato (stub)
  try {
    const variables = {
      first_name: (customerName || '').split(' ')[0] || 'Cliente',
      brand: process.env.BRAND_NAME || 'Nuestra marca',
      order_number: payload.orderNumber || ''
    };
    await messagingService.send({
      customerId,
      orderId,
      channel: 'whatsapp',
      scope: 'transaccional',
      templateKey: null, // usar content directo por ahora
      content: 'Hola {{first_name}}, gracias por tu compra en {{brand}}. Tu pedido {{order_number}} ha sido entregado. ¡Cuéntanos cómo te fue!',
      variables
    });
  } catch (e) {
    // continuar; se registra la interacción en messagingService
  }

  // Registrar ejecución del journey
  await logExecution(POST_ENTREGA, customerId, 'completed', 1, {
    event: eventType,
    orderId,
    orderNumber: payload.orderNumber || null
  });
}

/**
 * Activar/preparar el journey post_entrega_v1 con definición por defecto.
 */
async function activatePostEntrega() {
  const def = {
    name: POST_ENTREGA,
    description: 'Journey post-entrega v1: agradecimiento + encuesta (encuesta vía surveyService/eventBus)',
    steps: [
      { index: 1, type: 'message', channel: 'whatsapp', scope: 'transaccional', templateKey: null }
    ],
    version: 1
  };
  return activate(POST_ENTREGA, def);
}

/**
 * Pausar el journey post_entrega_v1.
 */
async function pausePostEntrega() {
  return pause(POST_ENTREGA);
}

/**
 * Utilidad de test: simula un delivered para probar el journey.
 */
async function testDelivered({ orderId, customerId, orderNumber }) {
  return handleEvent('order.delivered', { orderId, customerId, orderNumber });
}

module.exports = {
  ensureJourney,
  activate,
  pause,
  isActive,
  handleEvent,
  activatePostEntrega,
  pausePostEntrega,
  testDelivered
};
