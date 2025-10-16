const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

(async function run() {
  try {
    console.log('🧪 Probando lista de pedidos para el mensajero "julian"...');

    // 1) Login
    console.log('🔑 Iniciando sesión...');
    const login = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'julian',
      password: 'mensajero123'
    });

    if (!login.data?.success) {
      console.log('❌ Login falló:', login.data);
      process.exit(1);
    }

    const token = login.data.data.token;
    const user = login.data.data.user;
    console.log(`✅ Login OK - userId=${user?.id} username=${user?.username} role=${user?.role}`);

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2) Obtener pedidos del mensajero
    console.log('\n📦 Consultando /api/messenger/orders ...');
    const resp = await axios.get(`${BASE_URL}/messenger/orders`, { headers });

    console.log('✅ Status:', resp.status);
    console.log('📋 success:', resp.data?.success);

    const orders = resp.data?.data || [];
    console.log(`📊 Pedidos encontrados: ${orders.length}`);

    if (orders.length) {
      const summary = orders.map(o => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        messenger_status: o.messenger_status,
        delivery_method: o.delivery_method,
        assigned_messenger_id: o.assigned_messenger_id
      }));
      console.log('\n📝 Resumen de pedidos:', JSON.stringify(summary, null, 2));
    }

    // 3) Verificar presencia del pedido esperado
    const found = (orders || []).find(o => o.order_number === 'FV-2-13270');
    if (found) {
      console.log('\n🎯 Pedido FV-2-13270 visible para el mensajero.');
      console.log(`   - status=${found.status}`);
      console.log(`   - messenger_status=${found.messenger_status}`);
      console.log(`   - assigned_messenger_id=${found.assigned_messenger_id}`);
    } else {
      console.log('\n⚠️ Pedido FV-2-13270 NO aparece en la lista del mensajero.');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('📋 Status:', err.response.status);
      console.error('📋 Data:', err.response.data);
    }
    process.exit(1);
  }
})();
