const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function createCustomersAndQuotationsTables() {
    let connection;
    
    try {
        console.log('🔧 Conectando a la base de datos...');
        
        // Crear conexión a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });

        console.log('✅ Conexión establecida');

        // SQL para crear tabla customers
        const createCustomersTable = `
            CREATE TABLE IF NOT EXISTS customers (
                id INT PRIMARY KEY AUTO_INCREMENT,
                siigo_id VARCHAR(100) UNIQUE NOT NULL,
                document_type VARCHAR(20) NOT NULL,
                identification VARCHAR(50) NOT NULL,
                check_digit VARCHAR(5),
                name VARCHAR(255) NOT NULL,
                commercial_name VARCHAR(255),
                phone VARCHAR(50),
                address VARCHAR(500),
                city VARCHAR(100),
                state VARCHAR(100),
                country VARCHAR(100) DEFAULT 'Colombia',
                email VARCHAR(255),
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_identification (identification),
                INDEX idx_name (name),
                INDEX idx_siigo_id (siigo_id),
                INDEX idx_active (active)
            )
        `;

        // SQL para crear tabla quotations
        const createQuotationsTable = `
            CREATE TABLE IF NOT EXISTS quotations (
                id INT PRIMARY KEY AUTO_INCREMENT,
                quotation_number VARCHAR(50) UNIQUE,
                customer_id INT NOT NULL,
                siigo_customer_id VARCHAR(100) NOT NULL,
                raw_request TEXT NOT NULL,
                processed_request JSON,
                status ENUM('draft', 'processing', 'completed', 'error', 'sent') DEFAULT 'draft',
                total_amount DECIMAL(15,2) DEFAULT 0,
                siigo_quotation_id VARCHAR(100),
                siigo_quotation_url VARCHAR(500),
                processing_notes TEXT,
                error_message TEXT,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (created_by) REFERENCES users(id),
                
                INDEX idx_customer_id (customer_id),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at),
                INDEX idx_quotation_number (quotation_number)
            )
        `;

        // SQL para crear tabla quotation_items
        const createQuotationItemsTable = `
            CREATE TABLE IF NOT EXISTS quotation_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                quotation_id INT NOT NULL,
                product_code VARCHAR(100),
                product_name VARCHAR(255) NOT NULL,
                quantity DECIMAL(10,3) NOT NULL,
                unit_price DECIMAL(15,2),
                discount_percentage DECIMAL(5,2) DEFAULT 0,
                tax_percentage DECIMAL(5,2) DEFAULT 0,
                total_amount DECIMAL(15,2),
                siigo_product_id VARCHAR(100),
                processing_confidence DECIMAL(3,2),
                manual_review_required BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
                
                INDEX idx_quotation_id (quotation_id),
                INDEX idx_product_code (product_code)
            )
        `;

        // SQL para crear tabla chatgpt_processing_log
        const createChatGPTProcessingLogTable = `
            CREATE TABLE IF NOT EXISTS chatgpt_processing_log (
                id INT PRIMARY KEY AUTO_INCREMENT,
                quotation_id INT NOT NULL,
                request_type ENUM('text', 'image') NOT NULL,
                input_content TEXT NOT NULL,
                chatgpt_response JSON,
                tokens_used INT,
                processing_time_ms INT,
                success BOOLEAN DEFAULT TRUE,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
                
                INDEX idx_quotation_id (quotation_id),
                INDEX idx_created_at (created_at)
            )
        `;

        console.log('🔧 Creando tabla customers...');
        await connection.execute(createCustomersTable);
        console.log('✅ Tabla customers creada exitosamente');

        console.log('🔧 Creando tabla quotations...');
        await connection.execute(createQuotationsTable);
        console.log('✅ Tabla quotations creada exitosamente');

        console.log('🔧 Creando tabla quotation_items...');
        await connection.execute(createQuotationItemsTable);
        console.log('✅ Tabla quotation_items creada exitosamente');

        console.log('🔧 Creando tabla chatgpt_processing_log...');
        await connection.execute(createChatGPTProcessingLogTable);
        console.log('✅ Tabla chatgpt_processing_log creada exitosamente');

        // Verificar que las tablas se crearon correctamente
        console.log('🔍 Verificando tablas creadas...');
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME 
            FROM information_schema.tables 
            WHERE table_schema = ? AND TABLE_NAME IN ('customers', 'quotations', 'quotation_items', 'chatgpt_processing_log')
        `, [process.env.DB_NAME || 'gestion_pedidos_dev']);

        console.log('📊 Tablas encontradas:', tables.map(t => t.TABLE_NAME));

        if (tables.length === 4) {
            console.log('✅ Todas las tablas del sistema de cotizaciones fueron creadas exitosamente');
        } else {
            console.log('⚠️  Advertencia: No se crearon todas las tablas esperadas');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code) {
            console.error('🔍 Código de error:', error.code);
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

// Ejecutar la función
createCustomersAndQuotationsTables();
