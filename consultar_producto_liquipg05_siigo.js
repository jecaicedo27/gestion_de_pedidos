const axios = require('axios');

async function consultarProductoSiigo() {
    // SIIGO Authentication - Using correct credentials from backend/.env
    const username = 'COMERCIAL@PERLAS-EXPLOSIVAS.COM';
    const accessKey = 'ODVjN2RlNDItY2I3MS00MmI5LWFiNjItMWM5MDkyZTFjMzY5Oih7IzdDMmU+RVk=';
    
    try {
        console.log('🔐 Autenticando con SIIGO...');
        
        // Authenticate with SIIGO
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: username,
            access_key: accessKey
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación SIIGO exitosa');

        // Headers with the correct Partner-Id that works
        const headers = {
            'Authorization': token,
            'Content-Type': 'application/json',
            'Partner-Id': 'api'  // This is the correct Partner-Id that works!
        };

        console.log('🔍 Consultando producto LIQUIPG05...');

        // Try to get specific product by code
        const productResponse = await axios.get('https://api.siigo.com/v1/products?code=LIQUIPG05', {
            headers: headers
        });

        if (productResponse.data && productResponse.data.results && productResponse.data.results.length > 0) {
            const product = productResponse.data.results[0];
            
            console.log('\n🎉 PRODUCTO ENCONTRADO - LIQUIPG05');
            console.log('================================================================================');
            console.log('📋 JSON COMPLETO DEL PRODUCTO:');
            console.log(JSON.stringify(product, null, 2));
            
            console.log('\n📊 ESTRUCTURA DE CAMPOS:');
            console.log('================================================================================');
            Object.keys(product).forEach(key => {
                const value = product[key];
                const type = Array.isArray(value) ? 'ARRAY' : typeof value === 'object' && value !== null ? 'OBJECT' : typeof value;
                console.log(`${key.padEnd(30)} -> ${type.padEnd(10)} | ${JSON.stringify(value).substring(0, 100)}...`);
            });

        } else {
            console.log('❌ No se encontró el producto con código LIQUIPG05');
            console.log('Respuesta completa:', JSON.stringify(productResponse.data, null, 2));
        }

        // Also try to get products by searching in general list
        console.log('\n🔍 Buscando en listado general de productos...');
        const generalResponse = await axios.get('https://api.siigo.com/v1/products?page=1&page_size=100', {
            headers: headers
        });

        if (generalResponse.data && generalResponse.data.results) {
            console.log(`\n📦 Total productos encontrados: ${generalResponse.data.results.length}`);
            
            // Look for LIQUIPG05 in the results
            const foundProduct = generalResponse.data.results.find(p => p.code === 'LIQUIPG05');
            
            if (foundProduct) {
                console.log('\n🎯 PRODUCTO LIQUIPG05 ENCONTRADO EN LISTADO:');
                console.log('================================================================================');
                console.log(JSON.stringify(foundProduct, null, 2));
            } else {
                console.log('\n❌ LIQUIPG05 no encontrado en el listado general');
                console.log('\n📋 Códigos de productos disponibles (primeros 20):');
                generalResponse.data.results.slice(0, 20).forEach(p => {
                    console.log(`- ${p.code} | ${p.name}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Error en consulta:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

consultarProductoSiigo();
