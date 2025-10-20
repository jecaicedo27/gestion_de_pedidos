const axios = require('axios');
require('dotenv').config();

async function obtenerTokenSiigo() {
  try {
    console.log('🔐 Obteniendo token de autenticación SIIGO...');
    
    const authData = {
      username: process.env.SIIGO_API_USERNAME,
      access_key: process.env.SIIGO_API_ACCESS_KEY
    };
    
    console.log('📡 Datos de autenticación:', {
      username: authData.username,
      hasAccessKey: !!authData.access_key
    });

    const response = await axios.post(
      'https://api.siigo.com/auth',
      authData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Partner-Id': 'gestion_pedidos'
        }
      }
    );

    if (response.data && response.data.access_token) {
      console.log('✅ Token obtenido exitosamente');
      return response.data.access_token;
    } else {
      throw new Error('No se recibió token en la respuesta');
    }

  } catch (error) {
    console.error('❌ Error obteniendo token SIIGO:', error.response?.data || error.message);
    throw error;
  }
}

async function consultarProductoSHOT000ConToken(token) {
  try {
    console.log('\n🔍 Consultando producto SHOT000 en SIIGO...');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Partner-Id': 'gestion_pedidos'
    };

    // 1. Buscar producto por código SHOT000 específico
    console.log('\n1️⃣ Buscando producto SHOT000 directamente...');
    
    try {
      const productResponse = await axios.get(
        'https://api.siigo.com/v1/products',
        {
          headers,
          params: {
            code: 'SHOT000',
            page_size: 100
          }
        }
      );

      if (productResponse.data && productResponse.data.results && productResponse.data.results.length > 0) {
        const product = productResponse.data.results.find(p => p.code === 'SHOT000');
        
        if (product) {
          console.log('✅ Producto SHOT000 encontrado:');
          console.log('📦 INFORMACIÓN COMPLETA DEL PRODUCTO:');
          console.log('=====================================');
          console.log(`🔢 ID SIIGO: ${product.id}`);
          console.log(`📋 Código: ${product.code}`);
          console.log(`📝 Nombre: ${product.name}`);
          console.log(`📄 Descripción: ${product.description || 'N/A'}`);
          console.log(`🔄 Estado: ${product.active ? '✅ ACTIVO' : '❌ INACTIVO'}`);
          console.log(`📊 Tipo: ${product.type || 'N/A'}`);
          console.log(`💰 Precio: $${product.prices?.[0]?.price_list?.[0]?.value || 'N/A'}`);
          console.log(`📦 Stock: ${product.stock_control ? product.available_quantity || 'N/A' : 'Sin control de stock'}`);
          console.log(`🏷️ Categoría: ${product.category?.name || 'N/A'}`);
          console.log(`📈 Control stock: ${product.stock_control ? 'SÍ' : 'NO'}`);
          console.log(`📅 Creado: ${product.created_at || 'N/A'}`);
          console.log(`🔄 Actualizado: ${product.updated_at || 'N/A'}`);
          
          // Mostrar información detallada de precios
          if (product.prices && product.prices.length > 0) {
            console.log('\n💰 PRECIOS CONFIGURADOS:');
            product.prices.forEach((price, index) => {
              console.log(`  📋 Precio ${index + 1}:`);
              if (price.price_list && price.price_list.length > 0) {
                price.price_list.forEach((priceItem, priceIndex) => {
                  console.log(`    💵 Lista ${priceIndex + 1}: $${priceItem.value} (${priceItem.currency_code})`);
                });
              }
            });
          }

          // Información detallada de stock
          if (product.stock_control) {
            console.log('\n📊 INFORMACIÓN DE STOCK:');
            console.log(`📈 Stock disponible: ${product.available_quantity || 0}`);
            console.log(`⚠️ Stock mínimo: ${product.minimum_stock || 'No configurado'}`);
            console.log(`🔝 Stock máximo: ${product.maximum_stock || 'No configurado'}`);
          }

          // Información de categoría si existe
          if (product.category) {
            console.log('\n🏷️ INFORMACIÓN DE CATEGORÍA:');
            console.log(`📋 ID Categoría: ${product.category.id}`);
            console.log(`📝 Nombre Categoría: ${product.category.name}`);
          }

          return {
            encontrado: true,
            activo: product.active,
            producto: product
          };
        }
      }
      
      console.log('❌ Producto SHOT000 no encontrado con búsqueda específica');
      
    } catch (error) {
      console.log('❌ Error buscando producto por código específico:', error.response?.data || error.message);
    }

    // 2. Buscar en lista general de productos
    console.log('\n2️⃣ Buscando SHOT000 en lista general de productos...');
    
    try {
      const allProductsResponse = await axios.get(
        'https://api.siigo.com/v1/products',
        {
          headers,
          params: {
            page_size: 1000
          }
        }
      );

      if (allProductsResponse.data && allProductsResponse.data.results) {
        console.log(`📋 Total productos en SIIGO: ${allProductsResponse.data.results.length}`);
        
        // Buscar SHOT000 exactamente
        const shotProduct = allProductsResponse.data.results.find(p => 
          p.code === 'SHOT000'
        );

        if (shotProduct) {
          console.log('✅ SHOT000 encontrado en lista general:');
          console.log(`🔄 Estado: ${shotProduct.active ? '✅ ACTIVO' : '❌ INACTIVO'}`);
          console.log(`📝 Nombre: ${shotProduct.name}`);
          console.log(`📊 Stock: ${shotProduct.available_quantity || 'N/A'}`);
          
          return {
            encontrado: true,
            activo: shotProduct.active,
            producto: shotProduct
          };
        }

        // Buscar productos similares a SHOT
        const shotRelatedProducts = allProductsResponse.data.results.filter(p => 
          (p.code && p.code.toUpperCase().includes('SHOT')) ||
          (p.name && p.name.toUpperCase().includes('SHOT'))
        );

        if (shotRelatedProducts.length > 0) {
          console.log(`\n🔍 Productos relacionados con "SHOT" (${shotRelatedProducts.length}):`);
          shotRelatedProducts.forEach((prod, index) => {
            console.log(`${index + 1}. Código: ${prod.code} | Nombre: ${prod.name} | Estado: ${prod.active ? 'ACTIVO' : 'INACTIVO'} | Stock: ${prod.available_quantity || 'N/A'}`);
          });
        } else {
          console.log('❌ No se encontraron productos relacionados con "SHOT"');
        }
      }
    } catch (error) {
      console.log('❌ Error consultando lista general:', error.response?.data || error.message);
    }

    // 3. Buscar con variaciones del código
    console.log('\n3️⃣ Probando variaciones del código SHOT000...');
    
    const variaciones = ['SHOT000', 'shot000', 'Shot000', 'SHOT-000', 'SHOT_000', 'SHOTROOM000'];
    
    for (const variacion of variaciones) {
      try {
        console.log(`🔎 Probando: ${variacion}`);
        
        const response = await axios.get(
          'https://api.siigo.com/v1/products',
          {
            headers,
            params: {
              code: variacion,
              page_size: 50
            }
          }
        );

        if (response.data?.results?.length > 0) {
          const found = response.data.results.find(p => p.code === variacion);
          if (found) {
            console.log(`✅ Encontrado con variación ${variacion}:`);
            console.log(`🔄 Estado: ${found.active ? '✅ ACTIVO' : '❌ INACTIVO'}`);
            console.log(`📝 Nombre: ${found.name}`);
            console.log(`📊 Stock: ${found.available_quantity || 'N/A'}`);
            
            return {
              encontrado: true,
              activo: found.active,
              producto: found,
              variacion_encontrada: variacion
            };
          }
        }
      } catch (error) {
        console.log(`❌ Error con ${variacion}: ${error.response?.status || error.message}`);
      }
    }

    return {
      encontrado: false,
      activo: false,
      producto: null
    };

  } catch (error) {
    console.error('❌ Error consultando productos en SIIGO:', error.response?.data || error.message);
    throw error;
  }
}

