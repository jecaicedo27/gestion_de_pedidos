const axios = require('axios');

async function debugLoginResponse() {
  console.log('=== Debug de la respuesta de login ===');
  
  try {
    console.log('\n1. Haciendo login y analizando respuesta completa...');
    
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('Status del login:', loginResponse.status);
    console.log('Headers de la respuesta:', JSON.stringify(loginResponse.headers, null, 2));
    console.log('Respuesta completa del login:', JSON.stringify(loginResponse.data, null, 2));
    
    // Verificar diferentes posibles ubicaciones del token
    const token = loginResponse.data.token || 
                 loginResponse.data.accessToken || 
                 loginResponse.data.jwt ||
                 loginResponse.data.authToken;
                 
    console.log('\nToken encontrado:', token ? 'SÍ' : 'NO');
    
    if (token) {
      console.log('Token (primeros 50 chars):', token.substring(0, 50) + '...');
      console.log('Longitud del token:', token.length);
      
      // Verificar que el token tenga formato JWT válido
      const tokenParts = token.split('.');
      console.log('Partes del token (debe ser 3 para JWT):', tokenParts.length);
      
      if (tokenParts.length === 3) {
        console.log('✅ Token tiene formato JWT válido');
      } else {
        console.log('❌ Token no tiene formato JWT válido');
      }
      
      // Probar el token en un endpoint
      console.log('\n2. Probando token en endpoint...');
      try {
        const testResponse = await axios.get('http://localhost:3001/api/orders', {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        
        console.log('✅ Token funciona correctamente');
        
      } catch (tokenError) {
        console.log('❌ Error con el token:', tokenError.response?.status);
        console.log('Detalle:', tokenError.response?.data);
      }
      
    } else {
      console.log('❌ Token no encontrado en la respuesta');
      console.log('Posibles propiedades en data:', Object.keys(loginResponse.data));
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

debugLoginResponse();
