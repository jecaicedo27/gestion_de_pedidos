const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function testInventoryBillingAllCategories() {
  console.log('🧪 TESTING: Sistema de facturación de inventario con TODAS las categorías');
  console.log('=' .repeat(80));
  
  try {
    // PASO 1: Login
    console.log('🔐 PASO 1: Autenticación...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    
    if (!loginResponse.data.success) {
      throw new Error('Error en login: ' + loginResponse.data.message);
    }
    
    // Acceder correctamente al token anidado
    const token = loginResponse.data.data?.token || loginResponse.data.token;
    console.log('✅ Login exitoso, token obtenido');
    console.log(`🎫 Token: ${token.substring(0, 20)}...`);

    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // PASO 2: Obtener productos de TODAS las categorías
    console.log('\n📦 PASO 2: Cargando productos de TODAS las categorías...');
    const productsResponse = await axios.get(`${BASE_URL}/api/products?pageSize=100`, { headers });
    
