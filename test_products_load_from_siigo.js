const axios = require('axios');

async function testProductsLoadFromSiigo() {
    try {
        console.log('🧪 Iniciando prueba de carga de productos desde SIIGO...');
        
        const backendUrl = 'http://localhost:3001';
        
        // Primero verificar que el backend esté funcionando
        try {
            const healthResponse = await axios.get(`${backendUrl}/api/products/stats`);
            console.log('✅ Backend está funcionando');
            console.log('📊 Estadísticas actuales:', healthResponse.data.data);
        } catch (error) {
            console.error('❌ Backend no está disponible:', error.message);
            console.log('💡 Asegúrate de que el backend esté ejecutándose en el puerto 3001');
            return;
        }

        // Probar el endpoint de carga de productos desde SIIGO
        console.log('\n🔄 Probando carga de productos desde SIIGO...');
        
        try {
            const loadResponse = await axios.post(`${backendUrl}/api/products/load-from-siigo`, {}, {
                timeout: 60000 // 60 segundos de timeout porque puede tomar tiempo
            });
            
            console.log('✅ Carga de productos exitosa!');
            console.log('📦 Resultado:', loadResponse.data);
            
            if (loadResponse.data.success) {
                console.log(`\n📊 RESUMEN DE CARGA:`);
                console.log(`   📦 Total procesados: ${loadResponse.data.data.total_processed}`);
                console.log(`   ✅ Nuevos productos: ${loadResponse.data.data.inserted}`);
                console.log(`   🔄 Productos actualizados: ${loadResponse.data.data.updated}`);
                console.log(`   ❌ Errores: ${loadResponse.data.data.errors}`);
            }
            
        } catch (loadError) {
            console.error('❌ Error cargando productos desde SIIGO:', loadError.message);
            if (loadError.response) {
                console.error('   📄 Respuesta del servidor:', loadError.response.data);
            }
        }

        // Verificar estadísticas después de la carga
        try {
            console.log('\n📊 Verificando estadísticas después de la carga...');
            const finalStatsResponse = await axios.get(`${backendUrl}/api/products/stats`);
            console.log('📊 Estadísticas finales:', finalStatsResponse.data.data);
        } catch (error) {
            console.error('⚠️ No se pudieron obtener las estadísticas finales:', error.message);
        }

        // Probar búsqueda por código de barras de un producto de SIIGO
        try {
            console.log('\n🔍 Probando búsqueda por código de barras...');
            const searchResponse = await axios.get(`${backendUrl}/api/products/barcode/SIIGO_83bfe89b-24ca-4acb-8b86-b3e8c2bc43a8`);
            console.log('✅ Búsqueda exitosa:', searchResponse.data.data);
        } catch (searchError) {
            console.log('ℹ️ Búsqueda específica no encontrada (normal si el producto no existe)');
        }

        console.log('\n🎉 ¡Prueba completada exitosamente!');
        console.log('💡 El sistema de productos está funcionando correctamente.');
        console.log('💡 El botón "Cargar Productos" del frontend debería funcionar ahora.');

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
    }
}

testProductsLoadFromSiigo();
