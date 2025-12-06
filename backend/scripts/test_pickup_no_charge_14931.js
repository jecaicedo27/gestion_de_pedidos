/**
 * Test: Move order 1649 (FV-2-14931) to Recoge en Bodega sin cobro,
 * process to 'en_empaque', generate guide (SIN COBRO, total 0), and preview grouping.
 * Usage: node backend/scripts/test_pickup_no_charge_14931.js
 */
const { query } = require('../config/database');
const ctrl = require('../controllers/logisticsController');

function mockRes(label = 'RES') {
  return {
    _status: 200,
    status(code) { this._status = code; return this; },
    setHeader() {},
    end(buf) {
      console.log(`[${label}] PDF buffer length:`, buf?.length || 0);
    },
    json(payload) {
      const data = payload && payload.data ? payload.data : payload;
      console.log(`[${label}] STATUS:`, this._status || 200);
      console.log(`[${label}] PAYLOAD:`, JSON.stringify(data, null, 2));
    },
    send(buf) {
      console.log(`[${label}] send length:`, buf?.length || 0);
    }
  };
}

async function main() {
  const orderId = 1649;
  let safety = { id: null, order_number: null };

  try {
    console.log('Step 1) Snapshot initial order...');
    const rows = await query(`SELECT id, order_number, status, delivery_method, requires_payment, payment_method, carrier_id 
                              FROM orders WHERE id = ?`, [orderId]);
    if (!rows.length) {
      console.log('Order not found:', orderId);
      process.exit(1);
    }
    safety = rows[0];
    console.log('Initial:', safety);

    console.log('Step 2) Force to en_logistica + recoge_bodega + no charge...');
    await query(
      `UPDATE orders 
       SET status = 'en_logistica',
           delivery_method = 'recoge_bodega',
           requires_payment = 0,
           payment_method = COALESCE(NULLIF(payment_method, ''), 'cliente_credito'),
           updated_at = NOW()
       WHERE id = ?`,
      [orderId]
    );

    const afterPrep = await query(`SELECT id, order_number, status, delivery_method, requires_payment, payment_method 
                                   FROM orders WHERE id = ?`, [orderId]);
    console.log('After Prep:', afterPrep[0]);

    console.log('Step 3) Call processOrder -> move to en_empaque (recoge_bodega sin cobro)...');
    await ctrl.processOrder(
      {
        body: {
          orderId,
          shippingMethod: 'recoge_bodega',
          transportCompany: null,
          trackingNumber: null,
          shippingPaymentMethod: null,
          notes: 'Test Recoge en Bodega SIN COBRO - automated'
        }
      },
      mockRes('processOrder')
    );

    const afterProcess = await query(`SELECT id, order_number, status, delivery_method, requires_payment, payment_method 
                                      FROM orders WHERE id = ?`, [orderId]);
    console.log('After processOrder:', afterProcess[0]);

    console.log('Step 4) Call generateGuide -> should produce SIN COBRO and total 0...');
    await ctrl.generateGuide(
      {
        body: {
          orderId,
          shippingMethod: 'recoge_bodega',
          transportCompany: null,
          customerName: 'Cliente Recoge',
          customerPhone: '3000000000',
          customerAddress: 'Bodega Principal',
          customerCity: 'Bogotá',
          customerDepartment: 'Cundinamarca',
          notes: 'Guía de prueba SIN COBRO'
        }
      },
      mockRes('generateGuide')
    );

    console.log('Step 4.5) Move to listo to appear in ready buckets...');
    await query(
      "UPDATE orders SET status = 'listo', updated_at = NOW() WHERE id = ?",
      [orderId]
    );

    console.log('Step 5) Preview grouping with monitor...');
    const res = mockRes('preview');
    await ctrl.getReadyForDeliveryOrders(
      { query: { monitorId: orderId } },
      res
    );

  } catch (err) {
    console.error('Test failed:', err?.sqlMessage || err?.message || err);
    process.exit(1);
  } finally {
    // Ensure exit
    setTimeout(() => process.exit(0), 100);
  }
}

main();
