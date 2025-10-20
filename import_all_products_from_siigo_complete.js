const mysql = require('mysql2/promise');
const axios = require('axios');

async function importAllProductsFromSiigo() {
    // SIIGO Authentication
    const username = 'apiuser@gestiondepedidos.com';
    const accessKey = 'N2NkMWJiYzEtZWY2OS00Y2Y2LTkxYWUtNzMzYjc5OGVhNWY5OjVUZ1RZVUxFNzE=';
    
    let connection;
    
    try {
        console.log('🔗 Conectando a base de datos...');
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_de_pedidos'
        });

        console.log('🔐 Autenticando con SIIGO...');
        
        // Authenticate with SIIGO
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: username,
            access_key: accessKey
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación SIIGO exitosa');

        // Headers with the correct Partner-Id that works
        const headers = {
            'Authorization': token,
            'Content-Type': 'application/json',
            'Partner-Id': 'api'  // This is the correct Partner-Id that works!
        };

        console.log('📊 Iniciando importación completa de productos...');

        let page = 1;
        let totalImported = 0;
        let hasMorePages = true;
        let categories = new Set(); // Track unique categories

        // Clear existing products
        console.log('🗑️ Limpiando productos existentes...');
        await connection.execute('DELETE FROM products');

        while (hasMorePages) {
            try {
                console.log(`📄 Obteniendo página ${page}...`);

                const productsResponse = await axios.get(`https://api.siigo.com/v1/products?page=${page}&page_size=100`, {
                    headers: headers
                });

                const products = productsResponse.data.results || [];
                console.log(`✅ Página ${page}: ${products.length} productos`);

                if (products.length === 0) {
                    hasMorePages = false;
                    break;
                }

                // Insert products into database
                for (const product of products) {
                    try {
                        // Extract category for tracking
                        if (product.account_group_name) {
                            categories.add(product.account_group_name);
                        }

                        // Map all SIIGO fields to database
                        const insertQuery = `
                            INSERT INTO products (
                                siigo_id, account_group, account_group_id, account_group_name,
                                active, additional_fields, additional_fields_barcode, 
                                additional_fields_brand, additional_fields_model, additional_fields_tariff,
                                available_quantity, code, description, metadata, metadata_created,
                                metadata_last_updated, name, prices, reference, stock_control,
                                tax_classification, tax_consumption_value, tax_included, taxes,
                                type, unit, unit_code, unit_label, unit_name, warehouses,
                                internal_category, is_active, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;

                        const values = [
                            product.id || null,
                            product.account_group ? JSON.stringify(product.account_group) : null,
                            product.account_group?.id || null,
                            product.account_group?.name || null,
                            product.active !== undefined ? product.active : true,
                            product.additional_fields ? JSON.stringify(product.additional_fields) : null,
                            product.additional_fields?.barcode || null,
                            product.additional_fields?.brand || null,
                            product.additional_fields?.model || null,
                            product.additional_fields?.tariff || null,
                            product.available_quantity || 0,
                            product.code || null,
                            product.description || null,
                            product.metadata ? JSON.stringify(product.metadata) : null,
                            product.metadata?.created || null,
                            product.metadata?.last_updated || null,
                            product.name || null,
                            product.prices ? JSON.stringify(product.prices) : null,
                            product.reference || null,
                            product.stock_control !== undefined ? product.stock_control : false,
                            product.tax_classification || null,
                            product.tax_consumption_value || 0,
                            product.tax_included !== undefined ? product.tax_included : false,
                            product.taxes ? JSON.stringify(product.taxes) : null,
                            product.type || null,
                            product.unit ? JSON.stringify(product.unit) : null,
                            product.unit?.code || null,
                            product.unit?.label || null,
                            product.unit?.name || null,
                            product.warehouses ? JSON.stringify(product.warehouses) : null,
                            product.account_group?.name || 'Sin Categoría', // internal_category
                            true, // is_active
                            new Date(), // created_at
                            new Date()  // updated_at
                        ];

                        await connection.execute(insertQuery, values);
                        totalImported++;

                    } catch (productError) {
                        console.error(`⚠️ Error importando producto ${product.code || product.id}:`, productError.message);
                    }
                }

                console.log(`✅ Página ${page} procesada. Total importados: ${totalImported}`);

                // Check if there are more pages
                const totalPages = Math.ceil((productsResponse.data.pagination?.total_results || totalImported) / 100);
                if (page >= totalPages || products.length < 100) {
                    hasMorePages = false;
                } else {
                    page++;
                    
                    // Rate limiting: Wait 3 seconds between requests
                    console.log('⏳ Esperando 3 segundos...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }

            } catch (pageError) {
                console.error(`❌ Error obteniendo página ${page}:`, pageError.message);
                if (pageError.response?.status === 429) {
                    console.log('⏳ Rate limit alcanzado, esperando 10 segundos...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else {
                    hasMorePages = false;
                }
            }
        }

        // Create categories table if it doesn't exist
        console.log('📋 Creando tabla de categorías...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_name (name)
            )
        `);

        // Insert categories
        console.log('🏷️ Insertando categorías encontradas...');
        for (const categoryName of categories) {
            try {
                await connection.execute(
                    'INSERT IGNORE INTO categories (name) VALUES (?)',
                    [categoryName]
                );
            } catch (categoryError) {
                console.error(`⚠️ Error insertando categoría ${categoryName}:`, categoryError.message);
            }
        }

        // Get final counts
        const [productCount] = await connection.execute('SELECT COUNT(*) as count FROM products');
        const [categoryCount] = await connection.execute('SELECT COUNT(*) as count FROM categories');

        console.log('\n🎉 IMPORTACIÓN COMPLETADA');
        console.log('================================================================================');
        console.log(`📦 Total productos importados: ${productCount[0].count}`);
        console.log(`🏷️ Total categorías encontradas: ${categoryCount[0].count}`);
        console.log('✅ Base de datos actualizada con estructura completa de SIIGO');

        // Show some sample categories
        const [sampleCategories] = await connection.execute('SELECT name FROM categories ORDER BY name LIMIT 10');
        console.log('\n📋 Muestra de categorías importadas:');
        sampleCategories.forEach(cat => console.log(`- ${cat.name}`));

        console.log('\n🎯 Los productos y categorías ya están disponibles en la aplicación');

    } catch (error) {
        console.error('❌ Error en importación:', error);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

importAllProductsFromSiigo();
