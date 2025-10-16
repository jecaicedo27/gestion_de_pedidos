const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

// Productos específicos que necesitan verificación (de la imagen original)
const SPECIFIC_PRODUCTS = [
    'SHOT000', 'MP171', 'SKAR021', 'SKAR10', 'MP166',
    'MP170', 'MP172', 'MP175' // Algunos adicionales encontrados en logs
];

// Función para obtener token de SIIGO
async function getSiigoToken() {
    console.log('\n🔐 Obteniendo token de SIIGO...');
    
    try {
        const response = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Token obtenido exitosamente');
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error obteniendo token de SIIGO:', error.response?.data || error.message);
        throw error;
    }
}

// Función para obtener producto de SIIGO con rate limiting
async function getSiigoProductWithRetry(token, code, maxRetries = 3, baseDelay = 2000) {
    for (let retry = 0; retry <= maxRetries; retry++) {
        try {
            console.log(`🔍 Consultando ${code} en SIIGO (intento ${retry + 1}/${maxRetries + 1})`);
            
            const response = await axios.get(`https://api.siigo.com/v1/products?code=${code}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.length > 0) {
                const product = response.data[0];
                return {
                    code: product.code,
                    name: product.name,
                    active: product.active,
                    siigo_id: product.id
                };
            } else {
                console.log(`⚠️  ${code}: No encontrado en SIIGO`);
                return null;
            }
        } catch (error) {
            if (error.response?.status === 429) {
                const delay = baseDelay * Math.pow(2, retry); // Backoff exponencial
                console.log(`⏳ Rate limit para ${code}, esperando ${delay}ms antes del siguiente intento...`);
                
                if (retry < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    console.log(`❌ ${code}: Máximo de reintentos alcanzado por rate limiting`);
                    return { error: 'RATE_LIMITED', code };
                }
            } else {
                console.log(`❌ Error consultando ${code}:`, error.response?.status, error.response?.data?.message || error.message);
                return { error: 'API_ERROR', code, details: error.response?.data };
            }
        }
    }
}

// Función para verificar un producto específico
async function verifySpecificProduct(connection, token, productCode) {
    console.log(`\n📦 Verificando producto: ${productCode}`);
    
    // Obtener de la base de datos
    const [dbResults] = await connection.execute(
        'SELECT siigo_id, internal_code, product_name, is_active FROM products WHERE internal_code = ?',
        [productCode]
    );
    
    if (dbResults.length === 0) {
        console.log(`❌ ${productCode}: No encontrado en base de datos`);
        return { status: 'NOT_FOUND_DB', code: productCode };
    }
    
    const dbProduct = dbResults[0];
    const dbStatus = dbProduct.is_active ? 'ACTIVO' : 'INACTIVO';
    
    console.log(`📊 BD: ${productCode} = ${dbStatus} (siigo_id: ${dbProduct.siigo_id})`);
    
    // Obtener de SIIGO con rate limiting
    const siigoProduct = await getSiigoProductWithRetry(token, productCode);
    
    if (!siigoProduct) {
        console.log(`❌ ${productCode}: No encontrado en SIIGO`);
        return { status: 'NOT_FOUND_SIIGO', code: productCode, db_status: dbStatus };
    }
    
    if (siigoProduct.error) {
        console.log(`❌ ${productCode}: Error consultando SIIGO - ${siigoProduct.error}`);
        return { status: 'SIIGO_ERROR', code: productCode, db_status: dbStatus, error: siigoProduct.error };
    }
    
    const siigoStatus = siigoProduct.active ? 'ACTIVO' : 'INACTIVO';
    console.log(`🌐 SIIGO: ${productCode} = ${siigoStatus}`);
    
    // Comparar estados
    const isMatch = (dbProduct.is_active && siigoProduct.active) || (!dbProduct.is_active && !siigoProduct.active);
    
    if (isMatch) {
        console.log(`✅ ${productCode}: Estados sincronizados correctamente`);
        return { status: 'SYNCED', code: productCode, db_status: dbStatus, siigo_status: siigoStatus };
    } else {
        console.log(`🔴 ${productCode}: DISCREPANCIA ENCONTRADA - BD: ${dbStatus} vs SIIGO: ${siigoStatus}`);
        return { 
            status: 'MISMATCH', 
            code: productCode, 
            db_status: dbStatus, 
            siigo_status: siigoStatus,
            db_active: dbProduct.is_active,
            siigo_active: siigoProduct.active,
            siigo_id: siigoProduct.siigo_id
        };
    }
}

async function main() {
    let connection;
    
    try {
        console.log('🚀 INICIANDO VERIFICACIÓN ESPECÍFICA DE PRODUCTOS CON RATE LIMITING');
        console.log('=' .repeat(70));
        
        // Conectar a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });
        
        console.log('✅ Conectado a la base de datos');
        
        // Obtener token de SIIGO
        const token = await getSiigoToken();
        
        const results = {
            synced: [],
            mismatches: [],
            errors: [],
            not_found_db: [],
            not_found_siigo: []
        };
        
        // Verificar cada producto específico con delay entre consultas
        for (let i = 0; i < SPECIFIC_PRODUCTS.length; i++) {
            const productCode = SPECIFIC_PRODUCTS[i];
            
            try {
                const result = await verifySpecificProduct(connection, token, productCode);
                
                switch (result.status) {
                    case 'SYNCED':
                        results.synced.push(result);
                        break;
                    case 'MISMATCH':
                        results.mismatches.push(result);
                        break;
                    case 'NOT_FOUND_DB':
                        results.not_found_db.push(result);
                        break;
                    case 'NOT_FOUND_SIIGO':
                        results.not_found_siigo.push(result);
                        break;
                    case 'SIIGO_ERROR':
                        results.errors.push(result);
                        break;
                }
            } catch (error) {
                console.error(`❌ Error procesando ${productCode}:`, error.message);
                results.errors.push({ status: 'PROCESSING_ERROR', code: productCode, error: error.message });
            }
            
            // Delay entre productos para evitar rate limiting
            if (i < SPECIFIC_PRODUCTS.length - 1) {
                console.log('⏳ Esperando 3 segundos antes del siguiente producto...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        // Mostrar resumen final
        console.log('\n' + '='.repeat(70));
        console.log('📋 RESUMEN DE VERIFICACIÓN ESPECÍFICA');
        console.log('='.repeat(70));
        
        console.log(`✅ Productos sincronizados: ${results.synced.length}`);
        results.synced.forEach(item => {
            console.log(`   • ${item.code}: ${item.db_status} ✅`);
        });
        
        console.log(`🔴 Discrepancias encontradas: ${results.mismatches.length}`);
        results.mismatches.forEach(item => {
            console.log(`   • ${item.code}: BD=${item.db_status} vs SIIGO=${item.siigo_status} 🔴`);
        });
        
        console.log(`❌ Errores de consulta: ${results.errors.length}`);
        results.errors.forEach(item => {
            console.log(`   • ${item.code}: ${item.error} ❌`);
        });
        
        console.log(`🔍 No encontrados en BD: ${results.not_found_db.length}`);
        results.not_found_db.forEach(item => {
            console.log(`   • ${item.code} 🔍`);
        });
        
        console.log(`🌐 No encontrados en SIIGO: ${results.not_found_siigo.length}`);
        results.not_found_siigo.forEach(item => {
            console.log(`   • ${item.code} 🌐`);
        });
        
        // Si hay discrepancias, mostrar script de corrección
        if (results.mismatches.length > 0) {
            console.log('\n🛠️  SE DETECTARON DISCREPANCIAS');
            console.log('Se creará un script de corrección automática...');
            
            const corrections = results.mismatches.map(item => ({
                code: item.code,
                current_db_active: item.db_active,
                should_be_active: item.siigo_active,
                action: item.siigo_active ? 'ACTIVATE' : 'DEACTIVATE'
            }));
            
            console.log('\n🔧 Correcciones necesarias:');
            corrections.forEach(correction => {
                console.log(`   • ${correction.code}: ${correction.action} (${correction.current_db_active} → ${correction.should_be_active})`);
            });
            
            // Guardar datos para script de corrección
            const fs = require('fs');
            fs.writeFileSync('product_corrections.json', JSON.stringify(corrections, null, 2));
            console.log('💾 Datos de corrección guardados en: product_corrections.json');
        } else {
            console.log('\n🎉 ¡EXCELENTE! No se encontraron discrepancias en los productos específicos verificados.');
        }
        
        console.log('\n✅ Verificación específica completada');
        
    } catch (error) {
        console.error('❌ Error en el proceso:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión a base de datos cerrada');
        }
    }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
