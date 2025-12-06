/**
 * Encuentra pedido por número (texto o fragmento) o por id numérico
 * y muestra carrier_id y el nombre de la transportadora.
 *
 * Uso:
 *   node backend/scripts/find_order_carrier.js 15062
 *   node backend/scripts/find_order_carrier.js FV-2-15062
 */
const { query, poolEnd } = require('../config/database');

async function run() {
  const key = process.argv[2];
  if (!key) {
    console.error('Uso: node backend/scripts/find_order_carrier.js <order_number o fragmento o id>');
    process.exitCode = 1;
    return;
  }

  try {
    let sql, params;
    if (/^\d+$/.test(key)) {
      // Numérico: probar por id, order_number exacto como string y LIKE
      sql = `
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.delivery_method,
          o.carrier_id,
          c.name AS carrier_name
        FROM orders o
        LEFT JOIN carriers c ON o.carrier_id = c.id
        WHERE o.id = ? OR o.order_number = ? OR o.order_number LIKE ?
        ORDER BY o.id DESC
        LIMIT 10
      `;
      params = [Number(key), String(key), '%' + key + '%'];
    } else {
      // Texto: order_number exacto o LIKE
      sql = `
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.delivery_method,
          o.carrier_id,
          c.name AS carrier_name
        FROM orders o
        LEFT JOIN carriers c ON o.carrier_id = c.id
        WHERE o.order_number = ? OR o.order_number LIKE ?
        ORDER BY o.id DESC
        LIMIT 10
      `;
      params = [key, '%' + key + '%'];
    }

    const rows = await query(sql, params);

    if (!rows.length) {
      console.log('No orders matched:', key);
      return;
    }

    console.log('Matches:', rows.length);
    rows.forEach(r => {
      console.log({
        id: r.id,
        order_number: r.order_number,
        status: r.status,
        delivery_method: r.delivery_method,
        carrier_id: r.carrier_id,
        carrier_name: r.carrier_name
      });
    });

    if (rows.length === 1) {
      const r = rows[0];
      console.log(`\nResumen -> Pedido ${r.order_number} (ID ${r.id}): carrier_id=${r.carrier_id ?? 'NULL'} | carrier_name=${r.carrier_name ?? 'NULL'}`);
    }
  } catch (e) {
    console.error('Error:', (e && (e.sqlMessage || e.message)) || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
