const { query } = require('./backend/config/database');

async function debugCustomersStructure() {
  try {
    console.log('🔍 Verificando estructura de tabla customers...');
    
    // Verificar si la tabla customers existe
    const tablesResult = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
      AND TABLE_NAME = 'customers'
    `);
    
    if (tablesResult.length === 0) {
      console.log('❌ La tabla customers NO existe');
    } else {
      console.log('✅ La tabla customers existe');
      
      // Describir la estructura de la tabla customers
      const structure = await query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
        AND TABLE_NAME = 'customers'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('\n📋 Estructura de la tabla customers:');
      console.table(structure);
    }
    
    // Verificar también la tabla orders para commercial_name
    console.log('\n🔍 Verificando estructura de tabla orders...');
    const ordersStructure = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME LIKE '%commercial%'
      ORDER BY ORDINAL_POSITION
    `);
    
    if (ordersStructure.length > 0) {
      console.log('\n📋 Columnas relacionadas con commercial_name en orders:');
      console.table(ordersStructure);
      
      // Verificar datos reales con commercial_name
      const sampleOrders = await query(`
        SELECT id, order_number, customer_name, commercial_name, siigo_customer_id
        FROM orders 
        WHERE commercial_name IS NOT NULL 
        LIMIT 5
      `);
      
      if (sampleOrders.length > 0) {
        console.log('\n✅ Pedidos CON commercial_name:');
        console.table(sampleOrders);
      }
      
      const nullCommercial = await query(`
        SELECT COUNT(*) as count
        FROM orders 
        WHERE commercial_name IS NULL 
        AND siigo_customer_id IS NOT NULL
      `);
      
      console.log(`\n❌ Pedidos SIN commercial_name: ${nullCommercial[0].count}`);
      
    } else {
      console.log('❌ No se encontró columna commercial_name en la tabla orders');
    }
    
    // Verificar algunos pedidos de SIIGO
    const siigoOrders = await query(`
      SELECT id, order_number, customer_name, commercial_name, siigo_customer_id, siigo_invoice_id
      FROM orders 
      WHERE siigo_invoice_id IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n📊 Últimos pedidos de SIIGO:');
    console.table(siigoOrders);
    
  } catch (error) {
    console.error('❌ Error verificando estructura:', error.message);
  }
}

debugCustomersStructure().then(() => {
  console.log('\n✅ Verificación de estructura completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
