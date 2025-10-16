const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

class SiigoProductManager {
    constructor() {
        this.siigoConfig = {
            username: process.env.SIIGO_USERNAME || 'perlas.explosivas@hotmail.com',
            access_key: process.env.SIIGO_ACCESS_KEY || 'NDNhYjVjNzUtNzQwZi00ZWI3LWFjNDYtODJhN2MzOTZkYzgy'
        };
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        };
        this.accessToken = null;
    }

    async authenticateWithSiigo() {
        try {
            const response = await axios.post('https://api.siigo.com/auth', {
                username: this.siigoConfig.username,
                access_key: this.siigoConfig.access_key
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Partner-Id': 'gestion_pedidos'
                }
            });

            if (response.data && response.data.access_token) {
                this.accessToken = response.data.access_token;
                console.log('✅ Autenticación exitosa con SIIGO');
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error de autenticación SIIGO:', error.response?.data || error.message);
            return false;
        }
    }

    async getSiigoCategories() {
        try {
            const response = await axios.get('https://api.siigo.com/v1/product-types', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'gestion_pedidos'
                }
            });

            console.log('📦 Categorías obtenidas desde SIIGO:', response.data.results?.length || 0);
            return response.data.results || [];
        } catch (error) {
            console.error('❌ Error obteniendo categorías SIIGO:', error.response?.data || error.message);
            return [];
        }
    }

    async getSiigoProducts() {
        try {
            let allProducts = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                console.log(`📄 Obteniendo página ${page} de productos...`);
                
                const response = await axios.get(`https://api.siigo.com/v1/products`, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'gestion_pedidos'
                    },
                    params: {
                        page_size: 100,
                        page: page
                    }
                });

                const products = response.data.results || [];
                allProducts = allProducts.concat(products);

                // Check if there are more pages
                if (products.length < 100) {
                    hasMore = false;
                } else {
                    page++;
                }

                // Add delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`🎯 Total productos obtenidos desde SIIGO: ${allProducts.length}`);
            return allProducts;
        } catch (error) {
            console.error('❌ Error obteniendo productos SIIGO:', error.response?.data || error.message);
            return [];
        }
    }

    async cleanDatabase(connection) {
        try {
            console.log('🧹 Limpiando tablas de productos y categorías...');

            // Disable foreign key checks temporarily
            await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

            // Clean products table
            await connection.execute('DELETE FROM products WHERE 1=1');
            await connection.execute('ALTER TABLE products AUTO_INCREMENT = 1');

            // Clean categories table
            await connection.execute('DELETE FROM categories WHERE 1=1');
            await connection.execute('ALTER TABLE categories AUTO_INCREMENT = 1');

            // Re-enable foreign key checks
            await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

            console.log('✅ Base de datos limpiada exitosamente');
        } catch (error) {
            console.error('❌ Error limpiando base de datos:', error);
            throw error;
        }
    }

    async insertCategories(connection, categories) {
        try {
            console.log('📂 Insertando categorías...');

            for (const category of categories) {
                try {
                    await connection.execute(`
                        INSERT INTO categories (name, is_active, siigo_id, created_at, updated_at)
                        VALUES (?, 1, ?, NOW(), NOW())
                        ON DUPLICATE KEY UPDATE 
                        name = VALUES(name),
                        updated_at = NOW()
                    `, [category.name, category.id]);
                } catch (err) {
                    console.log(`⚠️  Error insertando categoría ${category.name}:`, err.message);
                }
            }

            const [categoryCount] = await connection.execute('SELECT COUNT(*) as count FROM categories');
            console.log(`✅ Categorías insertadas: ${categoryCount[0].count}`);
        } catch (error) {
            console.error('❌ Error insertando categorías:', error);
            throw error;
        }
    }

    async insertProducts(connection, products, categories) {
        try {
            console.log('🏷️ Insertando productos...');

            // Create a map for faster category lookup
            const categoryMap = {};
            categories.forEach(cat => {
                categoryMap[cat.id] = cat.name;
            });

            let inserted = 0;
            let errors = 0;

            for (const product of products) {
                try {
                    // Get category name from the product type
                    let categoryName = 'Sin Categoría';
                    if (product.type && categoryMap[product.type.id]) {
                        categoryName = categoryMap[product.type.id];
                    }

                    // Determine if it's active (available_quantity > 0 or not specified)
                    const isActive = !product.available_quantity || product.available_quantity > 0 ? 1 : 0;

                    await connection.execute(`
                        INSERT INTO products (
                            product_name, 
                            internal_code, 
                            category, 
                            barcode, 
                            is_active,
                            siigo_id,
                            price,
                            stock,
                            created_at, 
                            updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                        ON DUPLICATE KEY UPDATE 
                        product_name = VALUES(product_name),
                        category = VALUES(category),
                        barcode = VALUES(barcode),
                        is_active = VALUES(is_active),
                        price = VALUES(price),
                        stock = VALUES(stock),
                        updated_at = NOW()
                    `, [
                        product.name || 'Sin Nombre',
                        product.code || `SIIGO_${product.id}`,
                        categoryName,
                        product.reference || 'PENDIENTE',
                        isActive,
                        product.id,
                        product.prices?.[0]?.price_list?.[0]?.value || 0,
                        product.available_quantity || 0
                    ]);

                    inserted++;

                    if (inserted % 50 === 0) {
                        console.log(`📦 Productos insertados: ${inserted}/${products.length}`);
                    }

                } catch (err) {
                    errors++;
                    console.log(`⚠️  Error insertando producto ${product.name}:`, err.message);
                }
            }

            console.log(`✅ Productos procesados: ${inserted} insertados, ${errors} errores`);
        } catch (error) {
            console.error('❌ Error insertando productos:', error);
            throw error;
        }
    }

    async createCompanyConfiguration(connection) {
        try {
            console.log('⚙️ Configurando empresa...');

            // Insert or update company configuration
            await connection.execute(`
                INSERT INTO system_config (config_key, config_value, description, created_at, updated_at)
                VALUES ('siigo_username', ?, 'Username de la API de SIIGO', NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                config_value = VALUES(config_value),
                updated_at = NOW()
            `, [this.siigoConfig.username]);

            await connection.execute(`
                INSERT INTO system_config (config_key, config_value, description, created_at, updated_at)
                VALUES ('siigo_access_key', ?, 'Access Key de la API de SIIGO', NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                config_value = VALUES(config_value),
                updated_at = NOW()
            `, [this.siigoConfig.access_key]);

            await connection.execute(`
                INSERT INTO system_config (config_key, config_value, description, created_at, updated_at)
                VALUES ('products_sync_enabled', '1', 'Sincronización automática de productos habilitada', NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                config_value = VALUES(config_value),
                updated_at = NOW()
            `);

            await connection.execute(`
                INSERT INTO system_config (config_key, config_value, description, created_at, updated_at)
                VALUES ('last_products_sync', NOW(), 'Última sincronización de productos', NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                config_value = NOW(),
                updated_at = NOW()
            `);

            console.log('✅ Configuración de empresa completada');
        } catch (error) {
            console.error('❌ Error configurando empresa:', error);
            throw error;
        }
    }

    async run() {
        let connection = null;

        try {
            console.log('🚀 INICIANDO RECREACIÓN ESCALABLE DEL SISTEMA DE PRODUCTOS');
            console.log('=' * 60);

            // Database connection
            connection = await mysql.createConnection(this.dbConfig);
            console.log('✅ Conectado a la base de datos');

            // Step 1: Authenticate with SIIGO
            const authenticated = await this.authenticateWithSiigo();
            if (!authenticated) {
                throw new Error('No se pudo autenticar con SIIGO');
            }

            // Step 2: Clean database
            await this.cleanDatabase(connection);

            // Step 3: Get categories from SIIGO
            const categories = await this.getSiigoCategories();
            if (categories.length === 0) {
                throw new Error('No se pudieron obtener categorías desde SIIGO');
            }

            // Step 4: Insert categories
            await this.insertCategories(connection, categories);

            // Step 5: Get products from SIIGO
            const products = await this.getSiigoProducts();
            if (products.length === 0) {
                throw new Error('No se pudieron obtener productos desde SIIGO');
            }

            // Step 6: Insert products
            await this.insertProducts(connection, products, categories);

            // Step 7: Create company configuration
            await this.createCompanyConfiguration(connection);

            // Final statistics
            const [productStats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    COUNT(DISTINCT category) as categories
                FROM products
            `);

            console.log('📊 ESTADÍSTICAS FINALES:');
            console.log(`   Total Productos: ${productStats[0].total}`);
            console.log(`   Productos Activos: ${productStats[0].active}`);
            console.log(`   Categorías: ${productStats[0].categories}`);

            console.log('🎉 Sistema de productos recreado exitosamente');
            console.log('🔄 El sistema ahora está configurado para ser escalable a múltiples empresas');

        } catch (error) {
            console.error('❌ Error en la recreación del sistema:', error);
            throw error;
        } finally {
            if (connection) {
                await connection.end();
            }
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const manager = new SiigoProductManager();
    manager.run().catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}

module.exports = SiigoProductManager;
