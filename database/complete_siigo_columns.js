// Configurar variables de entorno
process.env.NODE_ENV = 'development';

const { query } = require('../backend/config/database');

console.log('🔧 COMPLETANDO COLUMNAS FALTANTES DE SIIGO');

async function completeSiigoColumns() {
  try {
    console.log('\n1️⃣ AGREGANDO COLUMNAS FALTANTES DE ORDERS...');
    
    // Agregar columnas de forma secuencial sin referencias
    const missingColumns = [
      {
        field: 'siigo_observations',
        sql: 'ADD COLUMN siigo_observations TEXT NULL',
        description: 'Observaciones completas de SIIGO'
      },
      {
        field: 'siigo_payment_info',
        sql: 'ADD COLUMN siigo_payment_info JSON NULL',
        description: 'Información completa de pagos de SIIGO'
      },
      {
        field: 'siigo_seller_id',
        sql: 'ADD COLUMN siigo_seller_id INT NULL',
        description: 'ID del vendedor en SIIGO'
      },
      {
        field: 'siigo_balance',
        sql: 'ADD COLUMN siigo_balance DECIMAL(15,2) NULL',
        description: 'Saldo pendiente en SIIGO'
      },
      {
        field: 'siigo_document_type',
        sql: 'ADD COLUMN siigo_document_type VARCHAR(50) NULL',
        description: 'Tipo de documento en SIIGO'
      },
      {
        field: 'siigo_stamp_status',
        sql: 'ADD COLUMN siigo_stamp_status VARCHAR(50) NULL',
        description: 'Estado del sello/timbrado'
      },
      {
        field: 'siigo_mail_status',
        sql: 'ADD COLUMN siigo_mail_status VARCHAR(50) NULL',
        description: 'Estado del envío por correo'
      },
      {
        field: 'siigo_public_url',
        sql: 'ADD COLUMN siigo_public_url TEXT NULL',
        description: 'URL pública del documento en SIIGO'
      }
    ];
    
    // Verificar estructura actual
    const currentStructure = await query('DESCRIBE orders');
    const existingColumns = currentStructure.map(col => col.Field);
    
    for (const col of missingColumns) {
      try {
        if (!existingColumns.includes(col.field)) {
          console.log(`📝 Agregando: ${col.field} - ${col.description}`);
          await query(`ALTER TABLE orders ${col.sql}`);
          console.log(`✅ Columna ${col.field} agregada exitosamente`);
        } else {
          console.log(`⚪ Columna ${col.field} ya existe`);
        }
      } catch (error) {
        console.log(`⚠️ Error con columna ${col.field}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Todas las columnas necesarias están disponibles');
    
  } catch (error) {
    console.error('❌ Error completando columnas:', error.message);
  }
}

completeSiigoColumns().then(() => {
  console.log('\n✅ Completado exitosamente');
  process.exit(0);
});
