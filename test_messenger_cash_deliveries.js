const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function main() {
  console.log('\n🧪 Prueba de cash-deliveries (mensajero)');

  try {
    // 1) Login como mensajero
    console.log('🔑 Iniciando sesión como mensajero...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'mensajero1',
      password: 'mensajero123',
    });
    if (!loginRes.data?.success) {
      console.error('❌ Login fallido:', loginRes.data);
      process.exit(1);
    }
    const token = loginRes.data.data.token;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    console.log('✅ Login exitoso');

    // 2) Obtener posibles receptores (admin/logistica/cartera)
    console.log('👥 Consultando usuarios para encontrar receptor válido (admin/logistica/cartera)...');
    const usersRes = await axios.get(`${BASE_URL}/users`, { headers });
    const payload = usersRes.data?.data || usersRes.data || {};
    const users = Array.isArray(payload.users)
      ? payload.users
      : (Array.isArray(usersRes.data?.users)
          ? usersRes.data.users
          : (Array.isArray(payload)
              ? payload
              : []));
    console.log('👥 Usuarios recibidos (conteo):', Array.isArray(users) ? users.length : 'no-array');
    const validRoles = new Set(['admin', 'logistica', 'cartera']);
    const receiver = users.find(u => validRoles.has((u.role || '').toLowerCase()));
    if (!receiver) {
      console.error('⚠️ No se encontró usuario receptor con rol admin/logistica/cartera en /api/users');
      console.error('📋 Muestra de respuesta:', JSON.stringify(usersRes.data, null, 2));
      process.exit(1);
    }
    console.log(`✅ Receptor encontrado: ID=${receiver.id}, role=${receiver.role}, name=${receiver.full_name || receiver.fullName || receiver.username}`);

    // 3) POST /api/messenger/cash-deliveries
    const amount = 12345;
    const body = {
      amount,
      deliveredTo: receiver.id,
      referenceNumber: `TEST-${Date.now()}`,
      notes: 'Prueba automatizada de entrega agregada diaria'
    };
    console.log('📮 Registrando entrega agregada de efectivo...', body);
    const postRes = await axios.post(`${BASE_URL}/messenger/cash-deliveries`, body, { headers });
    console.log('✅ POST /cash-deliveries OK:', JSON.stringify(postRes.data, null, 2));

    // 4) GET /api/messenger/cash-deliveries
    console.log('📥 Consultando historial de entregas agregadas...');
    const getRes = await axios.get(`${BASE_URL}/messenger/cash-deliveries`, { headers });
    console.log('✅ GET /cash-deliveries OK:', JSON.stringify({
      totals: getRes.data?.data?.totals,
      last3: (getRes.data?.data?.deliveries || []).slice(0, 3)
    }, null, 2));

    console.log('\n🎉 Prueba de cash-deliveries completada');
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('❌ Error en la prueba:', error.message, status ? `(HTTP ${status})` : '');
    if (data) {
      console.error('📋 Respuesta del servidor:', JSON.stringify(data, null, 2));
    } else {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
