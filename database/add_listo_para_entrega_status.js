const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev'
};

async function addListoParaEntregaStatus() {
  let connection;
  
  try {
    console.log('🔧 AGREGANDO ESTADO "listo_para_entrega" AL ENUM');
    console.log('==================================================');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida');
    
    // Verificar la estructura actual
    console.log('\n📊 ESTRUCTURA ACTUAL:');
    const [columns] = await connection.execute('DESCRIBE orders');
    const statusColumn = columns.find(col => col.Field === 'status');
    console.log('📋 ENUM actual:', statusColumn.Type);
    
    // Agregar el nuevo valor al ENUM
    console.log('\n🔧 MODIFICANDO ENUM...');
    const alterQuery = `
      ALTER TABLE orders 
      MODIFY COLUMN status ENUM(
        'pendiente',
        'pendiente_por_facturacion',
        'confirmado',
        'en_preparacion',
        'listo',
        'listo_para_entrega',
        'enviado',
        'entregado',
        'cancelado',
        'revision_cartera',
        'en_logistica',
        'en_empaque',
        'en_reparto',
        'entregado_transportadora',
        'entregado_cliente',
        'pendiente_facturacion'
      ) DEFAULT 'pendiente'
    `;
    
    await connection.execute(alterQuery);
    console.log('✅ ENUM modificado exitosamente');
    
    // Verificar la estructura nueva
    console.log('\n📊 ESTRUCTURA NUEVA:');
    const [newColumns] = await connection.execute('DESCRIBE orders');
    const newStatusColumn = newColumns.find(col => col.Field === 'status');
    console.log('📋 ENUM nuevo:', newStatusColumn.Type);
    
    // Verificar que 'listo_para_entrega' está incluido
    if (newStatusColumn.Type.includes('listo_para_entrega')) {
      console.log('🎉 ¡ÉXITO! El valor "listo_para_entrega" ha sido agregado al ENUM');
    } else {
      console.log('❌ ERROR: El valor "listo_para_entrega" no se agregó correctamente');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar migración
addListoParaEntregaStatus().catch(console.error);
