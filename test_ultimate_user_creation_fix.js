// Test definitivo para creación de usuarios con nombres únicos

const axios = require('axios');

async function testUltimateUserCreationFix() {
  console.log('🎯 TEST DEFINITIVO - CREACIÓN DE USUARIOS...\n');
  
  try {
    // Hacer login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido');
    
    // Generar timestamp único
    const timestamp = Date.now();
    
    // Test casos con nombres únicos
    const testCases = [
      {
        name: 'Usuario sin nombre completo',
        data: {
          username: `no_name_${timestamp}`,
          email: `noname${timestamp}@test.com`,
          password: 'password123',
          role: 'mensajero'
        }
      },
      {
        name: 'Usuario solo con campos mínimos',
        data: {
          username: `minimal_${timestamp}`,
          password: 'password123',
          role: 'mensajero'
        }
      },
      {
        name: 'Usuario sin email (vacío)',
        data: {
          username: `no_email_${timestamp}`,
          email: '',
          password: 'password123',
          role: 'mensajero',
          fullName: `Usuario Sin Email ${timestamp}`
        }
      }
    ];
    
    console.log('📝 Probando creación con casos problemáticos...\n');
    
    for (const testCase of testCases) {
      console.log(`🧪 ${testCase.name}`);
      console.log('   Datos:', JSON.stringify(testCase.data, null, 4));
      
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
        console.log(`   ❌ ERROR: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        if (error.response?.data?.errors) {
          console.log('   📋 Errores:');
          error.response.data.errors.forEach(err => {
            console.log(`     - ${err.field}: ${err.message}`);
          });
        }
        
        if (error.response?.status === 500) {
          console.log('   🚨 ERROR 500 - Problema interno del servidor');
          console.log('   💡 Revisar controlador y base de datos');
        }
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error.message);
  }
}

testUltimateUserCreationFix().catch(console.error);
