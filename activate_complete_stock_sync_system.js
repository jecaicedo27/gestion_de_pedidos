const mysql = require('mysql2/promise');
const StockSyncService = require('./backend/services/stockSyncService');
const WebhookService = require('./backend/services/webhookService');
require('dotenv').config({ path: 'backend/.env' });

class CompleteStockSyncSystem {
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
        
        this.stockSyncService = new StockSyncService();
        this.webhookService = new WebhookService();
    }

    async getConnection() {
        return await mysql.createConnection(this.dbConfig);
    }

    async setupDatabase() {
        const connection = await this.getConnection();
        
        try {
            console.log('🗄️  Configurando base de datos para webhooks...');

            // Crear tablas de webhook si no existen
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS webhook_subscriptions (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    webhook_id VARCHAR(255) UNIQUE NOT NULL,
                    application_id VARCHAR(255) NOT NULL,
                    topic VARCHAR(255) NOT NULL,
                    url VARCHAR(500) NOT NULL,
                    company_key VARCHAR(255),
                    active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            await connection.execute(`
                CREATE TABLE IF NOT EXISTS webhook_logs (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    webhook_id VARCHAR(255),
                    topic VARCHAR(255) NOT NULL,
                    company_key VARCHAR(255),
                    product_id VARCHAR(255),
                    siigo_product_id VARCHAR(255),
                    product_code VARCHAR(255),
                    old_stock INT,
                    new_stock INT,
                    payload JSON,
                    processed BOOLEAN DEFAULT false,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Crear índices si no existen
            try {
                await connection.execute(`CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_topic ON webhook_subscriptions(topic)`);
                await connection.execute(`CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(active)`);
                await connection.execute(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON webhook_logs(processed)`);
                await connection.execute(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_siigo_product_id ON webhook_logs(siigo_product_id)`);
                await connection.execute(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at)`);
            } catch (indexError) {
                console.log('⚠️  Algunos índices ya existen, continuando...');
            }

            // Verificar que la tabla products tenga las columnas necesarias para stock sync
            try {
                await connection.execute(`
                    ALTER TABLE products 
                    ADD COLUMN IF NOT EXISTS stock_updated_at TIMESTAMP NULL,
                    ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP NULL
                `);
            } catch (columnError) {
                console.log('⚠️  Columnas de stock sync ya existen, continuando...');
            }

            console.log('✅ Base de datos configurada correctamente');

        } catch (error) {
            console.error('❌ Error configurando base de datos:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    async checkSiigoConfiguration() {
        console.log('🔧 Verificando configuración de SIIGO...');

        const requiredVars = [
            'SIIGO_API_USERNAME',
            'SIIGO_API_ACCESS_KEY',
            'SIIGO_PARTNER_ID'
        ];

        const missing = requiredVars.filter(varName => !process.env[varName]);

        if (missing.length > 0) {
            console.error('❌ Faltan variables de entorno de SIIGO:', missing);
            console.log('💡 Asegúrate de configurar estas variables en tu archivo .env:');
            missing.forEach(varName => {
                console.log(`   ${varName}=tu_valor_aqui`);
            });
            return false;
        }

        // Verificar URL base para webhooks
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL;
        if (!webhookBaseUrl) {
            console.log('⚠️  WEBHOOK_BASE_URL no configurada, usando URL local por defecto');
            console.log('💡 Para producción, configura WEBHOOK_BASE_URL=https://tu-dominio.com/api/webhooks');
        }

        console.log('✅ Configuración de SIIGO verificada');
        return true;
    }

    async testSiigoConnection() {
        console.log('🔐 Probando conexión con SIIGO API...');

        try {
            const connected = await this.stockSyncService.authenticate();
            
            if (connected) {
                console.log('✅ Conexión con SIIGO API exitosa');
                return true;
            } else {
                console.error('❌ No se pudo conectar con SIIGO API');
                return false;
            }
        } catch (error) {
            console.error('❌ Error probando conexión con SIIGO:', error.message);
            return false;
        }
    }

    async configureWebhooks() {
        console.log('🔔 Configurando webhooks de SIIGO...');

        try {
            const subscriptions = await this.webhookService.setupStockWebhooks();
            
            if (subscriptions.length > 0) {
                console.log(`✅ ${subscriptions.length} webhooks configurados exitosamente:`);
                subscriptions.forEach(sub => {
                    console.log(`   - ${sub.topic}: ${sub.id}`);
                });
                return true;
            } else {
                console.log('⚠️  No se pudieron configurar webhooks (continuando con sync programado)');
                return false;
            }
        } catch (error) {
            console.error('❌ Error configurando webhooks:', error.message);
            console.log('⚠️  Continuando solo con sincronización programada');
            return false;
        }
    }

    async startStockSyncSystem() {
        console.log('🚀 Iniciando sistema completo de sincronización de stock...');

        try {
            await this.stockSyncService.startAutoSync();
            console.log('✅ Sistema de sincronización iniciado correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error iniciando sistema de sincronización:', error);
            return false;
        }
    }

    async getSystemStatus() {
        try {
            const stats = await this.stockSyncService.getStockStats();
            
            console.log('\n📊 ESTADO DEL SISTEMA:');
            console.log('=====================================');
            
            if (stats) {
                console.log(`📦 Productos totales: ${stats.products.total_products}`);
                console.log(`🔄 Productos sincronizados: ${stats.products.synced_products}`);
                console.log(`📈 Actualizados hoy: ${stats.products.updated_today}`);
                console.log(`📊 Stock promedio: ${stats.products.avg_stock ? Math.round(stats.products.avg_stock) : 'N/A'}`);
                console.log(`⏰ Última sincronización: ${stats.products.last_sync_time || 'Nunca'}`);
                
                if (stats.webhooks) {
                    console.log(`🔔 Total webhooks: ${stats.webhooks.total_webhooks}`);
                    console.log(`✅ Webhooks procesados: ${stats.webhooks.processed_webhooks}`);
                    console.log(`⏱️  Webhooks última hora: ${stats.webhooks.webhooks_last_hour}`);
                }
                
                console.log(`🔗 Webhooks configurados: ${stats.webhooksConfigured ? 'Sí' : 'No'}`);
                console.log(`▶️  Sync automático activo: ${stats.syncRunning ? 'Sí' : 'No'}`);
            } else {
                console.log('⚠️  No se pudieron obtener estadísticas');
            }
            
            console.log('=====================================\n');

        } catch (error) {
            console.error('❌ Error obteniendo estado del sistema:', error);
        }
    }

    async testWebhookEndpoint() {
        console.log('🧪 Probando endpoint de webhooks...');

        const axios = require('axios');
        
        try {
            const testPayload = {
                company_key: "test_company",
                username: "test_user", 
                topic: "public.siigoapi.products.stock.update",
                id: "test_product_123",
                code: "TEST001",
                name: "Producto de Prueba - Stock Sync",
                available_quantity: 25
            };

            const response = await axios.post('http://localhost:5000/api/webhooks/test', testPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test_token'}`
                },
                timeout: 5000
            });

            if (response.data.success) {
                console.log('✅ Endpoint de webhooks funciona correctamente');
                return true;
            } else {
                console.log('⚠️  Endpoint responde pero hay problemas:', response.data.message);
                return false;
            }

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.log('⚠️  Servidor backend no está ejecutándose en puerto 5000');
            } else {
                console.log('⚠️  Error probando endpoint:', error.message);
            }
            return false;
        }
    }

    async runCompleteSetup() {
        console.log('\n🎯 CONFIGURACIÓN COMPLETA DEL SISTEMA DE STOCK SYNC');
        console.log('====================================================\n');

        try {
            // 1. Configurar base de datos
            await this.setupDatabase();
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2. Verificar configuración de SIIGO
            const siigoConfigured = await this.checkSiigoConfiguration();
            if (!siigoConfigured) {
                console.log('❌ Sistema no se puede iniciar sin configuración de SIIGO');
                return false;
            }

            // 3. Probar conexión con SIIGO
            const siigoConnected = await this.testSiigoConnection();
            if (!siigoConnected) {
                console.log('❌ Sistema no se puede iniciar sin conexión a SIIGO');
                return false;
            }

            // 4. Configurar webhooks (opcional)
            await this.configureWebhooks();
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 5. Iniciar sistema de sincronización
            const systemStarted = await this.startStockSyncSystem();
            if (!systemStarted) {
                console.log('❌ Error iniciando sistema de sincronización');
                return false;
            }

            // 6. Probar endpoint de webhooks (opcional)
            await this.testWebhookEndpoint();

            // 7. Mostrar estado del sistema
            await new Promise(resolve => setTimeout(resolve, 3000));
            await this.getSystemStatus();

            console.log('🎉 ¡SISTEMA DE STOCK SYNC CONFIGURADO COMPLETAMENTE!');
            console.log('====================================================');
            console.log('📅 Sincronización programada: Cada 5 minutos');
            console.log('🔔 Webhooks: Para actualizaciones inmediatas');
            console.log('📊 WebSocket: Para notificaciones en tiempo real');
            console.log('🛡️  Rate limiting: Protección contra exceso de requests');
            console.log('📝 Logs: Seguimiento completo de todas las operaciones');
            console.log('\n✅ El sistema está listo y funcionando!\n');

            return true;

        } catch (error) {
            console.error('❌ Error en configuración completa:', error);
            return false;
        }
    }

    async stopSystem() {
        console.log('🛑 Deteniendo sistema de sincronización...');
        this.stockSyncService.stopAutoSync();
        console.log('✅ Sistema detenido correctamente');
    }
}

// Ejecutar configuración si se llama directamente
if (require.main === module) {
    const system = new CompleteStockSyncSystem();
    
    system.runCompleteSetup()
        .then(success => {
            if (success) {
                console.log('🚀 Sistema configurado exitosamente');
                console.log('💡 Para detener el sistema, presiona Ctrl+C');
                
                // Mantener el proceso activo
                setInterval(() => {
                    system.getSystemStatus();
                }, 5 * 60 * 1000); // Mostrar estado cada 5 minutos
                
            } else {
                console.log('❌ Error en la configuración del sistema');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Error crítico:', error);
            process.exit(1);
        });

    // Manejar señales de cierre
    process.on('SIGINT', async () => {
        console.log('\n🛑 Recibida señal de cierre...');
        await system.stopSystem();
        process.exit(0);
    });
}

module.exports = CompleteStockSyncSystem;
