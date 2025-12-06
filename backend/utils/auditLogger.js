const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
const updatesLogPath = path.join(logsDir, 'order_updates.log');

function ensureDirExists(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Silent fail; logging to console as fallback
    console.error('auditLogger.ensureDirExists error:', e.message);
  }
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    // Handle circular or non-serializable
    return JSON.stringify({ __non_serializable__: true, message: e.message });
  }
}

/**
 * Append a JSONL log entry to backend/logs/order_updates.log
 * entry shape:
 * {
 *   ts: ISOString,
 *   orderId,
 *   event,                // e.g., incoming, validation, sql_preview, final_verification
 *   userId, userRole,
 *   data: { ... }         // free-form payload, safe-stringified
 * }
 */
function logOrderUpdateEvent({ orderId, event, data = {}, userId = null, userRole = null }) {
  try {
    ensureDirExists(logsDir);
    const entry = {
      ts: new Date().toISOString(),
      orderId: Number.isFinite(orderId) ? orderId : orderId || null,
      event,
      userId,
      userRole,
      data
    };
    fs.appendFileSync(updatesLogPath, safeStringify(entry) + '\n', { encoding: 'utf8' });
  } catch (e) {
    // If file logging fails, fall back to console so at least we see it
    console.error('auditLogger.logOrderUpdateEvent error:', e.message, { orderId, event });
  }
}

module.exports = {
  logOrderUpdateEvent,
  updatesLogPath
};
