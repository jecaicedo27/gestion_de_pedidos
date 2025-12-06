/**
 * riskService (Fase 3): Riesgo de churn y cobranza preventiva.
 * - Calcula un score (0-100) combinando señales: recency, NPS, tickets abiertos y saldo (si aplica).
 * - Persiste en tabla churn_risk (score y features_json).
 * - Expone utilidades para obtener riesgo y sugerir acciones preventivas.
 */
const { query } = require('../../config/database');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Heurística simple:
 * - Recency (días desde última actividad): 0-40 días → bajo riesgo, 120+ días → alto riesgo
 *   recencyScore = map 0..120 a 0..60 (más días = más riesgo)
 * - NPS detractor (nps < 7): cada detractor reciente suma riesgo (hasta 20 pts)
 * - Tickets abiertos: cada ticket abierto suma 5 pts (máx 20)
 * - Opcional: balances/compromisos pagos futuros (no implementado ahora)
 */
function computeHeuristic(features) {
  const recencyDays = Number(features.recency_days ?? 999);
  const detractors = Number(features.nps_detractors_last90 ?? 0);
  const openTickets = Number(features.open_tickets ?? 0);

  const recencyScore = clamp((recencyDays / 120) * 60, 0, 60); // 0..60
  const npsScore = clamp(detractors * 5, 0, 20); // 0..20
  const ticketsScore = clamp(openTickets * 5, 0, 20); // 0..20

  const total = clamp(recencyScore + npsScore + ticketsScore, 0, 100);
  return Number(total.toFixed(2));
}

async function loadFeatures(customerId) {
  // Recency desde orders.created_at o surveys/responded_at/sent_at
  const [recRow] = await query(
    `SELECT
       DATEDIFF(NOW(), MAX(ts)) AS recency_days
     FROM (
       SELECT MAX(created_at) AS ts
         FROM orders
        WHERE customer_document = (SELECT document FROM customers WHERE id = ? LIMIT 1)
       UNION ALL
       SELECT MAX(COALESCE(responded_at, sent_at, created_at)) AS ts
         FROM surveys
        WHERE customer_id = ?
     ) t`,
    [customerId, customerId]
  );

  // NPS detractores últimos 90 días
  const [npsRow] = await query(
    `SELECT COUNT(*) AS cnt
       FROM surveys
      WHERE customer_id = ?
        AND nps IS NOT NULL
        AND nps < 7
        AND COALESCE(responded_at, sent_at, created_at) >= DATE_SUB(NOW(), INTERVAL 90 DAY)`,
    [customerId]
  );

  // Tickets abiertos
  const [tRow] = await query(
    `SELECT COUNT(*) AS open_cnt
       FROM tickets
      WHERE customer_id = ?
        AND status IN ('nuevo','en_progreso','esperando_cliente','escalado')`,
    [customerId]
  );

  return {
    recency_days: Number(recRow?.recency_days ?? 999),
    nps_detractors_last90: Number(npsRow?.cnt ?? 0),
    open_tickets: Number(tRow?.open_cnt ?? 0)
  };
}

async function setRisk(customerId, score, features) {
  const rows = await query(`SELECT customer_id FROM churn_risk WHERE customer_id = ? LIMIT 1`, [customerId]);
  if (rows.length) {
    await query(
      `UPDATE churn_risk SET score = ?, features_json = ?, updated_at = NOW() WHERE customer_id = ?`,
      [Number(score), JSON.stringify(features || {}), customerId]
    );
  } else {
    await query(
      `INSERT INTO churn_risk (customer_id, score, features_json, updated_at)
       VALUES (?, ?, ?, NOW())`,
      [customerId, Number(score), JSON.stringify(features || {})]
    );
  }
  return { customerId, score, features };
}

async function computeRisk(customerId) {
  const features = await loadFeatures(customerId);
  const score = computeHeuristic(features);
  await setRisk(customerId, score, features);
  return { customerId, score, features };
}

async function getRisk(customerId) {
  const rows = await query(`SELECT customer_id, score, features_json, updated_at FROM churn_risk WHERE customer_id = ? LIMIT 1`, [customerId]);
  if (!rows.length) {
    // Si no existe, calcular on-demand
    return await computeRisk(customerId);
  }
  return {
    customerId: rows[0].customer_id,
    score: Number(rows[0].score),
    features: safeParse(rows[0].features_json),
    updated_at: rows[0].updated_at
  };
}

function safeParse(json) {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}

/**
 * Sugerencias de acciones preventivas (no ejecuta, solo sugiere en esta versión):
 * - score >= 80: crear ticket de “cobranza preventiva” y enviar WhatsApp recordatorio amable.
 * - 60-79: enviar mensaje de reactivación (beneficio/promo) y ofrecer asistencia.
 * - 40-59: pedir feedback y ofrecer soporte.
 * - < 40: sin acción inmediata.
 */
function suggestPreventiveActions(score, features) {
  if (score >= 80) {
    return [
      { type: 'ticket', category: 'pago', priority: 'alta', note: 'Cobranza preventiva: alto riesgo de churn.' },
      { type: 'message', channel: 'whatsapp', scope: 'transaccional', template: 'recordatorio_amable' }
    ];
  } else if (score >= 60) {
    return [
      { type: 'message', channel: 'whatsapp', scope: 'marketing', template: 'reactivacion_beneficio' },
      { type: 'message', channel: 'email', scope: 'marketing', template: 'oferta_soporte' }
    ];
  } else if (score >= 40) {
    return [
      { type: 'message', channel: 'whatsapp', scope: 'transaccional', template: 'solicitud_feedback' }
    ];
  }
  return [];
}

module.exports = {
  computeRisk,
  getRisk,
  suggestPreventiveActions
};
