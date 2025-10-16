const mysql = require('mysql2/promise');
const axios = require('axios');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function testCompleteUserUpdateFlow() {
  console.log('🔄 PROBANDO FLUJO COMPLETO DE ACTUALIZACIÓN DE USUARIO FRONTEND\n');

  try {
    // 1. Login como admin
    console.log('🔐 PASO 1: Login como admin');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login falló');
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido');

    // 2. Obtener lista inicial de usuarios (simula cargar la página)
    console.log('\n📋 PASO 2: Obtener lista inicial de usuarios');
    const initialUsersResponse = await axios.get('http://localhost:3001/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const initialUsers = initialUsersResponse.data.data.users;
    const mensajero1Initial = initialUsers.find(u => u.username === 'mensajero1');
    
    console.log('📊 Estado inicial de mensajero1:');
    console.log(`   - ID: ${mensajero1Initial.id}`);
    console.log(`   - Username: ${mensajero1Initial.username}`);
    console.log(`   - Nombre: ${mensajero1Initial.full_name}`);
    console.log(`   - Email: ${mensajero1Initial.email}`);

    // 3. Actualizar usuario mensajero1 (simula editar usuario)
    const newName = `ACTUALIZADO FRONTEND - ${new Date().toISOString()}`;
    console.log(`\n✏️ PASO 3: Actualizando mensajero1 con nuevo nombre: "${newName}"`);
    
    const updateResponse = await axios.put(`http://localhost:3001/api/users/${mensajero1Initial.id}`, {
      username: mensajero1Initial.username,
      email: mensajero1Initial.email,
      full_name: newName,
      role: mensajero1Initial.role
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!updateResponse.data.success) {
      throw new Error('Actualización falló');
    }
    console.log('✅ Actualización exitosa (backend respuesta)');

    // 4. Verificar en base de datos directamente
    console.log('\n💾 PASO 4: Verificando en base de datos directamente');
    const connection = await mysql.createConnection(config);
    const [dbRows] = await connection.execute('SELECT * FROM users WHERE id = ?', [mensajero1Initial.id]);
    await connection.end();
    
    if (dbRows.length === 0) {
      throw new Error('Usuario no encontrado en base de datos');
    }
    
    console.log('📊 Estado en base de datos después de actualización:');
    console.log(`   - ID: ${dbRows[0].id}`);
    console.log(`   - Username: ${dbRows[0].username}`);
    console.log(`   - Nombre: ${dbRows[0].full_name}`);
    console.log(`   - Email: ${dbRows[0].email}`);

    // 5. Obtener lista actualizada de usuarios (simula fetchUsers después de actualización)
    console.log('\n🔄 PASO 5: Obtener lista actualizada de usuarios (como haría React)');
    const updatedUsersResponse = await axios.get('http://localhost:3001/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const updatedUsers = updatedUsersResponse.data.data.users;
    const mensajero1Updated = updatedUsers.find(u => u.username === 'mensajero1');
    
    console.log('📊 Estado de mensajero1 en API actualizada:');
    console.log(`   - ID: ${mensajero1Updated.id}`);
    console.log(`   - Username: ${mensajero1Updated.username}`);
    console.log(`   - Nombre: ${mensajero1Updated.full_name}`);
    console.log(`   - Email: ${mensajero1Updated.email}`);

    // 6. Comparar y mostrar resultados
    console.log('\n🔍 ANÁLISIS DE RESULTADOS:');
    
    const dbNameMatches = dbRows[0].full_name === newName;
    const apiNameMatches = mensajero1Updated.full_name === newName;
    const dbApiMatch = dbRows[0].full_name === mensajero1Updated.full_name;
    
    console.log(`   ✅ Nombre actualizado en BD: ${dbNameMatches ? 'SÍ' : 'NO'}`);
    console.log(`   ✅ Nombre actualizado en API: ${apiNameMatches ? 'SÍ' : 'NO'}`);
    console.log(`   ✅ BD y API coinciden: ${dbApiMatch ? 'SÍ' : 'NO'}`);
    
    if (dbNameMatches && apiNameMatches && dbApiMatch) {
      console.log('\n🎉 RESULTADO: El sistema backend está funcionando PERFECTAMENTE');
      console.log('   El problema está en el frontend (caché del navegador o estado de React)');
      console.log('\n💡 RECOMENDACIONES PARA EL USUARIO:');
      console.log('   1. Hacer F5 (refresh completo) en el navegador');
      console.log('   2. Abrir las herramientas de desarrollador (F12)');
      console.log('   3. Ir a la pestaña Network y verificar las llamadas a /api/users');
      console.log('   4. Probar en una pestaña incógnito del navegador');
      console.log('   5. Limpiar caché del navegador');
    } else {
      console.log('\n❌ RESULTADO: Hay un problema en el sistema');
      if (!dbNameMatches) console.log('   - La base de datos no se está actualizando correctamente');
      if (!apiNameMatches) console.log('   - La API no está devolviendo datos actualizados');
      if (!dbApiMatch) console.log('   - Hay desincronización entre BD y API');
    }

    // 7. Información adicional para debug
    console.log('\n📋 INFORMACIÓN ADICIONAL PARA DEBUG:');
    console.log('   API Endpoint utilizado:', 'GET http://localhost:3001/api/users');
    console.log('   Estructura de respuesta correcta:', JSON.stringify({
      success: true,
      data: {
        users: [{ id: "...", username: "...", full_name: "...", "...": "..." }],
        pagination: { page: 1, limit: 10, total: "...", pages: 1 }
      }
    }, null, 2));

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCompleteUserUpdateFlow();
