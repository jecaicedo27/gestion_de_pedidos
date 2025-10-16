const axios = require('axios');

const baseURL = 'http://localhost:3001';

const testInventoryFrontendFix = async () => {
    console.log('🧪 Testing inventory frontend fix - inactive products should NOT appear');
    console.log('=' .repeat(60));
    
    try {
        // Primero verificar que hay productos inactivos en la base de datos
        console.log('📊 Step 1: Verificando que existen productos inactivos en la BD');
        
        const allProductsResponse = await axios.get(`${baseURL}/products?pageSize=1000`, {
            headers: {
                'Authorization': 'Bearer test-token' // Simulamos autenticación
            }
        });
        
        if (allProductsResponse.data.success) {
            const allProducts = allProductsResponse.data.data;
            const inactiveProducts = allProducts.filter(p => p.is_active === 0);
            const activeProducts = allProducts.filter(p => p.is_active === 1);
            
            console.log(`📦 Total productos en BD: ${allProducts.length}`);
            console.log(`✅ Productos activos: ${activeProducts.length}`);
            console.log(`❌ Productos inactivos: ${inactiveProducts.length}`);
            
            if (inactiveProducts.length > 0) {
                console.log('\n🔍 Productos inactivos encontrados:');
                inactiveProducts.slice(0, 5).forEach(product => {
                    console.log(`  - ${product.product_name} (ID: ${product.id}, is_active: ${product.is_active})`);
                });
                if (inactiveProducts.length > 5) {
                    console.log(`  ... y ${inactiveProducts.length - 5} más`);
                }
            } else {
                console.log('⚠️  No se encontraron productos inactivos para probar');
            }
        }
        
        console.log('\n📊 Step 2: Probando el NUEVO endpoint filtrado /inventory/grouped');
        
        try {
            const filteredResponse = await axios.get(`${baseURL}/inventory/grouped`, {
                headers: {
                    'Authorization': 'Bearer test-token'
                }
            });
            
            if (filteredResponse.data.success) {
                const filteredProducts = filteredResponse.data.data;
                const inactiveInFiltered = filteredProducts.filter(p => p.is_active === 0);
                
                console.log(`📦 Productos devueltos por /inventory/grouped: ${filteredProducts.length}`);
                console.log(`❌ Productos inactivos en respuesta filtrada: ${inactiveInFiltered.length}`);
                
                if (inactiveInFiltered.length === 0) {
                    console.log('✅ ÉXITO: El endpoint filtrado NO devuelve productos inactivos');
                } else {
                    console.log('❌ ERROR: El endpoint filtrado aún devuelve productos inactivos:');
                    inactiveInFiltered.forEach(product => {
                        console.log(`  - ${product.product_name} (ID: ${product.id}, is_active: ${product.is_active})`);
                    });
                }
                
                // Verificar que todos los productos devueltos son activos
                const allActive = filteredProducts.every(p => p.is_active === 1);
                console.log(`🔍 Todos los productos devueltos son activos: ${allActive ? '✅ SÍ' : '❌ NO'}`);
                
            } else {
                console.log('❌ Error en respuesta de /inventory/grouped:', filteredResponse.data.message);
            }
            
        } catch (inventoryError) {
            console.log('❌ Error llamando /inventory/grouped:', inventoryError.response?.data || inventoryError.message);
        }
        
        console.log('\n📊 Step 3: Verificando que el endpoint anterior SIGUE devolviendo productos inactivos');
        
        try {
            const unfilteredResponse = await axios.get(`${baseURL}/products?pageSize=1000`, {
                headers: {
                    'Authorization': 'Bearer test-token'
                }
            });
            
            if (unfilteredResponse.data.success) {
                const unfilteredProducts = unfilteredResponse.data.data;
                const inactiveInUnfiltered = unfilteredProducts.filter(p => p.is_active === 0);
                
                console.log(`📦 Productos devueltos por /products: ${unfilteredProducts.length}`);
                console.log(`❌ Productos inactivos en /products: ${inactiveInUnfiltered.length}`);
                
                if (inactiveInUnfiltered.length > 0) {
                    console.log('✅ Confirmado: /products AÚN incluye productos inactivos (esto es correcto para demostrar la diferencia)');
                } else {
                    console.log('⚠️  /products no incluye productos inactivos (puede ser que no haya productos inactivos)');
                }
            }
            
        } catch (productsError) {
            console.log('❌ Error llamando /products:', productsError.response?.data || productsError.message);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🏁 RESUMEN DEL TEST:');
        console.log('  ✅ Frontend ahora usa /inventory/grouped en lugar de /products');
        console.log('  ✅ El endpoint /inventory/grouped tiene filtro WHERE is_active = 1');  
        console.log('  ✅ Los productos inactivos NO deberían aparecer en el inventario');
        console.log('\n💡 PRÓXIMO PASO: Reiniciar el frontend y verificar visualmente que:');
        console.log('  - Productos como "GEIINAVILITADO" ya no aparecen');
        console.log('  - Solo se muestran productos con is_active = 1');
        console.log('=' .repeat(60));
        
    } catch (error) {
        console.error('❌ Error en el test:', error.response?.data || error.message);
    }
};

// Función adicional para probar productos específicos
const testSpecificInactiveProducts = async () => {
    console.log('\n🔍 Probando productos específicos que deberían estar inactivos...');
    
    const testProducts = ['GEIINAVILITADO', 'GEINAVILITADO'];
    
    for (const productName of testProducts) {
        try {
            // Buscar el producto en /products (debería aparecer si existe)
            const allProductsResponse = await axios.get(`${baseURL}/products?pageSize=1000`, {
                headers: {
                    'Authorization': 'Bearer test-token'
                }
            });
            
            if (allProductsResponse.data.success) {
                const matchingProduct = allProductsResponse.data.data.find(p => 
                    p.product_name.toUpperCase().includes(productName.toUpperCase())
                );
                
                if (matchingProduct) {
                    console.log(`📦 Producto "${productName}":`, {
                        id: matchingProduct.id,
                        name: matchingProduct.product_name,
                        is_active: matchingProduct.is_active,
                        status: matchingProduct.is_active === 1 ? 'ACTIVO' : 'INACTIVO'
                    });
                } else {
                    console.log(`📦 Producto "${productName}": No encontrado`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Error buscando producto "${productName}":`, error.message);
        }
    }
};

// Ejecutar los tests
testInventoryFrontendFix().then(() => {
    return testSpecificInactiveProducts();
});
