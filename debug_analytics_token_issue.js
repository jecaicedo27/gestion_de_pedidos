const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// Test data for authentication  
const testAdmin = {
  username: 'admin', 
  password: 'admin123'
};

async function debugTokenIssue() {
  try {
    console.log('🔍 Diagnosticando problema de token en analytics...\n');

    // 1. Hacer login para obtener token
    console.log('1. Haciendo login como admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, testAdmin);
    
    if (!loginResponse.data.success) {
      throw new Error('Login fallido');
    }
    
    console.log('✅ Login exitoso');
    console.log('📋 Login response structure:', JSON.stringify(loginResponse.data, null, 2));
    
    const token = loginResponse.data.token;
    if (!token) {
      console.log('❌ No se encontró token en la respuesta de login');
      return;
    }
    
    console.log('🎫 Token recibido (primeros 50 chars):', token.substring(0, 50) + '...');
    console.log('🎫 Token length:', token.length);
    
    // 2. Inspeccionar estructura básica del token
    console.log('\n2. Inspeccionando token básico...');
    const tokenParts = token.split('.');
    console.log('📋 Token parts count:', tokenParts.length);
    if (tokenParts.length === 3) {
      console.log('📋 Es un JWT válido (3 partes separadas por puntos)');
    } else {
      console.log('⚠️  Token no tiene estructura JWT estándar');
    }
    
    // 3. Probar endpoint de analytics con headers detallados
    console.log('\n3. Probando endpoint de analytics con headers detallados...');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('📤 Headers enviados:', headers);
    
    try {
      const analyticsResponse = await axios.get(`${API_BASE_URL}/analytics/advanced-dashboard`, {
        headers,
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500; // No lanzar error para códigos < 500
        }
      });

      console.log('📊 Status de respuesta:', analyticsResponse.status);
      console.log('📊 Respuesta completa:', JSON.stringify(analyticsResponse.data, null, 2));
      
      if (analyticsResponse.status === 200) {
        console.log('✅ Analytics funcionando correctamente!');
      } else {
        console.log('❌ Error en analytics:', analyticsResponse.data);
      }
      
    } catch (analyticsError) {
      console.error('❌ Error haciendo petición a analytics:', analyticsError.message);
      if (analyticsError.response) {
        console.log('Status:', analyticsError.response.status);
        console.log('Headers de respuesta:', analyticsError.response.headers);
        console.log('Data:', analyticsError.response.data);
      }
    }
    
    // 4. Probar otros endpoints para comparar
    console.log('\n4. Probando otro endpoint para comparación...');
    try {
      const usersResponse = await axios.get(`${API_BASE_URL}/users`, {
        headers,
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      console.log('👥 Status /users:', usersResponse.status);
      console.log('👥 Response /users:', usersResponse.status === 200 ? 'OK' : usersResponse.data);
      
    } catch (usersError) {
      console.log('👥 Error en /users:', usersError.response?.status, usersError.response?.data);
    }

  } catch (error) {
    console.error('❌ Error general en la prueba:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
  }
}

// Ejecutar el debug
console.log('🚀 Iniciando debug del problema de token...');
debugTokenIssue();
