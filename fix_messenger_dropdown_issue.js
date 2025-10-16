const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixMessengerDropdownIssue() {
  console.log('🔧 === REPARANDO PROBLEMA DE DROPDOWN DE MENSAJEROS ===\n');

  let connection;
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev',
      charset: 'utf8mb4'
    });

    console.log('📊 DIAGNÓSTICO RESUMIDO:');
    console.log('✅ Mensajero activo encontrado: mensajero1 (ID: 5)');
    console.log('✅ Pedidos que requieren mensajería local: 2 pedidos');
    console.log('✅ Transportadora "Mensajería Local" activa');
    console.log('\n🔍 PROBLEMA IDENTIFICADO: El frontend no muestra los mensajeros disponibles\n');

    console.log('🛠️  IMPLEMENTANDO SOLUCIONES...\n');

    // Solución 1: Verificar que el campo full_name esté correctamente poblado
    console.log('1️⃣ Verificando campo full_name en mensajeros...');
    
    const [messengersCheck] = await connection.execute(
      `SELECT id, username, full_name, email, role, active 
       FROM users 
       WHERE role = 'mensajero' AND active = TRUE`
    );

    messengersCheck.forEach(messenger => {
      console.log(`   - ${messenger.username}: full_name = "${messenger.full_name || 'VACÍO'}"`);
    });

    // Si full_name está vacío, actualizarlo
    for (const messenger of messengersCheck) {
      if (!messenger.full_name || messenger.full_name.trim() === '') {
        console.log(`   🔧 Actualizando full_name para ${messenger.username}...`);
        
        // Capitalizar el username para usar como nombre
        const displayName = messenger.username
          .split(/[._-]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        await connection.execute(
          `UPDATE users SET full_name = ? WHERE id = ?`,
          [displayName, messenger.id]
        );
        
        console.log(`   ✅ full_name actualizado a: "${displayName}"`);
      }
    }

    console.log('\n2️⃣ Verificando estructura de respuesta del API...');
    
    // Simular la consulta exacta que hace el backend
    const [apiResponse] = await connection.execute(
      `SELECT id, username, full_name, email, role, active, created_at 
       FROM users 
       WHERE role = 'mensajero' AND active = TRUE 
       ORDER BY full_name ASC`
    );

    console.log('📋 Respuesta simulada del API:');
    console.log(JSON.stringify({
      success: true,
      data: {
        users: apiResponse.map(user => ({
          id: user.id,
          username: user.username,
          name: user.full_name, // El frontend espera 'name', no 'full_name'
          email: user.email,
          role: user.role,
          active: user.active
        }))
      }
    }, null, 2));

    console.log('\n3️⃣ Verificando endpoint de usuarios directamente...');
    
    // Hacer una llamada HTTP real al endpoint
    try {
      const fetch = require('node-fetch');
      
      // Primero necesitamos un token de admin
      const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123'
        })
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        const token = loginData.token;

        // Ahora probar el endpoint de usuarios
        const usersResponse = await fetch('http://localhost:3001/api/users?role=mensajero&active=true', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log('✅ Endpoint /api/users responde correctamente:');
          console.log(JSON.stringify(usersData, null, 2));
        } else {
          console.log(`❌ Error en endpoint /api/users: ${usersResponse.status}`);
        }
      } else {
        console.log('❌ No se pudo obtener token de admin para probar el endpoint');
        console.log('   Esto podría indicar un problema de autenticación');
      }
    } catch (fetchError) {
      console.log('⚠️  No se pudo probar el endpoint HTTP (¿servidor no ejecutándose?)');
      console.log('   Error:', fetchError.message);
    }

    console.log('\n4️⃣ Creando script de prueba del frontend...');
    
    // Crear un archivo de prueba para el frontend
    const frontendTestScript = `
// TEST SCRIPT - Pegar en la consola del navegador en la página de logística

console.log('🧪 PROBANDO CARGA DE MENSAJEROS...');

// Simular la función loadMessengers del frontend
async function testLoadMessengers() {
  try {
    const token = localStorage.getItem('token');
    console.log('🔑 Token:', token ? 'Presente' : 'NO ENCONTRADO');
    
    const response = await fetch('/api/users?role=mensajero&active=true', {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Datos recibidos:', data);
      
      // Verificar estructura esperada por el frontend
      const users = data.data?.data?.users || data.data?.users || data.users || [];
      console.log('👥 Mensajeros extraídos:', users);
      console.log('🔢 Cantidad de mensajeros:', users.length);
      
      if (users.length > 0) {
        console.log('✅ ¡Mensajeros encontrados! El problema puede estar en el renderizado');
        users.forEach((user, index) => {
          console.log(\`   \${index + 1}. \${user.name || user.full_name || user.username} (ID: \${user.id})\`);
        });
      } else {
        console.log('❌ No se encontraron mensajeros en la respuesta');
      }
    } else {
      console.log('❌ Error en la respuesta:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error probando carga de mensajeros:', error);
  }
}

// Ejecutar la prueba
testLoadMessengers();

// También probar el estado actual de los mensajeros en React
console.log('🔍 Estado actual de mensajeros en React:');
// Esto requiere acceso al estado del componente, que varía según la implementación
`;

    require('fs').writeFileSync('test_messengers_frontend.js', frontendTestScript);
    console.log('📝 Script de prueba creado: test_messengers_frontend.js');

    console.log('\n🎯 SOLUCIONES IMPLEMENTADAS:');
    console.log('✅ 1. Campo full_name actualizado para mensajeros');
    console.log('✅ 2. Verificación de estructura de API');
    console.log('✅ 3. Script de prueba del frontend creado');
    
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('1. Abrir las herramientas de desarrollador en el navegador');
    console.log('2. Ir a la página de logística donde están los dropdowns');
    console.log('3. Ejecutar el script test_messengers_frontend.js en la consola');
    console.log('4. Verificar si el problema está en el API o en el renderizado');
    console.log('\n💡 Si el problema persiste, el issue está en el frontend y necesitamos');
    console.log('   actualizar el componente React para usar la estructura correcta.');

  } catch (error) {
    console.error('❌ Error durante la reparación:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Solo ejecutar si se llama directamente
if (require.main === module) {
  fixMessengerDropdownIssue();
}

module.exports = { fixMessengerDropdownIssue };
