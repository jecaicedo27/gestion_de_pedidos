#!/usr/bin/env node
/**
 * Print structured audit logs for an order from backend/logs/order_updates.log
 * Usage:
 *   node scripts/print_order_update_logs.js 1598
 *   node scripts/print_order_update_logs.js FV-2-14883
 *   node scripts/print_order_update_logs.js 1598 50     // limit to last 50 entries
 */
const fs = require('fs');
const path = require('path');

// Get updatesLogPath from backend utils (ensures same path)
const { updatesLogPath } = require('../backend/utils/auditLogger');
// DB access to resolve order_number -> id if needed
let dotenv;
try { dotenv = require('dotenv'); } catch { dotenv = require('../backend/node_modules/dotenv'); }
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
const { query, poolEnd } = require('../backend/config/database');

async function resolveOrderId(term) {
  if (!term) return null;
  if (/^\d+$/.test(term)) return parseInt(term, 10);
  const rows = await query('SELECT id FROM orders WHERE order_number = ? LIMIT 1', [term]);
  return rows.length ? rows[0].id : null;
}

function readLinesReverse(filePath, maxLines = 2000) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').filter(Boolean);
    // Return last maxLines lines (most recent at end)
    return lines.slice(Math.max(0, lines.length - maxLines));
  } catch (e) {
    console.error('❌ Error reading log file:', e.message);
    return [];
  }
}

function prettyPrint(entry) {
  const ts = entry.ts || '-';
  const event = entry.event || '-';
  const oid = entry.orderId || '-';
  const user = entry.userId != null ? entry.userId : '-';
  const role = entry.userRole || '-';

  console.log(`\n[${ts}] (${event}) orderId=${oid} user=${user} role=${role}`);
  // Show relevant data parts depending on event
  if (event === 'incoming') {
    console.log('  payload:', JSON.stringify(entry.data?.payload ?? null));
  } else if (event === 'validation') {
    console.log('  validatedKeys:', JSON.stringify(entry.data?.validatedKeys ?? []));
    if ((entry.data?.removedKeys ?? []).length) {
      console.log('  removedKeys:', JSON.stringify(entry.data?.removedKeys ?? []));
    }
    if (entry.data?.validated?.electronic_payment_type !== undefined) {
      console.log('  validated.electronic_payment_type:', JSON.stringify(entry.data.validated.electronic_payment_type));
    }
  } else if (event === 'sql_preview') {
    console.log('  setClause:', JSON.stringify(entry.data?.setClause ?? []));
    console.log('  values:', JSON.stringify(entry.data?.values ?? []));
  } else if (event === 'final_verification') {
    console.log('  final.status:', entry.data?.status);
    console.log('  final.payment_method:', entry.data?.payment_method);
    console.log('  final.electronic_payment_type:', entry.data?.electronic_payment_type ?? null);
    console.log('  final.electronic_payment_notes:', entry.data?.electronic_payment_notes ?? null);
  } else {
    console.log('  data:', JSON.stringify(entry.data ?? null));
  }
}

async function main() {
  const term = process.argv[2];
  const limit = Math.max(1, Math.min(parseInt(process.argv[3] || '200', 10) || 200, 5000));

  if (!term) {
    console.log('Usage:\n  node scripts/print_order_update_logs.js <orderId|order_number> [limit]');
    process.exit(1);
  }

  let orderId = await resolveOrderId(term);
  if (!orderId) {
    console.log(`❌ Could not resolve order "${term}" to an orderId`);
    await poolEnd().catch(() => {});
    process.exit(1);
  }

  console.log(`🔎 Reading logs from: ${updatesLogPath}`);
  console.log(`🔎 Filtering for orderId=${orderId} (last ${limit} matching entries)`);

  const lines = readLinesReverse(updatesLogPath, 5000);
  const entries = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj && obj.orderId == orderId) {
        entries.push(obj);
      }
    } catch {
      // skip malformed lines
    }
  }

  // Keep only the last N entries chronologically (assuming file append is chronological)
  const toShow = entries.slice(Math.max(0, entries.length - limit));
  if (!toShow.length) {
    console.log('ℹ️ No audit log entries found for this order yet.');
  } else {
    toShow.forEach(prettyPrint);
    console.log(`\n✅ Shown ${toShow.length} entries for orderId=${orderId}`);
  }

  await poolEnd().catch(() => {});
}

main();
