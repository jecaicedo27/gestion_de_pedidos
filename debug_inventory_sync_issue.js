const fetch = require('node-fetch');
const mysql = require('mysql2/promise');

const API_BASE = 'http://localhost:3001/api';

// Credenciales de prueba
const TEST_USER = {
  username: 'admin',
  password: 'admin123'
};

async function debugInventorySyncIssue() {
  console.log('🔍 Diagnosticando problema de sincronización de inventario...\n');

  try {
    // 1. Login
    console.log('1️⃣ Realizando login...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });

    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error('Login falló: ' + loginData.message);
    }

    const token = loginData.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Verificar estado actual de productos en base de datos
    console.log('2️⃣ Verificando productos en base de datos...');
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    const [rows] = await connection.execute(`
      SELECT 
        id, 
        product_name, 
        category, 
        siigo_id,
        stock, 
        available_quantity,
        standard_price
      FROM products 
      WHERE category IN ('LIQUIPOPS', 'MEZCLAS EN POLVO') 
      ORDER BY category, product_name 
      LIMIT 20
    `);

    console.log('📦 Muestra de productos en BD:');
    rows.forEach(product => {
      console.log(`   • ${product.product_name}`);
      console.log(`     - Stock: ${product.stock || 0}`);
      console.log(`     - Available Qty: ${product.available_quantity || 0}`);
      console.log(`     - SIIGO ID: ${product.siigo_id || 'N/A'}`);
      console.log(`     - Precio: $${product.standard_price || 0}`);
      console.log('');
    });

    await connection.end();

    // 3. Probar endpoint de productos desde API
    console.log('3️⃣ Probando endpoint de productos...');
    const productsResponse = await fetch(`${API_BASE}/products?category=LIQUIPOPS&pageSize=10`, {
      headers: authHeaders
    });

    const productsData = await productsResponse.json();
    if (productsData.success) {
      console.log('📋 Productos desde API:');
      productsData.data.forEach(product => {
        console.log(`   • ${product.product_name}`);
        console.log(`     - Stock mostrado: ${product.stock || 0}`);
        console.log(`     - Available Qty: ${product.available_quantity || 0}`);
        console.log('');
      });
    } else {
      console.log('❌ Error obteniendo productos:', productsData.message);
    }

    // 4. Verificar configuración de SIIGO
    console.log('4️⃣ Verificando configuración SIIGO...');
    try {
      const configResponse = await fetch(`${API_BASE}/config`, {
        headers: authHeaders
      });
      const configData = await configResponse.json();
      
      if (configData.success && configData.data.siigo_credentials) {
        console.log('✅ Configuración SIIGO encontrada');
        console.log(`   • Usuario: ${configData.data.siigo_credentials.username || 'N/A'}`);
        console.log(`   • Token configurado: ${configData.data.siigo_credentials.access_token ? 'SÍ' : 'NO'}`);
      } else {
        console.log('❌ No se encontró configuración SIIGO válida');
      }
    } catch (error) {
      console.log('❌ Error verificando configuración SIIGO:', error.message);
    }

    // 5. Probar sincronización directa
    console.log('5️⃣ Ejecutando sincronización de inventario...');
    const syncResponse = await fetch(`${API_BASE}/products/sync-inventory`, {
      method: 'POST',
      headers: authHeaders
    });

    const syncData = await syncResponse.json();
    if (syncData.success) {
      console.log('✅ Sincronización ejecutada:');
      console.log(`   • Productos procesados: ${syncData.processed_products || 'N/A'}`);
      console.log(`   • Productos actualizados: ${syncData.updated_products || 'N/A'}`);
      console.log(`   • Tiempo: ${syncData.processing_time || 'N/A'}`);
    } else {
      console.log('❌ Error en sincronización:', syncData.message);
      if (syncData.error) {
        console.log('   Detalles del error:', syncData.error);
      }
    }

    // 6. Verificar productos después de sincronización
    console.log('6️⃣ Verificando productos después de sincronización...');
    const connection2 = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    const [rowsAfter] = await connection2.execute(`
      SELECT 
        id, 
        product_name, 
        stock, 
        available_quantity,
        updated_at
      FROM products 
      WHERE category = 'LIQUIPOPS' 
      ORDER BY product_name 
      LIMIT 10
    `);

    console.log('📦 Productos después de sync:');
    rowsAfter.forEach(product => {
      console.log(`   • ${product.product_name}`);
      console.log(`     - Stock: ${product.stock || 0}`);
      console.log(`     - Available Qty: ${product.available_quantity || 0}`);
      console.log(`     - Última actualización: ${product.updated_at}`);
      console.log('');
    });

    await connection2.end();

    // 7. Diagnóstico final
    console.log('📊 DIAGNÓSTICO:');
    
    const allZeroStock = rowsAfter.every(p => (p.stock || 0) === 0 && (p.available_quantity || 0) === 0);
    if (allZeroStock) {
      console.log('❌ PROBLEMA: Todos los productos tienen stock 0');
      console.log('   Posibles causas:');
      console.log('   • Configuración SIIGO incorrecta o token expirado');
      console.log('   • API de SIIGO no responde correctamente');
      console.log('   • Error en el mapeo de productos entre SIIGO y BD local');
      console.log('   • Productos no existen en SIIGO o tienen nombres diferentes');
    } else {
      console.log('✅ Algunos productos tienen stock > 0');
      console.log('   El sistema está funcionando parcialmente');
    }

    if (!syncData.success) {
      console.log('❌ PROBLEMA: Sincronización falló');
      console.log('   Revisar logs del servidor y configuración SIIGO');
    }

  } catch (error) {
    console.error('❌ Error durante diagnóstico:', error.message);
    console.log('\n🔧 Acciones recomendadas:');
    console.log('   • Verificar que el backend esté corriendo');
    console.log('   • Verificar configuración de SIIGO en .env');
    console.log('   • Revisar credenciales y token de acceso SIIGO');
    console.log('   • Verificar conectividad a la API de SIIGO');
  }
}

// Ejecutar diagnóstico
debugInventorySyncIssue();
