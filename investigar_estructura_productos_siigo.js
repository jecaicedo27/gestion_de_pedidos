require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function investigarProductosSiigo() {
    console.log('🔍 INVESTIGANDO ESTRUCTURA REAL DE PRODUCTOS EN SIIGO');
    
    const username = process.env.SIIGO_API_USERNAME;
    const accessKey = process.env.SIIGO_API_ACCESS_KEY;
    
    try {
        // Autenticar
        console.log('🔐 Autenticando con SIIGO...');
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
        
        // Probar diferentes variaciones del endpoint de productos
        const productEndpoints = [
            '/v1/products',
            '/v1/products?created_start=2020-01-01',
            '/v1/products?page=1&page_size=5',
            '/v1/products?created_start=2020-01-01&page=1&page_size=5'
        ];
        
        console.log('🧪 Probando endpoints de productos...');
        
        for (const endpoint of productEndpoints) {
            try {
                console.log(`\n🔍 Probando: ${endpoint}`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Delay para rate limiting
                
                const response = await axios.get(`https://api.siigo.com${endpoint}`, {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'gestion_pedidos'
                    },
                    timeout: 30000
                });
                
                console.log(`✅ ÉXITO - Status: ${response.status}`);
                console.log(`📊 Total resultados: ${response.data?.pagination?.total_results || 'N/A'}`);
                console.log(`📄 Resultados en página: ${response.data?.results?.length || 0}`);
                
                if (response.data?.results?.length > 0) {
                    console.log('\n📦 ESTRUCTURA DEL PRIMER PRODUCTO:');
                    console.log('=' .repeat(60));
                    console.log(JSON.stringify(response.data.results[0], null, 2));
                    console.log('=' .repeat(60));
                    
                    // Analizar todos los campos disponibles
                    const product = response.data.results[0];
                    console.log('\n🔍 CAMPOS DISPONIBLES EN EL PRODUCTO:');
                    console.log('─' .repeat(40));
                    
                    function analyzeObject(obj, prefix = '') {
                        Object.keys(obj).forEach(key => {
                            const value = obj[key];
                            const fullKey = prefix ? `${prefix}.${key}` : key;
                            
                            if (value === null) {
                                console.log(`${fullKey}: null`);
                            } else if (typeof value === 'object' && !Array.isArray(value)) {
                                console.log(`${fullKey}: (object)`);
                                analyzeObject(value, fullKey);
                            } else if (Array.isArray(value)) {
                                console.log(`${fullKey}: (array with ${value.length} items)`);
                                if (value.length > 0 && typeof value[0] === 'object') {
                                    console.log(`  └─ First item structure:`);
                                    analyzeObject(value[0], `${fullKey}[0]`);
                                }
                            } else {
                                console.log(`${fullKey}: ${typeof value} (${value})`);
                            }
                        });
                    }
                    
                    analyzeObject(product);
                    
                    // Obtener algunos productos más para análisis
                    if (response.data.results.length > 1) {
                        console.log('\n🔍 ANALIZANDO VARIACIONES EN OTROS PRODUCTOS:');
                        console.log('─' .repeat(50));
                        
                        for (let i = 1; i < Math.min(3, response.data.results.length); i++) {
                            const otherProduct = response.data.results[i];
                            console.log(`\nProducto ${i + 1}: ${otherProduct.name || otherProduct.id}`);
                            
                            // Verificar campos únicos en este producto
                            Object.keys(otherProduct).forEach(key => {
                                if (!product.hasOwnProperty(key)) {
                                    console.log(`  + Campo único: ${key} = ${otherProduct[key]}`);
                                }
                            });
                        }
                    }
                }
                
                // Si encontramos productos, salir del loop
                if (response.data?.results?.length > 0) {
                    break;
                }
                
            } catch (error) {
                if (error.response?.status === 400) {
                    console.log(`❌ ${endpoint} - 400 Bad Request`);
                    if (error.response.data) {
                        console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
                    }
                } else if (error.response?.status === 404) {
                    console.log(`❌ ${endpoint} - 404 Not Found`);
                } else if (error.response?.status === 429) {
                    console.log(`⏳ ${endpoint} - Rate Limited`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else {
                    console.log(`❌ ${endpoint} - Status: ${error.response?.status || 'Error'} - ${error.message}`);
                }
            }
        }
        
    } catch (error) {
        console.log('❌ Error de autenticación:', error.message);
    }
}

investigarProductosSiigo().catch(console.error);
