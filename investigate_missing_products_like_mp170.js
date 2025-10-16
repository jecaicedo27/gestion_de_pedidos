const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

class MissingProductsInvestigation {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev',
            port: process.env.DB_PORT || 3306,
            charset: 'utf8mb4'
        };
        
        this.siigoConfig = {
            baseUrl: 'https://api.siigo.com',
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        };
        
        this.token = null;
    }

    async authenticate() {
        try {
            console.log('🔐 Autenticando con SIIGO API...');
            
            const response = await axios.post(`${this.siigoConfig.baseUrl}/auth`, {
                username: this.siigoConfig.username,
                access_key: this.siigoConfig.access_key
            });

            this.token = response.data.access_token;
            console.log('✅ Autenticación exitosa');
            return true;
        } catch (error) {
            console.error('❌ Error autenticando con SIIGO:', error.message);
            return false;
        }
    }

    async getConnection() {
        return await mysql.createConnection(this.dbConfig);
    }

    async checkMP170InSIIGO() {
        console.log('\n🔍 Verificando MP170 en SIIGO...');
        
        try {
            const response = await axios.get(
                `${this.siigoConfig.baseUrl}/v1/products?code=MP170`,
                {
                    headers: {
                        'Authorization': this.token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    }
                }
            );

            if (response.data.results && response.data.results.length > 0) {
                const product = response.data.results[0];
                console.log('✅ MP170 encontrado en SIIGO:');
                console.log(`   - ID: ${product.id}`);
                console.log(`   - Código: ${product.code}`);
                console.log(`   - Nombre: ${product.name}`);
                console.log(`   - Activo: ${product.active}`);
                console.log(`   - Stock disponible: ${product.available_quantity || 0}`);
                return product;
            } else {
                console.log('❌ MP170 NO encontrado en SIIGO');
                return null;
            }
        } catch (error) {
            console.error('❌ Error consultando MP170 en SIIGO:', error.message);
            return null;
        }
    }

    async checkMP170InLocalDB() {
        console.log('\n🔍 Verificando MP170 en base de datos local...');
        const connection = await this.getConnection();
        
        try {
            const [products] = await connection.execute(`
                SELECT id, siigo_id, name, active, available_quantity
                FROM products 
                WHERE siigo_id = 'MP170' OR name LIKE '%MP170%' OR name LIKE '%INAVALIDADO%'
                LIMIT 10
            `);

            if (products.length > 0) {
                console.log(`✅ Encontrados ${products.length} productos relacionados con MP170 en DB local:`);
                products.forEach(product => {
                    console.log(`   - ID: ${product.id}, SIIGO_ID: ${product.siigo_id}, Nombre: ${product.name}, Activo: ${product.active}`);
                });
                return products;
            } else {
                console.log('❌ MP170 NO encontrado en base de datos local');
                return [];
            }
        } finally {
            await connection.end();
        }
    }

    async getSampleSiigoProducts() {
        console.log('\n🔍 Obteniendo muestra de productos desde SIIGO...');
        
        try {
            const response = await axios.get(
                `${this.siigoConfig.baseUrl}/v1/products?page_size=20&page=1`,
                {
                    headers: {
                        'Authorization': this.token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    }
                }
            );

            if (response.data.results && response.data.results.length > 0) {
                console.log(`✅ ${response.data.results.length} productos obtenidos de SIIGO (muestra):`);
                
                // Verificar cuáles están en DB local y cuáles no
                const connection = await this.getConnection();
                
                for (const siigoProduct of response.data.results.slice(0, 10)) {
                    const [localProduct] = await connection.execute(`
                        SELECT id, name FROM products WHERE siigo_id = ?
                    `, [siigoProduct.code]);
                    
                    const status = localProduct.length > 0 ? '✅ EN DB LOCAL' : '❌ FALTA EN DB';
                    console.log(`   - ${siigoProduct.code} (${siigoProduct.name}) - ${status}`);
                }
                
                await connection.end();
                return response.data.results;
            } else {
                console.log('❌ No se obtuvieron productos de SIIGO');
                return [];
            }
        } catch (error) {
            console.error('❌ Error obteniendo productos de SIIGO:', error.message);
            return [];
        }
    }

    async getLocalProductsCount() {
        console.log('\n📊 Estadísticas de productos en DB local...');
        const connection = await this.getConnection();
        
        try {
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_products,
                    COUNT(CASE WHEN siigo_id IS NOT NULL THEN 1 END) as with_siigo_id,
                    COUNT(CASE WHEN active = 1 THEN 1 END) as active_products,
                    COUNT(CASE WHEN active = 0 THEN 1 END) as inactive_products
                FROM products
            `);
            
            const stat = stats[0];
            console.log(`   📊 Total productos: ${stat.total_products}`);
            console.log(`   🔗 Con SIIGO ID: ${stat.with_siigo_id}`);
            console.log(`   ✅ Activos: ${stat.active_products}`);
            console.log(`   ❌ Inactivos: ${stat.inactive_products}`);
            
            return stat;
        } finally {
            await connection.end();
        }
    }

    async findProductsWithInvalidadoName() {
        console.log('\n🔍 Buscando productos con "INAVALIDADO" en el nombre...');
        const connection = await this.getConnection();
        
        try {
            const [products] = await connection.execute(`
                SELECT id, siigo_id, name, active, available_quantity
                FROM products 
                WHERE name LIKE '%INAVALIDADO%' OR name LIKE '%inactivo%' OR name LIKE '%desactivado%'
                LIMIT 10
            `);

            if (products.length > 0) {
                console.log(`✅ Encontrados ${products.length} productos con nombres relacionados:`);
                products.forEach(product => {
                    console.log(`   - SIIGO_ID: ${product.siigo_id}, Nombre: ${product.name}, Activo: ${product.active}`);
                });
                return products;
            } else {
                console.log('❌ No se encontraron productos con nombres relacionados a "INAVALIDADO"');
                return [];
            }
        } finally {
            await connection.end();
        }
    }

    async searchForMissingProducts() {
        console.log('\n🔍 Buscando productos potencialmente faltantes en SIIGO...');
        
        // Lista de códigos de productos que podrían estar faltando
        const suspectedMissingProducts = ['MP170', 'MP171', 'MP172', 'MP100', 'MP150'];
        
        for (const code of suspectedMissingProducts) {
            try {
                const response = await axios.get(
                    `${this.siigoConfig.baseUrl}/v1/products?code=${code}`,
                    {
                        headers: {
                            'Authorization': this.token,
                            'Content-Type': 'application/json',
                            'Partner-Id': 'siigo'
                        }
                    }
                );

                if (response.data.results && response.data.results.length > 0) {
                    const product = response.data.results[0];
                    
                    // Verificar si existe en DB local
                    const connection = await this.getConnection();
                    const [localProduct] = await connection.execute(`
                        SELECT id FROM products WHERE siigo_id = ?
                    `, [product.code]);
                    await connection.end();
                    
                    const localStatus = localProduct.length > 0 ? '✅ En DB local' : '❌ FALTA en DB local';
                    console.log(`   - ${code}: ${product.name} (Activo: ${product.active}) - ${localStatus}`);
                    
                    if (localProduct.length === 0) {
                        console.log(`   ⚠️ ${code} existe en SIIGO pero NO en base de datos local!`);
                    }
                } else {
                    console.log(`   - ${code}: No encontrado en SIIGO`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.log(`   - ${code}: Error consultando (${error.message})`);
            }
        }
    }

    async run() {
        console.log('🚀 Iniciando investigación de productos faltantes...');
        
        if (!await this.authenticate()) {
            return;
        }

        // 1. Verificar MP170 específicamente
        const mp170InSiigo = await this.checkMP170InSIIGO();
        const mp170InLocal = await this.checkMP170InLocalDB();

        // 2. Estadísticas generales
        await this.getLocalProductsCount();

        // 3. Buscar productos con "INAVALIDADO" en el nombre
        await this.findProductsWithInvalidadoName();

        // 4. Muestra de productos de SIIGO vs DB local
        await this.getSampleSiigoProducts();

        // 5. Buscar productos específicos que podrían estar faltantes
        await this.searchForMissingProducts();

        console.log('\n📋 RESUMEN DE INVESTIGACIÓN:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (mp170InSiigo && mp170InLocal.length === 0) {
            console.log('❌ PROBLEMA CONFIRMADO: MP170 existe en SIIGO pero NO en DB local');
            console.log('   Esto explica por qué no se puede sincronizar el estado activo/inactivo');
            console.log('   RECOMENDACIÓN: Ejecutar importación completa de productos desde SIIGO');
        } else if (!mp170InSiigo) {
            console.log('ℹ️  MP170 no encontrado en SIIGO - podría haber sido eliminado o renombrado');
        } else if (mp170InLocal.length > 0) {
            console.log('✅ MP170 encontrado tanto en SIIGO como en DB local');
        }
        
        console.log('\n🔧 SIGUIENTE PASO RECOMENDADO:');
        console.log('   Crear script para importar productos faltantes desde SIIGO');
    }
}

// Ejecutar investigación
const investigation = new MissingProductsInvestigation();
investigation.run().catch(console.error);
