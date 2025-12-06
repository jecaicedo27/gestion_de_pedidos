#!/usr/bin/env node
/**
 * Force-set orders.electronic_payment_type for a specific order (by ID or order_number)
 * Usage:
 *   node scripts/set_electronic_payment_type.js 14891 mercadopago
 *   node scripts/set_electronic_payment_type.js FV-2-14891 mercadopago
 *   (default type is 'mercadopago' if not provided)
 */
const path = require('path');
// Load dotenv from backend if not available at repo root, then load backend .env
let dotenv;
try {
  dotenv = require('dotenv');
} catch (e) {
  dotenv = require('../backend/node_modules/dotenv');
}
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
const { query, poolEnd } = require('../backend/config/database');

async function main() {
  const arg = process.argv[2];
  const type = (process.argv[3] || 'mercadopago').toLowerCase();

  if (!arg) {
    console.log('Usage:\n  node scripts/set_electronic_payment_type.js <orderId|orderNumber> [type]');
    process.exit(1);
  }

  // Normalize allowed values
  let normalized = type.trim();
  if (['mercado_pago', 'mercado-pago', 'mercado pago'].includes(normalized)) normalized = 'mercadopago';
  if (!['mercadopago', 'bold', 'otro', ''].includes(normalized)) {
    console.warn(`⚠️ Tipo "${type}" no reconocido. Se normaliza a "otro" para cumplir validación.`);
    normalized = 'otro';
  }
  if (normalized === '') normalized = null;

  const isNumericId = /^\d+$/.test(arg);
  const whereClause = isNumericId ? 'id = ?' : 'order_number = ?';
  const param = isNumericId ? Number(arg) : String(arg);

  try {
    console.log('🔧 Forzando electronic_payment_type...');
    console.log('   Target:', isNumericId ? `id=${param}` : `order_number='${param}'`);
    console.log('   New electronic_payment_type:', normalized);

    const [res] = await Promise.all([
      query(
        `UPDATE orders 
           SET electronic_payment_type = ?, updated_at = NOW() 
         WHERE ${whereClause}
         LIMIT 1`,
        [normalized, param]
      )
    ]).catch(err => { throw err; });

    // Show result
    const rows = await query(
      `SELECT id, order_number, status, payment_method, electronic_payment_type, electronic_payment_notes, updated_at 
         FROM orders 
         WHERE ${whereClause}
         ORDER BY updated_at DESC
         LIMIT 1`,
      [param]
    );

    if (!rows.length) {
      console.log('❌ Order not found after update (unexpected).');
    } else {
      console.log('\n📦 Order (post-update)');
      console.table(rows);
    }

    console.log('✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await poolEnd().catch(() => {});
  }
}

main();
