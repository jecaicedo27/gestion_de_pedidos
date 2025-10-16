// Debug del error 500 al crear usuarios desde la interfaz

const axios = require('axios');

async function debug500Error() {
  console.log('🔍 INVESTIGANDO ERROR 500 AL CREAR USUARIOS...\n');
  
  try {
    // Hacer login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido');
    
    // Simular exactamente los datos que envía el frontend
    console.log('📤 Probando datos típicos del frontend...');
    
    const frontendTestCases = [
      {
        name: 'Caso típico del formulario',
        data: {
          username: 'test_frontend',
          email: 'test@test.com',
          password: 'password123',
          role: 'mensajero',
          fullName: 'Test Frontend'
        }
      },
      {
        name: 'Sin email (campo vacío)',
        data: {
          username: 'no_email_test',
          email: '',
          password: 'password123', 
          role: 'mensajero',
          fullName: 'Sin Email Test'
        }
      },
      {
        name: 'Sin nombre completo',
        data: {
          username: 'no_name_test',
          email: 'noname@test.com',
          password: 'password123',
          role: 'mensajero'
        }
      },
      {
        name: 'Solo campos mínimos',
        data: {
          username: 'minimal_test',
          password: 'password123',
          role: 'mensajero'
        }
      }
    ];
    
    for (const testCase of frontendTestCases) {
      console.log(`\n🧪 ${testCase.name}`);
      console.log('   Datos enviados:', JSON.stringify(testCase.data, null, 4));
      
      try {
        const response = await axios.post('http://localhost:3001/api/users', testCase.data, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('   ✅ ÉXITO:', response.data.message);
        console.log('   📋 Usuario creado:', {
          id: response.data.data.id,
          username: response.data.data.username,
          email: response.data.data.email,
          full_name: response.data.data.full_name,
          role: response.data.data.role
        });
        
      } catch (error) {
        console.log('   ❌ ERROR:', error.response?.status, error.response?.data?.message);
        if (error.response?.data?.errors) {
          console.log('   📋 Errores de validación:');
          error.response.data.errors.forEach(err => {
            console.log(`     - ${err.field}: ${err.message}`);
          });
        }
        
        // Si es error 500, mostrar más detalles
        if (error.response?.status === 500) {
          console.log('   🚨 ERROR 500 DETECTADO');
          console.log('   💡 Revisar logs del servidor para más detalles');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error.message);
  }
}

debug500Error().catch(console.error);
