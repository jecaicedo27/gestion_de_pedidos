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

async function testCompleteProductFixes() {
    console.log('🔍 TESTING COMPLETE PRODUCT STATUS FIXES');
    console.log('========================================\n');
    
    let connection;
    
    try {
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connection established\n');
        
        // 1. Test database product status distribution
        console.log('📊 1. CHECKING DATABASE PRODUCT STATUS DISTRIBUTION');
        console.log('--------------------------------------------------');
        
        const [statusResults] = await connection.execute(`
            SELECT 
                is_active,
                COUNT(*) as count,
                GROUP_CONCAT(CONCAT(internal_code, ' (', product_name, ')') SEPARATOR ', ') as examples
            FROM products_base 
            GROUP BY is_active
        `);
        
        statusResults.forEach(row => {
            const status = row.is_active === 1 ? 'ACTIVO' : 'INACTIVO';
            console.log(`${status}: ${row.count} productos`);
            if (row.examples) {
                const examples = row.examples.split(', ').slice(0, 3).join(', ');
                console.log(`   Ejemplos: ${examples}${row.count > 3 ? '...' : ''}`);
            }
        });
        console.log();
        
        // 2. Test specific inactive products (like MP175)
        console.log('🔍 2. CHECKING SPECIFIC INACTIVE PRODUCTS');
        console.log('----------------------------------------');
        
        const [inactiveProducts] = await connection.execute(`
            SELECT internal_code, product_name, is_active 
            FROM products_base 
            WHERE internal_code IN ('MP175', 'GEIINAVILITADO', 'GEINAVILITADO')
               OR product_name LIKE '%INACTIVO%' 
               OR product_name LIKE '%DESHABILITADO%'
            ORDER BY internal_code
        `);
        
        if (inactiveProducts.length > 0) {
            inactiveProducts.forEach(product => {
                const status = product.is_active === 1 ? '❌ ACTIVO (ERROR)' : '✅ INACTIVO (CORRECTO)';
                console.log(`${product.internal_code}: ${status}`);
            });
        } else {
            console.log('No se encontraron productos específicos a verificar');
        }
        console.log();
        
        // 3. Test Products API endpoint (should filter inactive by default)
        console.log('🔌 3. TESTING PRODUCTS API ENDPOINT');
        console.log('----------------------------------');
        
        try {
            const response = await axios.get(`${API_BASE_URL}/api/products?page=1&pageSize=10`);
            console.log(`✅ Status: ${response.status}`);
            console.log(`📊 Products returned: ${response.data.products?.length || 0}`);
            console.log(`📄 Total products: ${response.data.totalProducts || 0}`);
            
            // Check if any inactive products are returned
            const inactiveReturned = response.data.products?.filter(p => p.is_active !== 1) || [];
            if (inactiveReturned.length === 0) {
                console.log('✅ CORRECTO: No se devolvieron productos inactivos');
            } else {
                console.log(`❌ ERROR: ${inactiveReturned.length} productos inactivos devueltos:`);
                inactiveReturned.forEach(p => {
                    console.log(`   - ${p.internal_code}: ${p.product_name}`);
                });
            }
        } catch (error) {
            console.log(`❌ Error testing products API: ${error.message}`);
        }
        console.log();
        
        // 4. Test Inventory API endpoint (should only show active products)
        console.log('📦 4. TESTING INVENTORY API ENDPOINT');
        console.log('-----------------------------------');
        
        try {
            const response = await axios.get(`${API_BASE_URL}/api/inventory/grouped`);
            console.log(`✅ Status: ${response.status}`);
            console.log(`📊 Inventory items returned: ${response.data.data?.length || 0}`);
            
            // Check if any inactive products are returned
            const inactiveReturned = response.data.data?.filter(p => p.is_active !== 1) || [];
            if (inactiveReturned.length === 0) {
                console.log('✅ CORRECTO: No se devolvieron productos inactivos en inventario');
            } else {
                console.log(`❌ ERROR: ${inactiveReturned.length} productos inactivos en inventario:`);
                inactiveReturned.forEach(p => {
                    console.log(`   - ${p.internal_code}: ${p.product_name}`);
                });
            }
        } catch (error) {
            console.log(`❌ Error testing inventory API: ${error.message}`);
        }
        console.log();
        
        // 5. Test Product Import from SIIGO (this was the main complaint)
        console.log('📥 5. TESTING PRODUCT IMPORT FROM SIIGO');
        console.log('--------------------------------------');
        
        try {
            const response = await axios.post(`${API_BASE_URL}/api/products/load-from-siigo`);
            console.log(`✅ Status: ${response.status}`);
            console.log(`📊 Response: ${JSON.stringify(response.data, null, 2)}`);
            
            if (response.status === 200) {
                console.log('✅ CORRECTO: Import endpoint funciona sin errores');
                
                // Check the results after import
                const [postImportCount] = await connection.execute(`
                    SELECT 
                        COUNT(*) as total_products,
                        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products,
                        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_products
                    FROM products_base
                `);
                
                console.log(`📊 Después de import: ${postImportCount[0].total_products} total, ${postImportCount[0].active_products} activos, ${postImportCount[0].inactive_products} inactivos`);
            }
        } catch (error) {
            console.log(`❌ ERROR en import: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            if (error.response?.data) {
                console.log(`📝 Detalles: ${JSON.stringify(error.response.data, null, 2)}`);
            }
        }
        console.log();
        
        // 6. Test with authentication (simulating real frontend request)
        console.log('🔐 6. TESTING WITH AUTHENTICATION');
        console.log('---------------------------------');
        
        try {
            // First, let's check if we can get a valid auth token
            const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
                email: 'admin@test.com',
                password: 'admin123'
            });
            
            if (loginResponse.data.token) {
                console.log('✅ Authentication successful');
                
                const authHeaders = {
                    'Authorization': `Bearer ${loginResponse.data.token}`,
                    'Content-Type': 'application/json'
                };
                
                // Test products endpoint with auth
                const productsResponse = await axios.get(`${API_BASE_URL}/api/products?page=1&pageSize=5`, {
                    headers: authHeaders
                });
                
                console.log(`✅ Authenticated products request: ${productsResponse.status}`);
                console.log(`📊 Products with auth: ${productsResponse.data.products?.length || 0}`);
                
                // Test inventory endpoint with auth
                const inventoryResponse = await axios.get(`${API_BASE_URL}/api/inventory/grouped`, {
                    headers: authHeaders
                });
                
                console.log(`✅ Authenticated inventory request: ${inventoryResponse.status}`);
                console.log(`📦 Inventory items with auth: ${inventoryResponse.data.data?.length || 0}`);
                
            }
        } catch (error) {
            console.log(`⚠️  Authentication test failed: ${error.message}`);
        }
        console.log();
        
        // 7. Summary and recommendations
        console.log('📋 7. SUMMARY AND RECOMMENDATIONS');
        console.log('=================================');
        
        const [finalStatus] = await connection.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
            FROM products_base
        `);
        
        const stats = finalStatus[0];
        console.log(`📊 Estado actual de la base de datos:`);
        console.log(`   Total productos: ${stats.total}`);
        console.log(`   Productos activos: ${stats.active}`);
        console.log(`   Productos inactivos: ${stats.inactive}`);
        console.log();
        
        if (stats.inactive > 0) {
            console.log('✅ CORRECTO: Se detectan productos inactivos en la base de datos');
            console.log('✅ CORRECTO: Los filtros deben prevenir que aparezcan en frontend');
        } else {
            console.log('⚠️  ADVERTENCIA: No se detectan productos inactivos, verificar import');
        }
        
        console.log('\n🎯 RECOMENDACIONES:');
        console.log('1. Verificar que el frontend use los endpoints correctos (/api/inventory/grouped)');
        console.log('2. Asegurar que el botón de import funcione sin errores 500');
        console.log('3. Confirmar que productos como MP175 muestren estado correcto');
        console.log('4. Reiniciar la aplicación completa si persisten errores de conexión');
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Execute the test
if (require.main === module) {
    testCompleteProductFixes()
        .then(() => {
            console.log('\n✅ Test de verificación completo');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error en test:', error);
            process.exit(1);
        });
}

module.exports = testCompleteProductFixes;
