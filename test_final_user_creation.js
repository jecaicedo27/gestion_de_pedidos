// Test final para verificar creación de usuarios con nombres únicos

const axios = require('axios');

async function testFinalUserCreation() {
  console.log('🎯 TEST FINAL - CREACIÓN DE USUARIOS...\n');
  
  try {
    // Hacer login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido');
    
    // Generar timestamp para nombres únicos
    const timestamp = Date.now();
    
    // Test casos con nombres únicos
    const testCases = [
      {
        name: 'Mensajero completo con fullName',
        data: {
          username: `carlos_${timestamp}`,
          email: `carlos_${timestamp}@empresa.com`,
          password: 'password123',
          role: 'mensajero',
          fullName: `Carlos Mensajero ${timestamp}`
        }
      },
      {
        name: 'Mensajero con full_name',
        data: {
          username: `lucia_${timestamp}`,
          email: `lucia_${timestamp}@empresa.com`,
          password: 'password123',
          role: 'mensajero',
          full_name: `Lucia Repartidora ${timestamp}`
        }
      },
      {
        name: 'Usuario simple solo con nombre de usuario',
        data: {
          username: `simple_${timestamp}`,
          password: 'password123',
          role: 'mensajero'
        }
      }
    ];
    
    console.log('📝 Probando creación de usuarios...\n');
    
    for (const testCase of testCases) {
      console.log(`   🔹 ${testCase.name}`);
      
      try {
        const response = await axios.post('http://localhost:3001/api/users', testCase.data, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('   ✅ ÉXITO:');
        console.log(`     ID: ${response.data.data.id}`);
        console.log(`     Usuario: ${response.data.data.username}`);
        console.log(`     Email: ${response.data.data.email || 'Sin email'}`);
        console.log(`     Nombre: ${response.data.data.full_name || 'Sin nombre'}`);
        console.log(`     Rol: ${response.data.data.role}`);
        
      } catch (error) {
        console.log('   ❌ ERROR:', error.response?.data?.message || error.message);
        if (error.response?.data?.errors) {
          error.response.data.errors.forEach(err => {
            console.log(`     - ${err.field}: ${err.message}`);
          });
        }
      }
      
      console.log('');
    }
    
    // Verificar mensajeros creados
    console.log('📋 Verificando mensajeros disponibles...');
    try {
      const messengersResponse = await axios.get('http://localhost:3001/api/users?role=mensajero', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (messengersResponse.data.success) {
        console.log(`✅ Total mensajeros: ${messengersResponse.data.data.users.length}`);
        messengersResponse.data.data.users.forEach(user => {
          console.log(`   - ${user.username} (${user.full_name || 'Sin nombre'})`);
        });
      }
    } catch (error) {
      console.log('❌ Error obteniendo mensajeros:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error.message);
  }
}

testFinalUserCreation().catch(console.error);
