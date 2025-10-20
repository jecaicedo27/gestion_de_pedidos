const mysql = require('mysql2/promise');
const axios = require('axios');
const siigoService = require('./siigoService');
require('dotenv').config();

class WebhookService {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev',
            port: process.env.DB_PORT || 3306,
            charset: 'utf8mb4',
            timezone: '+00:00'
        };
        
        this.siigoConfig = {
            baseUrl: 'https://api.siigo.com',
            username: process.env.SIIGO_USERNAME,
            access_key: process.env.SIIGO_ACCESS_KEY,
            partner_id: process.env.SIIGO_PARTNER_ID
        };
        
        this.token = null;
        this.tokenExpiry = null;
        
        // URL base para recibir webhooks
        this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:5000/api/webhooks';
    }

    async authenticate() {
        try {
            console.log('🔐 Autenticando con SIIGO API para webhooks...');
            
            const token = await siigoService.authenticate();
            this.token = `Bearer ${token}`;
            this.tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutos
            
            console.log('✅ Autenticación exitosa para webhooks');
            return true;
        } catch (error) {
            console.error('❌ Error autenticando con SIIGO para webhooks:', error.message);
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

    async subscribeToWebhook(topic) {
        const connection = await this.getConnection();
        
        try {
            if (!await this.ensureValidToken()) {
                throw new Error('No se pudo autenticar con SIIGO');
            }

            const subscriptionData = {
                application_id: 'GestionPedidos',
                topic: topic,
                url: `${this.webhookBaseUrl}/receive`
            };

            console.log(`🔔 Suscribiendo a webhook: ${topic}`);

            const headers = await siigoService.getHeaders();
            const response = await axios.post(`${siigoService.getBaseUrl()}/v1/webhooks`, subscriptionData, {
                headers
            });

            const subscription = response.data;

            // Guardar suscripción en la base de datos
            await connection.execute(`
                INSERT INTO webhook_subscriptions (
                    webhook_id, application_id, topic, url, company_key, active
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    active = VALUES(active),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                subscription.id,
                subscription.application_id,
                subscription.topic,
                subscription.url,
                subscription.company_key,
                subscription.active
            ]);

            console.log(`✅ Suscripción exitosa a ${topic}:`, subscription.id);
            return subscription;

        } catch (error) {
            console.error(`❌ Error suscribiendo a webhook ${topic}:`, error.message);
            throw error;
        } finally {
            await connection.end();
        }
    }

    async setupStockWebhooks() {
        try {
            console.log('🚀 Configurando webhooks de stock...');
            
            const topics = [
                'public.siigoapi.products.create',
                'public.siigoapi.products.update',
                'public.siigoapi.products.stock.update'
            ];

            const subscriptions = [];

            for (const topic of topics) {
                try {
                    const subscription = await this.subscribeToWebhook(topic);
                    subscriptions.push(subscription);
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`❌ Error configurando webhook ${topic}:`, error.message);
                }
            }

            console.log(`✅ Webhooks configurados: ${subscriptions.length}/${topics.length}`);
            return subscriptions;

        } catch (error) {
            console.error('❌ Error configurando webhooks de stock:', error);
            throw error;
        }
    }

    async processWebhookPayload(payload) {
        const connection = await this.getConnection();
        
        try {
            console.log(`📥 Procesando webhook: ${payload.topic}`);

            // Guardar log del webhook
            const [logResult] = await connection.execute(`
                INSERT INTO webhook_logs (
                    topic, company_key, product_id, siigo_product_id, product_code, payload
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                payload.topic,
                payload.company_key,
                payload.id,
                payload.id, // En SIIGO el id es el siigo_product_id
                payload.code,
                JSON.stringify(payload)
            ]);

            const logId = logResult.insertId;

            // Procesar según el tipo de evento
            let processed = false;
            let errorMessage = null;

            try {
                switch (payload.topic) {
                    case 'public.siigoapi.products.stock.update':
                        processed = await this.processStockUpdate(connection, payload);
                        break;
                    case 'public.siigoapi.products.update':
                        processed = await this.processProductUpdate(connection, payload);
                        break;
                    case 'public.siigoapi.products.create':
                        processed = await this.processProductCreate(connection, payload);
                        break;
                    default:
                        console.log(`⚠️  Evento no manejado: ${payload.topic}`);
                        processed = false;
                }
            } catch (error) {
                console.error(`❌ Error procesando webhook:`, error);
                errorMessage = error.message;
                processed = false;
            }

            // Actualizar log del webhook
            await connection.execute(`
                UPDATE webhook_logs 
                SET processed = ?, error_message = ?
                WHERE id = ?
            `, [processed, errorMessage, logId]);

            return processed;

        } catch (error) {
            console.error('❌ Error procesando webhook:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    async processStockUpdate(connection, payload) {
        try {
            // Buscar el producto en la base de datos local
            const [products] = await connection.execute(`
                SELECT id, product_name, available_quantity 
                FROM products 
                WHERE siigo_id = ? 
                AND is_active = 1
            `, [payload.id]);

            if (products.length === 0) {
                console.log(`⚠️  Producto ${payload.id} no encontrado en base de datos local`);
                return false;
            }

            const product = products[0];
            const newStock = payload.available_quantity || 0;
            const oldStock = product.available_quantity || 0;

            // Solo actualizar si hay cambio real
            if (newStock !== oldStock) {
                await connection.execute(`
                    UPDATE products 
                    SET available_quantity = ?,
                        updated_at = NOW()
                    WHERE siigo_id = ?
                `, [newStock, payload.id]);

                // Actualizar log con información de stock
                await connection.execute(`
                    UPDATE webhook_logs 
                    SET old_stock = ?, new_stock = ?
                    WHERE siigo_product_id = ? 
                    AND topic = 'public.siigoapi.products.stock.update'
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [oldStock, newStock, payload.id]);

                console.log(`📊 Stock actualizado vía webhook para ${product.product_name}: ${oldStock} → ${newStock}`);

                // Emitir evento WebSocket si está disponible
                if (global.io) {
                    global.io.emit('stock_updated', {
                        productId: product.id,
                        siigoProductId: payload.id,
                        productName: product.product_name,
                        oldStock: oldStock,
                        newStock: newStock,
                        source: 'webhook',
                        timestamp: new Date().toISOString()
                    });
                }

                return true;
            } else {
                console.log(`📊 Sin cambios de stock para producto ${payload.id}`);
                return true;
            }

        } catch (error) {
            console.error('❌ Error procesando actualización de stock:', error);
            throw error;
        }
    }

    async processProductUpdate(connection, payload) {
        try {
            // Verificar si el producto existe
            const [products] = await connection.execute(`
                SELECT id FROM products WHERE siigo_id = ? AND is_active = 1
            `, [payload.id]);

            if (products.length > 0) {
                // Actualizar información del producto
                await connection.execute(`
                    UPDATE products 
                    SET product_name = ?, 
                        is_active = ?,
                        available_quantity = ?,
                        updated_at = NOW()
                    WHERE siigo_id = ?
                `, [
                    payload.name,
                    payload.active ? 1 : 0,
                    payload.available_quantity || 0,
                    payload.id
                ]);

                console.log(`📝 Producto actualizado vía webhook: ${payload.name}`);
                return true;
            } else {
                console.log(`⚠️  Producto ${payload.id} no encontrado para actualizar`);
                return false;
            }

        } catch (error) {
            console.error('❌ Error procesando actualización de producto:', error);
            throw error;
        }
    }

    async processProductCreate(connection, payload) {
        try {
            // Verificar si el producto ya existe
            const [existingProducts] = await connection.execute(`
                SELECT id FROM products WHERE siigo_id = ?
            `, [payload.id]);

            if (existingProducts.length === 0) {
                console.log(`➕ Nuevo producto detectado vía webhook: ${payload.name}`);
                // Aquí se podría implementar lógica para crear el producto automáticamente
                // o simplemente registrar que hay un nuevo producto disponible
                return true;
            } else {
                console.log(`📝 Producto ${payload.id} ya existe en base de datos`);
                return true;
            }

        } catch (error) {
            console.error('❌ Error procesando creación de producto:', error);
            throw error;
        }
    }

    async getWebhookSubscriptions() {
        const connection = await this.getConnection();
        
        try {
            const [subscriptions] = await connection.execute(`
                SELECT * FROM webhook_subscriptions 
                WHERE active = true 
                ORDER BY created_at DESC
            `);
            
            return subscriptions;
        } finally {
            await connection.end();
        }
    }

    async getWebhookLogs(limit = 100) {
        const connection = await this.getConnection();
        
        try {
            const [logs] = await connection.execute(`
                SELECT * FROM webhook_logs 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [limit]);
            
            return logs;
        } finally {
            await connection.end();
        }
    }
}

module.exports = WebhookService;
