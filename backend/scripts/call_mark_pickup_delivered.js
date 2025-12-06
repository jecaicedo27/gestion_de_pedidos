/**
 * Invoke logisticsController.markPickupDelivered for a given orderId.
 * Usage: node backend/scripts/call_mark_pickup_delivered.js 1639
 */
const ctrl = require('../controllers/logisticsController');

async function main() {
  const orderId = Number(process.argv[2]);
  if (!orderId) {
    console.error('Usage: node backend/scripts/call_mark_pickup_delivered.js <orderId>');
    process.exit(1);
  }

  // Minimal req/res mocks
  const req = {
    body: {
      orderId,
      delivery_notes: 'Test entrega en bodega (crédito / sin cobro)'
    }
  };

  const res = {
    _status: 200,
    status(code) {
      this._status = code;
      return this;
    },
    json(payload) {
      console.log('STATUS:', this._status || 200);
      console.log('RESPONSE:', JSON.stringify(payload, null, 2));
    }
  };

  try {
    await ctrl.markPickupDelivered(req, res);
  } catch (e) {
    console.error('Error invoking controller:', e && (e.sqlMessage || e.message) || e);
    process.exit(1);
  }
}

main();
