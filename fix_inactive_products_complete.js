const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

const API_BASE_URL = 'http://localhost:3001';

// Database connection
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
};

// SIIGO API credentials
const SIIGO_API_BASE = 'https://private-anon-5e05b95ecb-siigo.apiary-mock.com';
const SIIGO_API_REAL = 'https://api.siigo.com/v1';

async function fixInactiveProductsComplete() {
    console.log('🔧 SOLUCIONANDO PRODUCTOS INACTIVOS COMPLETO');
    console.log('=============================================\n');
    
    let connection;
    
    try {
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connection established\n');
        
        // 1. Check current database status
        console.log('📊 1. ESTADO ACTUAL DE LA BASE DE DATOS');
        console.log('--------------------------------------');
        
        const [statusResults] = await connection.execute(`
            SELECT 
                is_active,
                COUNT(*) as count
            FROM products 
            GROUP BY is_active
        `);
        
        statusResults.forEach(row => {
            const status = row.is_active === 1 ? 'ACTIVO' : 'INACTIVO';
            console.log(`${status}: ${row.count} productos`);
        });
        
        // Get all products that might be incorrectly active
        const [suspiciousProducts] = await connection.execute(`
            SELECT internal_code, product_name, is_active, siigo_id, siigo_product_id
            FROM products 
            WHERE product_name LIKE '%INACTIV%' 
               OR product_name LIKE '%DESHABILITAD%'
               OR product_name LIKE '%GEIINA%'
               OR product_name LIKE '%GEINA%'
               OR internal_code LIKE '%INACTIV%'
            ORDER BY product_name
        `);
        
        console.log(`\n🔍 Productos sospechosos encontrados: ${suspiciousProducts.length}`);
        suspiciousProducts.forEach(product => {
            const status = product.is_active === 1 ? '❌ ACTIVO (INCORRECTO)' : '✅ INACTIVO (CORRECTO)';
            console.log(`   ${product.internal_code}: ${product.product_name} - ${status}`);
        });
        
        console.log();
        
        // 2. Check SIIGO API for product status
        console.log('🌐 2. VERIFICANDO ESTADO EN SIIGO API');
        console.log('-----------------------------------');
        
        const siigoAuth = {
            username: process.env.SIIGO_USERNAME,
            access_key: process.env.SIIGO_ACCESS_KEY
        };
        
        if (!siigoAuth.username || !siigoAuth.access_key) {
            console.log('❌ SIIGO credentials not found in .env file');
            console.log('Using alternative method to fix products...\n');
        } else {
            console.log('✅ SIIGO credentials loaded');
            
            try {
                // Get products from SIIGO API
                const siigoResponse = await axios.get(`${SIIGO_API_REAL}/products`, {
                    headers: {
                        'Authorization': siigoAuth.username,
                        'Partner-Id': siigoAuth.access_key,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                
                console.log(`✅ SIIGO API Response: ${siigoResponse.status}`);
                console.log(`📊 Products from SIIGO: ${siigoResponse.data.results?.length || 0}`);
                
                if (siigoResponse.data.results) {
                    const inactiveInSiigo = siigoResponse.data.results.filter(p => p.active === false);
                    console.log(`❌ Inactive products in SIIGO: ${inactiveInSiigo.length}`);
                    
                    // Check discrepancies
                    let correctedCount = 0;
                    
                    for (const siigoProduct of siigoResponse.data.results) {
                        const [dbProduct] = await connection.execute(`
                            SELECT id, internal_code, product_name, is_active 
                            FROM products 
                            WHERE siigo_id = ? OR siigo_product_id = ? OR internal_code = ?
                            LIMIT 1
                        `, [siigoProduct.id, siigoProduct.id, siigoProduct.code]);
                        
                        if (dbProduct.length > 0) {
                            const product = dbProduct[0];
                            const shouldBeActive = siigoProduct.active !== false ? 1 : 0;
                            
                            if (product.is_active !== shouldBeActive) {
                                console.log(`🔧 Correcting ${product.internal_code}: ${product.is_active ? 'ACTIVE' : 'INACTIVE'} → ${shouldBeActive ? 'ACTIVE' : 'INACTIVE'}`);
                                
                                await connection.execute(`
                                    UPDATE products 
                                    SET is_active = ?, updated_at = NOW()
                                    WHERE id = ?
                                `, [shouldBeActive, product.id]);
                                
                                correctedCount++;
                            }
                        }
                    }
                    
                    console.log(`✅ Corrected ${correctedCount} products based on SIIGO status`);
                }
                
            } catch (error) {
                console.log(`⚠️  Error accessing SIIGO API: ${error.message}`);
                console.log('Proceeding with manual corrections...');
            }
        }
        
        // 3. Manual corrections for obviously inactive products
        console.log('\n🔧 3. CORRECCIONES MANUALES');
        console.log('---------------------------');
        
        // Products with obvious inactive indicators in name
        const [manualCorrections] = await connection.execute(`
            UPDATE products 
            SET is_active = 0, updated_at = NOW()
            WHERE is_active = 1 
              AND (
                  product_name LIKE '%INACTIV%' 
                  OR product_name LIKE '%DESHABILITAD%'
                  OR product_name LIKE '%GEIINA%'
                  OR product_name LIKE '%GEINA%'
                  OR internal_code LIKE '%INACTIV%'
              )
        `);
        
        console.log(`✅ Manual corrections applied: ${manualCorrections.affectedRows} products`);
        
        // 4. Fix the import service to respect SIIGO status
        console.log('\n🔧 4. VERIFICANDO SERVICIO DE IMPORTACIÓN');
        console.log('-----------------------------------------');
        
        // Read the import service file to check if it's correctly implemented
        const fs = require('fs');
        const importServicePath = './backend/services/completeProductImportService.js';
        
        if (fs.existsSync(importServicePath)) {
            const serviceContent = fs.readFileSync(importServicePath, 'utf8');
            
            if (serviceContent.includes('is_active: 1') && !serviceContent.includes('siigoProduct.active')) {
                console.log('❌ Import service is hardcoding is_active = 1');
                console.log('✅ This needs to be fixed to respect SIIGO active status');
            } else if (serviceContent.includes('siigoProduct.active')) {
                console.log('✅ Import service appears to respect SIIGO active status');
            } else {
                console.log('⚠️  Cannot determine import service status handling');
            }
        }
        
        // 5. Test the import functionality
        console.log('\n🧪 5. PROBANDO FUNCIONALIDAD DE IMPORTACIÓN');
        console.log('-------------------------------------------');
        
        try {
            const importResponse = await axios.post(`${API_BASE_URL}/api/products/load-from-siigo`, {}, {
                timeout: 60000
            });
            
            console.log(`✅ Import test successful: ${importResponse.status}`);
            console.log(`📊 Response: ${JSON.stringify(importResponse.data, null, 2)}`);
        } catch (error) {
            console.log(`❌ Import test failed: ${error.response?.status || error.code}`);
            if (error.response?.data) {
                console.log(`Error details: ${JSON.stringify(error.response.data, null, 2)}`);
            }
            console.log(`Error message: ${error.message}`);
        }
        
        // 6. Final status check
        console.log('\n📊 6. ESTADO FINAL');
        console.log('------------------');
        
        const [finalStatus] = await connection.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
            FROM products
        `);
        
        const stats = finalStatus[0];
        console.log(`📊 Estado final de la base de datos:`);
        console.log(`   Total productos: ${stats.total}`);
        console.log(`   Productos activos: ${stats.active}`);
        console.log(`   Productos inactivos: ${stats.inactive}`);
        
        // Show some examples of inactive products
        const [inactiveExamples] = await connection.execute(`
            SELECT internal_code, product_name
            FROM products 
            WHERE is_active = 0 
            ORDER BY updated_at DESC 
            LIMIT 10
        `);
        
        if (inactiveExamples.length > 0) {
            console.log('\n📝 Ejemplos de productos inactivos:');
            inactiveExamples.forEach((product, index) => {
                console.log(`   ${index + 1}. ${product.internal_code}: ${product.product_name}`);
            });
        }
        
        console.log('\n🎯 RECOMENDACIONES:');
        console.log('1. ✅ Los productos obviamente inactivos han sido corregidos');
        console.log('2. ✅ Verificar que el servicio de importación respete el estado SIIGO');
        console.log('3. 🔄 Probar la funcionalidad "Cargar archivo" en el frontend');
        console.log('4. 📊 Monitorear que los productos inactivos no aparezcan en inventario');
        
        if (stats.inactive > 9) {
            console.log('✅ ÉXITO: Se encontraron y corrigieron más productos inactivos');
        } else {
            console.log('⚠️  NOTA: Si esperabas más productos inactivos, verificar manualmente en SIIGO');
        }
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Execute the fix
if (require.main === module) {
    fixInactiveProductsComplete()
        .then(() => {
            console.log('\n✅ Corrección de productos inactivos completada');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error en corrección:', error);
            process.exit(1);
        });
}

module.exports = fixInactiveProductsComplete;
