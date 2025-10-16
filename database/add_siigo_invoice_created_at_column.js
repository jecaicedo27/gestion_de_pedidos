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

/**
 * Agrega la columna siigo_invoice_created_at (DATETIME NULL)
 * a la tabla orders si no existe. Esta columna almacena la fecha
 * de creación de la factura en SIIGO (invoice.created o invoice.date).
 */
async function addSiigoInvoiceCreatedAtColumn() {
  let connection;
  try {
    console.log('🔧 Agregando columna siigo_invoice_created_at a la tabla orders...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a MySQL establecida');

    // Verificar si la columna ya existe
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'siigo_invoice_created_at'`,
      [dbConfig.database]
    );

    if (columns.length > 0) {
      console.log('⚪ La columna siigo_invoice_created_at ya existe. No se realizan cambios.');
    } else {
      // Intentar ubicar la columna cerca de otros campos de SIIGO
      // La pondremos después de siigo_observations si existe, de lo contrario al final.
      let afterClause = '';
      try {
        const [obsCol] = await connection.execute(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'siigo_observations'`,
          [dbConfig.database]
        );
        if (obsCol.length > 0) {
          afterClause = ' AFTER siigo_observations';
        }
      } catch (e) {
        // Ignorar y dejar sin AFTER
      }

      const alterSQL = `ALTER TABLE orders ADD COLUMN siigo_invoice_created_at DATETIME NULL${afterClause}`;
      console.log('📝 Ejecutando:', alterSQL);
      await connection.execute(alterSQL);
      console.log('✅ Columna siigo_invoice_created_at agregada exitosamente');
    }

    // Mostrar confirmación breve
    const [finalStructure] = await connection.execute('DESCRIBE orders');
    const siigoCols = finalStructure.filter(c => c.Field.includes('siigo_') || c.Field === 'siigo_invoice_created_at');
    console.log('\n📋 Columnas SIIGO relevantes en orders:');
    siigoCols.forEach(c => console.log(`  • ${c.Field} (${c.Type})`));

  } catch (error) {
    console.error('❌ Error agregando siigo_invoice_created_at:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  addSiigoInvoiceCreatedAtColumn();
}

module.exports = { addSiigoInvoiceCreatedAtColumn };
