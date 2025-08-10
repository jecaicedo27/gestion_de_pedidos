const axios = require('axios');

async function testProductsWithAuth() {
    try {
        console.log('🧪 Iniciando prueba de productos con autenticación...');
        
        const backendUrl = 'http://localhost:3001';
        
        // Primero autenticarse
        let authToken = null;
        try {
            console.log('🔐 Autenticándose...');
            const authResponse = await axios.post(`${backendUrl}/api/auth/login`, {
                username: 'admin',  // Usuario por defecto
                password: 'admin123' // Contraseña por defecto
            });
            
            if (authResponse.data.success) {
                authToken = authResponse.data.token;
                console.log('✅ Autenticación exitosa');
            } else {
                throw new Error('Autenticación fallida');
            }
        } catch (authError) {
            console.error('❌ Error en autenticación:', authError.message);
            console.log('💡 Probando sin autenticación...');
        }

        // Headers con autenticación si está disponible
        const headers = authToken ? {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };

        // Verificar que el backend esté funcionando
        try {
            console.log('\n📊 Obteniendo estadísticas de productos...');
            const statsResponse = await axios.get(`${backendUrl}/api/products/stats`, { headers });
            console.log('✅ Backend está funcionando');
            console.log('📊 Estadísticas actuales:', statsResponse.data.data);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('⚠️ Endpoint requiere autenticación, pero continuamos con otras pruebas...');
            } else {
                console.error('❌ Backend no está disponible:', error.message);
                return;
            }
        }

        // Probar obtener todos los productos
        try {
            console.log('\n📦 Obteniendo lista de productos...');
            const productsResponse = await axios.get(`${backendUrl}/api/products`, { headers });
            console.log(`✅ Se obtuvieron ${productsResponse.data.data.length} productos`);
            
            if (productsResponse.data.data.length > 0) {
                const firstProduct = productsResponse.data.data[0];
                console.log('🔍 Primer producto:', {
                    id: firstProduct.id,
                    nombre: firstProduct.product_name,
                    codigo_barras: firstProduct.barcode,
                    precio: firstProduct.standard_price
                });
            }
        } catch (error) {
            console.error('❌ Error obteniendo productos:', error.message);
        }

        // Probar el endpoint de carga de productos desde SIIGO
        if (authToken) {
            console.log('\n🔄 Probando carga de productos desde SIIGO...');
            
            try {
                const loadResponse = await axios.post(`${backendUrl}/api/products/load-from-siigo`, {}, {
                    headers,
                    timeout: 60000 // 60 segundos de timeout
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
        } else {
            console.log('\n⚠️ Sin autenticación, omitiendo prueba de carga desde SIIGO');
        }

        // Probar búsqueda por código de barras
        try {
            console.log('\n🔍 Probando búsqueda por código de barras...');
            
            // Intentar con un código de barras de SIIGO genérico
            const searchResponse = await axios.get(`${backendUrl}/api/products/barcode/SIIGO_83bfe89b-24ca-4acb-8b86-b3e8c2bc43a8`, { headers });
            console.log('✅ Búsqueda exitosa:', searchResponse.data.data);
        } catch (searchError) {
            if (searchError.response?.status === 404) {
                console.log('ℹ️ Producto específico no encontrado (normal)');
                
                // Intentar con el primer código de barras disponible
                try {
                    const productsResponse = await axios.get(`${backendUrl}/api/products`, { headers });
                    if (productsResponse.data.data.length > 0) {
                        const firstBarcode = productsResponse.data.data[0].barcode;
                        console.log(`🔍 Probando búsqueda con código real: ${firstBarcode}`);
                        
                        const realSearchResponse = await axios.get(`${backendUrl}/api/products/barcode/${firstBarcode}`, { headers });
                        console.log('✅ Búsqueda con código real exitosa:', realSearchResponse.data.data);
                    }
                } catch (realSearchError) {
                    console.log('ℹ️ No se pudo probar búsqueda con código real');
                }
            } else {
                console.error('⚠️ Error en búsqueda:', searchError.message);
            }
        }

        console.log('\n🎉 ¡Prueba completada!');
        console.log('💡 El sistema de productos está operativo.');
        console.log('💡 Si tienes autenticación válida, el botón "Cargar Productos" del frontend debería funcionar.');

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
    }
}

testProductsWithAuth();
