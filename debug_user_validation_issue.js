// Debug del problema de validación de usuarios

const axios = require('axios');

async function debugUserValidationIssue() {
  console.log('🔍 INVESTIGANDO PROBLEMA DE VALIDACIÓN...\n');
  
  try {
    // Hacer login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenido');
    
    // Simular exactamente los datos del formulario
    const testData = {
      username: 'julianCarrillo',
      email: 'carrillo@gmail.com',
      role: 'mensajero',  // Asegurarse que sea minúscula
      password: 'password123'
    };
    
    console.log('📤 Datos enviados:', JSON.stringify(testData, null, 2));
    
    try {
      const response = await axios.post('http://localhost:3001/api/users', testData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ ÉXITO:', response.data);
      
    } catch (error) {
      console.log('❌ ERROR DETALLADO:');
      console.log('Status:', error.response?.status);
      console.log('Message:', error.response?.data?.message);
      console.log('Errors:', JSON.stringify(error.response?.data?.errors, null, 2));
      console.log('Full Response:', JSON.stringify(error.response?.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error.message);
  }
}

debugUserValidationIssue().catch(console.error);
