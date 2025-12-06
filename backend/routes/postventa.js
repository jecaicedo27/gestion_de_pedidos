const express = require('express');
const router = express.Router();

const surveyService = require('../services/postventa/surveyService');
const ticketService = require('../services/postventa/ticketService');
const messagingService = require('../services/postventa/messagingService');
const segmentationService = require('../services/postventa/segmentationService');
const journeyService = require('../services/postventa/journeyService');
const loyaltyService = require('../services/postventa/loyaltyService');
const referralsService = require('../services/postventa/referralsService');
const riskService = require('../services/postventa/riskService');
const { query } = require('../config/database');

/**
 * POST /api/postventa/surveys/send
 * body: { orderId: number, customerId?: number, channel?: 'whatsapp'|'sms'|'email', attributes?: object }
 */
router.post('/surveys/send', async (req, res) => {
  try {
    const { orderId, customerId, channel = 'whatsapp', attributes = {} } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId es requerido' });
    }
    const result = await surveyService.sendPostDeliverySurvey({ orderId, customerId, channel, attributes });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error enviando encuesta post-entrega:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * POST /api/postventa/surveys/webhook
 * body (flexible):
 *  - orderId | order_id (number)
 *  - nps | score (0-10)
 *  - csat (1-5)
 *  - ces (1-7)
 *  - comment | comments | feedback (string)
 */
router.post('/surveys/webhook', async (req, res) => {
  try {
    const b = req.body || {};
    const orderId = b.orderId ?? b.order_id;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId/order_id requerido' });
    }
    const nps = b.nps ?? b.score ?? null;
    const csat = b.csat ?? null;
    const ces = b.ces ?? null;
    const comment = b.comment ?? b.comments ?? b.feedback ?? null;
    const customerId = b.customerId ?? b.customer_id ?? null;

    const result = await surveyService.handleSurveyResponse({ orderId, customerId, nps, csat, ces, comment });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error procesando webhook de encuesta:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * GET /api/postventa/customers/:id/360
 * Resumen 360 v1 del cliente: pedidos, tickets, encuestas
 */
router.get('/customers/:id/360', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId inválido' });
    }

    // Resumen de pedidos (robusto si orders no tiene customer_id)
    let ordersSummary;
    try {
      const rows = await query(
        `SELECT 
           COUNT(*) AS orders_count,
           COALESCE(SUM(total_amount), 0) AS total_spent,
           MAX(created_at) AS last_order_at,
           AVG(total_amount) AS avg_order_value
         FROM orders
         WHERE customer_id = ?`,
        [customerId]
      );
      ordersSummary = rows[0] || { orders_count: 0, total_spent: 0, last_order_at: null, avg_order_value: 0 };
    } catch (e) {
      // Fallback si la columna no existe
      ordersSummary = { orders_count: 0, total_spent: 0, last_order_at: null, avg_order_value: 0 };
    }

    // Últimos 5 pedidos (opcionales) - robusto sin customer_id
    let recentOrders = [];
    try {
      recentOrders = await query(
        `SELECT id, order_number, status, total_amount, created_at
           FROM orders
          WHERE customer_id = ?
          ORDER BY id DESC
          LIMIT 5`,
        [customerId]
      );
    } catch (e) {
      recentOrders = [];
    }

    // Resumen de tickets (robusto si tabla no existe aún)
    let ticketsSummary = { tickets_total: 0, tickets_open: 0 };
    try {
      const ticketsSummaryRows = await query(
        `SELECT
           COUNT(*) AS tickets_total,
           SUM(CASE WHEN status IN ('nuevo','en_progreso','esperando_cliente','escalado') THEN 1 ELSE 0 END) AS tickets_open
         FROM tickets
         WHERE customer_id = ?`,
        [customerId]
      );
      ticketsSummary = ticketsSummaryRows[0] || ticketsSummary;
    } catch (e) {
      ticketsSummary = { tickets_total: 0, tickets_open: 0 };
    }

    // Últimos 5 tickets (robusto si tabla no existe aún)
    let recentTickets = [];
    try {
      recentTickets = await query(
        `SELECT id, order_id, source, category, status, priority, created_at, sla_due_at
           FROM tickets
          WHERE customer_id = ?
          ORDER BY id DESC
          LIMIT 5`,
        [customerId]
      );
    } catch (e) {
      recentTickets = [];
    }

    // Resumen de encuestas (robusto si tabla no existe aún)
    let surveysSummary = { surveys_total: 0, avg_nps: null, avg_csat: null };
    try {
      const surveysSummaryRows = await query(
        `SELECT
           COUNT(*) AS surveys_total,
           AVG(nps) AS avg_nps,
           AVG(csat) AS avg_csat
         FROM surveys
         WHERE customer_id = ?`,
        [customerId]
      );
      surveysSummary = surveysSummaryRows[0] || surveysSummary;
    } catch (e) {
      surveysSummary = { surveys_total: 0, avg_nps: null, avg_csat: null };
    }

    // Últimas 5 encuestas (robusto si tabla no existe aún)
    let recentSurveys = [];
    try {
      recentSurveys = await query(
        `SELECT id, order_id, nps, csat, ces, comment, sent_at, responded_at
           FROM surveys
          WHERE customer_id = ?
          ORDER BY id DESC
          LIMIT 5`,
        [customerId]
      );
    } catch (e) {
      recentSurveys = [];
    }

    return res.json({
      success: true,
      data: {
        customer_id: customerId,
        orders: { summary: ordersSummary, recent: recentOrders },
        tickets: { summary: ticketsSummary, recent: recentTickets },
        surveys: { summary: surveysSummary, recent: recentSurveys }
      }
    });
  } catch (error) {
    console.error('Error en Customer 360 v1:', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
});

/**
 * POST /api/postventa/messaging/send
 * body: {
 *   customerId?: number,
 *   orderId?: number,
 *   channel: 'whatsapp'|'sms'|'email',
 *   templateKey?: string,
 *   content?: string,
 *   variables?: object,
 *   scope?: 'transaccional'|'marketing',
 *   userId?: number
 * }
 */
router.post('/messaging/send', async (req, res) => {
  try {
    const { customerId, orderId, channel, templateKey, content, variables, scope = 'transaccional', userId } = req.body || {};
    if (!channel) {
      return res.status(400).json({ success: false, message: 'channel es requerido' });
    }
    const result = await messagingService.send({ customerId, orderId, channel, templateKey, content, variables, scope, userId });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error enviando mensaje (postventa):', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * POST /api/postventa/consents/set
 * body: { customerId: number, channel: 'whatsapp'|'sms'|'email', scope?: 'transaccional'|'marketing'|'todos', optIn: boolean, source?: string }
 */
router.post('/consents/set', async (req, res) => {
  try {
    const { customerId, channel, scope = 'transaccional', optIn, source } = req.body || {};
    if (!customerId || !channel || typeof optIn === 'undefined') {
      return res.status(400).json({ success: false, message: 'customerId, channel y optIn son requeridos' });
    }
    const result = await messagingService.setConsent({ customerId, channel, scope, optIn: !!optIn, source: source || 'api' });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error configurando consentimiento (postventa):', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * POST /api/postventa/rfm/recompute
 * body: { customerId?: number }
 * Recalcula RFM para todos o para un cliente específico.
 */
router.post('/rfm/recompute', async (req, res) => {
  try {
    const { customerId } = req.body || {};
    const result = await segmentationService.recomputeRFM({ customerId: customerId ? Number(customerId) : null });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error recomputando RFM (postventa):', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * GET /api/postventa/rfm/profile/:id
 * Obtiene el perfil RFM del cliente.
 */
router.get('/rfm/profile/:id', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId inválido' });
    }
    const profile = await segmentationService.getProfile(customerId);
    return res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error obteniendo perfil RFM (postventa):', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * POST /api/postventa/journeys/activate
 * body: { name?: string }
 * Activa un journey (por defecto: post_entrega_v1)
 */
router.post('/journeys/activate', async (req, res) => {
  try {
    const name = String(req.body?.name || 'post_entrega_v1');
    const result = name === 'post_entrega_v1'
      ? await journeyService.activatePostEntrega()
      : await journeyService.activate(name);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error activando journey:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * POST /api/postventa/journeys/pause
 * body: { name?: string }
 * Pausa un journey (por defecto: post_entrega_v1)
 */
router.post('/journeys/pause', async (req, res) => {
  try {
    const name = String(req.body?.name || 'post_entrega_v1');
    const result = name === 'post_entrega_v1'
      ? await journeyService.pausePostEntrega()
      : await journeyService.pause(name);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error pausando journey:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * POST /api/postventa/journeys/test-delivered
 * body: { orderId: number, customerId?: number, orderNumber?: string }
 * Simula un evento de entrega para probar el journey post-entrega.
 */
router.post('/journeys/test-delivered', async (req, res) => {
  try {
    const { orderId, customerId = null, orderNumber = null } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId es requerido' });
    }
    await journeyService.testDelivered({ orderId, customerId, orderNumber });
    return res.json({ success: true, data: { simulated: true, orderId, customerId, orderNumber } });
  } catch (error) {
    console.error('Error simulando delivered en journey:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * LOYALTY (puntos)
 */
// GET /api/postventa/loyalty/:id/balance?includeMovements=true&limit=20
router.get('/loyalty/:id/balance', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const includeMovements = ['1', 'true', 'yes'].includes(String(req.query.includeMovements || '').toLowerCase());
    const limit = Number(req.query.limit || 20);
    const data = await loyaltyService.getBalance(customerId, { includeMovements, limit });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error obteniendo balance de loyalty:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error interno' });
  }
});

// POST /api/postventa/loyalty/earn { customerId, points, reason, orderId }
router.post('/loyalty/earn', async (req, res) => {
  try {
    const { customerId, points, reason = 'purchase', orderId = null, meta = null } = req.body || {};
    const data = await loyaltyService.earnPoints({ customerId, points, reason, orderId, meta });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error sumando puntos loyalty:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

// POST /api/postventa/loyalty/spend { customerId, points, reason, orderId }
router.post('/loyalty/spend', async (req, res) => {
  try {
    const { customerId, points, reason = 'adjustment', orderId = null, meta = null } = req.body || {};
    const data = await loyaltyService.spendPoints({ customerId, points, reason, orderId, meta });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error redimiendo puntos loyalty:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * REFERRALS (referidos)
 */
// POST /api/postventa/referrals/generate { referrerCustomerId }
router.post('/referrals/generate', async (req, res) => {
  try {
    const { referrerCustomerId } = req.body || {};
    const data = await referralsService.generateCode(referrerCustomerId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error generando código de referido:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

// GET /api/postventa/referrals/:referrerId?state=registered
router.get('/referrals/:referrerId', async (req, res) => {
  try {
    const referrerId = Number(req.params.referrerId);
    const { state = null } = req.query || {};
    const data = await referralsService.listByReferrer(referrerId, { state: state || null });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error listando referidos:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

// POST /api/postventa/referrals/register { code, referredCustomerId }
router.post('/referrals/register', async (req, res) => {
  try {
    const { code, referredCustomerId } = req.body || {};
    const data = await referralsService.registerReferral({ code, referredCustomerId });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error registrando referido:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

// POST /api/postventa/referrals/first-purchase { referredCustomerId, pointsReferrer?, pointsReferred?, orderId? }
router.post('/referrals/first-purchase', async (req, res) => {
  try {
    const { referredCustomerId, pointsReferrer = 500, pointsReferred = 200, orderId = null } = req.body || {};
    const data = await referralsService.markFirstPurchase({ referredCustomerId, pointsReferrer, pointsReferred, orderId });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error marcando first_purchase:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

// POST /api/postventa/referrals/reward { referrerCustomerId, referredCustomerId, pointsReferrer?, pointsReferred?, orderId? }
router.post('/referrals/reward', async (req, res) => {
  try {
    const { referrerCustomerId, referredCustomerId, pointsReferrer = 0, pointsReferred = 0, orderId = null } = req.body || {};
    const data = await referralsService.reward({ referrerCustomerId, referredCustomerId, pointsReferrer, pointsReferred, orderId });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error reward referidos:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

/**
 * RISK (churn / cobranza preventiva)
 */
// POST /api/postventa/risk/compute { customerId }
router.post('/risk/compute', async (req, res) => {
  try {
    const { customerId } = req.body || {};
    const data = await riskService.computeRisk(Number(customerId));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error computando riesgo:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

// GET /api/postventa/risk/:id
router.get('/risk/:id', async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const data = await riskService.getRisk(customerId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error obteniendo riesgo:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

// POST /api/postventa/risk/suggest { customerId }
router.post('/risk/suggest', async (req, res) => {
  try {
    const { customerId } = req.body || {};
    const riskRow = await riskService.getRisk(Number(customerId));
    const actions = riskService.suggestPreventiveActions(Number(riskRow?.score || 0), riskRow?.features || {});
    return res.json({ success: true, data: { score: riskRow?.score || 0, actions } });
  } catch (error) {
    console.error('Error sugiriendo acciones de riesgo:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Error interno' });
  }
});

module.exports = router;
