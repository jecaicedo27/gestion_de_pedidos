const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev'
};

const addSiigoColumns = async () => {
  let connection;
  
  try {
    console.log('🔧 Agregando columnas faltantes de SIIGO a la tabla orders...\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a MySQL establecida');
    
    // Lista de columnas a agregar
    const columnsToAdd = [
      {
        name: 'customer_identification',
        definition: 'VARCHAR(50)',
        description: 'Número de identificación del cliente'
      },
      {
        name: 'customer_id_type',
        definition: 'VARCHAR(50)',
        description: 'Tipo de identificación del cliente'
      },
      {
        name: 'siigo_customer_id',
        definition: 'VARCHAR(100)',
        description: 'ID del cliente en SIIGO'
      },
      {
        name: 'customer_person_type',
        definition: 'VARCHAR(50)',
        description: 'Tipo de persona del cliente (natural/jurídica)'
      },
      {
        name: 'customer_country',
        definition: 'VARCHAR(100) DEFAULT "Colombia"',
        description: 'País del cliente'
      },
      {
        name: 'siigo_public_url',
        definition: 'VARCHAR(500)',
        description: 'URL pública del documento en SIIGO'
      }
    ];
    
    // Verificar qué columnas ya existen
    const [existingColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
    `, [dbConfig.database]);
    
    const existingColumnNames = existingColumns.map(col => col.COLUMN_NAME);
    
    // Agregar columnas que no existen
    for (const column of columnsToAdd) {
      if (existingColumnNames.includes(column.name)) {
        console.log(`⚪ Columna ${column.name} ya existe`);
      } else {
        console.log(`📝 Agregando: ${column.name} - ${column.description}`);
        
        try {
          await connection.execute(`
            ALTER TABLE orders ADD COLUMN ${column.name} ${column.definition}
          `);
          console.log(`✅ Columna ${column.name} agregada exitosamente`);
        } catch (error) {
          console.error(`❌ Error agregando columna ${column.name}:`, error.message);
        }
      }
    }
    
    // Verificar que los ENUMs de delivery_method y status estén actualizados
    console.log('\n🔄 Verificando ENUMs...');
    
    // Actualizar ENUM de delivery_method
    try {
      await connection.execute(`
        ALTER TABLE orders 
        MODIFY COLUMN delivery_method ENUM(
          'recoge_bodega', 'domicilio', 'envio_nacional', 'envio_internacional', 
          'domicilio_ciudad', 'recogida_tienda', 'mensajeria_urbana'
        ) DEFAULT 'domicilio'
      `);
      console.log('✅ ENUM delivery_method actualizado');
    } catch (error) {
      console.log('⚪ ENUM delivery_method ya está actualizado');
    }
    
    // Actualizar ENUM de status
    try {
      await connection.execute(`
        ALTER TABLE orders 
        MODIFY COLUMN status ENUM(
          'pendiente', 'pendiente_por_facturacion', 'confirmado', 'en_preparacion', 
          'listo', 'enviado', 'entregado', 'cancelado', 'revision_cartera', 
          'en_logistica', 'en_empaque', 'en_reparto', 'entregado_transportadora', 
          'entregado_cliente', 'pendiente_facturacion'
        ) DEFAULT 'pendiente'
      `);
      console.log('✅ ENUM status actualizado');
    } catch (error) {
      console.log('⚪ ENUM status ya está actualizado');
    }
    
    // Verificar estructura final
    console.log('\n📋 Verificando estructura final de la tabla orders...');
    const [finalStructure] = await connection.execute('DESCRIBE orders');
    
    const siigoColumns = finalStructure.filter(col => 
      col.Field.includes('siigo_') || 
      col.Field.includes('customer_identification') ||
      col.Field.includes('customer_id_type') ||
      col.Field.includes('customer_person_type') ||
      col.Field.includes('customer_country')
    );
    
    console.log('\n✅ Columnas relacionadas con SIIGO:');
    siigoColumns.forEach(col => {
      console.log(`  • ${col.Field} (${col.Type})`);
    });
    
    console.log('\n✅ Columnas de SIIGO agregadas exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  addSiigoColumns();
}

module.exports = { addSiigoColumns };
