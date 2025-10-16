const axios = require('axios');
const mysql = require('mysql2/promise');

async function testDeliveryRegistrationUserRole() {
  console.log('🔍 Testando el rol del usuario que hace la solicitud de entrega...');
  
  // Conectar a la base de datos
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    console.log('\n📋 Simulando flujo completo de login y registro de entrega...');
    
    // 1. Intentar login como admin
    console.log('\n1️⃣ Intentando login como admin...');
    try {
      const adminLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      
      const adminToken = adminLoginResponse.data.data?.token || adminLoginResponse.data.token;
      console.log('✅ Admin login exitoso');
      console.log('Usuario admin:', {
        id: adminLoginResponse.data.data?.user?.id || adminLoginResponse.data.user?.id,
        username: adminLoginResponse.data.data?.user?.username || adminLoginResponse.data.user?.username,
        role: adminLoginResponse.data.data?.user?.role || adminLoginResponse.data.user?.role
      });

      // Probar registro de entrega con admin
      console.log('\n🧪 Probando registro de entrega con admin...');
      const adminDeliveryResponse = await axios.put('http://localhost:3001/api/orders/537', {
        status: 'entregado_cliente',
        delivery_notes: '',
        amount_received: 159510.02
      }, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Admin puede registrar entrega:', adminDeliveryResponse.status);
      
    } catch (adminError) {
      console.log('❌ Admin no puede registrar entrega:', adminError.response?.status, adminError.response?.data?.message);
    }

    // 2. Intentar login como mensajero1 (asignado al pedido)
    console.log('\n2️⃣ Intentando login como mensajero1...');
    try {
      const messengerLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        username: 'mensajero1',
        password: 'mensajero123'
      });
      
      const messengerToken = messengerLoginResponse.data.data?.token || messengerLoginResponse.data.token;
      console.log('✅ Mensajero1 login exitoso');
      console.log('Usuario mensajero1:', {
        id: messengerLoginResponse.data.data?.user?.id || messengerLoginResponse.data.user?.id,
        username: messengerLoginResponse.data.data?.user?.username || messengerLoginResponse.data.user?.username,
        role: messengerLoginResponse.data.data?.user?.role || messengerLoginResponse.data.user?.role
      });

      // Probar registro de entrega con mensajero
      console.log('\n🧪 Probando registro de entrega con mensajero1...');
      const messengerDeliveryResponse = await axios.put('http://localhost:3001/api/orders/537', {
        status: 'entregado_cliente',
        delivery_notes: '',
        amount_received: 159510.02
      }, {
        headers: {
          'Authorization': `Bearer ${messengerToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Mensajero1 puede registrar entrega:', messengerDeliveryResponse.status);
      
    } catch (messengerError) {
      console.log('❌ Mensajero1 no puede registrar entrega:', messengerError.response?.status, messengerError.response?.data?.message);
    }

    // 3. Verificar qué usuario está en el localStorage del frontend (simulado)
    console.log('\n3️⃣ Verificando estructura de tokens y usuarios...');
    
    // Ver todos los usuarios disponibles
    const [users] = await connection.execute(`
      SELECT id, username, role, active, created_at 
      FROM users 
      WHERE active = 1
      ORDER BY role, username
    `);
    
    console.log('\n👥 Usuarios disponibles:');
    users.forEach(user => {
      console.log(`- ${user.username} (ID: ${user.id}, Role: ${user.role})`);
    });

    // 4. Verificar roles permitidos en el endpoint
    console.log('\n🔐 Roles permitidos para PUT /api/orders/:id según verifyRoles.allRoles:');
    console.log('- admin');
    console.log('- facturador');  
    console.log('- cartera');
    console.log('- logistica');
    console.log('- mensajero');
    
  } catch (error) {
    console.error('❌ Error en el test:', error.message);
  } finally {
    await connection.end();
  }
}

testDeliveryRegistrationUserRole().catch(console.error);
