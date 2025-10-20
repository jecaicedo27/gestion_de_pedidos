require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function testSiigoEndpoints() {
    console.log('🔍 DESCUBRIENDO ENDPOINTS DISPONIBLES EN SIIGO API');
    
    const username = process.env.SIIGO_API_USERNAME;
    const accessKey = process.env.SIIGO_API_ACCESS_KEY;
    
    try {
        // Autenticar
        console.log('🔐 Autenticando...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: username,
            access_key: accessKey
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Partner-Id': 'gestion_pedidos'
            },
            timeout: 30000
        });
        
        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');
        
        // Lista de endpoints para probar
        const endpointsToTest = [
            // Categorías/Tipos de productos
            '/v1/product-types',
            '/v1/product_types', 
            '/v1/categories',
            '/v1/item-types',
            '/v1/item_types',
            '/v1/item-categories',
            '/v1/item_categories',
            '/v1/types',
            
            // Productos
            '/v1/products?page_size=1',
            '/v1/items?page_size=1',
            
            // Otros endpoints comunes
            '/v1/users',
            '/v1/document-types',
            '/v1/document_types',
            '/v1/customers?page_size=1',
            '/v1/taxes',
            '/v1/warehouses'
        ];
        
        console.log('🧪 Probando endpoints...');
        
        for (const endpoint of endpointsToTest) {
            try {
                await new Promise(resolve => setTimeout(resolve, 1500)); // Delay para rate limiting
                
                const response = await axios.get(`https://api.siigo.com${endpoint}`, {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'gestion_pedidos'
                    },
                    timeout: 15000
                });
                
                console.log(`✅ ${endpoint} - Status: ${response.status} - Results: ${response.data?.results?.length || 'N/A'}`);
                
                // Si encontramos un endpoint que parece ser para tipos/categorías, mostrar estructura
                if (endpoint.includes('type') || endpoint.includes('categor')) {
                    if (response.data?.results?.length > 0) {
                        console.log(`   📋 Estructura del primer elemento:`, JSON.stringify(response.data.results[0], null, 2));
                    }
                }
                
                // Si es productos, mostrar estructura también
                if (endpoint.includes('product') || endpoint.includes('item')) {
                    if (response.data?.results?.length > 0) {
                        console.log(`   📦 Estructura del primer producto:`, JSON.stringify(response.data.results[0], null, 2));
                    }
                }
                
            } catch (error) {
                if (error.response?.status === 404) {
                    console.log(`❌ ${endpoint} - 404 Not Found`);
                } else if (error.response?.status === 429) {
                    console.log(`⏳ ${endpoint} - Rate Limited`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    console.log(`❌ ${endpoint} - Status: ${error.response?.status || 'Error'} - ${error.message}`);
                }
            }
        }
        
    } catch (error) {
        console.log('❌ Error de autenticación:', error.message);
    }
}

testSiigoEndpoints().catch(console.error);
