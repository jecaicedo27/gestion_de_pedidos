/**
 * Simple test to verify POST /api/messenger/orders/:id/accept-cash
 * Logs HTTP status and response body for each tested order ID.
 */
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
  const res = await fetch(`http://localhost:3001/api/messenger/orders/${orderId}/accept-cash`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  const body = await res.text();
  console.log(`Order ${orderId} -> ${res.status} ${res.statusText}`);
  console.log(body);
  console.log('----');
}

(async function main() {
  try {
    const token = await login();
    const ids = [997, 998];
    for (const id of ids) {
      await acceptCash(id, token);
    }
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
})();
