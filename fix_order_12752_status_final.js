// Script para cambiar el status del pedido FV-2-12752 a 'empacado' correctamente

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'gestion_pedidos_dev',
  port: 3306
};

async function fixOrder12752StatusFinal() {
  console.log('🔧 CAMBIANDO STATUS DEL PEDIDO FV-2-12752 A EMPACADO CORRECTAMENTE...\n');
  
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
    
    // Cambiar status a empacado CORRECTAMENTE
    console.log('2. Cambiando status a "empacado" correctamente...');
    const [updateResult] = await connection.execute(
      "UPDATE orders SET status = 'empacado', updated_at = NOW() WHERE order_number = 'FV-2-12752'",
      []
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
    
    if (newStatus[0].status === 'empacado') {
      console.log('✅ ¡ÉXITO! El pedido FV-2-12752 ahora tiene status "empacado"');
      console.log('🎯 Debería aparecer en la página de logística en la tarjeta "Mensajería Local"');
    } else {
      console.log('❌ Problema: El status no se cambió correctamente');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixOrder12752StatusFinal().catch(console.error);
