const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

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

// Función para obtener producto de SIIGO con Partner-Id
async function getSiigoProduct(token, code) {
    try {
        const response = await axios.get(`https://api.siigo.com/v1/products?code=${code}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Partner-Id': process.env.SIIGO_API_PARTNER_ID || 'siigo',
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.length > 0) {
            return response.data[0];
        }
        return null;
    } catch (error) {
        console.error(`❌ Error consultando ${code}:`, error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Función para verificar productos reales de la base de datos
async function verifyRealProducts(connection, token) {
    console.log('\n📊 Verificando productos reales de la base de datos...');
    
    // Obtener una muestra aleatoria de productos activos de la BD
    const [activeProducts] = await connection.execute(`
        SELECT siigo_id, internal_code, product_name, is_active 
        FROM products 
        WHERE siigo_id IS NOT NULL 
        AND is_active = 1
        ORDER BY RAND() 
        LIMIT 10
    `);
    
    console.log(`📋 Productos activos encontrados en BD: ${activeProducts.length}`);
    
    const results = {
        synced: [],
        mismatches: [],
        not_found_siigo: [],
        errors: []
    };
    
    for (const dbProduct of activeProducts) {
        console.log(`\n🔍 Verificando: ${dbProduct.internal_code}`);
        
        const siigoProduct = await getSiigoProduct(token, dbProduct.internal_code);
        
        if (!siigoProduct) {
            console.log(`⚠️  ${dbProduct.internal_code}: No encontrado en SIIGO`);
            results.not_found_siigo.push(dbProduct);
        } else {
            const dbActive = dbProduct.is_active === 1;
            const siigoActive = siigoProduct.active;
            
            if (dbActive === siigoActive) {
                console.log(`✅ ${dbProduct.internal_code}: Sincronizado (${siigoActive ? 'ACTIVO' : 'INACTIVO'})`);
                results.synced.push({
                    code: dbProduct.internal_code,
                    status: siigoActive ? 'ACTIVO' : 'INACTIVO'
                });
            } else {
                console.log(`🔴 ${dbProduct.internal_code}: DISCREPANCIA - BD: ${dbActive ? 'ACTIVO' : 'INACTIVO'} vs SIIGO: ${siigoActive ? 'ACTIVO' : 'INACTIVO'}`);
                results.mismatches.push({
                    code: dbProduct.internal_code,
                    db_active: dbActive,
                    siigo_active: siigoActive,
                    siigo_id: dbProduct.siigo_id
                });
            }
        }
        
        // Pequeño delay
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    return results;
}

// Función para verificar productos inactivos
async function verifyInactiveProducts(connection, token) {
    console.log('\n📉 Verificando productos inactivos en la base de datos...');
    
    const [inactiveProducts] = await connection.execute(`
        SELECT siigo_id, internal_code, product_name, is_active 
        FROM products 
        WHERE siigo_id IS NOT NULL 
        AND is_active = 0
        ORDER BY internal_code
        LIMIT 5
    `);
    
    console.log(`📋 Productos inactivos encontrados en BD: ${inactiveProducts.length}`);
    
    const results = [];
    
    for (const dbProduct of inactiveProducts) {
        console.log(`\n🔍 Verificando producto inactivo: ${dbProduct.internal_code}`);
        
        const siigoProduct = await getSiigoProduct(token, dbProduct.internal_code);
        
        if (siigoProduct) {
            const siigoActive = siigoProduct.active;
            console.log(`📊 ${dbProduct.internal_code}: BD=INACTIVO, SIIGO=${siigoActive ? 'ACTIVO' : 'INACTIVO'}`);
            
            results.push({
                code: dbProduct.internal_code,
                db_active: false,
                siigo_active: siigoActive,
                match: !siigoActive // Debería ser inactivo en ambos
            });
        } else {
            console.log(`⚠️  ${dbProduct.internal_code}: No encontrado en SIIGO`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    return results;
}

async function main() {
    let connection;
    
    try {
        console.log('🚀 VERIFICACIÓN FINAL DE SINCRONIZACIÓN CON PARTNER-ID');
        console.log('=' .repeat(70));
        console.log(`🔑 Partner-Id configurado: ${process.env.SIIGO_API_PARTNER_ID || 'siigo'}`);
        
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
        
        // Verificar productos activos
        const activeResults = await verifyRealProducts(connection, token);
        
        // Verificar productos inactivos
        const inactiveResults = await verifyInactiveProducts(connection, token);
        
        // Mostrar resumen final
        console.log('\n' + '='.repeat(70));
        console.log('📋 RESUMEN FINAL DE SINCRONIZACIÓN');
        console.log('='.repeat(70));
        
        console.log('\n🟢 PRODUCTOS ACTIVOS:');
        console.log(`✅ Sincronizados correctamente: ${activeResults.synced.length}`);
        console.log(`🔴 Discrepancias encontradas: ${activeResults.mismatches.length}`);
        console.log(`⚠️  No encontrados en SIIGO: ${activeResults.not_found_siigo.length}`);
        
        if (activeResults.mismatches.length > 0) {
            console.log('\n🔴 Discrepancias en productos activos:');
            activeResults.mismatches.forEach(item => {
                console.log(`   • ${item.code}: BD=${item.db_active ? 'ACTIVO' : 'INACTIVO'} vs SIIGO=${item.siigo_active ? 'ACTIVO' : 'INACTIVO'}`);
            });
        }
        
        console.log('\n🔴 PRODUCTOS INACTIVOS:');
        const inactiveMatches = inactiveResults.filter(r => r.match);
        const inactiveMismatches = inactiveResults.filter(r => !r.match);
        
        console.log(`✅ Correctamente inactivos: ${inactiveMatches.length}`);
        console.log(`🔴 Discrepancias (activos en SIIGO): ${inactiveMismatches.length}`);
        
        if (inactiveMismatches.length > 0) {
            console.log('\n🔴 Productos que deberían estar inactivos:');
            inactiveMismatches.forEach(item => {
                console.log(`   • ${item.code}: BD=INACTIVO pero SIIGO=ACTIVO 🚨`);
            });
        }
        
        // Conclusión
        const totalDiscrepancies = activeResults.mismatches.length + inactiveMismatches.length;
        
        if (totalDiscrepancies === 0) {
            console.log('\n🎉 ¡PERFECTO! La sincronización está funcionando correctamente');
            console.log('✅ No se encontraron discrepancias de estado entre la BD y SIIGO');
            console.log('🔧 El problema reportado parece estar resuelto con el Partner-Id');
        } else {
            console.log(`\n⚠️  Se encontraron ${totalDiscrepancies} discrepancias`);
            console.log('🛠️  Considera ejecutar una sincronización manual de estados');
        }
        
        console.log('\n✅ Verificación completada');
        
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

// Ejecutar
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
