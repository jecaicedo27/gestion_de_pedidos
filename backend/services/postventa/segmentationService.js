/**
 * segmentationService (Fase 2): Cálculo de RFM y segmentación dinámica.
 * - Soporta entornos SIN orders.customer_id usando surveys (customer_id, order_id) + JOIN a orders por order_id.
 * - Calcula Recency (días desde última actividad), Frequency (#ordenes/distintas o #surveys) y Monetary (suma total_spent).
 * - Asigna puntajes 1-5 por quintiles y etiqueta rfm_segment (champion, leal, potencial, en_riesgo, dormido, nuevo).
 * - Actualiza/crea registros en customer_profiles.
 */
const { query } = require('../../config/database');

function daysBetween(dateStr, now = new Date()) {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 9999;
  const diffMs = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function percentile(sortedAsc, p) {
  if (!sortedAsc || !sortedAsc.length) return null;
  const pos = (sortedAsc.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedAsc[base + 1] !== undefined) {
    return sortedAsc[base] + rest * (sortedAsc[base + 1] - sortedAsc[base]);
  }
  return sortedAsc[base];
}

function buildQuintileThresholds(valuesAsc, invert = false) {
  // invert=false: valores altos son mejores (F y M). invert=true: valores bajos son mejores (R - días)
  if (!valuesAsc.length) {
    return { t20: 0, t40: 0, t60: 0, t80: 0 };
  }
  const arr = valuesAsc.slice().sort((a, b) => a - b);
  return {
    t20: percentile(arr, 0.20),
    t40: percentile(arr, 0.40),
    t60: percentile(arr, 0.60),
    t80: percentile(arr, 0.80)
  };
}

function scoreFromQuintiles(value, thresholds, invert = false) {
  // Para R (invert=true): menor valor ⇒ mejor puntaje
  // Para F/M (invert=false): mayor valor ⇒ mejor puntaje
  const { t20, t40, t60, t80 } = thresholds;
  if (invert) {
    if (value <= t20) return 5;
    if (value <= t40) return 4;
    if (value <= t60) return 3;
    if (value <= t80) return 2;
    return 1;
  } else {
    if (value >= t80) return 5;
    if (value >= t60) return 4;
    if (value >= t40) return 3;
    if (value >= t20) return 2;
    return 1;
  }
}

function assignSegment(r, f, m, metrics) {
  // Regla simple y explicable
  const { recencyDays, frequency, monetary } = metrics;
  if (frequency === 1 && recencyDays <= 30) return 'nuevo';
  if (r >= 4 && f >= 4 && m >= 4) return 'champion';
  if (r >= 3 && f >= 4) return 'leal';
  if (r >= 4 && f <= 3) return 'potencial';
  if (r <= 2 && f >= 3) return 'en_riesgo';
  if (r <= 2 && f <= 2) return 'dormido';
  return 'leal';
}

async function upsertCustomerProfile(customerId, profile) {
  const rows = await query(`SELECT id FROM customer_profiles WHERE customer_id = ? LIMIT 1`, [customerId]);
  if (rows.length) {
    await query(
      `UPDATE customer_profiles
          SET rfm_recency = ?, rfm_frequency = ?, rfm_monetary = ?,
              rfm_segment = ?, value_score = ?, risk_score = ?,
              avg_order_value = ?, returns_rate = ?, complaints_count = ?,
              last_order_at = ?, updated_at = NOW()
        WHERE customer_id = ?`,
      [
        profile.rfm_recency,
        profile.rfm_frequency,
        profile.rfm_monetary,
        profile.rfm_segment,
        profile.value_score,
        profile.risk_score,
        profile.avg_order_value,
        profile.returns_rate,
        profile.complaints_count,
        profile.last_order_at,
        customerId
      ]
    );
  } else {
    await query(
      `INSERT INTO customer_profiles
        (customer_id, rfm_recency, rfm_frequency, rfm_monetary, rfm_segment,
         value_score, risk_score, avg_order_value, returns_rate, complaints_count, last_order_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        customerId,
        profile.rfm_recency,
        profile.rfm_frequency,
        profile.rfm_monetary,
        profile.rfm_segment,
        profile.value_score,
        profile.risk_score,
        profile.avg_order_value,
        profile.returns_rate,
        profile.complaints_count,
        profile.last_order_at
      ]
    );
  }
}

async function getAllMetrics() {
  // Usa surveys.customer_id y surveys.order_id; une a orders para total y fecha
  const rows = await query(
    `SELECT
       s.customer_id,
       COUNT(*) AS survey_count,
       COUNT(DISTINCT s.order_id) AS orders_count,
       MAX(COALESCE(o.created_at, s.responded_at, s.sent_at, s.created_at)) AS last_activity_at,
       AVG(CASE WHEN o.total_amount IS NOT NULL THEN o.total_amount END) AS avg_order_value,
       SUM(CASE WHEN o.total_amount IS NOT NULL THEN o.total_amount ELSE 0 END) AS total_spent
     FROM surveys s
     LEFT JOIN orders o ON o.id = s.order_id
     WHERE s.customer_id IS NOT NULL
     GROUP BY s.customer_id`
  );

  const now = new Date();
  return rows.map(r => {
    const recencyDays = daysBetween(r.last_activity_at, now);
    const frequency = Number(r.orders_count || r.survey_count || 0);
    const monetary = Number(r.total_spent || 0);
    const avgOrder = Number(r.avg_order_value || 0);
    return {
      customer_id: Number(r.customer_id),
      recencyDays,
      frequency,
      monetary,
      avgOrder,
      last_activity_at: r.last_activity_at || null
    };
  });
}

async function getCustomerMetrics(customerId) {
  const rows = await query(
    `SELECT
       s.customer_id,
       COUNT(*) AS survey_count,
       COUNT(DISTINCT s.order_id) AS orders_count,
       MAX(COALESCE(o.created_at, s.responded_at, s.sent_at, s.created_at)) AS last_activity_at,
       AVG(CASE WHEN o.total_amount IS NOT NULL THEN o.total_amount END) AS avg_order_value,
       SUM(CASE WHEN o.total_amount IS NOT NULL THEN o.total_amount ELSE 0 END) AS total_spent
     FROM surveys s
     LEFT JOIN orders o ON o.id = s.order_id
     WHERE s.customer_id = ?
     GROUP BY s.customer_id`,
    [customerId]
  );
  const now = new Date();
  if (!rows.length) {
    // Sin datos, dejar perfil básico
    return {
      customer_id: customerId,
      recencyDays: 9999,
      frequency: 0,
      monetary: 0,
      avgOrder: 0,
      last_activity_at: null
    };
  }
  const r = rows[0];
  return {
    customer_id: Number(r.customer_id),
    recencyDays: daysBetween(r.last_activity_at, now),
    frequency: Number(r.orders_count || r.survey_count || 0),
    monetary: Number(r.total_spent || 0),
    avgOrder: Number(r.avg_order_value || 0),
    last_activity_at: r.last_activity_at || null
  };
}

/**
 * Recalcula RFM para todos o un cliente específico.
 * @param {{customerId?: number}} param0
 * @returns {Promise<{updated:number, sample?:any[]}>}
 */
async function recomputeRFM({ customerId = null } = {}) {
  if (customerId) {
    const m = await getCustomerMetrics(customerId);
    const recencies = [m.recencyDays];
    const freqs = [m.frequency];
    const mons = [m.monetary];

    // Umbrales triviales para 1 solo; evitan NaN
    const tR = { t20: recencies[0], t40: recencies[0], t60: recencies[0], t80: recencies[0] };
    const tF = { t20: freqs[0], t40: freqs[0], t60: freqs[0], t80: freqs[0] };
    const tM = { t20: mons[0], t40: mons[0], t60: mons[0], t80: mons[0] };

    const rScore = scoreFromQuintiles(m.recencyDays, tR, true);
    const fScore = scoreFromQuintiles(m.frequency, tF, false);
    const mScore = scoreFromQuintiles(m.monetary, tM, false);
    const seg = assignSegment(rScore, fScore, mScore, m);

    await upsertCustomerProfile(customerId, {
      rfm_recency: rScore,
      rfm_frequency: fScore,
      rfm_monetary: mScore,
      rfm_segment: seg,
      value_score: Number(((fScore + mScore) / 2).toFixed(2)),
      risk_score: Number((6 - rScore).toFixed(2)),
      avg_order_value: m.avgOrder,
      returns_rate: 0,
      complaints_count: 0,
      last_order_at: m.last_activity_at
    });

    return { updated: 1, sample: [{ customer_id: customerId, rScore, fScore, mScore, seg }] };
  }

  const metrics = await getAllMetrics();
  if (!metrics.length) return { updated: 0, sample: [] };

  const recenciesAsc = metrics.map(x => x.recencyDays).sort((a, b) => a - b);
  const freqsAsc = metrics.map(x => x.frequency).sort((a, b) => a - b);
  const monsAsc = metrics.map(x => x.monetary).sort((a, b) => a - b);

  const tR = buildQuintileThresholds(recenciesAsc, true);
  const tF = buildQuintileThresholds(freqsAsc, false);
  const tM = buildQuintileThresholds(monsAsc, false);

  let updated = 0;
  const sample = [];

  for (const m of metrics) {
    const rScore = scoreFromQuintiles(m.recencyDays, tR, true);
    const fScore = scoreFromQuintiles(m.frequency, tF, false);
    const mScore = scoreFromQuintiles(m.monetary, tM, false);
    const seg = assignSegment(rScore, fScore, mScore, m);

    await upsertCustomerProfile(m.customer_id, {
      rfm_recency: rScore,
      rfm_frequency: fScore,
      rfm_monetary: mScore,
      rfm_segment: seg,
      value_score: Number(((fScore + mScore) / 2).toFixed(2)),
      risk_score: Number((6 - rScore).toFixed(2)),
      avg_order_value: m.avgOrder,
      returns_rate: 0,
      complaints_count: 0,
      last_order_at: m.last_activity_at
    });
    updated++;
    if (sample.length < 5) sample.push({ customer_id: m.customer_id, rScore, fScore, mScore, seg });
  }

  return { updated, sample };
}

async function getProfile(customerId) {
  const rows = await query(`SELECT * FROM customer_profiles WHERE customer_id = ? LIMIT 1`, [customerId]);
  return rows.length ? rows[0] : null;
}

module.exports = {
  recomputeRFM,
  getProfile
};
