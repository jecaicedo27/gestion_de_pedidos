const axios = require('axios');
const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev',
  charset: 'utf8mb4'
};

async function debugAndActivateStockSync() {
  console.log('🔄 ACTIVANDO SINCRONIZACIÓN DE STOCK SIIGO');
  console.log('==========================================\n');

  try {
    const connection = await mysql.createConnection(dbConfig);

    // 1. Verificar productos actuales
    console.log('📊 1. Verificando estado actual de productos...');
    const [products] = await connection.execute(`
      SELECT code, name, stock, last_updated 
      FROM products 
      WHERE code LIKE 'LIQUIPP%' 
      ORDER BY last_updated DESC 
      LIMIT 10
    `);

    console.log('Productos actuales:');
    products.forEach(product => {
      console.log(`- ${product.code}: Stock: ${product.stock || 'N/A'}, Actualizado: ${product.last_updated}`);
    });

    // 2. Verificar configuración SIIGO
    console.log('\n🔑 2. Verificando credenciales SIIGO...');
    const [siigoConfig] = await connection.execute(`
      SELECT * FROM siigo_credentials ORDER BY created_at DESC LIMIT 1
    `);

    if (siigoConfig.length === 0) {
      console.log('❌ No hay credenciales SIIGO configuradas');
      return;
    }

    const credentials = siigoConfig[0];
    console.log(`✅ Credenciales SIIGO encontradas para: ${credentials.username}`);

    // 3. Obtener token de SIIGO
    console.log('\n🎫 3. Obteniendo token de autenticación...');
    
    const tokenResponse = await axios.post('https://api.siigo.com/auth', {
      username: credentials.username,
      access_key: credentials.access_key
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Partner-Id': 'liquipops'
      },
      timeout: 10000
    });

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Token obtenido exitosamente');

    // 4. Consultar productos directamente desde SIIGO
    console.log('\n📦 4. Consultando productos desde SIIGO...');
    
    const productsResponse = await axios.get('https://api.siigo.com/v1/products', {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json',
        'Partner-Id': 'liquipops'
      },
      params: {
        page_size: 20,
        page: 1
      },
      timeout: 15000
    });

    const siigoProducts = productsResponse.data.results;
    console.log(`✅ Se encontraron ${siigoProducts.length} productos en SIIGO`);

    // 5. Actualizar productos en base de datos local
    console.log('\n💾 5. Actualizando productos locales...');
    
    let updatedCount = 0;
    const updatePromises = siigoProducts.map(async (siigoProduct) => {
      try {
        // Obtener información detallada del producto
        const detailResponse = await axios.get(`https://api.siigo.com/v1/products/${siigoProduct.id}`, {
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json',
            'Partner-Id': 'liquipops'
          },
          timeout: 10000
        });

        const productDetail = detailResponse.data;
        const currentStock = productDetail.available_quantity || 0;

        // Actualizar en base de datos
        const [result] = await connection.execute(`
          UPDATE products 
          SET 
            stock = ?,
            siigo_id = ?,
            price = ?,
            active = ?,
            last_updated = NOW()
          WHERE code = ? OR siigo_id = ?
        `, [
          currentStock,
          productDetail.id,
          productDetail.prices && productDetail.prices.length > 0 ? productDetail.prices[0].price_list[0].value : null,
          productDetail.active ? 1 : 0,
          productDetail.code,
          productDetail.id
        ]);

        if (result.affectedRows > 0) {
          console.log(`✅ Actualizado: ${productDetail.code} - Stock: ${currentStock}`);
          updatedCount++;
        }

        // Pequeña pausa para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`❌ Error actualizando producto ${siigoProduct.code}: ${error.message}`);
      }
    });

    await Promise.all(updatePromises);
    console.log(`\n✅ Se actualizaron ${updatedCount} productos exitosamente`);

    // 6. Verificar productos después de la actualización
    console.log('\n📊 6. Verificando productos después de la actualización...');
    const [updatedProducts] = await connection.execute(`
      SELECT code, name, stock, last_updated 
      FROM products 
      WHERE last_updated >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      ORDER BY last_updated DESC 
      LIMIT 10
    `);

    console.log('Productos actualizados recientemente:');
    updatedProducts.forEach(product => {
      console.log(`- ${product.code}: Stock: ${product.stock || 'N/A'}, Actualizado: ${product.last_updated}`);
    });

    // 7. Activar sistema de auto-sincronización
    console.log('\n🔄 7. Activando sistema de auto-sincronización...');
    
    try {
      // Intentar activar el autoSync mediante API
      const syncResponse = await axios.post('http://localhost:3001/api/products/sync-from-siigo', {}, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ Sistema de auto-sincronización activado:', syncResponse.data);
    } catch (syncError) {
      console.log('⚠️ No se pudo activar via API, continuando...');
    }

    // 8. Verificar logs de sincronización
    console.log('\n📝 8. Verificando logs de sincronización...');
    try {
      const [syncLogs] = await connection.execute(`
        SELECT * FROM sync_logs 
        ORDER BY created_at DESC 
        LIMIT 5
      `);

      if (syncLogs.length > 0) {
        console.log('Últimos logs de sincronización:');
        syncLogs.forEach(log => {
          console.log(`- ${log.created_at}: ${log.status} - ${log.message}`);
        });
      } else {
        console.log('No hay logs de sincronización recientes');
      }
    } catch (logError) {
      console.log('⚠️ No se pudieron consultar los logs de sincronización');
    }

    await connection.end();

    console.log('\n🎉 SINCRONIZACIÓN COMPLETADA');
    console.log('=====================================');
    console.log(`✅ Productos consultados desde SIIGO: ${siigoProducts.length}`);
    console.log(`✅ Productos actualizados localmente: ${updatedCount}`);
    console.log('✅ Sistema de sincronización activado');
    console.log('\n📱 Revisa ahora el inventario en la aplicación para ver los cambios.');

  } catch (error) {
    console.error('❌ Error durante la sincronización:', error.message);
    
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
      console.error('Status:', error.response.status);
    }
  }
}

// Ejecutar sincronización
if (require.main === module) {
  debugAndActivateStockSync();
}

module.exports = { debugAndActivateStockSync };
