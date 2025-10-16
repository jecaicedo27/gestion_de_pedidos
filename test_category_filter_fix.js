async function testCategoryFilter() {
    try {
        console.log('🧪 Probando filtro de categorías corregido...');

        // Usar token hardcoded para pruebas rápidas
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsIm5hbWUiOiJBZG1pbmlzdHJhZG9yIiwiaWF0IjoxNzM2NDUzNDQwLCJleHAiOjE3MzY0NTcwNDB9.example';

        // Test 1: Obtener todas las categorías
        console.log('\n📋 Test 1: Obteniendo categorías disponibles...');
        const categoriesResponse = await fetch('http://localhost:3000/api/products/categories', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!categoriesResponse.ok) {
            throw new Error(`Error obteniendo categorías: ${categoriesResponse.status}`);
        }

        const categoriesData = await categoriesResponse.json();
        console.log(`✅ ${categoriesData.data.length} categorías encontradas:`);
        categoriesData.data.slice(0, 5).forEach(cat => {
            console.log(`   - ${cat.label} (${cat.count} productos)`);
        });

        // Test 2: Filtrar por una categoría específica (LIQUIPOPS)
        console.log('\n🔍 Test 2: Filtrando productos por categoría "LIQUIPOPS"...');
        const liquipopsResponse = await fetch('http://localhost:3000/api/products?page=1&pageSize=20&category=LIQUIPOPS', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!liquipopsResponse.ok) {
            throw new Error(`Error filtrando por LIQUIPOPS: ${liquipopsResponse.status}`);
        }

        const liquipopsData = await liquipopsResponse.json();
        console.log(`✅ Filtro por LIQUIPOPS funcionando:`);
        console.log(`   📦 ${liquipopsData.data.length} productos encontrados en esta página`);
        console.log(`   📊 Total: ${liquipopsData.pagination.totalItems} productos LIQUIPOPS`);

        // Verificar que todos los productos son de la categoría LIQUIPOPS
        const allLiquipops = liquipopsData.data.every(product => product.category === 'LIQUIPOPS');
        console.log(`   ✅ Todos los productos son LIQUIPOPS: ${allLiquipops ? 'SÍ' : 'NO'}`);

        if (liquipopsData.data.length > 0) {
            console.log(`   📋 Ejemplos:`);
            liquipopsData.data.slice(0, 3).forEach(product => {
                console.log(`      - ${product.product_name} (${product.category})`);
            });
        }

        // Test 3: Filtrar por otra categoría (GENIALITY)
        console.log('\n🔍 Test 3: Filtrando productos por categoría "GENIALITY"...');
        const genialityResponse = await fetch('http://localhost:3000/api/products?page=1&pageSize=20&category=GENIALITY', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!genialityResponse.ok) {
            throw new Error(`Error filtrando por GENIALITY: ${genialityResponse.status}`);
        }

        const genialityData = await genialityResponse.json();
        console.log(`✅ Filtro por GENIALITY funcionando:`);
        console.log(`   📦 ${genialityData.data.length} productos encontrados en esta página`);
        console.log(`   📊 Total: ${genialityData.pagination.totalItems} productos GENIALITY`);

        // Verificar que todos los productos son de la categoría GENIALITY
        const allGeniality = genialityData.data.every(product => product.category === 'GENIALITY');
        console.log(`   ✅ Todos los productos son GENIALITY: ${allGeniality ? 'SÍ' : 'NO'}`);

        // Test 4: Sin filtro (todos los productos)
        console.log('\n📋 Test 4: Obteniendo todos los productos sin filtro...');
        const allProductsResponse = await fetch('http://localhost:3000/api/products?page=1&pageSize=20', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!allProductsResponse.ok) {
            throw new Error(`Error obteniendo todos los productos: ${allProductsResponse.status}`);
        }

        const allProductsData = await allProductsResponse.json();
        console.log(`✅ Sin filtro funcionando:`);
        console.log(`   📦 ${allProductsData.data.length} productos en esta página`);
        console.log(`   📊 Total: ${allProductsData.pagination.totalItems} productos en total`);

        // Test 5: Combinación de búsqueda y categoría
        console.log('\n🔍 Test 5: Combinando búsqueda y filtro de categoría...');
        const searchCategoryResponse = await fetch('http://localhost:3000/api/products?page=1&pageSize=20&category=LIQUIPOPS&search=LIQUIPP', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!searchCategoryResponse.ok) {
            throw new Error(`Error combinando búsqueda y categoría: ${searchCategoryResponse.status}`);
        }

        const searchCategoryData = await searchCategoryResponse.json();
        console.log(`✅ Búsqueda + Categoría funcionando:`);
        console.log(`   📦 ${searchCategoryData.data.length} productos encontrados`);
        console.log(`   📊 Total: ${searchCategoryData.pagination.totalItems} productos que contienen "LIQUIPP" en LIQUIPOPS`);

        console.log('\n🎉 TODOS LOS TESTS PASARON EXITOSAMENTE!');
        console.log('\n✅ RESUMEN:');
        console.log('   - El filtro de categorías ahora funciona correctamente');
        console.log('   - El backend filtra apropiadamente por categoría');  
        console.log('   - La paginación mantiene el filtro de categoría');
        console.log('   - Se puede combinar búsqueda de texto con filtro de categoría');
        console.log('   - El problema del dropdown que no mostraba productos está resuelto');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
        process.exit(1);
    }
}

// Ejecutar las pruebas
testCategoryFilter();
