/**
 * messagingService: Envío omnicanal (stub Fase 2) con registro de interacciones y verificación de consentimientos.
 * - Canales soportados: 'whatsapp' | 'sms' | 'email'
 * - Respeta consentimientos (customer_consents): scope 'transaccional' o 'marketing'
 * - Usa plantillas (tabla templates) por template_key; si no hay plantilla, usa 'content' directo
 * - Registra en customer_interactions (status: 'sent' best-effort)
 *
 * Nota: Este es un stub sin integración real a proveedor. En producción, agregar adaptadores reales.
 */
const { query } = require('../../config/database');

/**
 * Obtiene plantilla por clave desde la tabla templates (si existe).
 */
async function getTemplateByKey(templateKey) {
  if (!templateKey) return null;
  try {
    const rows = await query(
      `SELECT template_key, channel, content, variables, approved
         FROM templates
        WHERE template_key = ?
        LIMIT 1`,
      [templateKey]
    );
    return rows.length ? rows[0] : null;
  } catch (e) {
    // Si no existe la tabla o error, ignorar (fase inicial)
    return null;
  }
}

/**
 * Render simple de plantilla con variables: reemplaza {{var}} por values[var]
 */
function renderTemplate(raw, values = {}) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
    const k = String(key || '').trim();
    const v = values[k];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

/**
 * Verifica consentimientos del cliente para el canal/scope dado.
 * - Si no hay consentimientos: permitir 'transaccional' por defecto; bloquear 'marketing'.
 * - Si existe registro:
 *   - opt_out_at => bloquea
 *   - opt_in_at => permite
 */
async function hasConsent(customerId, channel, scope) {
  if (!customerId) {
    // Si no tenemos customerId, permitir transaccional (ej: mensajes operativos post-pedido) para no bloquear
    return scope === 'transaccional';
  }
  try {
    const rows = await query(
      `SELECT channel, scope, opt_in_at, opt_out_at
         FROM customer_consents
        WHERE customer_id = ?
          AND channel = ?
          AND (scope = ? OR scope = 'todos')
        LIMIT 1`,
      [customerId, channel, scope]
    );
    if (!rows.length) {
      // Sin registro: por defecto permitir transaccional, bloquear marketing
      return scope === 'transaccional';
    }
    const r = rows[0];
    if (r.opt_out_at) return false;
    if (r.opt_in_at) return true;
    return scope === 'transaccional';
  } catch (e) {
    // Si tabla no existe, permitir transaccional y bloquear marketing
    return scope === 'transaccional';
  }
}

/**
 * Registra la interacción en customer_interactions (best-effort).
 */
async function logInteraction({ customerId, orderId = null, channel, direction = 'outgoing', templateKey = null, content = null, status = 'sent', metadata = null, userId = null }) {
  try {
    await query(
      `INSERT INTO customer_interactions
         (customer_id, order_id, channel, direction, template_key, content, metadata, status, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        customerId || null,
        orderId || null,
        channel,
        direction,
        templateKey || null,
        content || null,
        metadata ? JSON.stringify(metadata) : null,
        status,
        userId || null
      ]
    );
  } catch (e) {
    // Ignorar errores de logging en fase inicial
  }
}

/**
 * Envía un mensaje (stub) respetando consentimientos y registrando interacción.
 * params: { customerId?, orderId?, channel, templateKey?, content?, variables?, scope?='transaccional', userId? }
 */
async function send({ customerId = null, orderId = null, channel = 'whatsapp', templateKey = null, content = null, variables = {}, scope = 'transaccional', userId = null }) {
  const ch = String(channel || 'whatsapp').toLowerCase();
  const sc = String(scope || 'transaccional').toLowerCase();

  // Consentimientos
  const allowed = await hasConsent(customerId, ch, sc);
  if (!allowed) {
    await logInteraction({
      customerId,
      orderId,
      channel: ch,
      templateKey,
      content: '[BLOCKED by consent]',
      status: 'failed',
      metadata: { reason: 'consent_blocked', scope: sc },
      userId
    });
    return { success: false, reason: 'consent_blocked' };
  }

  // Resolver plantilla
  let finalContent = content || '';
  let tplMeta = null;
  if (templateKey) {
    const tpl = await getTemplateByKey(templateKey);
    tplMeta = tpl;
    if (tpl && tpl.content) {
      finalContent = renderTemplate(tpl.content, variables || {});
    } else {
      // Plantilla no encontrada: si no hay content, usar placeholder
      if (!finalContent) {
        finalContent = renderTemplate('Hola {{first_name}}, gracias por tu compra en {{brand}}.', variables || {});
      }
    }
  } else {
    // No hay plantilla, usar content directo o fallback
    if (!finalContent) {
      finalContent = renderTemplate('Hola {{first_name}}, gracias por tu compra en {{brand}}.', variables || {});
    }
  }

  // Stub de envío (aquí iría integración a proveedor)
  const providerResponse = {
    provider: 'stub',
    channel: ch,
    content_length: (finalContent || '').length,
    sent_at: new Date().toISOString()
  };

  await logInteraction({
    customerId,
    orderId,
    channel: ch,
    templateKey: templateKey || null,
    content: finalContent,
    status: 'sent',
    metadata: { scope: sc, variables, tplMeta, providerResponse },
    userId
  });

  return { success: true, channel: ch, scope: sc, content: finalContent };
}

/**
 * Administra consentimientos del cliente (opt-in/opt-out).
 * params: { customerId, channel, scope, optIn:boolean }
 */
async function setConsent({ customerId, channel, scope = 'transaccional', optIn = true, source = 'api' }) {
  if (!customerId || !channel) throw new Error('customerId y channel son requeridos');
  const ch = String(channel).toLowerCase();
  const sc = String(scope || 'transaccional').toLowerCase();
  const stamp = optIn ? 'opt_in_at = NOW(), opt_out_at = NULL' : 'opt_out_at = NOW()';

  try {
    // Upsert manual
    const exists = await query(
      `SELECT id FROM customer_consents WHERE customer_id = ? AND channel = ? AND scope IN (?, 'todos') LIMIT 1`,
      [customerId, ch, sc]
    );
    if (exists.length) {
      await query(
        `UPDATE customer_consents SET ${stamp}, source = ?, updated_at = NOW() WHERE id = ?`,
        [source || 'api', exists[0].id]
      );
    } else {
      await query(
        `INSERT INTO customer_consents (customer_id, channel, scope, ${optIn ? 'opt_in_at' : 'opt_out_at'}, source, created_at)
         VALUES (?, ?, ?, NOW(), ?, NOW())`,
        [customerId, ch, sc, source || 'api']
      );
    }
    return { success: true, customerId, channel: ch, scope: sc, status: optIn ? 'opt_in' : 'opt_out' };
  } catch (e) {
    return { success: false, error: e?.message || e };
  }
}

module.exports = {
  send,
  setConsent
};
