const axios = require('axios');
const mysql = require('mysql2/promise');

async function debugFrontendCategoriesDiscrepancy() {
    console.log('=== DEBUGGING FRONTEND CATEGORIES DISCREPANCY ===\n');

    // 1. Check database directly
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('📊 1. DIRECT DATABASE CHECK:');
        const [dbCategories] = await connection.execute(`
            SELECT 
                c.id,
                c.name as categoria,
                c.is_active,
                COUNT(p.id) as productos
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name, c.is_active
            ORDER BY productos DESC, c.name ASC
        `);

        console.log(`Total categories in DB: ${dbCategories.length}`);
        dbCategories.forEach(cat => {
            const status = cat.productos > 0 ? '✅' : '❌';
            console.log(`${status} ${cat.categoria}: ${cat.productos} productos (ID: ${cat.id})`);
        });

        // 2. Test the API endpoint directly
        console.log('\n🔗 2. TESTING API ENDPOINT DIRECTLY:');
        try {
            const response = await axios.get('http://localhost:3000/api/products/categories', {
                timeout: 5000
            });
            
            console.log('API Response Status:', response.status);
            console.log('API Response Data:');
            console.log(JSON.stringify(response.data, null, 2));
            
            if (response.data && response.data.length) {
                console.log(`\n📈 API returned ${response.data.length} categories:`);
                response.data.forEach((cat, index) => {
                    console.log(`${index + 1}. ${cat.name || cat.categoria || cat} (Count: ${cat.productCount || cat.productos || 'N/A'})`);
                });
            }
        } catch (apiError) {
            console.log('❌ API Error:', apiError.message);
            console.log('Backend might not be running on http://localhost:3000');
        }

        // 3. Check the category service file
        console.log('\n🔍 3. CHECKING CATEGORY SERVICE IMPLEMENTATION:');
        const fs = require('fs');
        const categoryServicePath = 'backend/services/categoryService.js';
        
        if (fs.existsSync(categoryServicePath)) {
            const categoryService = fs.readFileSync(categoryServicePath, 'utf8');
            console.log('Category service exists. Checking getActiveCategories method...');
            
            if (categoryService.includes('HAVING COUNT(p.id) > 0')) {
                console.log('❌ PROBLEM FOUND: getActiveCategories still has HAVING COUNT filter!');
                console.log('The method is still filtering out categories without products.');
            } else if (categoryService.includes('LEFT JOIN products p')) {
                console.log('✅ Category service appears to have been updated correctly');
            } else {
                console.log('⚠️  Category service structure is different than expected');
            }
            
            // Show the actual method
            const methodMatch = categoryService.match(/getActiveCategories[\s\S]*?(?=\n\s*[a-zA-Z]|\n\s*}|\n\s*$)/);
            if (methodMatch) {
                console.log('\n📝 Current getActiveCategories method:');
                console.log(methodMatch[0].substring(0, 500) + '...');
            }
        } else {
            console.log('❌ Category service file not found at expected location');
        }

        // 4. Check for YEXIS products specifically
        console.log('\n🎯 4. CHECKING YEXIS PRODUCTS SPECIFICALLY:');
        const [yexisProducts] = await connection.execute(`
            SELECT product_name, internal_code, category
            FROM products 
            WHERE product_name LIKE '%YEXIS%' OR internal_code LIKE '%YEXIS%' OR category = 'YEXIS'
            AND is_active = TRUE
        `);
        
        console.log(`Found ${yexisProducts.length} YEXIS-related products in database:`);
        yexisProducts.forEach(product => {
            console.log(`• ${product.product_name} [${product.internal_code}] → Category: ${product.category || 'Sin categoría'}`);
        });

        // 5. Check for products that should be YEXIS but aren't categorized
        const [potentialYexis] = await connection.execute(`
            SELECT product_name, internal_code, category
            FROM products 
            WHERE (
                product_name LIKE '%YEXIS%' OR 
                internal_code LIKE '%YEX%' OR
                product_name LIKE '%YEX%'
            )
            AND is_active = TRUE
            AND (category IS NULL OR category = '' OR category = 'Sin categoría')
            LIMIT 10
        `);
        
        console.log(`\nFound ${potentialYexis.length} potential YEXIS products that are uncategorized:`);
        potentialYexis.forEach(product => {
            console.log(`• ${product.product_name} [${product.internal_code}] → Currently: ${product.category || 'Sin categoría'}`);
        });

        // 6. Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        
        if (dbCategories.length >= 16 && dbCategories.some(cat => cat.productos > 0)) {
            console.log('✅ Database has correct data');
        } else {
            console.log('❌ Database data issue detected');
        }
        
        console.log('🔧 Next steps:');
        console.log('1. Verify backend server is running on correct port');
        console.log('2. Check if API endpoint returns correct data');
        console.log('3. Clear frontend cache/refresh browser');
        console.log('4. Assign more products to empty categories (especially YEXIS)');

    } catch (error) {
        console.error('❌ Database Error:', error);
    } finally {
        await connection.end();
    }
}

debugFrontendCategoriesDiscrepancy();
