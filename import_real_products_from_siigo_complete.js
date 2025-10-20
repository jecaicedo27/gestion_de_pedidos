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

    // First, get or create categories
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
                        'INSERT INTO categories (name, description, active) VALUES (?, ?, ?)',
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

    // Insert products
    let insertedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
        try {
            // Extract main fields
            const siigo_id = product.id || null;
            const code = product.code || null;
            const name = product.name || '';
            const type = product.type || 'Product';
            const stock_control = product.stock_control || false;
            const active = product.active || true;
            const tax_classification = product.tax_classification || null;
            const tax_included = product.tax_included || false;
            
            // Extract category
            let category_id = null;
            if (product.account_group && product.account_group.name) {
                category_id = categories.get(product.account_group.name);
            }

            // Extract price
            let price = 0;
            if (product.prices && product.prices.length > 0 && 
                product.prices[0].price_list && product.prices[0].price_list.length > 0) {
                price = product.prices[0].price_list[0].value || 0;
            }

            // Extract barcode
            let barcode = 'PENDIENTE';
            if (product.additional_fields && product.additional_fields.barcode) {
                barcode = product.additional_fields.barcode;
            }

            // Extract stock
            const available_quantity = product.available_quantity || 0;

            // Extract unit
            let unit_code = null;
            let unit_name = null;
            if (product.unit) {
                unit_code = product.unit.code;
                unit_name = product.unit.name;
            }

            // Extract taxes
            let tax_percentage = 0;
            if (product.taxes && product.taxes.length > 0) {
                tax_percentage = product.taxes[0].percentage || 0;
            }

            // Extract additional fields
            const brand = product.additional_fields?.brand || '';
            const tariff = product.additional_fields?.tariff || '';
            const model = product.additional_fields?.model || '';
            const reference = product.reference || '';
            const description = product.description || '';
            const unit_label = product.unit_label || '';

            // Prepare JSON fields
            const account_group_json = product.account_group ? JSON.stringify(product.account_group) : null;
            const taxes_json = product.taxes ? JSON.stringify(product.taxes) : null;
            const prices_json = product.prices ? JSON.stringify(product.prices) : null;
            const warehouses_json = product.warehouses ? JSON.stringify(product.warehouses) : null;
            const metadata_json = product.metadata ? JSON.stringify(product.metadata) : null;
            const additional_fields_json = product.additional_fields ? JSON.stringify(product.additional_fields) : null;

            // Insert product
            await connection.execute(`
                INSERT INTO products (
                    siigo_id, code, name, category_id, price, barcode, stock, 
                    type, stock_control, active, tax_classification, tax_included,
                    unit_code, unit_name, unit_label, reference, description,
                    brand, tariff, model, tax_percentage, available_quantity,
                    account_group, taxes, prices, warehouses, metadata, additional_fields,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                siigo_id, code, name, category_id, price, barcode, available_quantity,
                type, stock_control, active, tax_classification, tax_included,
                unit_code, unit_name, unit_label, reference, description,
                brand, tariff, model, tax_percentage, available_quantity,
                account_group_json, taxes_json, prices_json, warehouses_json, 
                metadata_json, additional_fields_json
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
            SELECT p.code, p.name, c.name as category, p.price, p.barcode, p.stock 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.created_at DESC 
            LIMIT 10
        `);
        
        sampleProducts.forEach(product => {
            console.log(`• ${product.code} | ${product.name} | ${product.category} | $${product.price} | Stock: ${product.stock}`);
        });

        // Show categories
        console.log('\n📂 CATEGORÍAS IMPORTADAS:');
        const [categoriesResult] = await connection.execute('SELECT name FROM categories ORDER BY name');
        categoriesResult.forEach(cat => {
            console.log(`• ${cat.name}`);
        });

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
