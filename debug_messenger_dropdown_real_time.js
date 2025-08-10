const axios = require('axios');

async function debugMessengerDropdown() {
  try {
    console.log('🔍 DEBUG EN TIEMPO REAL: Dropdown de mensajeros vacío\n');

    // 1. Verificar endpoint directo sin caché
    console.log('1️⃣ Probando endpoint /api/users?role=mensajero&active=true');
    try {
      const response = await axios.get('http://localhost:3001/api/users?role=mensajero&active=true', {
        headers: {
          'Cache-Control': 'no-cache',
          'Authorization': 'Bearer fake-token-for-test'
        }
      });
      
      console.log('📊 Respuesta del servidor:');
      console.log('- Status:', response.status);
      console.log('- Headers:', response.headers);
      console.log('- Data:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Error del servidor:', error.response?.status, error.response?.data);
    }

    console.log('\n');

    // 2. Verificar directamente en la base de datos
    console.log('2️⃣ Verificando mensajeros directamente en la base de datos');
    const mysql = require('mysql2/promise');
    require('dotenv').config({ path: 'backend/.env' });

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    });

    const [messengers] = await connection.execute(
      'SELECT id, name, last_name, username, email, role, active FROM users WHERE role = ? AND active = ?',
      ['mensajero', 1]
    );

    console.log(`👥 Mensajeros en base de datos: ${messengers.length}`);
    messengers.forEach(m => {
      console.log(`   - ID: ${m.id}, Nombre: ${m.name} ${m.last_name || ''}, Username: ${m.username}, Activo: ${m.active}`);
    });

    await connection.end();

    console.log('\n');

    // 3. Verificar el controlador de usuarios
    console.log('3️⃣ Verificando implementación del controlador...');
    console.log('El endpoint debería usar backend/controllers/userController.js');
    console.log('Y la ruta debería estar en backend/routes/users.js');

    console.log('\n');

    // 4. Instrucciones para el frontend
    console.log('4️⃣ PASOS PARA DEBUGGEAR EN EL FRONTEND:');
    console.log('1. Abre las DevTools del navegador (F12)');
    console.log('2. Ve a la pestaña Network');
    console.log('3. Intenta abrir el dropdown de mensajeros');
    console.log('4. Busca la llamada a /api/users?role=mensajero&active=true');
    console.log('5. Verifica qué respuesta está recibiendo');
    console.log('6. También verifica la consola por errores de JavaScript');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugMessengerDropdown().catch(console.error);
