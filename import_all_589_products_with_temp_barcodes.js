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

/**
 * Genera un código de barras temporal único y escalable para cualquier empresa
 * @param {string} productCode - Código del producto de SIIGO
 * @param {number} index - Índice del producto para asegurar unicidad
 * @param {string} companyPrefix - Prefijo de la empresa (por defecto 'TEMP')
 * @returns {string} Código de barras temporal único
 */
function generateTemporaryBarcode(productCode, index, companyPrefix = 'TEMP') {
    const timestamp = Date.now().toString().slice(-8); // Últimos 8 dígitos del timestamp
    const productCodeSafe = (productCode || 'PROD').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    const indexPadded = index.toString().padStart(4, '0');
    
    // Formato: TEMP-PRODUCTCODE-TIMESTAMP-INDEX
    // Ejemplo: TEMP-LIQUIPG05-45678901-0001
    const tempBarcode = `${companyPrefix}-${productCodeSafe}-${timestamp}-${indexPadded}`;
    
    // Asegurar que no sea más largo que el límite de la base de datos (100 caracteres)
    return tempBarcode.substring(0, 99);
}

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
    console.log('📦 Obteniendo TODOS los productos de SIIGO...');
    
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

async function insertAllProductsInDatabase(connection, products) {
    console.log('💾 Insertando TODOS los productos en la base de datos...');

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

    // Get company name or use default prefix for barcode generation
    const companyName = process.env.COMPANY_NAME || 'COMPANY';
    const companyPrefix = companyName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'TEMP';

    // Insert ALL products with unique temporary barcodes for those without real barcodes
    let insertedCount = 0;
    let tempBarcodeCount = 0;
    let realBarcodeCount = 0;

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
            // Map SIIGO fields to existing table structure
            const siigo_id = product.id || null;
            const siigo_product_id = product.code || null;
            const product_name = product.name || '';
            const description = product.description || '';
            const internal_code = product.code || null;
            
            // Generate barcode: use real barcode if exists, otherwise create temporary unique barcode
            let barcode;
            if (product.additional_fields && product.additional_fields.barcode && 
                product.additional_fields.barcode.trim() !== '') {
                barcode = product.additional_fields.barcode;
                realBarcodeCount++;
                console.log(`✅ Real barcode: ${product.code} -> ${barcode}`);
            } else {
                barcode = generateTemporaryBarcode(product.code, i, companyPrefix);
                tempBarcodeCount++;
                console.log(`🔧 Temp barcode: ${product.code} -> ${barcode}`);
            }
            
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

            // Insert product with unique barcode (either real or temporary)
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
            // En caso de error, crear un barcode aún más único
            try {
                const fallbackBarcode = `${companyPrefix}-FALLBACK-${Date.now()}-${i}`;
                await connection.execute(`
                    INSERT INTO products (
                        product_name, description, barcode, internal_code, category,
                        standard_price, siigo_product_id, is_active, siigo_id,
                        available_quantity, stock, subcategory, last_sync_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
                `, [
                    product.name || 'Producto sin nombre',
                    product.description || '',
                    fallbackBarcode,
                    product.code || null,
                    product.account_group?.name || null,
                    0,
                    product.code || null,
                    true,
                    product.id || null,
                    0, 0, null
                ]);
                insertedCount++;
                tempBarcodeCount++;
                console.log(`🔄 Fallback barcode creado: ${product.code} -> ${fallbackBarcode}`);
            } catch (fallbackError) {
                console.error(`💥 Error crítico con producto ${product.code}:`, fallbackError.message);
            }
        }
    }

    console.log(`\n📊 RESUMEN DE IMPORTACIÓN:`);
    console.log(`✅ Productos insertados: ${insertedCount} de ${products.length}`);
    console.log(`🏷️ Barcodes reales: ${realBarcodeCount}`);
    console.log(`🔧 Barcodes temporales: ${tempBarcodeCount}`);
    console.log(`📂 Categorías creadas: ${categories.size}`);
}

async function importAllProductsFromSiigo() {
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

        // Insert ALL products in database with temporary barcodes for those without real ones
        await insertAllProductsInDatabase(connection, products);

        // Verify insertion
        const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM products');
        const [categoryCountResult] = await connection.execute('SELECT COUNT(*) as count FROM categories');
        
        console.log('\n🎉 IMPORTACIÓN COMPLETA EXITOSA');
        console.log('=====================================');
        console.log(`📦 Total productos en BD: ${countResult[0].count}`);
        console.log(`📂 Total categorías en BD: ${categoryCountResult[0].count}`);

        // Show sample products with different barcode types
        console.log('\n📋 MUESTRA DE PRODUCTOS IMPORTADOS:');
        const [sampleProducts] = await connection.execute(`
            SELECT product_name, category, standard_price, barcode, stock, siigo_product_id
            FROM products 
            ORDER BY created_at DESC 
            LIMIT 15
        `);
        
        sampleProducts.forEach((product, index) => {
            const barcodeType = product.barcode.includes('TEMP-') ? '🔧 TEMP' : '🏷️ REAL';
            console.log(`• ${barcodeType} | ${product.siigo_product_id} | ${product.product_name.substring(0, 40)}... | ${product.category} | $${product.standard_price}`);
        });

        // Show categories
        console.log('\n📂 TODAS LAS CATEGORÍAS IMPORTADAS:');
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

        // Show statistics by barcode type
        console.log('\n📊 ESTADÍSTICAS POR TIPO DE BARCODE:');
        const [barcodeStats] = await connection.execute(`
            SELECT 
                CASE 
                    WHEN barcode LIKE 'TEMP-%' THEN 'Temporal'
                    ELSE 'Real'
                END as barcode_type,
                COUNT(*) as count
            FROM products 
            GROUP BY barcode_type
        `);
        barcodeStats.forEach(stat => {
            console.log(`• ${stat.barcode_type}: ${stat.count} productos`);
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

// Execute the complete import
importAllProductsFromSiigo();
