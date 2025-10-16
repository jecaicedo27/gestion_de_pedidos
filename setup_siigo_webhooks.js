const mysql = require('mysql2/promise');
const WebhookService = require('./backend/services/webhookService');
require('dotenv').config();

class SiigoWebhookSetup {
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
        
        this.webhookService = new WebhookService();
    }

    async getConnection() {
        return await mysql.createConnection(this.dbConfig);
    }

    async checkWebhookTables() {
        const connection = await this.getConnection();
        
        try {
            console.log('🔍 Verificando tablas de webhooks...');
            
            // Verificar tabla webhook_subscriptions
            const [subscriptionsTable] = await connection.execute(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = ? AND table_name = 'webhook_subscriptions'
            `, [this.dbConfig.database]);

            // Verificar tabla webhook_logs
            const [logsTable] = await connection.execute(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = ? AND table_name = 'webhook_logs'
            `, [this.dbConfig.database]);

            if (subscriptionsTable[0].count === 0) {
                console.log('⚠️  Tabla webhook_subscriptions no existe, creándola...');
                await connection.execute(`
                    CREATE TABLE webhook_subscriptions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        webhook_id VARCHAR(255) NOT NULL UNIQUE,
                        application_id VARCHAR(255) NOT NULL,
                        topic VARCHAR(255) NOT NULL,
                        url TEXT NOT NULL,
                        company_key VARCHAR(255),
                        active BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_webhook_id (webhook_id),
                        INDEX idx_topic (topic),
                        INDEX idx_active (active)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                `);
                console.log('✅ Tabla webhook_subscriptions creada');
            } else {
                console.log('✅ Tabla webhook_subscriptions existe');
            }

            if (logsTable[0].count === 0) {
                console.log('⚠️  Tabla webhook_logs no existe, creándola...');
                await connection.execute(`
                    CREATE TABLE webhook_logs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        topic VARCHAR(255) NOT NULL,
                        company_key VARCHAR(255),
                        product_id VARCHAR(255),
                        siigo_product_id VARCHAR(255),
                        product_code VARCHAR(255),
                        payload JSON,
                        processed BOOLEAN DEFAULT false,
                        error_message TEXT,
                        old_stock INT,
                        new_stock INT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_topic (topic),
                        INDEX idx_product_id (product_id),
                        INDEX idx_siigo_product_id (siigo_product_id),
                        INDEX idx_processed (processed),
                        INDEX idx_created_at (created_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                `);
                console.log('✅ Tabla webhook_logs creada');
            } else {
                console.log('✅ Tabla webhook_logs existe');
            }

        } finally {
            await connection.end();
        }
    }

    async checkExistingWebhooks() {
        const connection = await this.getConnection();
        
        try {
            console.log('🔍 Verificando webhooks existentes...');
            
            const [existing] = await connection.execute(`
                SELECT webhook_id, topic, active, created_at 
                FROM webhook_subscriptions 
                ORDER BY created_at DESC
            `);

            if (existing.length > 0) {
                console.log(`📋 Webhooks existentes encontrados: ${existing.length}`);
                existing.forEach(webhook => {
                    console.log(`  - ${webhook.topic} (${webhook.active ? 'Activo' : 'Inactivo'}) - ID: ${webhook.webhook_id}`);
                });
            } else {
                console.log('📋 No se encontraron webhooks existentes');
            }

            return existing;

        } finally {
            await connection.end();
        }
    }

    async setupWebhooks() {
        try {
            console.log('🚀 Iniciando configuración de webhooks SIIGO...');
            
            // Verificar tablas
            await this.checkWebhookTables();
            
            // Verificar webhooks existentes
            const existingWebhooks = await this.checkExistingWebhooks();
            
            // Configurar webhooks
            console.log('🔔 Configurando webhooks de stock...');
            const subscriptions = await this.webhookService.setupStockWebhooks();
            
            console.log(`✅ Configuración completada: ${subscriptions.length} webhooks configurados`);
            
            // Mostrar resumen
            await this.showWebhookStatus();
            
            return subscriptions;

        } catch (error) {
            console.error('❌ Error configurando webhooks:', error);
            
            if (error.response) {
                console.error('📋 Respuesta del servidor SIIGO:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            
            throw error;
        }
    }

    async showWebhookStatus() {
        const connection = await this.getConnection();
        
        try {
            console.log('\n📊 Estado actual de webhooks:');
            console.log('='.repeat(50));
            
            // Suscripciones activas
            const [subscriptions] = await connection.execute(`
                SELECT topic, webhook_id, active, created_at 
                FROM webhook_subscriptions 
                ORDER BY topic
            `);

            if (subscriptions.length > 0) {
                console.log('🔔 Suscripciones activas:');
                subscriptions.forEach(sub => {
                    const status = sub.active ? '✅' : '❌';
                    console.log(`  ${status} ${sub.topic}`);
                    console.log(`      ID: ${sub.webhook_id}`);
                    console.log(`      Creado: ${sub.created_at}`);
                });
            }

            // Logs recientes
            const [recentLogs] = await connection.execute(`
                SELECT topic, processed, created_at, error_message
                FROM webhook_logs 
                ORDER BY created_at DESC 
                LIMIT 10
            `);

            if (recentLogs.length > 0) {
                console.log('\n📥 Logs recientes de webhooks:');
                recentLogs.forEach(log => {
                    const status = log.processed ? '✅' : (log.error_message ? '❌' : '⏳');
                    console.log(`  ${status} ${log.topic} - ${log.created_at}`);
                    if (log.error_message) {
                        console.log(`      Error: ${log.error_message}`);
                    }
                });
            }

            // URL del webhook
            const webhookUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:5000/api/webhooks';
            console.log(`\n🌐 URL de webhook configurada: ${webhookUrl}/receive`);
            
            console.log('='.repeat(50));

        } finally {
            await connection.end();
        }
    }

    async testWebhookEndpoint() {
        console.log('🧪 Verificando endpoint de webhooks...');
        
        const testPayload = {
            topic: 'public.siigoapi.products.stock.update',
            company_key: 'test-company',
            id: 'test-product-id',
            code: 'TEST001',
            name: 'Producto de Prueba',
            available_quantity: 10
        };

        try {
            const processed = await this.webhookService.processWebhookPayload(testPayload);
            
            if (processed) {
                console.log('✅ Endpoint de webhooks funcionando correctamente');
            } else {
                console.log('⚠️  Endpoint procesó el webhook pero no encontró el producto');
            }

        } catch (error) {
            console.error('❌ Error testando endpoint de webhooks:', error.message);
        }
    }
}

async function main() {
    const setup = new SiigoWebhookSetup();
    
    try {
        console.log('🎯 Configuración de Webhooks SIIGO');
        console.log('================================');
        
        // Configurar webhooks
        await setup.setupWebhooks();
        
        // Test del endpoint
        await setup.testWebhookEndpoint();
        
        console.log('\n🎉 Configuración de webhooks completada exitosamente!');
        console.log('📝 Los webhooks están configurados para recibir notificaciones en tiempo real');
        console.log('📊 El sistema actualizará automáticamente el stock cuando haya cambios en SIIGO');

    } catch (error) {
        console.error('❌ Error en configuración de webhooks:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = SiigoWebhookSetup;
