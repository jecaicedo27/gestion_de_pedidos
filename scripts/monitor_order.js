#!/usr/bin/env node
/**
 * Real-time monitor for an order:
 * - Polls DB every 2s for changes in status/payment/electronic_payment_type
 * - If backend/logs/order_updates.log exists, also tails audit events (incoming/validation/sql_preview/final_verification)
 *
 * Usage:
 *   node scripts/monitor_order.js 14878
 *   node scripts/monitor_order.js FV-2-14878
 *
 * Tip: Run this, then procesa el pedido desde el rol facturador.
 */
const fs = require('fs');
const path = require('path');

// Load dotenv (backend/.env)
let dotenv;
try { dotenv = require('dotenv'); } catch { dotenv = require('../backend/node_modules/dotenv'); }
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { query, poolEnd } = require('../backend/config/database');
const { updatesLogPath } = require('../backend/utils/auditLogger');

const term = process.argv[2];

if (!term) {
  console.log('Usage:\n  node scripts/monitor_order.js <orderId|order_number|partial>');
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resolveOrder(term) {
  // If numeric -> try id first, otherwise search by partial order_number
  let id = null;
  if (/^\d+$/.test(term)) {
    const byId = await query('SELECT id, order_number FROM orders WHERE id = ? LIMIT 1', [parseInt(term, 10)]);
    if (byId.length) return { id: byId[0].id, order_number: byId[0].order_number };

    // Try to find by partial order_number (e.g., FV-2-14878)
    const like = `%${term}%`;
    const byLike = await query(
      `SELECT id, order_number FROM orders
       WHERE order_number LIKE ?
       ORDER BY updated_at DESC
       LIMIT 1`, [like]
    );
    if (byLike.length) return { id: byLike[0].id, order_number: byLike[0].order_number };
  } else {
    // Exact order_number or like
    const exact = await query('SELECT id, order_number FROM orders WHERE order_number = ? LIMIT 1', [term]);
    if (exact.length) return { id: exact[0].id, order_number: exact[0].order_number };

    const like = `%${term}%`;
    const byLike = await query(
      `SELECT id, order_number FROM orders
       WHERE order_number LIKE ?
       ORDER BY updated_at DESC
       LIMIT 1`, [like]
    );
    if (byLike.length) return { id: byLike[0].id, order_number: byLike[0].order_number };
  }
  return null;
}

async function getOrderRow(id) {
  const rows = await query(
    `SELECT 
       id, order_number, status, payment_method, delivery_method, 
       electronic_payment_type, electronic_payment_notes, shipping_date, updated_at
     FROM orders WHERE id = ? LIMIT 1`, [id]
  );
  return rows.length ? rows[0] : null;
}

function fmtRow(r) {
  if (!r) return '-';
  return {
    id: r.id,
    order_number: r.order_number,
    status: r.status,
    payment_method: r.payment_method,
    delivery_method: r.delivery_method,
    electronic_payment_type: r.electronic_payment_type,
    electronic_payment_notes: r.electronic_payment_notes,
    shipping_date: r.shipping_date,
    updated_at: r.updated_at
  };
}

// Very simple diff: show fields that changed
function diffRows(prev, curr) {
  const changes = {};
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})]);
  for (const k of keys) {
    const a = prev ? prev[k] : undefined;
    const b = curr ? curr[k] : undefined;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[k] = { from: a, to: b };
    }
  }
  return changes;
}

function prettyLogEntry(entry) {
  const ts = entry.ts || '-';
  const event = entry.event || '-';
  const oid = entry.orderId || '-';
  const user = entry.userId != null ? entry.userId : '-';
  const role = entry.userRole || '-';
  let lines = [];
  lines.push(`[${ts}] (${event}) orderId=${oid} user=${user} role=${role}`);
  if (event === 'incoming') {
    lines.push(`  payload: ${JSON.stringify(entry.data?.payload ?? null)}`);
  } else if (event === 'validation') {
    lines.push(`  validatedKeys: ${JSON.stringify(entry.data?.validatedKeys ?? [])}`);
    if ((entry.data?.removedKeys ?? []).length) {
      lines.push(`  removedKeys: ${JSON.stringify(entry.data?.removedKeys ?? [])}`);
    }
    if (Object.prototype.hasOwnProperty.call(entry.data?.validated || {}, 'electronic_payment_type')) {
      lines.push(`  validated.electronic_payment_type: ${JSON.stringify(entry.data.validated.electronic_payment_type)}`);
    }
  } else if (event === 'sql_preview') {
    lines.push(`  setClause: ${JSON.stringify(entry.data?.setClause ?? [])}`);
    lines.push(`  values: ${JSON.stringify(entry.data?.values ?? [])}`);
  } else if (event === 'final_verification') {
    lines.push(`  final.status: ${entry.data?.status}`);
    lines.push(`  final.payment_method: ${entry.data?.payment_method}`);
    lines.push(`  final.electronic_payment_type: ${entry.data?.electronic_payment_type ?? null}`);
    lines.push(`  final.electronic_payment_notes: ${entry.data?.electronic_payment_notes ?? null}`);
  } else {
    lines.push(`  data: ${JSON.stringify(entry.data ?? null)}`);
  }
  return lines.join('\n');
}

