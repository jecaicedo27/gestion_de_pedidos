require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function testSiigoSinPartnerId() {
    console.log('🔍 PROBANDO API SIIGO SIN PARTNER-ID Y CON DIFERENTES OPCIONES');
    
    const username = process.env.SIIGO_API_USERNAME;
    const accessKey = process.env.SIIGO_API_ACCESS_KEY;
    
    try {
        // Autenticar SIN Partner-Id
        console.log('🔐 Autenticando SIN Partner-Id...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: username,
            access_key: accessKey
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');
        
        // Probar productos sin Partner-Id
        console.log('\n🧪 Probando /v1/products SIN Partner-Id...');
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const response = await axios.get('https://api.siigo.com/v1/products?created_start=2020-01-01&page=1&page_size=5', {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            
            console.log(`✅ ÉXITO SIN Partner-Id - Status: ${response.status}`);
            console.log(`📊 Total resultados: ${response.data?.pagination?.total_results || 'N/A'}`);
            console.log(`📄 Resultados en página: ${response.data?.results?.length || 0}`);
            
            if (response.data?.results?.length > 0) {
                console.log('\n📦 ESTRUCTURA DEL PRIMER PRODUCTO:');
                console.log('=' .repeat(80));
                console.log(JSON.stringify(response.data.results[0], null, 2));
                console.log('=' .repeat(80));
                
                // Extraer todos los campos del primer producto para crear la estructura de BD
                const product = response.data.results[0];
                console.log('\n🗃️  CAMPOS PARA LA TABLA DE PRODUCTOS:');
                console.log('─' .repeat(60));
                
                function extractFields(obj, prefix = '') {
                    const fields = [];
                    Object.keys(obj).forEach(key => {
                        const value = obj[key];
                        const fullKey = prefix ? `${prefix}_${key}` : key;
                        
                        if (value === null) {
                            fields.push(`${fullKey}: NULL`);
                        } else if (typeof value === 'object' && !Array.isArray(value)) {
                            // Objeto anidado - extraer campos
                            const nestedFields = extractFields(value, fullKey);
                            fields.push(...nestedFields);
                        } else if (Array.isArray(value)) {
                            fields.push(`${fullKey}: JSON (array)`);
                            if (value.length > 0 && typeof value[0] === 'object') {
                                console.log(`   └─ ${fullKey} array structure:`, Object.keys(value[0]).join(', '));
                            }
                        } else {
                            const type = typeof value === 'string' ? `VARCHAR(${Math.max(255, value.length + 50)})` :
                                        typeof value === 'number' ? 'DECIMAL(15,2)' :
                                        typeof value === 'boolean' ? 'BOOLEAN' : 'TEXT';
                            fields.push(`${fullKey}: ${type} (${value})`);
                        }
                    });
                    return fields;
                }
                
                const fields = extractFields(product);
                fields.forEach(field => console.log(field));
                
                console.log('\n🔍 ANÁLISIS DE MÚLTIPLES PRODUCTOS:');
                const allFields = new Set();
                response.data.results.forEach((prod, idx) => {
                    console.log(`\nProducto ${idx + 1}: ${prod.name} (${prod.id})`);
                    Object.keys(prod).forEach(key => allFields.add(key));
                });
                
                console.log('\n📋 TODOS LOS CAMPOS ÚNICOS ENCONTRADOS:');
                console.log(Array.from(allFields).sort().join(', '));
            }
            
        } catch (error) {
            console.log('❌ Error sin Partner-Id:', {
                status: error.response?.status,
                data: error.response?.data
            });
            
            // Probar con diferentes Partner-Id
            const partnerIds = ['', 'default', 'api', 'siigo', 'test', 'client'];
            
            for (const partnerId of partnerIds) {
                try {
                    console.log(`\n🧪 Probando con Partner-Id: "${partnerId}"...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const headers = {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    };
                    
                    if (partnerId) {
                        headers['Partner-Id'] = partnerId;
                    }
                    
                    const testResponse = await axios.get('https://api.siigo.com/v1/products?created_start=2020-01-01&page=1&page_size=3', {
                        headers: headers,
                        timeout: 30000
                    });
                    
                    console.log(`✅ ÉXITO con Partner-Id "${partnerId}" - Status: ${testResponse.status}`);
                    console.log(`📄 Resultados: ${testResponse.data?.results?.length || 0}`);
                    
                    if (testResponse.data?.results?.length > 0) {
                        console.log(`📦 Primer producto: ${testResponse.data.results[0].name}`);
                    }
                    
                } catch (partnerError) {
                    console.log(`❌ Error con Partner-Id "${partnerId}":`, {
                        status: partnerError.response?.status,
                        message: partnerError.response?.data?.Errors?.[0]?.Message || partnerError.message
                    });
                }
            }
        }
        
    } catch (error) {
        console.log('❌ Error de autenticación:', error.message);
    }
}

testSiigoSinPartnerId().catch(console.error);
