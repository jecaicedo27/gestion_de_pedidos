#!/usr/bin/env node
/**
 * Alteración Postventa: permitir customer_id NULL en tickets
 * Contexto: en algunos entornos la tabla orders no tiene customer_id.
 * Para no bloquear la creación automática de tickets (incidencias/NPS), relajamos la restricción.
 *
 * Ejecución:
 *   node backend/scripts/migrations_postventa/alter_tickets_allow_null_customer_id.js
 */
const { query } = require('../../config/database');

(async () => {
  try {
    console.log('🛠  Alterando tabla tickets: permitir customer_id NULL...');
    await query(`
      ALTER TABLE tickets
      MODIFY COLUMN customer_id INT NULL;
    `, []);
    console.log('✅ Alteración aplicada: tickets.customer_id ahora acepta NULL');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error alterando tickets.customer_id:', err.sqlMessage || err.message || err);
    process.exit(1);
  }
})();
