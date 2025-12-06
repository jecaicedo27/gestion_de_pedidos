/**
 * ticketService: Gestión de tickets postventa (creación, updates, cierre)
 */
const { query } = require('../../config/database');

function calcSlaDueAt(priority) {
  const p = String(priority || 'media').toLowerCase();
  const now = new Date();
  const addHours = (h) => new Date(now.getTime() + h * 60 * 60 * 1000);
  if (p === 'critica') return addHours(12);
  if (p === 'alta') return addHours(24);
  if (p === 'media') return addHours(48);
  return addHours(72); // baja
}

/**
 * Crea un ticket con estado inicial "nuevo".
 * @param {Object} params
 * @param {number|null} params.customerId
 * @param {number|null} params.orderId
 * @param {'nps'|'logistica'|'cartera'|'manual'|'otros'} params.source
 * @param {'entrega'|'producto'|'pago'|'atencion'|'otros'} params.category
 * @param {'baja'|'media'|'alta'|'critica'} [params.priority='media']
 * @param {string} [params.initialNote]
 * @param {number|null} [params.assigneeId]
 */
async function createTicket({
  customerId = null,
  orderId = null,
  source = 'manual',
  category = 'otros',
  priority = 'media',
  initialNote = null,
  assigneeId = null
}) {
  const slaDueAt = calcSlaDueAt(priority);
  const ins = await query(
    `INSERT INTO tickets (customer_id, order_id, source, category, status, priority, sla_due_at, assignee_id, created_at)
     VALUES (?, ?, ?, ?, 'nuevo', ?, ?, ?, NOW())`,
    [customerId, orderId, source, category, priority, slaDueAt.toISOString().slice(0, 19).replace('T', ' '), assigneeId]
  );

  const ticketId = ins.insertId;

  if (initialNote) {
    await query(
      `INSERT INTO ticket_updates (ticket_id, user_id, note, prev_status, new_status, created_at)
       VALUES (?, NULL, ?, NULL, 'nuevo', NOW())`,
      [ticketId, initialNote]
    );
  }

  return { ticketId };
}

/**
 * Agrega una nota/update al ticket (y opcionalmente cambia estado)
 */
async function addUpdate({ ticketId, userId = null, note = null, newStatus = null }) {
  const updates = [];
  if (newStatus) {
    await query(`UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, ticketId]);
    updates.push(['status', newStatus]);
  }
  await query(
    `INSERT INTO ticket_updates (ticket_id, user_id, note, prev_status, new_status, created_at)
     VALUES (?, ?, ?, NULL, ?, NOW())`,
    [ticketId, userId, note || null, newStatus || null]
  );
  return { ticketId, updates };
}

/**
 * Asigna un ticket a un usuario/agente
 */
async function assignTicket({ ticketId, assigneeId }) {
  await query(`UPDATE tickets SET assignee_id = ?, updated_at = NOW() WHERE id = ?`, [assigneeId, ticketId]);
  await query(
    `INSERT INTO ticket_updates (ticket_id, user_id, note, prev_status, new_status, created_at)
     VALUES (?, ?, ?, NULL, NULL, NOW())`,
    [ticketId, assigneeId, `Asignado a usuario ${assigneeId}`]
  );
  return { ticketId, assigneeId };
}

/**
 * Cierra un ticket (resuelto/cerrado)
 */
async function closeTicket({ ticketId, userId = null, note = null, finalStatus = 'cerrado' }) {
  const status = ['resuelto', 'cerrado'].includes(finalStatus) ? finalStatus : 'cerrado';
  await query(`UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?`, [status, ticketId]);
  await query(
    `INSERT INTO ticket_updates (ticket_id, user_id, note, prev_status, new_status, created_at)
     VALUES (?, ?, ?, NULL, ?, NOW())`,
    [ticketId, userId, note || 'Ticket cerrado', status]
  );
  return { ticketId, status };
}

module.exports = {
  createTicket,
  addUpdate,
  assignTicket,
  closeTicket
};
