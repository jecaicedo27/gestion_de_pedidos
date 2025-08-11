// Test para verificar que la creación de usuarios funciona correctamente después del fix

const axios = require('axios');

async function testCreateUserFix() {
  console.log('🧪 PROBANDO CREACIÓN DE USUARIOS DESPUÉS DEL FIX...\n');
  
  try {
    // Hacer login
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido');
    
    // Test casos exitosos
    const testCases = [
      {
        name: 'Usuario con guión bajo y fullName',
        data: {
          username: 'julian_carrillo',
          email: 'julian.carrillo@empresa.com',
          password: 'password123',
          role: 'mensajero',
          fullName: 'Julian Carrillo'
        }
      },
      {
        name: 'Usuario con full_name (snake_case)',
        data: {
          username: 'maria_rodriguez',
          email: 'maria.rodriguez@empresa.com',
          password: 'password123',
          role: 'mensajero',
          full_name: 'Maria Rodriguez'
        }
      },
      {
        name: 'Usuario sin email',
        data: {
          username: 'pedro123',
          password: 'password123',
          role: 'mensajero',
          fullName: 'Pedro González'
        }
      },
      {
        name: 'Usuario sin nombre completo',
        data: {
          username: 'ana_lopez',
          email: 'ana@empresa.com',
          password: 'password123',
          role: 'mensajero'
        }
      }
    ];
    
    console.log('2. Probando creación de usuarios...\n');
    
    for (const testCase of testCases) {
      console.log(`   📝 Caso: ${testCase.name}`);
      console.log('   Datos:', JSON.stringify(testCase.data, null, 4));
      
      try {
        const response = await axios.post('http://localhost:3001/api/users', testCase.data, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('   ✅ ÉXITO - Usuario creado:');
        console.log('     ID:', response.data.data.id);
        console.log('     Username:', response.data.data.username);
        console.log('     Email:', response.data.data.email || 'No email');
        console.log('     Nombre completo:', response.data.data.full_name || 'No nombre completo');
        console.log('     Rol:', response.data.data.role);
        
      } catch (error) {
        console.log('   ❌ ERROR:', error.response?.data?.message || error.message);
        if (error.response?.data?.errors) {
          error.response.data.errors.forEach(err => {
            console.log(`     - Campo ${err.field}: ${err.message}`);
          });
        }
      }
      
      console.log(''); // Línea en blanco entre casos
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error.message);
  }
}

testCreateUserFix().catch(console.error);
