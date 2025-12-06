#!/usr/bin/env node
/**
 * Alteración Postventa: permitir customer_id NULL en surveys
 * Contexto: en algunos entornos la tabla orders no tiene customer_id.
 * Para no bloquear el envío/registro de encuestas, relajamos la restricción.
 *
 * Ejecución:
 *   node backend/scripts/migrations_postventa/alter_surveys_allow_null_customer_id.js
 */
const { query } = require('../../config/database');

(async () => {
  try {
    console.log('🛠  Alterando tabla surveys: permitir customer_id NULL...');
    await query(`
      ALTER TABLE surveys
      MODIFY COLUMN customer_id INT NULL;
    `, []);
    console.log('✅ Alteración aplicada: surveys.customer_id ahora acepta NULL');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error alterando surveys.customer_id:', err.sqlMessage || err.message || err);
    process.exit(1);
  }
})();
