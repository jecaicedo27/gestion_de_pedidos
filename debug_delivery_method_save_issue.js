const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

const ORDER_ID = 162; // Pedido FV-2-12666

async function debugDeliveryMethodIssue() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 DEBUG: PROBLEMA DE GUARDADO DEL MÉTODO DE ENTREGA');
    console.log('===================================================\n');
    
    // 1. Verificar el estado actual del pedido
    const [orderData] = await connection.execute(
      'SELECT id, order_number, delivery_method, payment_method, status, updated_at FROM orders WHERE id = ?',
      [ORDER_ID]
    );
    
    const order = orderData[0];
    console.log('📦 ESTADO ACTUAL DEL PEDIDO #FV-2-12666:');
    console.log(`ID: ${order.id}`);
    console.log(`Método de Entrega: "${order.delivery_method || ''}" ${order.delivery_method ? '✅' : '❌ VACÍO'}`);
    console.log(`Método de Pago: "${order.payment_method || ''}" ${order.payment_method ? '✅' : '❌ VACÍO'}`);
    console.log(`Estado: ${order.status}`);
    console.log(`Última actualización: ${order.updated_at}`);
    
    // 2. Verificar la estructura de la tabla
    console.log('\n🔧 ESTRUCTURA DE LA COLUMNA delivery_method:');
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM orders WHERE Field = 'delivery_method'"
    );
    
    if (columns.length > 0) {
      const col = columns[0];
      console.log(`Tipo: ${col.Type}`);
      console.log(`Permite NULL: ${col.Null}`);
      console.log(`Valor por defecto: ${col.Default || 'ninguno'}`);
    }
    
    // 3. Verificar métodos de entrega disponibles
    console.log('\n📋 MÉTODOS DE ENTREGA EN delivery_methods:');
    const [deliveryMethods] = await connection.execute(
      'SELECT code, name, active FROM delivery_methods ORDER BY code'
    );
    
    deliveryMethods.forEach(method => {
      console.log(`${method.active ? '✅' : '❌'} ${method.code} - ${method.name}`);
    });
    
    // 4. Buscar si existe "domicilio nacional"
    const [nationalDelivery] = await connection.execute(
      "SELECT * FROM delivery_methods WHERE code LIKE '%nacional%' OR name LIKE '%nacional%'"
    );
    
    if (nationalDelivery.length > 0) {
      console.log('\n✅ Encontrado método "nacional":');
      nationalDelivery.forEach(m => {
        console.log(`   Code: "${m.code}" - Name: "${m.name}"`);
      });
    } else {
      console.log('\n❌ NO se encontró método con "nacional" en el nombre');
    }
    
    // 5. Verificar otros pedidos con métodos de entrega
    console.log('\n📊 OTROS PEDIDOS CON MÉTODO DE ENTREGA:');
    const [ordersWithDelivery] = await connection.execute(`
      SELECT order_number, delivery_method, updated_at 
      FROM orders 
      WHERE delivery_method IS NOT NULL AND delivery_method != ''
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    
    if (ordersWithDelivery.length > 0) {
      ordersWithDelivery.forEach(o => {
        console.log(`- ${o.order_number}: "${o.delivery_method}" (${o.updated_at})`);
      });
    } else {
      console.log('❌ No hay pedidos con método de entrega guardado');
    }
    
    // 6. Simular la actualización correcta
    console.log('\n💡 SOLUCIÓN PROPUESTA:');
    console.log('El modal de facturación debe ejecutar:');
    console.log(`UPDATE orders SET delivery_method = 'nacional' WHERE id = ${ORDER_ID}`);
    console.log('\nPero parece que NO se está ejecutando o hay un error.');
    
    console.log('\n🐛 POSIBLES CAUSAS:');
    console.log('1. El campo delivery_method no se está incluyendo en el request del frontend');
    console.log('2. El backend no está procesando el campo en el controlador');
    console.log('3. Hay un error de validación que rechaza el valor "domicilio nacional"');
    console.log('4. El valor se guarda pero luego se sobrescribe con vacío');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
debugDeliveryMethodIssue();
