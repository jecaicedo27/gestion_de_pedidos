/**
 * Aceptar recepción de efectivo para un pedido entregado y generar recibo HTML.
 * Uso:
 *   node accept_cash_for_order.js <orderId>
 * Ejemplo:
 *   node accept_cash_for_order.js 1237
 */
const fs = require('fs');
const path = require('path');

async function login() {
  const res = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('Login response not JSON:', text);
    throw new Error('Login failed (non-JSON response)');
  }
  if (!res.ok || !data?.success) {
    console.error('Login failed:', res.status, data);
    throw new Error('Login failed');
  }
  return data.data.token;
}

async function acceptCash(orderId, token) {
  const url = `http://localhost:3001/api/messenger/orders/${orderId}/accept-cash`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  const body = await res.text();
  console.log(`[ACCEPT] Order ${orderId} -> ${res.status} ${res.statusText}`);
  console.log(body);
  return { status: res.status, body };
}

async function downloadReceipt(orderId, token) {
  const url = `http://localhost:3001/api/messenger/orders/${orderId}/cash-receipt`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const html = await res.text();
  console.log(`[RECEIPT] Order ${orderId} -> ${res.status} ${res.statusText}`);

  // Guardar HTML en carpeta recibos/
  const outDir = path.join(process.cwd(), 'recibos');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `recibo_${orderId}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`Recibo guardado en: ${outPath}`);
  return outPath;
}

(async function main() {
  try {
    const orderId = process.argv[2] || '';
    if (!orderId) {
      console.error('Uso: node accept_cash_for_order.js <orderId>');
      process.exit(1);
    }

    const token = await login();
    await acceptCash(orderId, token);
    await downloadReceipt(orderId, token);

    console.log('✔ Proceso de aceptación de efectivo completado.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
