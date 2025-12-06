#!/usr/bin/env node
/**
 * Lista en tabla los pedidos que faltan por gestionar por parte de logística.
 * Muestra: código (order_number), método de pago (payment_method) y electronic_payment_type.
 *
 * Uso:
 *   node scripts/list_pending_logistics_orders.js
 *   node scripts/list_pending_logistics_orders.js en_logistica           // estado único
 *   node scripts/list_pending_logistics_orders.js en_logistica,en_empaque // múltiples estados
 *   node scripts/list_pending_logistics_orders.js en_logistica 200        // con límite
 */
const path = require('path');

// Cargar dotenv (como en otros scripts)
let dotenv;
try {
  dotenv = require('dotenv');
} catch (e) {
  dotenv = require('../backend/node_modules/dotenv');
}
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { query, poolEnd } = require('../backend/config/database');

// Estados permitidos para evitar SQL dinámico arbitrario
const ALLOWED_STATUSES = new Set([
  'pendiente_por_facturacion',
  'revision_cartera',
  'en_logistica',
  'en_preparacion',
  'en_empaque',
  'empacado',
  'listo_para_recoger',
  'en_reparto',
  'entregado_transportadora',
  'entregado_cliente',
  'entregado_bodega',
  'cancelado'
]);

async function main() {
  // args: [statusesCsv] [limit]
  const statusesCsv = process.argv[2] || 'en_logistica';
  const limitArg = process.argv[3];
  const limit = Math.max(1, Math.min(parseInt(limitArg || '500', 10) || 500, 2000));

  // Normalizar y validar estados
  const statuses = statusesCsv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => ALLOWED_STATUSES.has(s));

  if (statuses.length === 0) {
    console.error('❌ Ningún estado válido recibido. Usa por ejemplo: en_logistica o en_logistica,en_empaque');
    process.exitCode = 1;
    return;
  }

  try {
    console.log(`🔎 Listando pedidos con estados [${statuses.join(', ')}] (máx ${limit})...`);

    // Construir placeholders para IN (...)
    const placeholders = statuses.map(() => '?').join(', ');
    const sql = `
      SELECT
        id,
        order_number,
        customer_name,
        status,
        payment_method,
        /* campo principal segun estructura actual */
        electronic_payment_type AS electronic_payment_type,
        updated_at
      FROM orders
      WHERE status IN (${placeholders})
      ORDER BY updated_at DESC
      LIMIT ?
    `;

    const rows = await query(sql, [...statuses, limit]);

    if (!rows.length) {
      console.log('❌ No se encontraron pedidos para los estados indicados.');
    } else {
      // Imprimir tabla con columnas solicitadas
      console.table(
        rows.map(r => ({
          id: r.id,
          codigo: r.order_number,
          dueno: r.customer_name,
          metodo_pago: r.payment_method,
          electronic_payment_type: r.electronic_payment_type || null,
          status: r.status
        }))
      );
      console.log(`✅ Total: ${rows.length}`);
    }
  } catch (err) {
    console.error('❌ Error ejecutando consulta:', err.message);
  } finally {
    await poolEnd().catch(() => {});
  }
}

main();
