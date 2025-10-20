require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');
const axios = require('axios');

class SiigoProductManager {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        };
        
        this.siigoConfig = {
            username: process.env.SIIGO_API_USERNAME,
            accessKey: process.env.SIIGO_API_ACCESS_KEY,
            baseUrl: process.env.SIIGO_API_BASE_URL || 'https://api.siigo.com'
        };
        
        this.siigoToken = null;
        this.requestDelay = 2000; // 2 segundos entre requests para evitar rate limiting
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async authenticateWithSiigo() {
        console.log('🔐 Autenticando con SIIGO...');
        
        try {
            const response = await axios.post(`${this.siigoConfig.baseUrl}/auth`, {
                username: this.siigoConfig.username,
                access_key: this.siigoConfig.accessKey
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Partner-Id': 'gestion_pedidos'
                },
                timeout: 30000
            });
            
            if (response.data && response.data.access_token) {
                this.siigoToken = response.data.access_token;
                console.log('✅ Autenticación exitosa con SIIGO');
                return true;
            } else {
                throw new Error('No se recibió token de acceso');
            }
        } catch (error) {
            console.log('❌ Error de autenticación SIIGO:', {
                status: error.response?.status,
                errors: error.response?.data?.errors || error.response?.data?.Errors
            });
            throw new Error('No se pudo autenticar con SIIGO');
        }
    }
    
    async makeProtectedSiigoRequest(url, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.delay(this.requestDelay);
                
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': this.siigoToken,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'gestion_pedidos'
                    },
                    timeout: 30000
                });
                
                return response.data;
            } catch (error) {
                if (error.response?.status === 429) {
                    const retryAfter = error.response.data?.Errors?.[0]?.Message?.match(/(\d+) seconds/) || ['', '10'];
                    const waitTime = parseInt(retryAfter[1]) * 1000 + 2000; // Esperar + 2 segundos extra
                    
                    console.log(`⏳ Rate limit alcanzado. Esperando ${Math.ceil(waitTime/1000)} segundos... (intento ${attempt}/${retries})`);
                    await this.delay(waitTime);
                    
                    if (attempt === retries) {
                        throw new Error(`Rate limit persistente después de ${retries} intentos`);
                    }
                    continue;
                } else {
                    console.log(`❌ Error en request (intento ${attempt}/${retries}):`, {
                        status: error.response?.status,
                        message: error.message
                    });
                    
                    if (attempt === retries) {
                        throw error;
                    }
                    await this.delay(2000);
                }
            }
        }
    }
    
    async getSiigoCategories() {
        console.log('📂 Obteniendo categorías de SIIGO...');
        
        try {
            const data = await this.makeProtectedSiigoRequest(`${this.siigoConfig.baseUrl}/v1/product-types?page_size=100`);
            
            const categories = data.results || [];
            console.log(`✅ ${categories.length} categorías obtenidas de SIIGO`);
            
            return categories.map(cat => ({
                siigo_id: cat.id,
                name: cat.name,
                description: cat.name,
                is_active: true
            }));
        } catch (error) {
            console.log('❌ Error obteniendo categorías:', error.message);
            throw error;
        }
    }
    
    async getSiigoProducts() {
        console.log('📦 Obteniendo productos de SIIGO...');
        
        let allProducts = [];
        let page = 1;
        const pageSize = 25; // Reducido para evitar rate limits
        let hasMore = true;
        
        try {
            while (hasMore) {
                console.log(`📄 Obteniendo página ${page}...`);
                
                const data = await this.makeProtectedSiigoRequest(
                    `${this.siigoConfig.baseUrl}/v1/products?page=${page}&page_size=${pageSize}`
                );
                
                const products = data.results || [];
                allProducts = allProducts.concat(products);
                
                console.log(`✅ Página ${page}: ${products.length} productos obtenidos (Total: ${allProducts.length})`);
                
                // Verificar si hay más páginas
                hasMore = products.length === pageSize && data.pagination?.next;
                page++;
                
                // Delay extra entre páginas
                if (hasMore) {
                    await this.delay(this.requestDelay);
                }
            }
            
            console.log(`✅ Total de productos obtenidos: ${allProducts.length}`);
            return allProducts;
        } catch (error) {
            console.log('❌ Error obteniendo productos:', error.message);
            throw error;
        }
    }
    
    async cleanDatabase(connection) {
        console.log('🧹 Limpiando tablas de productos y categorías...');
        
        try {
            // Deshabilitar foreign key checks temporalmente
            await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
            
            // Limpiar productos
            await connection.execute('DELETE FROM products WHERE 1=1');
            console.log('✅ Tabla products limpiada');
            
            // Limpiar categorías
            await connection.execute('DELETE FROM categories WHERE 1=1');
            console.log('✅ Tabla categories limpiada');
            
            // Reset AUTO_INCREMENT
            await connection.execute('ALTER TABLE products AUTO_INCREMENT = 1');
            await connection.execute('ALTER TABLE categories AUTO_INCREMENT = 1');
            
            // Rehabilitar foreign key checks
            await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
            
            console.log('✅ Base de datos limpiada completamente');
        } catch (error) {
            console.log('❌ Error limpiando base de datos:', error.message);
            throw error;
        }
    }
    
    async insertCategories(connection, categories) {
        console.log('📂 Insertando categorías en la base de datos...');
        
        const insertQuery = `
            INSERT INTO categories (siigo_id, name, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        
        let insertedCount = 0;
        
        for (const category of categories) {
            try {
                await connection.execute(insertQuery, [
                    category.siigo_id,
                    category.name,
                    category.description,
                    category.is_active
                ]);
                insertedCount++;
            } catch (error) {
                console.log(`❌ Error insertando categoría ${category.name}:`, error.message);
            }
        }
        
        console.log(`✅ ${insertedCount} categorías insertadas exitosamente`);
        return insertedCount;
    }
    
    async insertProducts(connection, products, categories) {
        console.log('📦 Insertando productos en la base de datos...');
        
        // Crear mapa de categorías para búsqueda rápida
        const categoryMap = new Map();
        categories.forEach(cat => {
            categoryMap.set(cat.siigo_id, cat.name);
        });
        
        const insertQuery = `
            INSERT INTO products (
                siigo_id, code, barcode, name, description, reference, 
                category, unit_price, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        
        let insertedCount = 0;
        let skippedCount = 0;
        
        for (const product of products) {
            try {
                // Determinar categoría
                let categoryName = 'Sin Categoría';
                if (product.type && product.type.id) {
                    categoryName = categoryMap.get(product.type.id) || 'Sin Categoría';
                }
                
                // Generar código de barras temporal si no existe
                const barcode = product.code || `TEMP_${Date.now()}_${insertedCount}`;
                
                await connection.execute(insertQuery, [
                    product.id,
                    product.code || '',
                    barcode,
                    product.name || '',
                    product.name || '',
                    product.reference || '',
                    categoryName,
                    parseFloat(product.prices?.[0]?.price_list?.[0]?.value || 0),
                    true
                ]);
                
                insertedCount++;
                
                if (insertedCount % 50 === 0) {
                    console.log(`📦 ${insertedCount} productos insertados...`);
                }
            } catch (error) {
                console.log(`❌ Error insertando producto ${product.name}:`, error.message);
                skippedCount++;
            }
        }
        
        console.log(`✅ ${insertedCount} productos insertados exitosamente`);
        if (skippedCount > 0) {
            console.log(`⚠️  ${skippedCount} productos omitidos por errores`);
        }
        
        return insertedCount;
    }
    
    async createCompanyConfiguration(connection) {
        console.log('⚙️  Creando configuración del sistema escalable...');
        
        try {
            // Verificar si ya existe configuración
            const [existing] = await connection.execute(
                'SELECT * FROM system_config WHERE config_key = ?',
                ['siigo_integration_enabled']
            );
            
            if (existing.length === 0) {
                // Crear configuración base
                const configs = [
                    ['siigo_integration_enabled', 'true', 'Integración SIIGO habilitada'],
                    ['siigo_auto_sync_interval', '24', 'Intervalo de sincronización automática (horas)'],
                    ['last_product_sync', new Date().toISOString(), 'Última sincronización de productos'],
                    ['company_scalable_mode', 'true', 'Modo escalable para múltiples empresas']
                ];
                
                const insertConfigQuery = `
                    INSERT INTO system_config (config_key, config_value, description, created_at, updated_at)
                    VALUES (?, ?, ?, NOW(), NOW())
                `;
                
                for (const config of configs) {
                    await connection.execute(insertConfigQuery, config);
                }
                
                console.log('✅ Configuración del sistema escalable creada');
            } else {
                // Actualizar última sincronización
                await connection.execute(
                    'UPDATE system_config SET config_value = ?, updated_at = NOW() WHERE config_key = ?',
                    [new Date().toISOString(), 'last_product_sync']
                );
                console.log('✅ Configuración del sistema actualizada');
            }
        } catch (error) {
            console.log('❌ Error creando configuración:', error.message);
            // No es crítico, continuar sin fallar
        }
    }
    
    async run() {
        let connection = null;
        
        try {
            console.log('🚀 INICIANDO RECREACIÓN ESCALABLE DEL SISTEMA DE PRODUCTOS CON RATE LIMITING');
            console.log('⏳ Delay entre requests:', this.requestDelay, 'ms');
            
            // Conectar a la base de datos
            connection = await mysql.createConnection(this.dbConfig);
            console.log('✅ Conectado a la base de datos');
            
            // Autenticar con SIIGO
            await this.authenticateWithSiigo();
            
            // Limpiar base de datos
            await this.cleanDatabase(connection);
            
            // Obtener categorías de SIIGO
            const categories = await this.getSiigoCategories();
            
            // Insertar categorías
            await this.insertCategories(connection, categories);
            
            // Obtener productos de SIIGO (con paginación y rate limiting)
            const products = await this.getSiigoProducts();
            
            // Insertar productos
            await this.insertProducts(connection, products, categories);
            
            // Crear configuración escalable
            await this.createCompanyConfiguration(connection);
            
            console.log('🎉 RECREACIÓN DEL SISTEMA COMPLETADA EXITOSAMENTE');
            console.log('📊 RESUMEN:');
            console.log(`   📂 Categorías: ${categories.length}`);
            console.log(`   📦 Productos: ${products.length}`);
            console.log('   ⚙️  Sistema configurado para escalabilidad');
            
        } catch (error) {
            console.log('❌ Error en la recreación del sistema:', error.message);
            throw error;
        } finally {
            if (connection) {
                await connection.end();
                console.log('🔌 Conexión a la base de datos cerrada');
            }
        }
    }
}

// Ejecutar el manager
const manager = new SiigoProductManager();
manager.run().catch(error => {
    console.log('❌ Error fatal:', error.message);
    process.exit(1);
});
