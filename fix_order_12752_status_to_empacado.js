// Script para cambiar el status del pedido FV-2-12752 de 'en_empaque' a 'empacado'

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'gestion_pedidos_dev',
  port: 3306
};

async function fixOrder12752Status() {
  console.log('🔧 CAMBIANDO STATUS DEL PEDIDO FV-2-12752 A EMPACADO...\n');
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Verificar estado actual
    console.log('1. Verificando estado actual...');
    const [currentStatus] = await connection.execute(
      'SELECT id, order_number, status, delivery_method, carrier_id FROM orders WHERE order_number = ?',
      ['FV-2-12752']
    );
    
    if (currentStatus.length === 0) {
      console.log('❌ Pedido FV-2-12752 no encontrado');
      return;
    }
    
    console.log('📦 Estado actual:', currentStatus[0]);
    console.log('');
    
    // Cambiar status a empacado
    console.log('2. Cambiando status a "empacado"...');
    const [updateResult] = await connection.execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_number = ?',
      ['empacado', 'FV-2-12752']
    );
    
    console.log('✅ Filas afectadas:', updateResult.affectedRows);
    
    // Verificar el cambio
    console.log('3. Verificando cambio...');
    const [newStatus] = await connection.execute(
      'SELECT id, order_number, status, delivery_method, carrier_id FROM orders WHERE order_number = ?',
      ['FV-2-12752']
    );
    
    console.log('📦 Nuevo estado:', newStatus[0]);
    console.log('');
    console.log('🎯 El pedido FV-2-12752 ahora debería aparecer en la página de logística en la tarjeta "Mensajería Local"');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixOrder12752Status().catch(console.error);
