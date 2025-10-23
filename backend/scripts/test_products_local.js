const axios = require('axios');

async function getToken(baseURL) {
  const candidates = [
    { username: 'admin', password: 'admin123' },
    { username: 'admin', password: 'admin' },
    { email: 'admin@admin.com', password: 'admin123' },
    { email: 'admin@test.com', password: 'admin123' }
  ];
  for (const body of candidates) {
    try {
      const { data } = await axios.post(`${baseURL}/api/auth/login`, body, { timeout: 10000 });
      if (data && (data.token || data.data?.token)) {
        const token = data.token || data.data?.token;
        console.log(`✅ Login OK con ${body.username || body.email}`);
        return token;
      }
      console.log('⚠️ Login sin token, respuesta:', data);
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error || e.message;
      console.log(`❌ Falló login con ${body.username || body.email}: ${msg}`);
    }
  }
  return null;
}

async function main() {
  const baseURL = 'http://localhost:3002';
  console.log('🧪 Probando /api/products en', baseURL);

  const token = await getToken(baseURL);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const stats = await axios.get(`${baseURL}/api/products/stats`, { headers, timeout: 15000 });
    console.log('📊 /api/products/stats ->', stats.status, stats.data?.success, stats.data?.data);
  } catch (e) {
    console.log('⚠️ Error en /api/products/stats:', e.response?.status, e.response?.data || e.message);
  }

  try {
    const params = { page: 1, pageSize: 20, search: '' };
    const resp = await axios.get(`${baseURL}/api/products`, { headers, params, timeout: 20000 });
    console.log('✅ /api/products OK. items:', Array.isArray(resp.data?.data) ? resp.data.data.length : 'N/A');
    if (Array.isArray(resp.data?.data) && resp.data.data.length > 0) {
      console.log('🔍 Primer item:', resp.data.data[0]);
    }
  } catch (e) {
    const status = e.response?.status;
    const payload = e.response?.data || e.message;
    console.log('❌ Error en /api/products:', status, payload);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
