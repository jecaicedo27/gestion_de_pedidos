const axios = require('axios');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');

// Configuración de base de datos
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
});

const JWT_SECRET = 'tu_jwt_secret_muy_seguro_aqui_cambiar_en_produccion'; // Mismo que en .env

async function debugJWTToken() {
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO DE TOKEN JWT\n');

    // Obtener un usuario para probar
    connection.connect();
    
    const users = await new Promise((resolve, reject) => {
      connection.execute('SELECT id, username, full_name, email, role FROM users WHERE username = "admin"', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (users.length === 0) {
      console.log('❌ No se encontró el usuario admin');
      return;
    }

    const testUser = users[0];
    console.log('👤 Usuario para prueba:', testUser);

    // PASO 1: Hacer login y obtener token
    console.log('\n🔐 PASO 1: Login y obtención de token');
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
      console.log('❌ No se pudo hacer login');
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Login exitoso');
    console.log('📄 Token recibido:', token);

    // PASO 2: Decodificar el token para ver su estructura
    console.log('\n🔍 PASO 2: Análisis del token JWT');
    
    try {
      // Decodificar sin verificar
      const decodedWithoutVerify = jwt.decode(token, { complete: true });
      console.log('🔓 Token decodificado (sin verificar):');
      console.log('Header:', JSON.stringify(decodedWithoutVerify.header, null, 2));
      console.log('Payload:', JSON.stringify(decodedWithoutVerify.payload, null, 2));

      // Verificar con el secreto
      const decodedVerified = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token verificado exitosamente:');
      console.log('Payload verificado:', JSON.stringify(decodedVerified, null, 2));

      // Verificar campos importantes
      console.log('\n🔎 Verificación de campos:');
      console.log('- userId:', decodedVerified.userId || 'NO PRESENTE');
      console.log('- id:', decodedVerified.id || 'NO PRESENTE');
      console.log('- username:', decodedVerified.username || 'NO PRESENTE');
      console.log('- role:', decodedVerified.role || 'NO PRESENTE');
      console.log('- exp:', decodedVerified.exp ? new Date(decodedVerified.exp * 1000) : 'NO PRESENTE');

    } catch (jwtError) {
      console.log('❌ Error verificando token:', jwtError.message);
      return;
    }

    // PASO 3: Probar el token en una petición protegida
    console.log('\n🌐 PASO 3: Prueba de token en endpoint protegido');
    
    // Probar en endpoint de usuarios
    try {
      const usersResponse = await axios.get('http://localhost:3001/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Endpoint /api/users funcionó correctamente');
      console.log('📊 Usuarios obtenidos:', usersResponse.data.data?.length || 'N/A');

    } catch (usersError) {
      console.log('❌ Error en /api/users:');
      if (usersError.response) {
        console.log('Status:', usersError.response.status);
        console.log('Data:', usersError.response.data);
        console.log('Headers enviados:', usersError.config.headers);
      } else {
        console.log('Error:', usersError.message);
      }
    }

    // PASO 4: Probar actualización de usuario específica
    console.log('\n✏️ PASO 4: Prueba de actualización de usuario');
    
    try {
      const updateData = { fullName: 'TEST USUARIO - ' + new Date().toISOString() };
      const updateResponse = await axios.put(
        `http://localhost:3001/api/users/${testUser.id}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Actualización de usuario exitosa:', updateResponse.data);

    } catch (updateError) {
      console.log('❌ Error en actualización de usuario:');
      if (updateError.response) {
        console.log('Status:', updateError.response.status);
        console.log('Data:', updateError.response.data);
        console.log('URL:', updateError.config.url);
        console.log('Method:', updateError.config.method);
        console.log('Headers enviados:', updateError.config.headers);
        console.log('Body enviado:', updateError.config.data);
      } else {
        console.log('Error:', updateError.message);
      }
    }

    // PASO 5: Verificar si el backend está usando el mismo secreto
    console.log('\n🔧 PASO 5: Verificación del secreto en backend');
    
    // Crear un token de prueba local
    const testTokenPayload = {
      userId: testUser.id,
      username: testUser.username,
      role: testUser.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
    };

    const testToken = jwt.sign(testTokenPayload, JWT_SECRET);
    console.log('🏷️ Token de prueba generado localmente:', testToken);

    try {
      const testResponse = await axios.get('http://localhost:3001/api/users', {
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Token generado localmente funciona correctamente');

    } catch (testError) {
      console.log('❌ Token generado localmente falló:');
      if (testError.response) {
        console.log('Status:', testError.response.status);
        console.log('Data:', testError.response.data);
      } else {
        console.log('Error:', testError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    connection.end();
  }
}

// Ejecutar la prueba
debugJWTToken();
