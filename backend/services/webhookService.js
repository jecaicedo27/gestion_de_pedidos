const mysql = require('mysql2/promise');
const axios = require('axios');
const siigoService = require('./siigoService');
const customerService = require('./customerService');
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
            const response = await siigoService.makeRequestWithRetry(async () => {
                return await axios.post(`${siigoService.getBaseUrl()}/v1/webhooks`, subscriptionData, {
                    headers,
                    timeout: 30000
                });
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
            const status = error.response?.status;
            const data = error.response?.data;
            console.error(`❌ Error suscribiendo a webhook ${topic}:`, error.message, status ? `status=${status}` : '');
            if (data) {
                try {
                    console.error('📦 Respuesta de error SIIGO (webhook):', JSON.stringify(data));
                } catch (_e) {
                    console.error('📦 Respuesta de error SIIGO (webhook):', data);
                }
            }
            throw error;
        } finally {
            await connection.end();
        }
    }

    async setupStockWebhooks() {
        try {
            console.log('🚀 Configurando webhooks de stock...');
            
            // Validar URL del webhook (SIIGO requiere URL pública HTTPS)
            if (!this.webhookBaseUrl || !/^https:\/\/.+/i.test(this.webhookBaseUrl)) {
                console.warn(`⚠️ URL de webhook no segura o inválida (${this.webhookBaseUrl}). Salteando suscripciones. Configure WEBHOOK_BASE_URL con HTTPS público.`);
                return [];
            }

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
                    
                    // Pausa adaptativa tras suscripción para evitar 429
                    const baseDelay = Math.min(Math.max(siigoService.rateLimitDelay || 1000, 1000), 5000);
                    const jitter = Math.floor(Math.random() * 500);
                    const pause = baseDelay + jitter;
                    console.log(`⏱️ Pausa entre suscripciones: ${pause}ms`);
                    await new Promise(resolve => setTimeout(resolve, pause));
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

    async setupCustomerWebhooks() {
        try {
            console.log('🚀 Configurando webhooks de clientes...');
            
            if (!this.webhookBaseUrl || !/^https:\/\/.+/i.test(this.webhookBaseUrl)) {
                console.warn(`⚠️ URL de webhook no segura o inválida (${this.webhookBaseUrl}). Salteando suscripciones de clientes. Configure WEBHOOK_BASE_URL con HTTPS público.`);
                return [];
            }

            const topics = [
                'public.siigoapi.customers.create',
                'public.siigoapi.customers.update'
            ];

            const subscriptions = [];

            for (const topic of topics) {
                try {
                    const subscription = await this.subscribeToWebhook(topic);
                    subscriptions.push(subscription);

                    const baseDelay = Math.min(Math.max(siigoService.rateLimitDelay || 1000, 1000), 5000);
                    const jitter = Math.floor(Math.random() * 500);
                    const pause = baseDelay + jitter;
                    console.log(`⏱️ Pausa entre suscripciones (clientes): ${pause}ms`);
                    await new Promise(resolve => setTimeout(resolve, pause));
                } catch (error) {
                    console.error(`❌ Error configurando webhook ${topic}:`, error.message);
                }
            }

            console.log(`✅ Webhooks de clientes configurados: ${subscriptions.length}/${topics.length}`);
            return subscriptions;

        } catch (error) {
            console.error('❌ Error configurando webhooks de clientes:', error);
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
                    case 'public.siigoapi.customers.create':
                        processed = await this.processCustomerCreate(connection, payload);
                        break;
                    case 'public.siigoapi.customers.update':
                        processed = await this.processCustomerUpdate(connection, payload);
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
            console.error('❌ Error procesando webhook payload:', error.message);
            throw error;
        } finally {
            await connection.end();
        }
    }

    async processStockUpdate(connection, payload) {
        try {
            const siigoId = payload.id;
            const siigoCode = payload.code;
            const newStock = typeof payload.available_quantity === 'number'
                ? payload.available_quantity
                : (typeof payload.new_stock === 'number' ? payload.new_stock : 0);

            // Intentar múltiples estrategias de emparejamiento para soportar filas con siigo_id=UUID o siigo_id=code
            let productRow = null;

            // 1) siigo_id = UUID (payload.id)
            const [byUuid] = await connection.execute(`
                SELECT id, product_name, available_quantity, siigo_id, internal_code 
                FROM products 
                WHERE siigo_id = ? AND is_active = 1
            `, [siigoId]);
            if (byUuid.length > 0) productRow = byUuid[0];

            // 2) siigo_id = code (algunas filas guardan el code en siigo_id)
            if (!productRow && siigoCode) {
                const [bySiigoCode] = await connection.execute(`
                    SELECT id, product_name, available_quantity, siigo_id, internal_code 
                    FROM products 
                    WHERE siigo_id = ? AND is_active = 1
                `, [siigoCode]);
                if (bySiigoCode.length > 0) productRow = bySiigoCode[0];
            }

            // 3) internal_code = code (fallback adicional)
            if (!productRow && siigoCode) {
                const [byInternal] = await connection.execute(`
                    SELECT id, product_name, available_quantity, siigo_id, internal_code 
                    FROM products 
                    WHERE internal_code = ? AND is_active = 1
                `, [siigoCode]);
                if (byInternal.length > 0) productRow = byInternal[0];
            }

            if (!productRow) {
                console.log(`⚠️  Producto no encontrado por siigo_id=${siigoId} ni code=${siigoCode}`);
                return false;
            }

            const oldStock = productRow.available_quantity || 0;

            // Solo actualizar si hay cambio real
            if (newStock !== oldStock) {
                await connection.execute(`
                    UPDATE products 
                    SET available_quantity = ?,
                        stock_updated_at = NOW(),
                        updated_at = NOW()
                    WHERE id = ?
                `, [newStock, productRow.id]);

                // Actualizar log con información de stock (indexado por siigo_product_id=UUID del webhook)
                await connection.execute(`
                    UPDATE webhook_logs 
                    SET old_stock = ?, new_stock = ?
                    WHERE siigo_product_id = ? 
                      AND topic = 'public.siigoapi.products.stock.update'
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [oldStock, newStock, siigoId]);

                console.log(`📊 Stock actualizado vía webhook para ${productRow.product_name}: ${oldStock} → ${newStock}`);

                // Emitir evento WebSocket si está disponible
                if (global.io) {
                    global.io.emit('stock_updated', {
                        productId: productRow.id,
                        siigoProductId: siigoId,
                        productName: productRow.product_name,
                        oldStock,
                        newStock,
                        source: 'webhook',
                        timestamp: new Date().toISOString()
                    });
                }

                return true;
            } else {
                console.log(`📊 Sin cambios de stock para producto id=${productRow.id} siigo_id=${siigoId}`);
                return true;
            }

        } catch (error) {
            console.error('❌ Error procesando actualización de stock:', error);
            throw error;
        }
    }

    async processProductUpdate(connection, payload) {
        try {
            const siigoId = payload.id;
            const siigoCode = payload.code;

            // 1) Buscar el producto local soportando las 3 variantes (igual que stock.update)
            let current = null;

            // a) siigo_id = UUID
            const [byUuid] = await connection.execute(`
                SELECT id, product_name, available_quantity, is_active, siigo_id 
                FROM products 
                WHERE siigo_id = ? 
                LIMIT 1
            `, [siigoId]);
            if (byUuid.length > 0) current = byUuid[0];

            // b) siigo_id = code
            if (!current && siigoCode) {
                const [bySiigoCode] = await connection.execute(`
                    SELECT id, product_name, available_quantity, is_active, siigo_id 
                    FROM products 
                    WHERE siigo_id = ? 
                    LIMIT 1
                `, [siigoCode]);
                if (bySiigoCode.length > 0) current = bySiigoCode[0];
            }

            // c) internal_code = code
            if (!current && siigoCode) {
                const [byInternal] = await connection.execute(`
                    SELECT id, product_name, available_quantity, is_active, siigo_id 
                    FROM products 
                    WHERE internal_code = ? 
                    LIMIT 1
                `, [siigoCode]);
                if (byInternal.length > 0) current = byInternal[0];
            }

            if (!current) {
                console.log(`⚠️  Producto no encontrado (product.update) por siigo_id=${siigoId} ni code=${siigoCode}`);
                return false;
            }

            const oldStock = Number(current.available_quantity || 0);
            const newName = payload.name || current.product_name;
            const newActive = payload.active ? 1 : 0;

            // 2) Determinar nuevo stock del payload; si no viene, consultar SIIGO (fallback global)
            let newStock = null;
            if (typeof payload.available_quantity === 'number') newStock = Number(payload.available_quantity);
            else if (typeof payload.new_stock === 'number') newStock = Number(payload.new_stock);
            else if (typeof payload.stock === 'number') newStock = Number(payload.stock);

            // Fallback: fetch directo a SIIGO cuando el webhook no trae stock
            if (newStock === null) {
                try {
                    const headers = await siigoService.getHeaders();
                    let resp;
                    const isUuid = typeof siigoId === 'string' && /^[0-9a-fA-F-]{36}$/.test(siigoId);
                    if (isUuid) {
                        resp = await siigoService.makeRequestWithRetry(async () =>
                            axios.get(`${siigoService.getBaseUrl()}/v1/products/${siigoId}`, { headers, timeout: 30000 })
                        );
                    } else if (siigoCode) {
                        resp = await siigoService.makeRequestWithRetry(async () =>
                            axios.get(`${siigoService.getBaseUrl()}/v1/products`, { headers, params: { code: siigoCode }, timeout: 30000 })
                        );
                    }
                    const d = resp?.data;
                    const prod = Array.isArray(d?.results) ? d.results[0] : d;
                    if (prod && typeof prod.available_quantity === 'number') {
                        newStock = Number(prod.available_quantity);
                    } else {
                        newStock = oldStock; // dejar igual si no se pudo obtener
                    }
                } catch (e) {
                    console.warn('⚠️ Fallback SIIGO en product.update falló:', e?.message || e);
                    newStock = oldStock;
                }
            }

            // 3) Actualizar en BD (marcando stock_updated_at y last_sync_at si cambió)
            await connection.execute(`
                UPDATE products
                SET product_name = ?,
                    is_active = ?,
                    available_quantity = ?,
                    stock_updated_at = IF(available_quantity <> ?, NOW(), stock_updated_at),
                    last_sync_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
            `, [newName, newActive, newStock, newStock, current.id]);

            const stockChanged = newStock !== oldStock;

            console.log(`📝 Producto actualizado vía webhook (products.update): ${newName}` + (stockChanged ? ` | Stock: ${oldStock} → ${newStock}` : ''));

            // 4) Emitir evento en tiempo real si cambió el stock
            if (stockChanged && global.io) {
                try {
                    const eventPayload = {
                        productId: current.id,
                        siigoProductId: siigoId,
                        productName: newName,
                        oldStock,
                        newStock,
                        source: 'webhook_product_update',
                        timestamp: new Date().toISOString()
                    };
                    global.io.emit('stock_updated', eventPayload);
                    global.io.to('siigo-updates').emit('stock_updated', eventPayload);
                } catch (e) {
                    console.warn('⚠️ Error emitiendo evento WS stock_updated (product.update):', e?.message || e);
                }
            }

            return true;

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

    async processCustomerCreate(connection, payload) {
        try {
            const customerId = payload.id;
            if (!customerId) {
                console.log('⚠️  Webhook de cliente sin id');
                return false;
            }

            // Obtener datos completos del cliente y guardar/actualizar en BD local
            const details = await siigoService.getCustomer(String(customerId));
            if (details && details.id) {
                await customerService.saveCustomer(details);
                console.log(`👤 Cliente creado sincronizado: ${details.id}`);
                return true;
            }

            console.log(`⚠️  No se pudo obtener detalles para cliente ${customerId}`);
            return false;
        } catch (error) {
            console.error('❌ Error procesando creación de cliente:', error);
            throw error;
        }
    }

    async processCustomerUpdate(connection, payload) {
        try {
            const customerId = payload.id;
            if (!customerId) {
                console.log('⚠️  Webhook de cliente (update) sin id');
                return false;
            }

            const details = await siigoService.getCustomer(String(customerId));
            if (details && details.id) {
                await customerService.saveCustomer(details);
                console.log(`👤 Cliente actualizado sincronizado: ${details.id}`);
                return true;
            }

            console.log(`⚠️  No se pudo obtener detalles para cliente ${customerId} (update)`);
            return false;
        } catch (error) {
            console.error('❌ Error procesando actualización de cliente:', error);
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
