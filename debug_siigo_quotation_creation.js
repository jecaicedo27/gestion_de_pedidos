const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugSiigoQuotationCreation() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos'
  });

  try {
    console.log('🔍 Depurando creación de cotización en SIIGO...\n');

    // 1. Verificar configuración de SIIGO
    console.log('1️⃣ Verificando configuración de SIIGO:');
    console.log('   - SIIGO_API_URL:', process.env.SIIGO_API_URL || 'No configurado');
    console.log('   - SIIGO_USERNAME:', process.env.SIIGO_USERNAME ? '✓ Configurado' : '✗ No configurado');
    console.log('   - SIIGO_ACCESS_KEY:', process.env.SIIGO_ACCESS_KEY ? '✓ Configurado' : '✗ No configurado');
    console.log('');

    // 2. Verificar clientes con SIIGO ID
    console.log('2️⃣ Clientes con SIIGO ID:');
    const [customers] = await connection.execute(`
      SELECT id, name, commercial_name, siigo_id 
      FROM customers 
      WHERE siigo_id IS NOT NULL
      LIMIT 5
    `);
    
    if (customers.length > 0) {
      console.table(customers);
    } else {
      console.log('   ⚠️ No hay clientes con siigo_id configurado');
    }
    console.log('');

    // 3. Verificar productos en la base de datos
    console.log('3️⃣ Verificando productos disponibles:');
    const [products] = await connection.execute(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN standard_price > 0 THEN 1 END) as con_precio,
             COUNT(CASE WHEN internal_code IS NOT NULL THEN 1 END) as con_codigo
      FROM products
      WHERE is_active = 1
    `);
    console.table(products);
    console.log('');

    // 4. Verificar últimos procesamiento de ChatGPT
    console.log('4️⃣ Últimos procesamientos de ChatGPT:');
    const [logs] = await connection.execute(`
      SELECT id, request_type, success, tokens_used, 
             DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as fecha
      FROM chatgpt_processing_log
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (logs.length > 0) {
      console.table(logs);
    } else {
      console.log('   ℹ️ No hay logs de procesamiento de ChatGPT');
    }
    console.log('');

    // 5. Verificar estructura de un producto ejemplo para SIIGO
    console.log('5️⃣ Estructura de ejemplo para SIIGO:');
    const ejemploItem = {
      code: 'SIRBLUE01',
      description: 'Sirope Blueberry x 1L',
      quantity: 3,
      price: 15000,
      discount: 0,
      taxes: []
    };
    console.log('   Estructura de item para SIIGO:');
    console.log(JSON.stringify(ejemploItem, null, 2));
    console.log('');

    // 6. Verificar si axios está instalado
    console.log('6️⃣ Verificando dependencias:');
    try {
      require('axios');
      console.log('   ✓ axios está instalado');
    } catch (error) {
      console.log('   ✗ axios NO está instalado - Ejecutar: npm install axios');
    }
    console.log('');

    // 7. Sugerencias
    console.log('📋 POSIBLES CAUSAS DEL ERROR 500:');
    console.log('   1. Items sin código de producto válido');
    console.log('   2. Items sin precio unitario');
    console.log('   3. Cliente sin siigo_id');
    console.log('   4. Falta la librería axios');
    console.log('   5. Credenciales de SIIGO incorrectas');
    console.log('   6. Estructura de datos incorrecta para SIIGO');
    console.log('');

    console.log('💡 SOLUCIÓN RECOMENDADA:');
    console.log('   1. Asegurarse de que los items tengan códigos y precios');
    console.log('   2. Verificar que el cliente tenga siigo_id');
    console.log('   3. Instalar axios si no está: npm install axios');
    console.log('   4. Revisar los logs del backend para ver el error específico');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

debugSiigoQuotationCreation();
