const mysql = require('mysql2/promise');
const fs = require('fs').promises;
require('dotenv').config();

async function runWebhooksMigration() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root', 
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gestion_pedidos_dev',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });

    try {
        console.log('🚀 Ejecutando migración de webhooks...');
        
        // Ejecutar cada statement por separado en el orden correcto
        console.log('📝 Creando tabla webhook_subscriptions...');
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

        console.log('📝 Creando tabla webhook_logs...');
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

        console.log('📝 Creando índices...');
        await connection.execute('CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_topic ON webhook_subscriptions(topic)');
        await connection.execute('CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(active)');
        await connection.execute('CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON webhook_logs(processed)');
        await connection.execute('CREATE INDEX IF NOT EXISTS idx_webhook_logs_siigo_product_id ON webhook_logs(siigo_product_id)');
        await connection.execute('CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at)');
        
        console.log('✅ Migración de webhooks completada exitosamente');
        
        // Verificar que las tablas se crearon correctamente
        const [tables] = await connection.execute(`
            SHOW TABLES LIKE '%webhook%'
        `);
        
        console.log('📋 Tablas de webhooks creadas:');
        tables.forEach(table => {
            console.log(`  - ${Object.values(table)[0]}`);
        });
        
    } catch (error) {
        console.error('❌ Error ejecutando migración de webhooks:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runWebhooksMigration()
        .then(() => {
            console.log('🎉 Migración de webhooks completada');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Error en migración de webhooks:', error);
            process.exit(1);
        });
}

module.exports = { runWebhooksMigration };
