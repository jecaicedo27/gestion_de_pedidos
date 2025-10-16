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

async function testFixedImportService() {
    console.log('🧪 PROBANDO SERVICIO DE IMPORTACIÓN CORREGIDO');
    console.log('==============================================\n');
    
    let connection;
    
    try {
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connection established\n');
        
        // 1. Check current state BEFORE import
        console.log('📊 1. ESTADO ANTES DE LA IMPORTACIÓN');
        console.log('-----------------------------------');
        
        const [beforeImport] = await connection.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
            FROM products
        `);
        
        console.log(`Estado actual: ${beforeImport[0].total} total, ${beforeImport[0].active} activos, ${beforeImport[0].inactive} inactivos`);
        
        // 2. Test import with authentication
        console.log('\n🔄 2. PROBANDO IMPORTACIÓN CON SERVICIO CORREGIDO');
        console.log('------------------------------------------------');
        
        try {
            // First get auth token
            const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
                email: 'admin@test.com',
                password: 'admin123'
            });
            
            if (!loginResponse.data.token) {
                console.log('❌ No se pudo obtener token de autenticación');
                return;
            }
            
            console.log('✅ Token obtenido correctamente');
            
            const authHeaders = {
                'Authorization': `Bearer ${loginResponse.data.token}`,
                'Content-Type': 'application/json'
            };
            
            // Test the import endpoint
            console.log('🚀 Iniciando importación...');
            const importResponse = await axios.post(`${API_BASE_URL}/api/products/load-from-siigo`, {}, {
                headers: authHeaders,
                timeout: 120000 // 2 minutos timeout
            });
            
            console.log(`✅ Import successful: ${importResponse.status}`);
            console.log(`📊 Response:`, JSON.stringify(importResponse.data, null, 2));
            
            // 3. Check state AFTER import
            console.log('\n📊 3. ESTADO DESPUÉS DE LA IMPORTACIÓN');
            console.log('------------------------------------');
            
            const [afterImport] = await connection.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
                FROM products
            `);
            
            console.log(`Estado después: ${afterImport[0].total} total, ${afterImport[0].active} activos, ${afterImport[0].inactive} inactivos`);
            
            // 4. Check specific products that should be inactive
            console.log('\n🔍 4. VERIFICANDO PRODUCTOS ESPECÍFICOS');
            console.log('-------------------------------------');
            
            const [inactiveProducts] = await connection.execute(`
                SELECT internal_code, product_name, is_active 
                FROM products 
                WHERE product_name LIKE '%INAV%' 
                   OR internal_code LIKE 'MP17%'
                   OR product_name LIKE '%DESHABILITAD%'
                ORDER BY internal_code
                LIMIT 10
            `);
            
            if (inactiveProducts.length > 0) {
                console.log('Productos que deberían ser inactivos:');
                inactiveProducts.forEach(product => {
                    const status = product.is_active === 1 ? '❌ ACTIVO (PROBLEMA)' : '✅ INACTIVO (CORRECTO)';
                    console.log(`   ${product.internal_code}: ${product.product_name} - ${status}`);
                });
            } else {
                console.log('No se encontraron productos específicos para verificar');
            }
            
            // 5. Test the frontend endpoint filters
            console.log('\n🌐 5. VERIFICANDO FILTROS DE FRONTEND');
            console.log('------------------------------------');
            
            // Test products endpoint
            const productsResponse = await axios.get(`${API_BASE_URL}/api/products?page=1&pageSize=5`, {
                headers: authHeaders
            });
            
            console.log(`✅ Products endpoint: ${productsResponse.status}`);
            console.log(`📊 Products returned: ${productsResponse.data.products?.length || 0}`);
            
            const inactiveInProducts = productsResponse.data.products?.filter(p => p.is_active !== 1) || [];
            if (inactiveInProducts.length === 0) {
                console.log('✅ CORRECTO: Products endpoint no devuelve productos inactivos');
            } else {
                console.log(`❌ PROBLEMA: ${inactiveInProducts.length} productos inactivos en products endpoint`);
            }
            
            // Test inventory endpoint
            const inventoryResponse = await axios.get(`${API_BASE_URL}/api/inventory/grouped`, {
                headers: authHeaders
            });
            
            console.log(`✅ Inventory endpoint: ${inventoryResponse.status}`);
            console.log(`📦 Inventory items: ${inventoryResponse.data.data?.length || 0}`);
            
            const inactiveInInventory = inventoryResponse.data.data?.filter(p => p.is_active !== 1) || [];
            if (inactiveInInventory.length === 0) {
                console.log('✅ CORRECTO: Inventory endpoint no devuelve productos inactivos');
            } else {
                console.log(`❌ PROBLEMA: ${inactiveInInventory.length} productos inactivos en inventory endpoint`);
            }
            
            // 6. Summary
            console.log('\n📋 6. RESUMEN DE LA CORRECCIÓN');
            console.log('=============================');
            
            const totalChange = afterImport[0].total - beforeImport[0].total;
            const activeChange = afterImport[0].active - beforeImport[0].active;
            const inactiveChange = afterImport[0].inactive - beforeImport[0].inactive;
            
            console.log(`📈 Cambios en la importación:`);
            console.log(`   Total productos: ${beforeImport[0].total} → ${afterImport[0].total} (${totalChange > 0 ? '+' : ''}${totalChange})`);
            console.log(`   Productos activos: ${beforeImport[0].active} → ${afterImport[0].active} (${activeChange > 0 ? '+' : ''}${activeChange})`);
            console.log(`   Productos inactivos: ${beforeImport[0].inactive} → ${afterImport[0].inactive} (${inactiveChange > 0 ? '+' : ''}${inactiveChange})`);
            
            if (afterImport[0].inactive > afterImport[0].total * 0.05) { // Más del 5% inactivos
                console.log('✅ ÉXITO: Se detectan productos inactivos correctamente');
                console.log('✅ ÉXITO: El servicio de importación ahora respeta el estado SIIGO');
            } else {
                console.log('⚠️  ADVERTENCIA: Pocos productos inactivos detectados, verificar configuración SIIGO');
            }
            
        } catch (error) {
            console.log(`❌ Error en importación: ${error.response?.status || error.code}`);
            if (error.response?.data) {
                console.log(`Error details: ${JSON.stringify(error.response.data, null, 2)}`);
            }
            console.log(`Error message: ${error.message}`);
        }
        
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
    testFixedImportService()
        .then(() => {
            console.log('\n✅ Test del servicio corregido completado');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error en test:', error);
            process.exit(1);
        });
}

module.exports = testFixedImportService;
