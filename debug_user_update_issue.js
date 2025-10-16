const axios = require('axios');
const mysql = require('mysql2');

// Configuración de base de datos
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
});

async function testUserUpdate() {
  try {
    console.log('🔍 DIAGNÓSTICO DE ACTUALIZACIÓN DE USUARIOS');

    // Primero obtener un usuario para probar
    connection.connect();
    
    const users = await new Promise((resolve, reject) => {
      connection.execute('SELECT id, username, full_name, email, role FROM users WHERE role = "mensajero" LIMIT 1', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (users.length === 0) {
      console.log('❌ No hay usuarios mensajeros para probar');
      return;
    }

    const testUser = users[0];
    console.log('\n📋 Usuario de prueba seleccionado:', testUser);

    // Simular login de admin para obtener token
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
      console.log('❌ No se pudo hacer login. Verificar credenciales de admin');
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Login exitoso, token obtenido');

    // Probar diferentes variaciones de actualización
    const testCases = [
      {
        name: 'Actualizar con fullName',
        data: { fullName: 'NUEVO NOMBRE - Mensajero TEST' }
      },
      {
        name: 'Actualizar con full_name', 
        data: { full_name: 'OTRO NOMBRE - Mensajero TEST' }
      },
      {
        name: 'Actualizar email',
        data: { email: 'nuevo_email@test.com' }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🧪 PROBANDO: ${testCase.name}`);
      console.log('Datos a enviar:', JSON.stringify(testCase.data, null, 2));

      try {
        const response = await axios.put(
          `http://localhost:3001/api/users/${testUser.id}`,
          testCase.data,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('✅ Actualización exitosa:', response.data);

        // Verificar en base de datos si realmente se actualizó
        const updatedUser = await new Promise((resolve, reject) => {
          connection.execute('SELECT id, username, full_name, email FROM users WHERE id = ?', [testUser.id], (err, results) => {
            if (err) reject(err);
            else resolve(results[0]);
          });
        });

        console.log('📊 Usuario después de la actualización:', updatedUser);

      } catch (error) {
        console.log('❌ Error en actualización:');
        if (error.response) {
          console.log('Status:', error.response.status);
          console.log('Data:', error.response.data);
        } else {
          console.log('Error:', error.message);
        }
      }

      // Esperar un momento entre pruebas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    connection.end();
  }
}

// Ejecutar la prueba
testUserUpdate();
