const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function debugSiigoCategoriesAPI() {
  console.log('🔍 INVESTIGANDO API DE CATEGORÍAS DE SIIGO');
  console.log('='.repeat(50));

  // Configuración de SIIGO - Usar los nombres correctos de las variables del .env
  const SIIGO_API_URL = process.env.SIIGO_API_BASE_URL + '/v1' || 'https://api.siigo.com/v1';
  const SIIGO_USERNAME = process.env.SIIGO_API_USERNAME;
  const SIIGO_ACCESS_KEY = process.env.SIIGO_API_ACCESS_KEY;

  console.log('📋 Configuración SIIGO:');
  console.log('- API URL:', SIIGO_API_URL);
  console.log('- Username:', SIIGO_USERNAME ? '✅ Configurado' : '❌ No configurado');
  console.log('- Access Key:', SIIGO_ACCESS_KEY ? '✅ Configurado' : '❌ No configurado');

  if (!SIIGO_USERNAME || !SIIGO_ACCESS_KEY) {
    console.log('❌ Credenciales de SIIGO no configuradas');
    return;
  }

  try {
    // Autenticar con SIIGO - Usar el endpoint correcto
    console.log('\n🔐 Autenticando con SIIGO...');
    const authResponse = await axios.post(`${process.env.SIIGO_API_BASE_URL}/auth`, {
      username: SIIGO_USERNAME,
      access_key: SIIGO_ACCESS_KEY
    });

    const token = authResponse.data.access_token;
    console.log('✅ Autenticación exitosa');

    // Headers para las solicitudes
    const headers = {
      'Authorization': token,
      'Content-Type': 'application/json',
      'Partner-Id': 'test-partner'
    };

    // 1. Probar endpoint de categorías directamente
    console.log('\n🔍 Probando endpoints de categorías...');
    
    const possibleEndpoints = [
      '/products/categories',
      '/categories', 
      '/product-categories',
      '/items/categories',
      '/inventory/categories',
      '/products/groups',
      '/groups',
      '/product-groups'
    ];

    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`\n📡 Probando: ${SIIGO_API_URL}${endpoint}`);
        const response = await axios.get(`${SIIGO_API_URL}${endpoint}`, { headers });
        
        console.log(`✅ ENDPOINT ENCONTRADO: ${endpoint}`);
        console.log('📊 Respuesta:', JSON.stringify(response.data, null, 2));
        
        if (Array.isArray(response.data)) {
          console.log(`📦 Categorías encontradas: ${response.data.length}`);
          response.data.slice(0, 5).forEach((category, index) => {
            console.log(`${index + 1}. ${JSON.stringify(category, null, 2)}`);
          });
        }
        
        return; // Salir al encontrar el primer endpoint válido
        
      } catch (error) {
        if (error.response) {
          console.log(`❌ ${endpoint}: ${error.response.status} - ${error.response.statusText}`);
        } else {
          console.log(`❌ ${endpoint}: Error de conexión`);
        }
      }
    }

    // 2. Si no hay endpoint directo, extraer categorías de productos
    console.log('\n📦 No se encontró endpoint directo de categorías.');
    console.log('🔄 Extrayendo categorías únicas de productos SIIGO...');

    const productsResponse = await axios.get(`${SIIGO_API_URL}/products`, { 
      headers,
      params: {
        page_size: 100, // Obtener más productos
        page: 1
      }
    });

    if (productsResponse.data && productsResponse.data.results) {
      const products = productsResponse.data.results;
      console.log(`📊 Productos obtenidos: ${products.length}`);

      // Extraer categorías únicas
      const categoriesSet = new Set();
      const categoryFields = ['category', 'group', 'type', 'family', 'classification'];
      
      products.forEach(product => {
        console.log('🔍 Analizando producto:', product.name);
        console.log('📋 Campos del producto:', Object.keys(product));
        
        categoryFields.forEach(field => {
          if (product[field]) {
            console.log(`  - ${field}: ${product[field]}`);
            categoriesSet.add(product[field]);
          }
        });

        // Buscar otros campos que puedan contener categorías
        Object.keys(product).forEach(key => {
          if (key.toLowerCase().includes('categor') || 
              key.toLowerCase().includes('group') ||
              key.toLowerCase().includes('type') ||
              key.toLowerCase().includes('class')) {
            console.log(`  - CAMPO POSIBLE: ${key}: ${product[key]}`);
            if (product[key]) {
              categoriesSet.add(product[key]);
            }
          }
        });

        console.log('---');
      });

      const uniqueCategories = Array.from(categoriesSet);
      console.log('\n🎯 CATEGORÍAS ÚNICAS ENCONTRADAS EN SIIGO:');
      console.log('='.repeat(40));
      uniqueCategories.forEach((category, index) => {
        console.log(`${index + 1}. ${category}`);
      });
      
      console.log(`\n📊 Total de categorías únicas: ${uniqueCategories.length}`);
      
      // Mostrar estructura completa de un producto de ejemplo
      if (products.length > 0) {
        console.log('\n🔍 ESTRUCTURA COMPLETA DE PRODUCTO DE EJEMPLO:');
        console.log('='.repeat(50));
        console.log(JSON.stringify(products[0], null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error investigando categorías SIIGO:', error.message);
    if (error.response) {
      console.error('📡 Respuesta del servidor:', error.response.data);
    }
  }
}

debugSiigoCategoriesAPI().catch(console.error);
