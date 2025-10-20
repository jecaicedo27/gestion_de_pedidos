// Mejora para extraer automáticamente el método de pago de envío desde las notas SIIGO

// 1. Actualizar el modal de logística para incluir el campo de método de pago de envío
// 2. Extraer automáticamente desde las notas pero permitir edición
// 3. Mejorar la UX del proceso

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function testPaymentMethodExtraction() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔧 MEJORANDO EXTRACCIÓN DE MÉTODO DE PAGO DE ENVÍO');
    console.log('================================================\n');
    
    // Obtener el pedido 12668 para probar
    const [orders] = await connection.execute(
      `SELECT id, order_number, customer_name, notes 
       FROM orders 
       WHERE order_number LIKE '%12668%'`,
      []
    );
    
    if (orders.length > 0) {
      const order = orders[0];
      console.log(`📦 Probando con pedido: ${order.order_number}`);
      console.log(`👤 Cliente: ${order.customer_name}\n`);
      
      console.log('📄 NOTAS COMPLETAS:');
      console.log('==================');
      console.log(order.notes);
      console.log('');
      
      // Función para extraer método de pago de envío
      function extractShippingPaymentMethod(notes) {
        if (!notes) return null;
        
        const lines = notes.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Buscar específicamente "FORMA DE PAGO DE ENVIO:"
          if (trimmedLine.includes('FORMA DE PAGO DE ENVIO:')) {
            const paymentMethod = trimmedLine.split(':')[1]?.trim();
            return paymentMethod;
          }
        }
        
        return null;
      }
      
      // Probar extracción
      const extractedPaymentMethod = extractShippingPaymentMethod(order.notes);
      
      console.log('🎯 RESULTADO DE EXTRACCIÓN:');
      console.log('===========================');
      if (extractedPaymentMethod) {
        console.log(`✅ Método de pago extraído: "${extractedPaymentMethod}"`);
      } else {
        console.log('❌ No se encontró método de pago de envío en las notas');
      }
      
      // Mostrar otros datos extraíbles
      console.log('\n📋 OTROS DATOS EXTRAÍBLES:');
      console.log('==========================');
      
      const extractAllData = (notes) => {
        if (!notes) return {};
        
        const data = {};
        const lines = notes.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.includes('FORMA DE PAGO DE ENVIO:')) {
            data.shippingPaymentMethod = trimmedLine.split(':')[1]?.trim();
          } else if (trimmedLine.includes('MEDIO DE PAGO:')) {
            data.paymentMethod = trimmedLine.split(':')[1]?.trim();
          } else if (trimmedLine.includes('ESTADO DEL PAGO:')) {
            data.paymentStatus = trimmedLine.split(':')[1]?.trim();
          } else if (trimmedLine.includes('NOMBRE:')) {
            data.name = trimmedLine.split(':')[1]?.trim();
          } else if (trimmedLine.includes('TELÉFONO:')) {
            data.phone = trimmedLine.split(':')[1]?.trim();
          } else if (trimmedLine.includes('DIRECCIÓN:')) {
            data.address = trimmedLine.split(':')[1]?.trim();
          } else if (trimmedLine.includes('CIUDAD:')) {
            data.city = trimmedLine.split(':')[1]?.trim();
          } else if (trimmedLine.includes('DEPARTAMENTO:')) {
            data.department = trimmedLine.split(':')[1]?.trim();
          }
        }
        
        return data;
      };
      
      const allExtractedData = extractAllData(order.notes);
      
      Object.entries(allExtractedData).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
      
    } else {
      console.log('❌ No se encontró el pedido 12668');
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar prueba
testPaymentMethodExtraction();
