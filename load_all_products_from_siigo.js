const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config({ path: 'backend/.env' });

// Configuración de SIIGO
const SIIGO_CONFIG = {
  username: process.env.SIIGO_API_USERNAME,
  accessKey: process.env.SIIGO_API_ACCESS_KEY,
  baseURL: process.env.SIIGO_API_BASE_URL || 'https://api.siigo.com',
};

let authToken = null;

async function authenticateSiigo() {
  try {
    console.log('🔐 Autenticando con SIIGO API...');
    const response = await axios.post(
      `${SIIGO_CONFIG.baseURL}/auth`,
      {
        username: SIIGO_CONFIG.username,
        access_key: SIIGO_CONFIG.accessKey,
      }
    );
    authToken = response.data.access_token;
    console.log('✅ Autenticación exitosa');
    return authToken;
  } catch (error) {
    console.error('❌ Error autenticando con SIIGO:', error.response?.data || error.message);
    throw error;
  }
}

async function fetchProductsFromSiigo(page = 1, pageSize = 100) {
  try {
    console.log(`📦 Obteniendo productos de SIIGO (página ${page}, tamaño: ${pageSize})...`);
    
    if (!authToken) {
      await authenticateSiigo();
    }

    const response = await axios.get(`${SIIGO_CONFIG.baseURL}/v1/products`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Partner-Id': 'SIIGO',
      },
      params: {
        page,
        page_size: pageSize,
      },
    });

    const { results, pagination } = response.data;
    console.log(`✅ ${results.length} productos obtenidos de página ${page}`);
    console.log(`📊 Total disponible: ${pagination.total_results}`);
    
    return {
      products: results,
      totalPages: Math.ceil(pagination.total_results / pageSize),
      currentPage: page,
      totalResults: pagination.total_results
    };
  } catch (error) {
    console.error('❌ Error obteniendo productos de SIIGO:', error.response?.data || error.message);
    throw error;
  }
}

async function loadProductsToDatabase() {
  let connection;
  
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev',
    });

    console.log('🔄 Iniciando carga COMPLETA de productos desde SIIGO...\n');

    // Obtener primera página para conocer el total
    const firstPageData = await fetchProductsFromSiigo(1, 100);
    const totalPages = firstPageData.totalPages;
    const totalProducts = firstPageData.totalResults;
    
    console.log(`📊 Total de productos en SIIGO: ${totalProducts}`);
    console.log(`📄 Total de páginas a procesar: ${totalPages}\n`);

    let totalProcessed = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Procesar todas las páginas
    for (let page = 1; page <= totalPages; page++) {
      console.log(`\n=== Procesando página ${page} de ${totalPages} ===`);
      
      const pageData = await fetchProductsFromSiigo(page, 100);
      const products = pageData.products;
      
      for (const product of products) {
        try {
          // Verificar si el producto ya existe
          const [existing] = await connection.execute(
            'SELECT id FROM products WHERE siigo_product_id = ?',
            [product.id]
          );

          if (existing.length > 0) {
            // Actualizar producto existente
            await connection.execute(
              `UPDATE products SET 
                product_name = ?, 
                description = ?, 
                category = ?, 
                standard_price = ?,
                internal_code = ?,
                updated_at = CURRENT_TIMESTAMP
               WHERE siigo_product_id = ?`,
              [
                product.name || product.description,
                product.description || product.name,
                product.category?.name || 'Sin categoría',
                product.prices?.[0]?.price_list?.[0]?.value || 0,
                product.code || null,
                product.id
              ]
            );
            totalUpdated++;
          } else {
            // Crear nuevo producto
            const barcode = product.barcode || `SIIGO_${product.id}`;
            
            await connection.execute(
              `INSERT INTO products (
                product_name, description, barcode, internal_code, 
                category, standard_price, siigo_product_id, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                product.name || product.description,
                product.description || product.name,
                barcode,
                product.code || null,
                product.category?.name || 'Sin categoría',
                product.prices?.[0]?.price_list?.[0]?.value || 0,
                product.id,
                product.active ? 1 : 0
              ]
            );
            totalNew++;
          }
          
          totalProcessed++;
          
          // Mostrar progreso cada 25 productos
          if (totalProcessed % 25 === 0) {
            console.log(`📦 Procesados ${totalProcessed}/${totalProducts} productos...`);
          }
          
        } catch (error) {
          console.error(`❌ Error procesando producto ${product.name}:`, error.message);
          totalErrors++;
        }
      }
      
      // Pequeña pausa entre páginas para no sobrecargar la API
      if (page < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Mostrar resumen final
    console.log('\n📊 RESUMEN DE CARGA COMPLETA:');
    console.log(`📦 Total procesados: ${totalProcessed}`);
    console.log(`✅ Nuevos productos: ${totalNew}`);
    console.log(`🔄 Productos actualizados: ${totalUpdated}`);
    console.log(`❌ Errores: ${totalErrors}`);
    
    // Verificar cantidad final en base de datos
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM products');
    console.log(`\n📊 Total de productos en la base de datos: ${countResult[0].total}`);
    
    console.log('\n🎉 ¡Carga completa de productos desde SIIGO finalizada!');
    
  } catch (error) {
    console.error('❌ Error en el proceso de carga:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar la carga
loadProductsToDatabase();
