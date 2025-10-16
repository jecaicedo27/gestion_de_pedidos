// Configurar variables de entorno
process.env.NODE_ENV = 'development';

const { query } = require('../backend/config/database');

console.log('🔧 OPTIMIZANDO ESTRUCTURA DE BASE DE DATOS PARA SIIGO');

async function optimizeSiigoDatabaseStructure() {
  try {
    console.log('\n1️⃣ ANALIZANDO ESTRUCTURA ACTUAL...');
    
    // Verificar estructura actual de orders
    console.log('\n📋 Verificando tabla ORDERS...');
    const ordersStructure = await query('DESCRIBE orders');
    console.log('📊 Columnas actuales en orders:');
    ordersStructure.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Verificar estructura actual de order_items
    console.log('\n📦 Verificando tabla ORDER_ITEMS...');
    const itemsStructure = await query('DESCRIBE order_items');
    console.log('📊 Columnas actuales en order_items:');
    itemsStructure.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    console.log('\n2️⃣ OPTIMIZANDO TABLA ORDERS PARA SIIGO...');
    
    // Agregar/optimizar campos específicos para SIIGO
    const orderOptimizations = [
      {
        field: 'customer_identification',
        sql: 'ADD COLUMN customer_identification VARCHAR(50) NULL AFTER customer_name',
        description: 'Número de identificación/NIT del cliente'
      },
      {
        field: 'customer_id_type',
        sql: 'ADD COLUMN customer_id_type VARCHAR(50) NULL AFTER customer_identification',
        description: 'Tipo de identificación (Cédula, NIT, etc.)'
      },
      {
        field: 'siigo_customer_id',
        sql: 'ADD COLUMN siigo_customer_id VARCHAR(255) NULL AFTER customer_id_type',
        description: 'ID del cliente en SIIGO'
      },
      {
        field: 'customer_person_type',
        sql: 'ADD COLUMN customer_person_type ENUM("Person", "Company") NULL AFTER siigo_customer_id',
        description: 'Tipo de persona (física o jurídica)'
      },
      {
        field: 'customer_country',
        sql: 'ADD COLUMN customer_country VARCHAR(100) DEFAULT "Colombia" AFTER customer_department',
        description: 'País del cliente'
      },
      {
        field: 'siigo_observations',
        sql: 'MODIFY COLUMN siigo_observations TEXT NULL',
        description: 'Ampliar campo para observaciones completas'
      },
      {
        field: 'siigo_payment_info',
        sql: 'ADD COLUMN siigo_payment_info JSON NULL AFTER siigo_observations',
        description: 'Información completa de pagos de SIIGO'
      },
      {
        field: 'siigo_seller_id',
        sql: 'ADD COLUMN siigo_seller_id INT NULL AFTER siigo_payment_info',
        description: 'ID del vendedor en SIIGO'
      },
      {
        field: 'siigo_balance',
        sql: 'ADD COLUMN siigo_balance DECIMAL(15,2) NULL AFTER siigo_seller_id',
        description: 'Saldo pendiente en SIIGO'
      },
      {
        field: 'siigo_document_type',
        sql: 'ADD COLUMN siigo_document_type VARCHAR(50) NULL AFTER siigo_balance',
        description: 'Tipo de documento en SIIGO'
      },
      {
        field: 'siigo_stamp_status',
        sql: 'ADD COLUMN siigo_stamp_status VARCHAR(50) NULL AFTER siigo_document_type',
        description: 'Estado del sello/timbrado'
      },
      {
        field: 'siigo_mail_status',
        sql: 'ADD COLUMN siigo_mail_status VARCHAR(50) NULL AFTER siigo_stamp_status',
        description: 'Estado del envío por correo'
      },
      {
        field: 'siigo_public_url',
        sql: 'ADD COLUMN siigo_public_url TEXT NULL AFTER siigo_mail_status',
        description: 'URL pública del documento en SIIGO'
      }
    ];
    
    // Aplicar optimizaciones a orders
    for (const opt of orderOptimizations) {
      try {
        // Verificar si la columna ya existe
        const columnExists = ordersStructure.some(col => col.Field === opt.field);
        
        if (!columnExists) {
          console.log(`📝 Agregando columna: ${opt.field} - ${opt.description}`);
          await query(`ALTER TABLE orders ${opt.sql}`);
          console.log(`✅ Columna ${opt.field} agregada exitosamente`);
        } else if (opt.sql.includes('MODIFY')) {
          console.log(`📝 Modificando columna: ${opt.field} - ${opt.description}`);
          await query(`ALTER TABLE orders ${opt.sql}`);
          console.log(`✅ Columna ${opt.field} modificada exitosamente`);
        } else {
          console.log(`⚪ Columna ${opt.field} ya existe`);
        }
      } catch (error) {
        console.log(`⚠️ Error con columna ${opt.field}: ${error.message}`);
      }
    }
    
    console.log('\n3️⃣ OPTIMIZANDO TABLA ORDER_ITEMS PARA SIIGO...');
    
    // Agregar/optimizar campos específicos para items de SIIGO
    const itemOptimizations = [
      {
        field: 'siigo_item_id',
        sql: 'ADD COLUMN siigo_item_id VARCHAR(255) NULL AFTER product_code',
        description: 'ID único del item en SIIGO'
      },
      {
        field: 'warehouse_id',
        sql: 'ADD COLUMN warehouse_id INT NULL AFTER siigo_item_id',
        description: 'ID del almacén en SIIGO'
      },
      {
        field: 'warehouse_name',
        sql: 'ADD COLUMN warehouse_name VARCHAR(100) NULL AFTER warehouse_id',
        description: 'Nombre del almacén'
      },
      {
        field: 'tax_info',
        sql: 'ADD COLUMN tax_info JSON NULL AFTER warehouse_name',
        description: 'Información completa de impuestos'
      },
      {
        field: 'item_total',
        sql: 'ADD COLUMN item_total DECIMAL(15,2) NULL AFTER tax_info',
        description: 'Total del item (precio + impuestos)'
      },
      {
        field: 'discount_value',
        sql: 'ADD COLUMN discount_value DECIMAL(15,2) DEFAULT 0 AFTER item_total',
        description: 'Valor de descuento aplicado'
      },
      {
        field: 'unit_price_without_tax',
        sql: 'ADD COLUMN unit_price_without_tax DECIMAL(15,2) NULL AFTER discount_value',
        description: 'Precio unitario sin impuestos'
      }
    ];
    
    // Aplicar optimizaciones a order_items
    for (const opt of itemOptimizations) {
      try {
        // Verificar si la columna ya existe
        const columnExists = itemsStructure.some(col => col.Field === opt.field);
        
        if (!columnExists) {
          console.log(`📦 Agregando columna: ${opt.field} - ${opt.description}`);
          await query(`ALTER TABLE order_items ${opt.sql}`);
          console.log(`✅ Columna ${opt.field} agregada exitosamente`);
        } else {
          console.log(`⚪ Columna ${opt.field} ya existe`);
        }
      } catch (error) {
        console.log(`⚠️ Error con columna ${opt.field}: ${error.message}`);
      }
    }
    
    console.log('\n4️⃣ VERIFICANDO ÍNDICES PARA RENDIMIENTO...');
    
    // Crear índices para mejorar rendimiento en consultas SIIGO
    const indexes = [
      {
        name: 'idx_siigo_invoice_id',
        table: 'orders',
        sql: 'CREATE INDEX idx_siigo_invoice_id ON orders (siigo_invoice_id)',
        description: 'Índice para búsquedas por ID de factura SIIGO'
      },
      {
        name: 'idx_siigo_customer_id', 
        table: 'orders',
        sql: 'CREATE INDEX idx_siigo_customer_id ON orders (siigo_customer_id)',
        description: 'Índice para búsquedas por ID de cliente SIIGO'
      },
      {
        name: 'idx_customer_identification',
        table: 'orders',
        sql: 'CREATE INDEX idx_customer_identification ON orders (customer_identification)',
        description: 'Índice para búsquedas por identificación de cliente'
      },
      {
        name: 'idx_siigo_item_id',
        table: 'order_items',
        sql: 'CREATE INDEX idx_siigo_item_id ON order_items (siigo_item_id)',
        description: 'Índice para búsquedas por ID de item SIIGO'
      },
      {
        name: 'idx_product_code',
        table: 'order_items', 
        sql: 'CREATE INDEX idx_product_code ON order_items (product_code)',
        description: 'Índice para búsquedas por código de producto'
      }
    ];
    
    for (const idx of indexes) {
      try {
        console.log(`🔍 Creando índice: ${idx.name} - ${idx.description}`);
        await query(idx.sql);
        console.log(`✅ Índice ${idx.name} creado exitosamente`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('Duplicate key name')) {
          console.log(`⚪ Índice ${idx.name} ya existe`);
        } else {
          console.log(`⚠️ Error creando índice ${idx.name}: ${error.message}`);
        }
      }
    }
    
    console.log('\n5️⃣ CREANDO TABLA DE CACHE DE CLIENTES SIIGO...');
    
    // Crear tabla para cachear información de clientes de SIIGO
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS siigo_customers_cache (
          id INT AUTO_INCREMENT PRIMARY KEY,
          siigo_customer_id VARCHAR(255) NOT NULL UNIQUE,
          customer_data JSON NOT NULL,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_siigo_customer_id (siigo_customer_id),
          INDEX idx_last_updated (last_updated)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Tabla siigo_customers_cache verificada/creada');
    } catch (error) {
      console.log('⚠️ Error con tabla siigo_customers_cache:', error.message);
    }
    
    console.log('\n6️⃣ CREANDO TABLA DE CACHE DE PRODUCTOS SIIGO...');
    
    // Crear tabla para cachear información de productos de SIIGO
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS siigo_products_cache (
          id INT AUTO_INCREMENT PRIMARY KEY,
          siigo_item_id VARCHAR(255) NOT NULL UNIQUE,
          product_code VARCHAR(100) NOT NULL,
          product_data JSON NOT NULL,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_siigo_item_id (siigo_item_id),
          INDEX idx_product_code (product_code),
          INDEX idx_last_updated (last_updated)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Tabla siigo_products_cache verificada/creada');
    } catch (error) {
      console.log('⚠️ Error con tabla siigo_products_cache:', error.message);
    }
    
    console.log('\n7️⃣ VERIFICANDO ESTRUCTURA FINAL...');
    
    // Verificar estructura final
    const finalOrdersStructure = await query('DESCRIBE orders');
    const finalItemsStructure = await query('DESCRIBE order_items');
    
    console.log(`\n📊 TABLA ORDERS - ${finalOrdersStructure.length} columnas:`);
    finalOrdersStructure.forEach(col => {
      if (col.Field.includes('siigo') || col.Field.includes('customer')) {
        console.log(`  ✅ ${col.Field}: ${col.Type}`);
      }
    });
    
    console.log(`\n📦 TABLA ORDER_ITEMS - ${finalItemsStructure.length} columnas:`);
    finalItemsStructure.forEach(col => {
      if (col.Field.includes('siigo') || col.Field.includes('product') || col.Field.includes('warehouse')) {
        console.log(`  ✅ ${col.Field}: ${col.Type}`);
      }
    });
    
    console.log('\n🎯 ¡BASE DE DATOS OPTIMIZADA PARA SIIGO!');
    console.log('✅ Todos los campos necesarios para datos ricos de SIIGO están disponibles');
    console.log('✅ Índices creados para mejorar rendimiento');
    console.log('✅ Tablas de cache implementadas para optimización');
    console.log('✅ La base de datos está lista para recibir importaciones completas');
    
  } catch (error) {
    console.error('❌ Error optimizando base de datos:', error.message);
    console.error('📊 Stack:', error.stack);
  }
}

optimizeSiigoDatabaseStructure().then(() => {
  console.log('\n✅ Optimización completada');
  process.exit(0);
});
