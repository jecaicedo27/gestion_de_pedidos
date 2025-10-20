const axios = require('axios');
require('dotenv').config();

async function consultarProductoSHOT000() {
  try {
    console.log('🔍 Consultando producto SHOT000 en SIIGO...');
    
    // Configurar headers para autenticación
    const headers = {
      'Authorization': `Bearer ${process.env.SIIGO_TOKEN}`,
      'Content-Type': 'application/json',
      'Partner-Id': process.env.SIIGO_USERNAME || 'gestion_pedidos'
    };
    
    console.log('📡 Headers configurados:', {
      hasToken: !!process.env.SIIGO_TOKEN,
      partnerId: process.env.SIIGO_USERNAME || 'gestion_pedidos'
    });

    // 1. Buscar producto por código SHOT000
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
          console.log('📦 Información completa del producto:');
          console.log('-----------------------------------');
          console.log(`Código: ${product.code}`);
          console.log(`ID: ${product.id}`);
          console.log(`Nombre: ${product.name}`);
          console.log(`Descripción: ${product.description || 'N/A'}`);
          console.log(`Estado: ${product.active ? '✅ ACTIVO' : '❌ INACTIVO'}`);
          console.log(`Tipo: ${product.type || 'N/A'}`);
          console.log(`Precio de venta: $${product.prices?.[0]?.price_list?.[0]?.value || 'N/A'}`);
          console.log(`Stock disponible: ${product.stock_control ? product.available_quantity || 'N/A' : 'Sin control de stock'}`);
          console.log(`Categoria: ${product.category?.name || 'N/A'}`);
          console.log(`Control de stock: ${product.stock_control ? 'SÍ' : 'NO'}`);
          console.log(`Fecha creación: ${product.created_at || 'N/A'}`);
          console.log(`Fecha actualización: ${product.updated_at || 'N/A'}`);
          
          // Mostrar precios detallados si existen
          if (product.prices && product.prices.length > 0) {
            console.log('\n💰 Precios configurados:');
            product.prices.forEach((price, index) => {
              console.log(`  Precio ${index + 1}:`);
              if (price.price_list && price.price_list.length > 0) {
                price.price_list.forEach((priceItem, priceIndex) => {
                  console.log(`    Lista ${priceIndex + 1}: $${priceItem.value} (${priceItem.currency_code})`);
                });
              }
            });
          }

          // Información de stock si aplica
          if (product.stock_control) {
            console.log('\n📊 Información de stock:');
            console.log(`Stock disponible: ${product.available_quantity || 0}`);
            console.log(`Stock mínimo: ${product.minimum_stock || 'No configurado'}`);
            console.log(`Stock máximo: ${product.maximum_stock || 'No configurado'}`);
          }

          // Mostrar JSON completo para análisis
          console.log('\n🔍 JSON completo del producto:');
          console.log('=====================================');
          console.log(JSON.stringify(product, null, 2));
          
          return {
            encontrado: true,
            activo: product.active,
            producto: product
          };
        }
      }
    } catch (error) {
      console.log('❌ Error buscando producto por código específico:', error.response?.data || error.message);
    }

    // 2. Si no se encuentra por código específico, buscar en toda la lista de productos
    console.log('\n2️⃣ Buscando SHOT000 en lista general de productos...');
    
    try {
      const allProductsResponse = await axios.get(
        'https://api.siigo.com/v1/products',
        {
          headers,
          params: {
            page_size: 1000 // Aumentar para buscar más productos
          }
        }
      );

      if (allProductsResponse.data && allProductsResponse.data.results) {
        console.log(`📋 Total productos encontrados: ${allProductsResponse.data.results.length}`);
        
        // Buscar SHOT000 en la lista
        const shotProduct = allProductsResponse.data.results.find(p => 
          p.code && p.code.includes('SHOT000')
        );

        if (shotProduct) {
          console.log('✅ Producto SHOT000 encontrado en lista general:');
          console.log('📦 Información del producto:');
          console.log('-----------------------------------');
          console.log(`Código: ${shotProduct.code}`);
          console.log(`Nombre: ${shotProduct.name}`);
          console.log(`Estado: ${shotProduct.active ? '✅ ACTIVO' : '❌ INACTIVO'}`);
          console.log(`Stock: ${shotProduct.available_quantity || 'N/A'}`);
          
          return {
            encontrado: true,
            activo: shotProduct.active,
            producto: shotProduct
          };
        }

        // Buscar productos con nombres similares a "SHOT"
        const shotRelatedProducts = allProductsResponse.data.results.filter(p => 
          (p.code && p.code.toUpperCase().includes('SHOT')) ||
          (p.name && p.name.toUpperCase().includes('SHOT'))
        );

        if (shotRelatedProducts.length > 0) {
          console.log(`\n🔍 Productos relacionados con "SHOT" encontrados (${shotRelatedProducts.length}):`);
          shotRelatedProducts.forEach((prod, index) => {
            console.log(`${index + 1}. ${prod.code} - ${prod.name} (${prod.active ? 'ACTIVO' : 'INACTIVO'})`);
          });
        } else {
          console.log('❌ No se encontraron productos relacionados con "SHOT"');
        }
      }
    } catch (error) {
      console.log('❌ Error consultando lista general de productos:', error.response?.data || error.message);
    }

    // 3. Intentar búsqueda con diferentes variaciones del código
    console.log('\n3️⃣ Probando variaciones del código SHOT000...');
    
    const variaciones = ['SHOT000', 'shot000', 'Shot000', 'SHOT-000', 'SHOT_000'];
    
    for (const variacion of variaciones) {
      try {
        console.log(`🔎 Probando variación: ${variacion}`);
        
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
            console.log(`Estado: ${found.active ? '✅ ACTIVO' : '❌ INACTIVO'}`);
            console.log(`Nombre: ${found.name}`);
            
            return {
              encontrado: true,
              activo: found.active,
              producto: found,
              variacion_encontrada: variacion
            };
          }
        }
      } catch (error) {
        console.log(`❌ Error con variación ${variacion}:`, error.response?.status || error.message);
      }
    }

    console.log('\n❌ RESULTADO FINAL: Producto SHOT000 NO ENCONTRADO en SIIGO');
    console.log('💡 Posibles causas:');
    console.log('   - El producto no existe en SIIGO');
    console.log('   - El código es diferente');
    console.log('   - Problemas de autenticación');
    console.log('   - El producto fue eliminado');
    
    return {
      encontrado: false,
      activo: false,
      producto: null
    };

  } catch (error) {
    console.error('❌ Error general consultando SIIGO:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔐 ERROR DE AUTENTICACIÓN');
      console.log('Verifica que el token SIIGO sea válido y no haya expirado');
    } else if (error.response?.status === 403) {
      console.log('\n🚫 ERROR DE PERMISOS');
      console.log('El token no tiene permisos para consultar productos');
    }
    
    return {
      encontrado: false,
      activo: false,
      producto: null,
      error: error.message
    };
  }
}

// Ejecutar consulta
consultarProductoSHOT000()
  .then(resultado => {
    console.log('\n🎯 RESUMEN FINAL:');
    console.log('==================');
    console.log(`Producto encontrado: ${resultado.encontrado ? '✅ SÍ' : '❌ NO'}`);
    console.log(`Estado en SIIGO: ${resultado.activo ? '✅ ACTIVO' : '❌ INACTIVO'}`);
    
    if (resultado.variacion_encontrada) {
      console.log(`Encontrado con variación: ${resultado.variacion_encontrada}`);
    }
    
    if (resultado.error) {
      console.log(`Error: ${resultado.error}`);
    }
  })
  .catch(error => {
    console.error('❌ Error ejecutando consulta:', error);
  });
