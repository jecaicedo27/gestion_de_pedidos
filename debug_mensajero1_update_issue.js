const axios = require('axios');
const mysql = require('mysql2');

// Configuración de base de datos
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
});

async function debugMensajero1UpdateIssue() {
  try {
    console.log('🔍 INVESTIGACIÓN ESPECÍFICA: PROBLEMA ACTUALIZACIÓN MENSAJERO1\n');

    connection.connect();

    // PASO 1: Buscar el usuario mensajero1 en la base de datos
    console.log('👤 PASO 1: Verificando usuario mensajero1 en base de datos');
    const mensajero1Users = await new Promise((resolve, reject) => {
      connection.execute(
        'SELECT id, username, full_name, email, role, active, created_at, updated_at FROM users WHERE username = "mensajero1"', 
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (mensajero1Users.length === 0) {
      console.log('❌ No se encontró el usuario mensajero1');
      return;
    }

    const mensajero1 = mensajero1Users[0];
    console.log('📊 Usuario mensajero1 encontrado:');
    console.log(JSON.stringify(mensajero1, null, 2));

    // PASO 2: Hacer login como admin para obtener token
    console.log('\n🔐 PASO 2: Obteniendo token de admin para pruebas');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }).catch(err => {
      if (err.response) {
        console.log('❌ Error de login:', err.response.data);
        return null;
      }
      throw err;
    });

    if (!loginResponse) {
      console.log('❌ No se pudo hacer login como admin');
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido correctamente');

    // PASO 3: Intentar actualizar el nombre del mensajero1
    console.log('\n✏️ PASO 3: Intentando actualizar nombre de mensajero1');
    const newName = `Mensajero Actualizado - ${new Date().toISOString()}`;
    
    console.log(`📝 Nuevo nombre a asignar: "${newName}"`);
    console.log(`🆔 ID del usuario: ${mensajero1.id}`);

    try {
      const updateResponse = await axios.put(
        `http://localhost:3001/api/users/${mensajero1.id}`,
        { fullName: newName },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Respuesta del servidor:');
      console.log(JSON.stringify(updateResponse.data, null, 2));

    } catch (updateError) {
      console.log('❌ Error en la actualización:');
      if (updateError.response) {
        console.log('Status:', updateError.response.status);
        console.log('Data:', updateError.response.data);
      } else {
        console.log('Error:', updateError.message);
      }
    }

    // PASO 4: Verificar el estado actual en la base de datos inmediatamente después
    console.log('\n🔍 PASO 4: Verificando estado en base de datos DESPUÉS de la actualización');
    const afterUpdateUsers = await new Promise((resolve, reject) => {
      connection.execute(
        'SELECT id, username, full_name, email, role, active, created_at, updated_at FROM users WHERE username = "mensajero1"', 
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (afterUpdateUsers.length > 0) {
      const updatedUser = afterUpdateUsers[0];
      console.log('📊 Estado actual en base de datos:');
      console.log(JSON.stringify(updatedUser, null, 2));
      
      // Comparar valores
      console.log('\n📋 COMPARACIÓN:');
      console.log(`Nombre anterior: "${mensajero1.full_name}"`);
      console.log(`Nombre esperado: "${newName}"`);
      console.log(`Nombre actual DB: "${updatedUser.full_name}"`);
      console.log(`¿Cambió en DB?: ${mensajero1.full_name !== updatedUser.full_name ? '✅ SÍ' : '❌ NO'}`);
      console.log(`¿Es el nombre esperado?: ${updatedUser.full_name === newName ? '✅ SÍ' : '❌ NO'}`);
    }

    // PASO 5: Verificar la respuesta del endpoint GET /api/users
    console.log('\n🌐 PASO 5: Verificando respuesta del endpoint GET /api/users');
    try {
      const usersListResponse = await axios.get('http://localhost:3001/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const mensajero1InList = usersListResponse.data.data?.find(u => u.username === 'mensajero1');
      if (mensajero1InList) {
        console.log('📊 Mensajero1 desde API:');
        console.log(JSON.stringify(mensajero1InList, null, 2));
        console.log(`¿Nombre coincide con DB?: ${mensajero1InList.full_name === afterUpdateUsers[0]?.full_name ? '✅ SÍ' : '❌ NO'}`);
      } else {
        console.log('❌ No se encontró mensajero1 en la lista de usuarios desde API');
      }

    } catch (getError) {
      console.log('❌ Error obteniendo lista de usuarios:', getError.message);
    }

    // PASO 6: Hacer una segunda actualización para ver si persiste el problema
    console.log('\n🔄 PASO 6: Intentando SEGUNDA actualización para confirmar el problema');
    const secondNewName = `Segunda Actualización - ${new Date().toISOString()}`;
    
    try {
      const secondUpdateResponse = await axios.put(
        `http://localhost:3001/api/users/${mensajero1.id}`,
        { fullName: secondNewName },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Segunda actualización - Respuesta del servidor:');
      console.log(JSON.stringify(secondUpdateResponse.data, null, 2));

      // Verificar inmediatamente en DB
      const finalCheckUsers = await new Promise((resolve, reject) => {
        connection.execute(
          'SELECT id, username, full_name, updated_at FROM users WHERE username = "mensajero1"', 
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      if (finalCheckUsers.length > 0) {
        console.log('🎯 VERIFICACIÓN FINAL:');
        console.log(`Nombre esperado: "${secondNewName}"`);
        console.log(`Nombre en DB: "${finalCheckUsers[0].full_name}"`);
        console.log(`¿Se actualizó?: ${finalCheckUsers[0].full_name === secondNewName ? '✅ SÍ' : '❌ NO'}`);
        console.log(`Última actualización: ${finalCheckUsers[0].updated_at}`);
      }

    } catch (secondError) {
      console.log('❌ Error en segunda actualización:', secondError.message);
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    connection.end();
  }
}

// Ejecutar la investigación
debugMensajero1UpdateIssue();