// Ejecutar consulta principal
consultarProductoSHOT000()
  .then(resultado => {
    console.log('\n🎯 RESUMEN FINAL - PRODUCTO SHOT000 EN SIIGO:');
    console.log('===============================================');
    console.log(`📍 Producto encontrado: ${resultado.encontrado ? '✅ SÍ' : '❌ NO'}`);
    
    if (resultado.encontrado) {
      console.log(`🔄 Estado en SIIGO: ${resultado.activo ? '✅ ACTIVO' : '❌ INACTIVO'}`);
      console.log(`📝 Nombre: ${resultado.producto?.name || 'N/A'}`);
      console.log(`📊 Stock disponible: ${resultado.producto?.available_quantity || 'N/A'}`);
      console.log(`💰 Precio: $${resultado.producto?.prices?.[0]?.price_list?.[0]?.value || 'N/A'}`);
      
      if (resultado.variacion_encontrada) {
        console.log(`🔍 Encontrado como: ${resultado.variacion_encontrada}`);
      }
    } else {
      console.log('❌ El producto SHOT000 NO EXISTE en SIIGO o no se pudo acceder');
      
      if (resultado.error) {
        console.log(`🔍 Error específico: ${resultado.error}`);
      }
    }
    
    console.log('\n� CONCLUSIÓN:');
    if (resultado.encontrado && resultado.activo) {
      console.log('✅ El producto SHOT000 ESTÁ ACTIVO y disponible para facturación en SIIGO');
    } else if (resultado.encontrado && !resultado.activo) {
      console.log('⚠️ El producto SHOT000 EXISTE pero está INACTIVO en SIIGO');
    } else {
      console.log('❌ El producto SHOT000 NO EXISTE en SIIGO');
    }
  })
  .catch(error => {
    console.error('❌ Error crítico en consulta:', error);
  });
