const axios = require('axios');

async function testCategoriesAPI() {
    console.log('🧪 PROBANDO API DE CATEGORÍAS DESPUÉS DEL REINICIO');
    console.log('===============================================');
    
    try {
        console.log('\n🔗 Probando API endpoint: http://localhost:3001/api/products/categories');
        
        const response = await axios.get('http://localhost:3001/api/products/categories');
        
        console.log(`✅ Status: ${response.status}`);
        console.log(`📊 Categorías recibidas: ${response.data.length}`);
        
        console.log('\n📋 RESPUESTA DE LA API:');
        response.data.forEach((cat, index) => {
            const status = cat.productos > 0 ? '✅' : '⚠️';
            console.log(`${index + 1}. ${status} ${cat.categoria}: ${cat.productos} productos`);
        });

        // Check YEXIS in API response
        const yexisInAPI = response.data.find(cat => cat.categoria === 'YEXIS');
        if (yexisInAPI) {
            console.log(`\n🎯 YEXIS en API: ${yexisInAPI.productos} productos`);
        } else {
            console.log('\n❌ YEXIS no encontrada en respuesta API');
        }

        console.log('\n📊 ANÁLISIS DE RESULTADOS:');
        
        const categoriesWithProducts = response.data.filter(cat => cat.productos > 0);
        console.log(`✅ Total categorías disponibles: ${response.data.length}`);
        console.log(`✅ Categorías con productos: ${categoriesWithProducts.length}`);
        
        if (response.data.length >= 16) {
            console.log('✅ Las 16 categorías están disponibles');
        } else {
            console.log(`⚠️ Solo ${response.data.length} categorías disponibles (esperadas: 16)`);
        }

        if (yexisInAPI && yexisInAPI.productos >= 27) {
            console.log('✅ YEXIS tiene productos asignados correctamente');
        } else {
            console.log(`⚠️ YEXIS tiene ${yexisInAPI ? yexisInAPI.productos : 0} productos (esperados: 27)`);
        }

        // Categories that should have products
        const expectedCategoriesWithProducts = [
            'LIQUIPOPS',
            'YEXIS', 
            'Materia prima gravadas 19%',
            'MEZCLAS EN POLVO',
            'Productos No fabricados 19%',
            'GENIALITY',
            'VENTA PROPIEDAD PLANTA Y EQUIPO NUEVO',
            'Servicios'
        ];

        console.log('\n🔍 VERIFICANDO CATEGORÍAS ESPECÍFICAS:');
        expectedCategoriesWithProducts.forEach(catName => {
            const cat = response.data.find(c => c.categoria === catName);
            if (cat) {
                const status = cat.productos > 0 ? '✅' : '⚠️';
                console.log(`${status} ${catName}: ${cat.productos} productos`);
            } else {
                console.log(`❌ ${catName}: NO ENCONTRADA`);
            }
        });

        console.log('\n🎉 PRUEBA COMPLETADA');
        console.log('📱 El frontend ahora debería mostrar todas las categorías con productos');
        console.log('🌐 Acceda a: http://localhost:3000/products');

        // Final summary
        console.log('\n📋 RESUMEN FINAL:');
        console.log(`🔢 Categorías totales: ${response.data.length}`);
        console.log(`✅ Categorías con productos: ${categoriesWithProducts.length}`);
        console.log(`🎯 YEXIS productos: ${yexisInAPI ? yexisInAPI.productos : 0}`);
        
        const success = response.data.length >= 16 && yexisInAPI && yexisInAPI.productos >= 27;
        console.log(`🚀 Estado general: ${success ? '✅ EXITOSO' : '⚠️ NECESITA REVISIÓN'}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📊 Response status:', error.response.status);
            console.error('📊 Response data:', error.response.data);
        }
        console.log('\n🔧 Posibles soluciones:');
        console.log('1. Verificar que el backend esté ejecutándose en puerto 3001');
        console.log('2. Verificar la conexión a la base de datos');
        console.log('3. Verificar que las categorías estén configuradas correctamente');
    }
}

testCategoriesAPI();
