// Debug para investigar el error de validación al crear usuarios

const axios = require('axios');

async function debugCreateUserValidation() {
  console.log('🔍 INVESTIGANDO PROBLEMA DE VALIDACIÓN AL CREAR USUARIOS...\n');
  
  try {
    // Primero hacer login para obtener token
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido');
    
    // Intentar crear usuario con datos mínimos para ver qué falla
    console.log('2. Intentando crear usuario con datos básicos...');
    
    const userData = {
      username: 'julian_carrillo',
      email: 'julian.carrillo@empresa.com', 
      password: 'password123',
      role: 'mensajero',
      full_name: 'Julian Carrillo'
    };
    
    console.log('📤 Datos enviados:', userData);
    
    try {
      const response = await axios.post('http://localhost:3001/api/users', userData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Usuario creado exitosamente:', response.data);
      
    } catch (error) {
      console.log('❌ Error creando usuario:');
      console.log('   Status:', error.response?.status);
      console.log('   Data:', error.response?.data);
      
      if (error.response?.data?.errors) {
        console.log('🔍 Errores específicos:');
        error.response.data.errors.forEach((err, index) => {
          console.log(`   ${index + 1}. ${err}`);
        });
      }
    }
    
    // Probar con diferentes variaciones de datos
    console.log('\n3. Probando con otros formatos de datos...');
    
    const testCases = [
      {
        name: 'Sin full_name',
        data: {
          username: 'test1',
          email: 'test1@empresa.com',
          password: 'password123', 
          role: 'mensajero'
        }
      },
      {
        name: 'Email simple',
        data: {
          username: 'test2',
          email: 'test2@test.com',
          password: 'password123',
          role: 'mensajero',
          full_name: 'Test User 2'
        }
      },
      {
        name: 'Solo campos requeridos',
        data: {
          username: 'test3',
          password: 'password123',
          role: 'mensajero'
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n   Probando: ${testCase.name}`);
      console.log('   Datos:', testCase.data);
      
      try {
        const response = await axios.post('http://localhost:3001/api/users', testCase.data, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('   ✅ Éxito');
      } catch (error) {
        console.log('   ❌ Error:', error.response?.data?.message || error.message);
        if (error.response?.data?.errors) {
          error.response.data.errors.forEach(err => {
            console.log(`     - ${err}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error.message);
  }
}

debugCreateUserValidation().catch(console.error);
