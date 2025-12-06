#!/usr/bin/env node
/**
 * Backfill de orders.paid_amount (y campos relacionados) desde wallet_validations
 *
 * Reglas:
 * - Tomar la ÚLTIMA validación aprobada por order_id (ORDER BY id DESC)
 * - Si payment_type = 'mixed':
 *    - requires_payment = 1
 *    - payment_amount = cash_amount
 *    - paid_amount = transferred_amount
 * - Si payment_type es NULL o 'single':
 *    - Si payment_method IN ('transferencia','pago_electronico','tarjeta_credito'):
 *        paid_amount = COALESCE(orders.paid_amount, wallet_validations.payment_amount)
 *      (No forzar requires_payment en single para no alterar lógica de crédito/otros)
 *
 * Uso:
 *  - node backend/scripts/backfill_orders_paid_amount_from_wallet_validations.js               (procesa todas con condiciones)
 *  - node backend/scripts/backfill_orders_paid_amount_from_wallet_validations.js FV-2-15058   (solo esa orden)
 */
const { query, poolEnd } = require('../config/database');

const SINGLE_METHODS = new Set(['transferencia', 'pago_electronico', 'tarjeta_credito']);

function toNumber(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

async function getTargetRows(orderNumberArg) {
  if (orderNumberArg) {
    // Filtrar por número de orden específico
    return await query(
      `SELECT 
         o.id as order_id, o.order_number, o.paid_amount as order_paid_amount,
         o.requires_payment as order_requires_payment, o.payment_amount as order_payment_amount,
         wv.id as wv_id, wv.payment_method, wv.payment_type, wv.transferred_amount, wv.cash_amount, wv.payment_amount
       FROM orders o
       JOIN wallet_validations wv ON wv.order_id = o.id
       WHERE o.order_number = ?
         AND wv.validation_status = 'approved'
       ORDER BY wv.id DESC
       LIMIT 1`,
      [orderNumberArg]
    );
  }

  // Backfill general: últimas aprobadas por order_id donde potencialmente falte paid_amount
  // Evitamos sobreescribir si ya hay paid_amount > 0 en orders (excepto mixto donde igual seteamos requires_payment=1/payment_amount)
  return await query(
    `SELECT t.*
     FROM (
       SELECT 
         o.id as order_id, o.order_number, o.paid_amount as order_paid_amount,
         o.requires_payment as order_requires_payment, o.payment_amount as order_payment_amount,
         wv.id as wv_id, wv.payment_method, wv.payment_type, wv.transferred_amount, wv.cash_amount, wv.payment_amount
       FROM wallet_validations wv
       JOIN orders o ON o.id = wv.order_id
       WHERE wv.validation_status = 'approved'
       ORDER BY wv.order_id, wv.id DESC
     ) as t
     GROUP BY t.order_id`
  );
}

async function run() {
  const arg = (process.argv[2] || '').trim();
  try {
    const rows = await getTargetRows(arg || null);
    if (!rows.length) {
      console.log(arg ? `No se encontraron validaciones aprobadas para ${arg}` : 'No hay filas para procesar.');
      return;
    }

    let updated = 0;
    for (const r of rows) {
      const paymentType = (r.payment_type || '').toLowerCase();
      const method = (r.payment_method || '').toLowerCase();
      const isMixed = paymentType === 'mixed';

      if (isMixed) {
        const transferred = toNumber(r.transferred_amount);
        const cash = toNumber(r.cash_amount);

        if (!(transferred > 0 && cash > 0)) {
          console.log(`- Saltando ${r.order_number}: mixto inválido (transferred=${r.transferred_amount}, cash=${r.cash_amount})`);
          continue;
        }

        // Siempre setear según reglas mixto
        const res = await query(
          `UPDATE orders
           SET requires_payment = 1,
               payment_amount = ?,
               paid_amount = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [cash, transferred, r.order_id]
        );
        if (res.affectedRows) {
          updated++;
          console.log(`✅ [MIXED] ${r.order_number}: requires_payment=1, payment_amount=${cash}, paid_amount=${transferred}`);
        }
        continue;
      }

      // Single: solo backfill de paid_amount si método es de pago inmediato
      if (SINGLE_METHODS.has(method)) {
        const currentPaid = toNumber(r.order_paid_amount);
        const wvPaid = toNumber(r.payment_amount);

        if (currentPaid && currentPaid > 0) {
          // Ya hay paid_amount, no tocar
          console.log(`- ${r.order_number}: paid_amount ya informado (${currentPaid}), no se modifica`);
          continue;
        }

        if (wvPaid > 0) {
          const res = await query(
            `UPDATE orders
             SET paid_amount = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [wvPaid, r.order_id]
          );
          if (res.affectedRows) {
            updated++;
            console.log(`✅ [SINGLE] ${r.order_number}: paid_amount=${wvPaid}`);
          }
        } else {
          console.log(`- Saltando ${r.order_number}: single sin monto válido (wv.payment_amount=${r.payment_amount})`);
        }
      } else {
        console.log(`- ${r.order_number}: método ${method} no aplica para backfill single`);
      }
    }

    console.log(`\n🏁 Backfill completado. Filas actualizadas: ${updated}`);
  } catch (err) {
    console.error('❌ Error en backfill:', err && (err.sqlMessage || err.message) || err);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
