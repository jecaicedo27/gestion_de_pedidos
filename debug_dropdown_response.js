const axios = require('axios');

async function debugDropdownResponse() {
  try {
    console.log('🔍 DEBUGGING: Respuesta exacta del endpoint de mensajeros\n');

    // Simular una llamada como la haría el frontend
    console.log('1️⃣ Llamada al endpoint con token simulado...');
    
    const response = await axios.get('http://localhost:3001/api/users?role=mensajero&active=true', {
      headers: {
        'Authorization': 'Bearer test-token',
        'Cache-Control': 'no-cache'
      },
      timeout: 10000
    }).catch(error => {
      if (error.response) {
        console.log('❌ Error de respuesta:', error.response.status, error.response.statusText);
        console.log('❌ Data:', JSON.stringify(error.response.data, null, 2));
        return null;
      } else {
        console.log('❌ Error de conexión:', error.message);
        return null;
      }
    });

    if (!response) {
      console.log('⚠️  No se pudo obtener respuesta del servidor\n');
    } else {
      console.log('✅ Respuesta obtenida:');
      console.log('- Status:', response.status);
      console.log('- Content-Type:', response.headers['content-type']);
      console.log('- Data length:', JSON.stringify(response.data).length, 'bytes');
      console.log('- Raw data:', JSON.stringify(response.data, null, 2));
    }

    // Verificar directamente en la base de datos
    console.log('\n2️⃣ Verificando datos en base de datos...');
    const mysql = require('mysql2/promise');
    require('dotenv').config({ path: 'backend/.env' });

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    });

    const [messengers] = await connection.execute(
      'SELECT id, username, full_name, email, role, active FROM users WHERE role = ? AND active = ? ORDER BY full_name',
      ['mensajero', 1]
    );

    console.log(`👥 Mensajeros en BD: ${messengers.length}`);
    messengers.forEach(m => {
      console.log(`   - ID: ${m.id}`);
      console.log(`     Nombre: ${m.full_name || 'NULL'}`);
      console.log(`     Username: ${m.username}`);
      console.log(`     Email: ${m.email}`);
      console.log(`     Activo: ${m.active}`);
      console.log('');
    });

    await connection.end();

    // Simular el procesamiento del frontend
    console.log('3️⃣ Simulando procesamiento del frontend...');
    
    if (response && response.data) {
      let messagersData = [];
      
      // Lógica exacta del LogisticsModal.js
      if (Array.isArray(response.data)) {
        messagersData = response.data;
        console.log('✅ Data es array directo');
      } else if (response.data.success && response.data.data) {
        messagersData = response.data.data;
        console.log('✅ Data está en .data.data');
      } else if (response.data.users) {
        messagersData = response.data.users;
        console.log('✅ Data está en .users');
      } else {
        console.log('❌ Estructura de datos no reconocida');
        console.log('Keys disponibles:', Object.keys(response.data));
      }

      console.log(`📊 Mensajeros procesados: ${messagersData.length}`);
      
      // Simular la creación del dropdown
      const dropdownOptions = messagersData.length > 0 
        ? messagersData.map(messenger => ({
            value: messenger.id.toString(),
            label: messenger.full_name || messenger.username || 'Mensajero sin nombre'
          }))
        : [{ value: '', label: 'No hay mensajeros disponibles' }];

      console.log('\n🎯 Opciones que debería mostrar el dropdown:');
      dropdownOptions.forEach(option => {
        console.log(`   - Value: "${option.value}", Label: "${option.label}"`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugDropdownResponse().catch(console.error);
