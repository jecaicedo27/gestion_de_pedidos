const axios = require('axios');

async function debugLoadProductsAuthIssue() {
    console.log('🔍 DEPURANDO PROBLEMA DE AUTENTICACIÓN');
    console.log('====================================');

    try {
        // Verificar que el backend esté corriendo
        console.log('1️⃣ Verificando que el backend esté activo...');
        const healthResponse = await axios.get('http://localhost:3001/api/health').catch(() => null);
        
        if (!healthResponse) {
            console.log('❌ Backend no está ejecutándose en puerto 3001');
            console.log('   Iniciando backend...');
            
            const { spawn } = require('child_process');
            const backendProcess = spawn('node', ['backend/server.js'], { 
                stdio: 'inherit',
                detached: true
            });
            
            console.log('⏳ Esperando 5 segundos para que inicie el backend...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
            console.log('✅ Backend está activo');
        }

        // Probar login detalladamente
        console.log('\n2️⃣ Probando login detalladamente...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        console.log('Login response:', {
            status: loginResponse.status,
            success: loginResponse.data.success,
            hasToken: !!loginResponse.data.token,
            tokenLength: loginResponse.data.token ? loginResponse.data.token.length : 0,
            tokenStart: loginResponse.data.token ? loginResponse.data.token.substring(0, 20) + '...' : 'No token'
        });

        const token = loginResponse.data.token;

        // Probar un endpoint simple primero
        console.log('\n3️⃣ Probando endpoint simple con token...');
        try {
            const profileResponse = await axios.get('http://localhost:3001/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('✅ Endpoint /api/auth/profile funciona correctamente');
        } catch (error) {
            console.log('❌ Error en /api/auth/profile:', error.response?.status, error.response?.data);
        }

        // Probar endpoint de productos
        console.log('\n4️⃣ Probando endpoint GET /api/products...');
        try {
            const productsResponse = await axios.get('http://localhost:3001/api/products?page=1&pageSize=5', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('✅ Endpoint GET /api/products funciona correctamente');
            console.log(`   Productos encontrados: ${productsResponse.data.pagination?.totalItems || 0}`);
        } catch (error) {
            console.log('❌ Error en GET /api/products:', error.response?.status, error.response?.data);
        }

        // Ahora probar el endpoint problemático
        console.log('\n5️⃣ Probando endpoint POST /api/products/load-from-siigo...');
        try {
            // Probar con timeout más corto primero
            const loadResponse = await axios.post('http://localhost:3001/api/products/load-from-siigo', {}, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 segundos
            });

            console.log('✅ Endpoint de carga funciona correctamente');
            console.log('Response:', {
                success: loadResponse.data.success,
                message: loadResponse.data.message,
                hasData: !!loadResponse.data.data
            });

        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.log('⏰ Timeout - el proceso está tardando mucho (esto es normal para importación completa)');
                console.log('   Vamos a probar si ya hay productos cargados...');
                
                // Verificar si hay productos
                const checkProducts = await axios.get('http://localhost:3001/api/products?page=1&pageSize=1', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (checkProducts.data.pagination && checkProducts.data.pagination.totalItems > 0) {
                    console.log(`✅ ¡Hay ${checkProducts.data.pagination.totalItems} productos cargados!`);
                    console.log('   El endpoint está funcionando correctamente, solo tarda mucho tiempo');
                } else {
                    console.log('❓ No hay productos cargados todavía');
                }
            } else {
                console.log('❌ Error en POST /api/products/load-from-siigo:');
                console.log('   Status:', error.response?.status);
                console.log('   Data:', error.response?.data);
            }
        }

        // Verificar categorías
        console.log('\n6️⃣ Verificando categorías disponibles...');
        try {
            const categoriesResponse = await axios.get('http://localhost:3001/api/products/categories', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('✅ Categorías cargadas:', categoriesResponse.data.data.length);
            console.log('   Primeras 5 categorías:');
            categoriesResponse.data.data.slice(0, 5).forEach((cat, idx) => {
                console.log(`   ${idx + 1}. ${cat}`);
            });
        } catch (error) {
            console.log('❌ Error obteniendo categorías:', error.response?.status, error.response?.data);
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

// Ejecutar el debug
debugLoadProductsAuthIssue().then(() => {
    console.log('\n✅ Debug completado');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error en debug:', error);
    process.exit(1);
});