function safeReadAuditLines(filePath, maxLines = 5000) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').filter(Boolean);
    return lines.slice(Math.max(0, lines.length - maxLines));
  } catch {
    return [];
  }
}

async function main() {
  const resolved = await resolveOrder(term);
  if (!resolved) {
    console.log(`❌ Order not found for term "${term}"`);
    await poolEnd().catch(() => {});
    process.exit(1);
  }

  const { id, order_number } = resolved;
  console.log(`🔎 Monitoring order id=${id} (${order_number})`);
  console.log('   - Polling DB every 2s for changes');
  console.log(`   - Audit log file: ${updatesLogPath}`);
  if (!fs.existsSync(path.dirname(updatesLogPath))) {
    console.log('   ⚠️ Logs directory does not exist yet. The backend may need a restart to enable audit logging.');
  }

  let previous = await getOrderRow(id);
  console.log('\n📦 Baseline (DB):');
  console.table([fmtRow(previous)]);

  // Initialize last audit timestamp for this order
  let lastLogTimeMs = 0;
  const initialLines = safeReadAuditLines(updatesLogPath, 5000);
  for (const line of initialLines) {
    try {
      const obj = JSON.parse(line);
      if (obj && obj.orderId == id) {
        const ms = Date.parse(obj.ts || '');
        if (!isNaN(ms)) lastLogTimeMs = Math.max(lastLogTimeMs, ms);
      }
    } catch {}
  }
  if (lastLogTimeMs) {
    console.log(`\nℹ️ Last audit log timestamp for this order: ${new Date(lastLogTimeMs).toISOString()}`);
  } else {
    console.log('\nℹ️ No audit log entries found for this order yet.');
  }

  let stop = false;
  process.on('SIGINT', async () => {
    stop = true;
    console.log('\n🛑 Stopping monitor...');
    await poolEnd().catch(() => {});
    process.exit(0);
  });

  // Poll loop
  while (!stop) {
    try {
      // DB poll
      const current = await getOrderRow(id);
      const prevObj = fmtRow(previous);
      const currObj = fmtRow(current);
      const changes = diffRows(prevObj, currObj);
      // Only report meaningful changes
      const interesting = ['status','payment_method','delivery_method','electronic_payment_type','electronic_payment_notes','shipping_date','updated_at'];
      const interestingChanges = {};
      for (const k of interesting) {
        if (changes[k]) interestingChanges[k] = changes[k];
      }
      if (Object.keys(interestingChanges).length) {
        console.log('\n🔄 DB CHANGE DETECTED:');
        console.table([currObj]);
        console.log('Δ Changes:', interestingChanges);
        previous = current;
      }

      // Audit log poll
      if (fs.existsSync(updatesLogPath)) {
        const lines = safeReadAuditLines(updatesLogPath, 2000);
        const newEntries = [];
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj && obj.orderId == id) {
              const ms = Date.parse(obj.ts || '');
              if (!isNaN(ms) && ms > lastLogTimeMs) {
                newEntries.push(obj);
              }
            }
          } catch { /* ignore */ }
        }
        if (newEntries.length) {
          // Sort by ts ascending and print
          newEntries.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
          console.log('\n📝 New audit events:');
          for (const e of newEntries) {
            console.log(prettyLogEntry(e));
            const ms = Date.parse(e.ts || '');
            if (!isNaN(ms)) lastLogTimeMs = Math.max(lastLogTimeMs, ms);
          }
        }
      } else {
        // One-time hint
        // console.log('ℹ️ Audit log file not found yet. If you just instrumented, restart backend to enable logging.');
      }
    } catch (err) {
      console.error('❌ Monitor error:', err.message);
    }
    await sleep(2000);
  }
}

main().catch(async (e) => {
  console.error('❌ Fatal monitor error:', e.message);
  await poolEnd().catch(() => {});
  process.exit(1);
});
