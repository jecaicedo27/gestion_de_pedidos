/**
 * surveyService: Manejo de encuestas postventa (NPS/CSAT/CES)
 * - Envío (registro en BD) de encuesta post-entrega
 * - Webhook/handler de respuesta: guarda NPS/CSAT/Comentario y dispara acciones (auto-ticket detractor)
 */
const { query } = require('../../config/database');

async function sendPostDeliverySurvey({ orderId, customerId, channel = 'whatsapp', attributes = {} }) {
  if (!orderId) throw new Error('orderId requerido');
  // Si no viene customerId, buscarlo por la orden
  const custId = customerId ?? null;

  // Registrar envío (simulación de envío real; la integración con proveedor se agregará en Fase 2)
  const res = await query(
    `INSERT INTO surveys (customer_id, order_id, channel, nps, csat, ces, comment, attributes, sent_at, responded_at, created_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, NOW(), NULL, NOW())`,
    [custId, orderId, channel, JSON.stringify(attributes || {})]
  );

  // TODO (Fase 2): Integrar messagingService para disparar WhatsApp/SMS/Email real con plantilla
  return { surveyId: res.insertId, orderId, customerId: custId, channel };
}

/**
 * Guarda la respuesta de NPS/CSAT/CES para una orden y dispara automatizaciones.
 * payload esperado: { orderId, customerId?, nps?, csat?, ces?, comment? }
 */
async function handleSurveyResponse({ orderId, customerId, nps = null, csat = null, ces = null, comment = null }) {
  if (!orderId) throw new Error('orderId requerido');

  // Determinar survey objetivo (la última sin respuesta de esa orden)
  const surveys = await query(
    `SELECT id, customer_id FROM surveys WHERE order_id = ? AND responded_at IS NULL ORDER BY id DESC LIMIT 1`,
    [orderId]
  );

  let surveyId = null;
  let custId = customerId || null;
  if (surveys.length) {
    surveyId = surveys[0].id;
    custId = custId || surveys[0].customer_id;
  } else {
    // Si no existe survey previa, crear un registro y marcar respondido (resguardo)
    // En entornos sin relación orders->customers, permitir NULL
    custId = custId ?? null;
    const ins = await query(
      `INSERT INTO surveys (customer_id, order_id, channel, sent_at, created_at)
       VALUES (?, ?, 'whatsapp', NOW(), NOW())`,
      [custId, orderId]
    );
    surveyId = ins.insertId;
  }

  // Guardar respuesta
  await query(
    `UPDATE surveys 
        SET nps = ?, csat = ?, ces = ?, comment = ?, responded_at = NOW(), updated_at = NOW()
      WHERE id = ?`,
    [
      nps !== null ? Number(nps) : null,
      csat !== null ? Number(csat) : null,
      ces !== null ? Number(ces) : null,
      comment || null,
      surveyId
    ]
  );

  // Automatización: Detractor (NPS < 7) => crear ticket de soporte
  if (nps !== null && Number(nps) < 7) {
    try {
      const ticketService = require('./ticketService');
      await ticketService.createTicket({
        customerId: custId || null,
        orderId,
        source: 'nps',
        category: 'atencion',
        priority: 'alta',
        initialNote: `[NPS Detractor ${nps}] ${comment || ''}`.trim()
      });
    } catch (e) {
      console.warn('⚠️  No se pudo crear ticket para detractor NPS:', e?.message || e);
    }
  }

  // Automatización: Promotor (NPS >= 9) → futura acción (solicitar reseña/referral) en Fase 2
  return { surveyId, saved: true };
}

module.exports = {
  sendPostDeliverySurvey,
  handleSurveyResponse
};
