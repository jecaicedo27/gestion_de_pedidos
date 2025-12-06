/**
 * Preview the grouping returned by logisticsController.getReadyForDeliveryOrders
 * Usage: node backend/scripts/preview_ready_for_delivery.js
 */
const ctrl = require('../controllers/logisticsController');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--id' || a === '-i') {
      const v = args[i + 1]; i++;
      if (v) out.id = Number(v);
    } else if (a === '--number' || a === '--num' || a === '-n') {
      const v = args[i + 1]; i++;
      if (v) out.number = String(v);
    }
  }
  return out;
}

async function main() {
  const { id, number } = parseArgs();

  const req = { query: {} };
  if (id) req.query.monitorId = id;
  if (number) req.query.monitorNumber = number;

  const res = {
    _status: 200,
    status(code) { this._status = code; return this; },
    json(payload) {
      console.log('STATUS:', this._status || 200);
      const data = payload && payload.data ? payload.data : payload;
      if (!data) { console.log(payload); return; }

      const { stats, groupedOrders, monitor } = data;
      console.log('STATS:', stats);
      if (monitor) console.log('MONITOR:', monitor);

      const pick = (arr) => (Array.isArray(arr) ? arr.map(o => ({ id: o.id, order_number: o.order_number })) : []);
      if (groupedOrders) {
        console.log('recoge_bodega_credito:', pick(groupedOrders.recoge_bodega_credito));
        console.log('recoge_bodega:', pick(groupedOrders.recoge_bodega));
      }
    }
  };

  try {
    await ctrl.getReadyForDeliveryOrders(req, res);
  } catch (e) {
    console.error('Error invoking controller:', (e && (e.sqlMessage || e.message)) || e);
    process.exit(1);
  } finally {
    // Force exit to avoid open handles keeping process alive
    setTimeout(() => process.exit(0), 50);
  }
}

main();
