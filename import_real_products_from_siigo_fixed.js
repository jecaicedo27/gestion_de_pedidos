const mysql = require('mysql2/promise');
const axios = require('axios');

// Database connection
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

// SIIGO credentials from backend/.env
const SIIGO_USERNAME = 'COMERCIAL@PERLAS-EXPLOSIVAS.COM';
const SIIGO_ACCESS_KEY = 'ODVjN2RlNDItY2I3MS00MmI5LWFiNjItMWM5MDkyZTFjMzY5Oih7IzdDMmU+RVk=';

async function authenticateWithSiigo() {
    console.log('🔐 Autenticando con SIIGO...');
    
    const authResponse = await axios.post('https://api.siigo.com/auth', {
        username: SIIGO_USERNAME,
        access_key: SIIGO_ACCESS_KEY
    });

    console.log('✅ Autenticación SIIGO exitosa');
    return authResponse.data.access_token;
}

async function fetchAllProducts(token) {
    console.log('📦 Obteniendo todos los productos de SIIGO...');
    
    const headers = {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Partner-Id': 'api'
    };

    let allProducts = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
        console.log(`📄 Consultando página ${currentPage}...`);
        
        const response = await axios.get(`https://api.siigo.com/v1/products?page=${currentPage}&page_size=100`, {
            headers: headers
        });

        const products = response.data.results || [];
        allProducts = allProducts.concat(products);

        console.log(`   ➤ Productos en página ${currentPage}: ${products.length}`);
        
        // Check if there are more pages
        hasMorePages = products.length === 100;
        currentPage++;

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`🎯 Total productos obtenidos: ${allProducts.length}`);
    return allProducts;
}

async function insertProductsInDatabase(connection, products) {
    console.log('💾 Insertando productos en la base de datos...');

    // First, get or create categories based on account_group
    const categories = new Map();
    
    for (const product of products) {
        if (product.account_group && product.account_group.name) {
            const categoryName = product.account_group.name;
            if (!categories.has(categoryName)) {
                // Check if category exists, if not create it
                const [existingCategory] = await connection.execute(
                    'SELECT id FROM categories WHERE name = ?',
                    [categoryName]
                );

                let categoryId;
                if (existingCategory.length > 0) {
                    categoryId = existingCategory[0].id;
                } else {
                    const [insertResult] = await connection.execute(
                        'INSERT INTO categories (name, description, is_active) VALUES (?, ?, ?)',
                        [categoryName, `Categoría ${categoryName} importada de SIIGO`, true]
                    );
                    categoryId = insertResult.insertId;
                }
                
                categories.set(categoryName, categoryId);
            }
        }
    }

    console.log(`📂 Categorías procesadas: ${categories.size}`);

    // Clear existing products
    await connection.execute('DELETE FROM products');
    console.log('🗑️ Productos existentes eliminados');

    // Insert products matching the existing table structure
    let insertedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
        try {
            // Map SIIGO fields to existing table structure
            const siigo_id = product.id || null;
            const siigo_product_id = product.code || null; // Use code as siigo_product_id
            const product_name = product.name || '';
            const description = product.description || '';
            const barcode = (product.additional_fields && product.additional_fields.barcode) 
                ? product.additional_fields.barcode 
                : 'PENDIENTE';
            const internal_code = product.code || null;
            
            // Extract category name from account_group
            let category = null;
            if (product.account_group && product.account_group.name) {
                category = product.account_group.name;
            }

            // Extract price
            let standard_price = 0;
            if (product.prices && product.prices.length > 0 && 
                product.prices[0].price_list && product.prices[0].price_list.length > 0) {
                standard_price = product.prices[0].price_list[0].value || 0;
            }

            const is_active = product.active === undefined ? true : product.active;
            const available_quantity = product.available_quantity || 0;
            const stock = product.available_quantity || 0;
            const subcategory = null; // Not provided by SIIGO

            // Insert product with matching column names
            await connection.execute(`
                INSERT INTO products (
                    product_name, description, barcode, internal_code, category,
                    standard_price, siigo_product_id, is_active, siigo_id,
                    available_quantity, stock, subcategory, last_sync_at,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
            `, [
                product_name, description, barcode, internal_code, category,
                standard_price, siigo_product_id, is_active, siigo_id,
                available_quantity, stock, subcategory
            ]);

            insertedCount++;

        } catch (error) {
            console.error(`❌ Error insertando producto ${product.code}:`, error.message);
            skippedCount++;
        }
    }

    console.log(`✅ Productos insertados: ${insertedCount}`);
    console.log(`⚠️ Productos omitidos: ${skippedCount}`);
}

async function importRealProductsFromSiigo() {
    let connection;
    
    try {
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('🔗 Conectado a la base de datos');

        // Authenticate with SIIGO
        const token = await authenticateWithSiigo();

        // Fetch all products
        const products = await fetchAllProducts(token);

        if (products.length === 0) {
            console.log('⚠️ No se encontraron productos en SIIGO');
            return;
        }

        // Insert products in database
        await insertProductsInDatabase(connection, products);

        // Verify insertion
        const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM products');
        const [categoryCountResult] = await connection.execute('SELECT COUNT(*) as count FROM categories');
        
        console.log('\n🎉 IMPORTACIÓN COMPLETADA');
        console.log('=====================================');
        console.log(`📦 Total productos en BD: ${countResult[0].count}`);
        console.log(`📂 Total categorías en BD: ${categoryCountResult[0].count}`);

        // Show sample products
        console.log('\n📋 MUESTRA DE PRODUCTOS IMPORTADOS:');
        const [sampleProducts] = await connection.execute(`
            SELECT product_name, category, standard_price, barcode, stock, siigo_product_id
            FROM products 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        sampleProducts.forEach(product => {
            console.log(`• ${product.siigo_product_id} | ${product.product_name} | ${product.category} | $${product.standard_price} | Stock: ${product.stock}`);
        });

        // Show categories
        console.log('\n📂 CATEGORÍAS IMPORTADAS:');
        const [categoriesResult] = await connection.execute('SELECT name FROM categories ORDER BY name');
        categoriesResult.forEach(cat => {
            console.log(`• ${cat.name}`);
        });

        // Show LIQUIPG05 specifically
        console.log('\n🎯 PRODUCTO LIQUIPG05 IMPORTADO:');
        const [liquipg05] = await connection.execute(`
            SELECT * FROM products WHERE siigo_product_id = 'LIQUIPG05'
        `);
        if (liquipg05.length > 0) {
            console.log(JSON.stringify(liquipg05[0], null, 2));
        } else {
            console.log('❌ LIQUIPG05 no se encontró en la BD');
        }

    } catch (error) {
        console.error('❌ Error en importación:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión a base de datos cerrada');
        }
    }
}

// Execute the import
importRealProductsFromSiigo();
