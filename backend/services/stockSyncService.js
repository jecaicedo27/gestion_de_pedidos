const mysql = require('mysql2/promise');
const axios = require('axios');
const WebhookService = require('./webhookService');
const siigoService = require('./siigoService');
require('dotenv').config();

class StockSyncService {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos',
            port: process.env.DB_PORT || 3306,
            charset: 'utf8mb4',
            timezone: '+00:00'
        };
        
        this.siigoConfig = {
            baseUrl: 'https://api.siigo.com',
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        };
        
        this.token = null;
        this.tokenExpiry = null;
        this.syncInterval = null;
        this.webhookService = new WebhookService();
        this.webhooksConfigured = false;
        
        // Configurar intervalo de 5 minutos (300000 ms)
        this.SYNC_INTERVAL = 5 * 60 * 1000;
    }

    async authenticate() {
        try {
            console.log('🔐 Autenticando con SIIGO API para sync de stock...');
            
            const token = await siigoService.authenticate();
            this.token = `Bearer ${token}`;
            // El token expira en 1 hora, renovar 5 minutos antes
            this.tokenExpiry = Date.now() + (55 * 60 * 1000);
            
            console.log('✅ Autenticación exitosa para sync de stock');
            return true;
        } catch (error) {
            console.error('❌ Error autenticando con SIIGO para sync de stock:', error.message);
            return false;
        }
    }

    async ensureValidToken() {
        if (!this.token || Date.now() >= this.tokenExpiry) {
            return await this.authenticate();
        }
        return true;
    }

    async getConnection() {
        return await mysql.createConnection(this.dbConfig);
    }

    async syncProductStock() {
        const connection = await this.getConnection();
        
        try {
            if (!await this.ensureValidToken()) {
                throw new Error('No se pudo autenticar con SIIGO');
            }

            console.log('📦 Iniciando sincronización programada de stock...');

            // Obtener todos los productos con siigo_id
            const [products] = await connection.execute(`
                SELECT id, siigo_id, product_name, available_quantity, is_active 
                FROM products 
                WHERE siigo_id IS NOT NULL 
                ORDER BY IFNULL(last_sync_at, '1970-01-01') ASC
                LIMIT 50
            `);

            console.log(`🔍 Encontrados ${products.length} productos para sincronizar stock`);

            let updated = 0;
            let errors = 0;

            for (const product of products) {
                try {
                    await this.updateProductStock(connection, product);
                    updated++;
                    
                    // Rate limiting - esperar entre requests
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                } catch (error) {
                    console.error(`❌ Error actualizando stock producto ${product.siigo_id}:`, error.message);
                    errors++;
                }
            }

            console.log(`✅ Sincronización programada completada: ${updated} actualizados, ${errors} errores`);

        } catch (error) {
            console.error('❌ Error en sincronización programada:', error);
        } finally {
            await connection.end();
        }
    }

    async updateProductStock(connection, product) {
        try {
            // Obtener datos del producto desde SIIGO usando el endpoint correcto
            const headers = await siigoService.getHeaders();
            const response = await axios.get(
                `${siigoService.getBaseUrl()}/v1/products?code=${product.siigo_id}`,
                { headers }
            );

            // La respuesta viene en results array, tomar el primer producto
            if (!response.data.results || response.data.results.length === 0) {
                throw new Error(`Product ${product.siigo_id} not found in SIIGO`);
            }
            
            const siigoProduct = response.data.results[0];
            const currentStock = siigoProduct.available_quantity || 0;
            const currentActive = siigoProduct.active !== false; // SIIGO active field

            // Verificar si hay cambios en stock o estado activo
            const stockChanged = currentStock !== product.available_quantity;
            const activeChanged = currentActive !== (product.is_active !== 0); // Convert DB boolean to boolean
            
            if (stockChanged || activeChanged) {
                await connection.execute(`
                    UPDATE products 
                    SET available_quantity = ?,
                        is_active = ?,
                        stock_updated_at = NOW(),
                        last_sync_at = NOW()
                    WHERE id = ?
                `, [currentStock, currentActive, product.id]);

                let changeMsg = `📊 ${product.product_name}:`;
                const changes = [];
                if (stockChanged) {
                    changes.push(`Stock: ${product.available_quantity} → ${currentStock}`);
                }
                if (activeChanged) {
                    changes.push(`Estado: ${product.is_active ? 'Activo' : 'Inactivo'} → ${currentActive ? 'Activo' : 'Inactivo'}`);
                }
                console.log(`${changeMsg} ${changes.join(', ')}`);
                
                // Emitir evento de actualización si hay WebSocket
                if (global.io) {
                    global.io.emit('stock_updated', {
                        productId: product.id,
                        siigoProductId: product.siigo_id,
                        productName: product.product_name,
                        oldStock: product.available_quantity,
                        newStock: currentStock,
                        oldActive: product.is_active !== 0,
                        newActive: currentActive,
                        source: 'scheduled_sync',
                        timestamp: new Date().toISOString()
                    });
                }
                
                return true;
            } else {
                // Actualizar solo la fecha de sincronización
                await connection.execute(`
                    UPDATE products 
                    SET last_sync_at = NOW()
                    WHERE id = ?
                `, [product.id]);
                
                return false;
            }

        } catch (error) {
            if (error.response?.status === 404) {
                // Producto no encontrado en SIIGO, marcar como inactivo
                await connection.execute(`
                    UPDATE products 
                    SET is_active = false,
                        last_sync_at = NOW()
                    WHERE id = ?
                `, [product.id]);
                console.log(`⚠️  Producto ${product.siigo_id} no encontrado en SIIGO, marcado como inactivo`);
            } else {
                throw error;
            }
        }
    }

    async startAutoSync() {
        if (this.syncInterval) {
            return; // Ya está iniciado
        }

        console.log(`🚀 Iniciando sistema completo de sincronización de stock...`);
        console.log(`📅 Sincronización programada cada ${this.SYNC_INTERVAL / 60000} minutos`);
        console.log(`🔔 Webhooks para actualizaciones inmediatas`);
        
        // Configurar webhooks primero (para actualizaciones inmediatas)
        try {
            if (!this.webhooksConfigured) {
                console.log('🔧 Configurando webhooks de SIIGO...');
                await this.webhookService.setupStockWebhooks();
                this.webhooksConfigured = true;
                console.log('✅ Webhooks configurados exitosamente');
            }
        } catch (error) {
            console.error('⚠️  Error configurando webhooks (continuando con sincronización programada):', error.message);
        }
        
        // Ejecutar primera sincronización inmediatamente
        this.syncProductStock();
        
        // Configurar intervalo de sincronización programada
        this.syncInterval = setInterval(() => {
            this.syncProductStock();
        }, this.SYNC_INTERVAL);
        
        console.log('✅ Sistema de sincronización de stock iniciado completamente');
    }

    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('🛑 Sincronización automática de stock detenida');
        }
    }

    async syncSpecificProduct(siigoProductId) {
        const connection = await this.getConnection();
        
        try {
            if (!await this.ensureValidToken()) {
                throw new Error('No se pudo autenticar con SIIGO');
            }

            // Buscar el producto en la base de datos
            const [products] = await connection.execute(`
                SELECT id, siigo_id, product_name, available_quantity, is_active 
                FROM products 
                WHERE siigo_id = ?
            `, [siigoProductId]);

            if (products.length === 0) {
                console.log(`⚠️  Producto ${siigoProductId} no encontrado en base de datos local`);
                return false;
            }

            const product = products[0];
            const updated = await this.updateProductStock(connection, product);
            
            console.log(`🔄 Producto ${siigoProductId} sincronizado: ${updated ? 'actualizado' : 'sin cambios'}`);
            return updated;

        } catch (error) {
            console.error(`❌ Error sincronizando producto específico ${siigoProductId}:`, error.message);
            return false;
        } finally {
            await connection.end();
        }
    }

    async getStockStats() {
        const connection = await this.getConnection();
        
        try {
            // Estadísticas de productos sincronizados
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_products,
                    COUNT(CASE WHEN last_sync_at IS NOT NULL THEN 1 END) as synced_products,
                    COUNT(CASE WHEN stock_updated_at > DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as updated_today,
                    AVG(available_quantity) as avg_stock,
                    MAX(last_sync_at) as last_sync_time
                FROM products 
                WHERE siigo_id IS NOT NULL
            `);

            // Logs de webhooks recientes
            const [webhookStats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_webhooks,
                    COUNT(CASE WHEN processed = true THEN 1 END) as processed_webhooks,
                    COUNT(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as webhooks_last_hour
                FROM webhook_logs 
                WHERE topic = 'public.siigoapi.products.stock.update'
            `);

            return {
                products: stats[0],
                webhooks: webhookStats[0],
                webhooksConfigured: this.webhooksConfigured,
                syncRunning: this.syncInterval !== null
            };

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de stock:', error);
            return null;
        } finally {
            await connection.end();
        }
    }
}

module.exports = StockSyncService;
