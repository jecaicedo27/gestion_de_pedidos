/**
 * Monitor en vivo de wallet_validations y órdenes para validar pagos mixtos
 * - Imprime nueva wallet_validation detectada
 * - Imprime órdenes actualizadas en los últimos 2 minutos
 * - Si la validación es mixta con transferencia, verifica consistencia:
 *   requires_payment=1, payment_amount=efectivo, paid_amount=transferido
 */
const { query, poolEnd } = require("../config/database");

function pad(n) {
  return String(n).padStart(2, "0");
}
function ts() {
  const d = new Date();
  return `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`;
}

async function checkConsistency(orderId, transferredNum, cashNum) {
  const rows = await query(
    "SELECT id, order_number, requires_payment, payment_amount, paid_amount, payment_method, status FROM orders WHERE id = ?",
    [orderId]
  );
  if (!rows[0]) return;
  const o = rows[0];
  const ok =
    Number(o.requires_payment) === 1 &&
    Number(o.payment_amount) === Number(cashNum) &&
    Number(o.paid_amount) === Number(transferredNum);

  console.log(ts(), "Consistencia mixto", ok ? "OK" : "FAIL", {
    orderId,
    order_number: o.order_number,
    requires_payment: o.requires_payment,
    payment_amount: o.payment_amount,
    paid_amount: o.paid_amount,
    expected_cash: cashNum,
    expected_transferred: transferredNum,
    status: o.status,
  });
}

async function main() {
  let lastWv = 0;
  const seen = new Set();
  const start = Date.now();

  async function tick() {
    try {
      // Última validación
      const wv = await query(
        `SELECT 
           wv.id, wv.order_id, o.order_number, 
           wv.payment_method, wv.payment_type, 
           wv.transferred_amount, wv.cash_amount, 
           wv.validation_status, wv.validated_at,
           o.requires_payment, o.payment_amount, o.paid_amount, 
           o.payment_method as order_payment_method, o.status
         FROM wallet_validations wv 
         JOIN orders o ON o.id = wv.order_id 
         ORDER BY wv.id DESC 
         LIMIT 1`
      );

      if (wv[0] && wv[0].id > lastWv) {
        lastWv = wv[0].id;
        console.log(ts(), "Nueva wallet_validation:", wv[0]);

        // Verificar consistencia si es mixto transferencia + efectivo
        if (wv[0].payment_type === "mixed" && wv[0].payment_method === "transferencia") {
          const transferredNum = Number(wv[0].transferred_amount);
          const cashNum = Number(wv[0].cash_amount);
          await checkConsistency(wv[0].order_id, transferredNum, cashNum);
        }
      }

      // Órdenes actualizadas en los últimos 2 minutos
      const upd = await query(
        `SELECT id, order_number, requires_payment, payment_amount, paid_amount, payment_method, status, updated_at
         FROM orders 
         WHERE updated_at > NOW() - INTERVAL 2 MINUTE
         ORDER BY updated_at DESC
         LIMIT 20`
      );
      for (const r of upd) {
        const key = r.id + "-" + r.updated_at.getTime();
        if (!seen.has(key)) {
          seen.add(key);
          console.log(ts(), "Orden actualizada:", r);
        }
      }
    } catch (e) {
      console.error("tick error", (e && (e.sqlMessage || e.message)) || e);
    }
  }

  // Primera ejecución inmediata
  await tick();

  // Intervalo de 2s
  const h = setInterval(tick, 2000);

  // Parar en 15 minutos
  setTimeout(async () => {
    clearInterval(h);
    await poolEnd().catch(() => {});
    console.log("Monitoreo finalizado.");
  }, 15 * 60 * 1000);
}

main().catch(async (e) => {
  console.error("fatal", (e && (e.sqlMessage || e.message)) || e);
  await poolEnd().catch(() => {});
});
