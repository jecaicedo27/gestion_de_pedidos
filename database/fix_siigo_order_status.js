const { query } = require('../backend/config/database');

async function fixSiigoOrderStatus() {
  try {
    console.log('🔄 Actualizando pedidos de SIIGO con estado incorrecto...');
    
    // Actualizar pedidos de SIIGO que tienen estado 'pendiente' a 'pendiente_facturacion'
    const result = await query(
      `UPDATE orders 
       SET status = 'pendiente_facturacion' 
       WHERE status = 'pendiente' 
       AND siigo_invoice_id IS NOT NULL`,
      []
    );
    
    console.log(`✅ ${result.affectedRows} pedidos actualizados de 'pendiente' a 'pendiente_facturacion'`);
    
    // Mostrar pedidos de SIIGO actualizados
    const siigoOrders = await query(
      `SELECT id, order_number, siigo_invoice_id, status, created_at 
       FROM orders 
       WHERE siigo_invoice_id IS NOT NULL 
       ORDER BY created_at DESC 
       LIMIT 10`,
      []
    );
    
    console.log('\n📋 Pedidos de SIIGO en el sistema:');
    console.table(siigoOrders);
    
    // Verificar distribución de estados
    const statusDistribution = await query(
      `SELECT status, COUNT(*) as count 
       FROM orders 
       WHERE siigo_invoice_id IS NOT NULL 
       GROUP BY status`,
      []
    );
    
    console.log('\n📊 Distribución de estados en pedidos de SIIGO:');
    console.table(statusDistribution);
    
    console.log('\n✅ Corrección completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error actualizando pedidos:', error.message);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixSiigoOrderStatus()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = fixSiigoOrderStatus;
