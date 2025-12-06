/**
 * Llamar a messengerController.completeDelivery desde CLI.
 * Uso:
 *   node backend/scripts/call_messenger_complete_delivery.js <orderId> [messengerId=16] [payloadJson]
 * Ejemplos:
 *   node backend/scripts/call_messenger_complete_delivery.js 1678
 *   node backend/scripts/call_messenger_complete_delivery.js 1678 16 '{"amountReceived":0,"deliveryFeeCollected":0}'
 */
const messengerController = require('../controllers/messengerController');
const { poolEnd } = require('../config/database');

function parseJson(arg) {
  if (!arg) return {};
  try {
    return JSON.parse(arg);
  } catch (e) {
    console.warn('⚠️ No se pudo parsear payload JSON. Usando objeto vacío. Error:', e.message);
    return {};
  }
}

function mockRes() {
  return {
    _status: 200,
    status(c) {
      this._status = c;
      return this;
    },
    json(payload) {
      console.log('STATUS:', this._status || 200);
      try {
        console.log('RESPONSE:', JSON.stringify(payload, null, 2));
      } catch {
        console.log('RESPONSE:', payload);
      }
    },
    send(payload) {
      console.log('STATUS:', this._status || 200);
      console.log('SEND:', payload);
    },
    setHeader() {}
  };
}

async function main() {
  const orderId = Number(process.argv[2]);
  const messengerId = Number(process.argv[3] || 16);
  const payload = parseJson(process.argv[4]);

  if (!orderId) {
    console.error('Uso: node backend/scripts/call_messenger_complete_delivery.js <orderId> [messengerId] [payloadJson]');
    process.exit(1);
  }

  // Defaults seguros para "sin cobro" si no se pasa payload
  const body = {
    amountReceived: 0,
    deliveryFeeCollected: 0,
    ...payload
  };

  const req = {
    params: { orderId },
    user: { id: messengerId, role: 'mensajero' },
    body
  };

  const res = mockRes();

  try {
    console.log('▶️  Invocando completeDelivery con:', { orderId, messengerId, body });
    await messengerController.completeDelivery(req, res);
  } catch (err) {
    const msg = (err && (err.sqlMessage || err.message)) || String(err);
    console.error('❌ Error en completeDelivery:', msg);
  } finally {
    try {
      await poolEnd();
      console.log('✅ Pool de conexiones MySQL cerrado correctamente');
    } catch (_) {}
  }
}

main();
