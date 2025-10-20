const mysql = require('mysql2/promise');

async function createCompleteProductsTable() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_de_pedidos'
    });

    try {
        console.log('🔄 Creando tabla products completa basada en estructura SIIGO...');

        // Verificar si la tabla products existe antes de hacer backup
        console.log('📦 Verificando si tabla products existe...');
        const [tables] = await connection.execute("SHOW TABLES LIKE 'products'");
        
        if (tables.length > 0) {
            console.log('📦 Haciendo backup de tabla products existente...');
            await connection.execute(`
                CREATE TABLE products_backup_${Date.now()} AS 
                SELECT * FROM products WHERE 1=1
            `);
        } else {
            console.log('✅ No hay tabla products existente, creando nueva tabla...');
        }

        // Crear la nueva tabla con toda la estructura de SIIGO
        const createTableSQL = `
            DROP TABLE IF EXISTS products;
            CREATE TABLE products (
              id INT AUTO_INCREMENT PRIMARY KEY,
              siigo_id VARCHAR(255) UNIQUE,
              account_group JSON,
              account_group_id DECIMAL(15,2),
              account_group_name TEXT,
              active BOOLEAN,
              additional_fields JSON,
              additional_fields_barcode TEXT,
              additional_fields_brand TEXT,
              additional_fields_model TEXT,
              additional_fields_tariff TEXT,
              available_quantity DECIMAL(15,2),
              code VARCHAR(255),
              description TEXT,
              metadata JSON,
              metadata_created TEXT,
              metadata_last_updated TEXT,
              name TEXT,
              prices JSON,
              reference TEXT,
              stock_control BOOLEAN,
              tax_classification TEXT,
              tax_consumption_value DECIMAL(15,2),
              tax_included BOOLEAN,
              taxes JSON,
              type TEXT,
              unit JSON,
              unit_code TEXT,
              unit_label TEXT,
              unit_name TEXT,
              warehouses JSON,
              -- Campos adicionales del sistema
              internal_barcode VARCHAR(255),
              internal_category VARCHAR(255),
              stock_quantity DECIMAL(15,2) DEFAULT 0,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              
              -- Índices para rendimiento
              INDEX idx_siigo_id (siigo_id),
              INDEX idx_code (code),
              INDEX idx_name (name),
              INDEX idx_active (is_active),
              INDEX idx_internal_category (internal_category)
            );
        `;

        // Ejecutar cada statement por separado
        await connection.execute('DROP TABLE IF EXISTS products');
        
        await connection.execute(`
            CREATE TABLE products (
              id INT AUTO_INCREMENT PRIMARY KEY,
              siigo_id VARCHAR(255) UNIQUE,
              account_group JSON,
              account_group_id DECIMAL(15,2),
              account_group_name TEXT,
              active BOOLEAN,
              additional_fields JSON,
              additional_fields_barcode TEXT,
              additional_fields_brand TEXT,
              additional_fields_model TEXT,
              additional_fields_tariff TEXT,
              available_quantity DECIMAL(15,2),
              code VARCHAR(255),
              description TEXT,
              metadata JSON,
              metadata_created TEXT,
              metadata_last_updated TEXT,
              name TEXT,
              prices JSON,
              reference TEXT,
              stock_control BOOLEAN,
              tax_classification TEXT,
              tax_consumption_value DECIMAL(15,2),
              tax_included BOOLEAN,
              taxes JSON,
              type TEXT,
              unit JSON,
              unit_code TEXT,
              unit_label TEXT,
              unit_name TEXT,
              warehouses JSON,
              internal_barcode VARCHAR(255),
              internal_category VARCHAR(255),
              stock_quantity DECIMAL(15,2) DEFAULT 0,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Crear índices
        console.log('📊 Creando índices para rendimiento...');
        await connection.execute('CREATE INDEX idx_siigo_id ON products(siigo_id)');
        await connection.execute('CREATE INDEX idx_code ON products(code)');
        await connection.execute('CREATE INDEX idx_name ON products(name(255))');
        await connection.execute('CREATE INDEX idx_active ON products(is_active)');
        await connection.execute('CREATE INDEX idx_internal_category ON products(internal_category)');

        console.log('✅ Tabla products creada exitosamente con estructura completa de SIIGO');
        
        // Verificar la estructura
        const [columns] = await connection.execute('DESCRIBE products');
        console.log('\n📋 ESTRUCTURA DE LA TABLA PRODUCTS:');
        console.log('================================================================================');
        columns.forEach(col => {
            console.log(`${col.Field.padEnd(35)} -> ${col.Type}`);
        });

        console.log('\n🎯 SIGUIENTE PASO: Importar productos desde SIIGO usando Partner-Id "api"');

    } catch (error) {
        console.error('❌ Error creando tabla products:', error);
    } finally {
        await connection.end();
    }
}

createCompleteProductsTable();
