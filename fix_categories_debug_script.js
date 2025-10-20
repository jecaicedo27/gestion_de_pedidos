#!/usr/bin/env node

/**
 * FIX CATEGORIES DEBUG SCRIPT
 * ==========================
 * 
 * Primero verificamos la estructura real de las tablas
 * y luego diagnosticamos el problema de categorías.
 */

const mysql = require('mysql2/promise');
const axios = require('axios');

async function fixCategoriesDebugScript() {
    console.log('\n🔍 VERIFICANDO ESTRUCTURA DE TABLAS Y DIAGNOSTICANDO CATEGORÍAS');
    console.log('================================================================');

    try {
        // Conectar a la base de datos
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        // 1. Verificar estructura de la tabla products
        console.log('\n📊 1. Verificando estructura de tabla products...');
        const [productColumns] = await connection.execute(`
            DESCRIBE products
        `);

        console.log('✅ Columnas en tabla products:');
        productColumns.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.Field} (${col.Type}) ${col.Null} ${col.Key} ${col.Default}`);
        });

        // 2. Verificar estructura de la tabla categories
        console.log('\n📊 2. Verificando estructura de tabla categories...');
        const [categoryColumns] = await connection.execute(`
            DESCRIBE categories
        `);

        console.log('✅ Columnas en tabla categories:');
        categoryColumns.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.Field} (${col.Type}) ${col.Null} ${col.Key} ${col.Default}`);
        });

        // 3. Contar categorías total
        console.log('\n📊 3. Contando categorías directamente...');
        const [categories] = await connection.execute(`
            SELECT id, name 
            FROM categories 
            ORDER BY name
        `);

        console.log(`✅ Total categorías en BD: ${categories.length}`);
        console.log('\n📋 TODAS LAS CATEGORÍAS EN BD:');
        categories.forEach((cat, index) => {
            console.log(`   ${index + 1}. ${cat.name} (ID: ${cat.id})`);
        });

        // 4. Si existe una columna de categoría en products, verificar relación
        const hasCategoryId = productColumns.some(col => col.Field === 'category_id');
        const hasCategoryName = productColumns.some(col => col.Field === 'category');
        
        console.log(`\n🔗 Relación products-categories:`);
        console.log(`   - Tiene category_id: ${hasCategoryId}`);
        console.log(`   - Tiene category: ${hasCategoryName}`);

        if (hasCategoryId) {
            console.log('\n📊 4. Verificando productos por categoría (usando category_id)...');
            const [productsByCategory] = await connection.execute(`
                SELECT c.id, c.name, COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id
                GROUP BY c.id, c.name
                ORDER BY c.name
            `);

            console.log('\n📋 PRODUCTOS POR CATEGORÍA:');
            productsByCategory.forEach((cat) => {
                console.log(`   - ${cat.name}: ${cat.product_count} productos`);
            });
        } else if (hasCategoryName) {
            console.log('\n📊 4. Verificando productos por categoría (usando category)...');
            const [productsByCategory] = await connection.execute(`
                SELECT category, COUNT(*) as product_count
                FROM products
                WHERE category IS NOT NULL AND category != ''
                GROUP BY category
                ORDER BY category
            `);

            console.log('\n📋 PRODUCTOS POR CATEGORÍA:');
            productsByCategory.forEach((cat) => {
                console.log(`   - ${cat.category}: ${cat.product_count} productos`);
            });
        }

        await connection.end();

        // 5. Probar API de categorías
        console.log('\n📊 5. Verificando API de categorías...');
        
        try {
            // Login
            const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
                username: 'admin',
                password: 'admin123'
            });

            const token = loginResponse.data.token;
            console.log(`✅ Login exitoso`);

            // Probar endpoint de categorías
            const categoriesResponse = await axios.get('http://localhost:3001/api/products/categories', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log(`✅ Categories API Status: ${categoriesResponse.status}`);
            console.log(`📋 Total categorías desde API: ${categoriesResponse.data.length}`);
            
            console.log('\n📋 CATEGORÍAS DESDE API:');
            categoriesResponse.data.forEach((category, index) => {
                console.log(`   ${index + 1}. ${category.name} (ID: ${category.id || 'N/A'})`);
            });

            // 6. Análisis comparativo
            console.log('\n🔍 ANÁLISIS COMPARATIVO:');
            console.log(`📊 BD: ${categories.length} categorías`);
            console.log(`📊 API: ${categoriesResponse.data.length} categorías`);

            if (categories.length !== categoriesResponse.data.length) {
                console.log('❌ DISCREPANCIA DETECTADA: BD y API no coinciden');
                
                const bdNames = categories.map(c => c.name);
                const apiNames = categoriesResponse.data.map(c => c.name);
                
                const missingInApi = bdNames.filter(name => !apiNames.includes(name));
                const extraInApi = apiNames.filter(name => !bdNames.includes(name));
                
                if (missingInApi.length > 0) {
                    console.log('\n❌ CATEGORÍAS FALTANTES EN API:');
                    missingInApi.forEach(name => console.log(`   - ${name}`));
                }
                
                if (extraInApi.length > 0) {
                    console.log('\n⚠️ CATEGORÍAS EXTRA EN API:');
                    extraInApi.forEach(name => console.log(`   - ${name}`));
                }
            } else {
                console.log('✅ BD y API coinciden en número de categorías');
            }

        } catch (apiError) {
            console.log(`❌ Error en API: ${apiError.message}`);
            if (apiError.response) {
                console.log(`❌ Status: ${apiError.response.status}`);
                console.log(`❌ Data: ${JSON.stringify(apiError.response.data, null, 2)}`);
            }
        }

        console.log('\n🎯 DIAGNÓSTICO FINAL:');
        if (categories.length >= 10) {
            console.log(`✅ Base de datos tiene ${categories.length} categorías - esto es correcto`);
        } else {
            console.log(`❌ Base de datos solo tiene ${categories.length} categorías - esto puede ser un problema`);
        }

        console.log('\n💡 PRÓXIMOS PASOS:');
        console.log('1. Verificar el controlador de categorías en backend/controllers/productController.js');
        console.log('2. Revisar la ruta /api/products/categories en backend/routes/products.js');
        console.log('3. Verificar si hay filtros o límites en la consulta SQL del backend');

    } catch (error) {
        console.log('\n❌ ERROR EN DIAGNÓSTICO:');
        console.log(`❌ ${error.message}`);
        if (error.stack) {
            console.log(`❌ Stack: ${error.stack}`);
        }
    }
}

fixCategoriesDebugScript().catch(console.error);
