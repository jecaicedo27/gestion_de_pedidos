const mysql = require('mysql2');

// Configuración de la base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos'
};

const connection = mysql.createConnection(dbConfig);

async function debugWalletValidation() {
  console.log('\n🔍 DEBUGGING WALLET VALIDATION ERROR\n');
  console.log('=' . repeat(80));
  
  try {
    // 1. Verificar estructura de la tabla wallet_validations
    console.log('\n📊 Estructura de tabla wallet_validations:');
    const [columns] = await connection.promise().query(`
      SHOW COLUMNS FROM wallet_validations
    `);
    
    console.log('\nColumnas encontradas:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // 2. Verificar pedidos en estado revision_cartera
    console.log('\n\n📋 Pedidos en revisión de cartera:');
    const [orders] = await connection.promise().query(`
      SELECT 
        id, 
        order_number, 
        customer_name,
        payment_method,
        total_amount,
        status,
        validation_status
      FROM orders 
      WHERE status = 'revision_cartera'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (orders.length > 0) {
      console.log(`\nEncontrados ${orders.length} pedidos:`);
      orders.forEach(order => {
        console.log(`\n  Pedido #${order.order_number}:`);
        console.log(`    - ID: ${order.id}`);
        console.log(`    - Cliente: ${order.customer_name}`);
        console.log(`    - Método de pago: ${order.payment_method}`);
        console.log(`    - Total: $${order.total_amount?.toLocaleString('es-CO')}`);
        console.log(`    - Estado de validación: ${order.validation_status || 'pendiente'}`);
      });
    } else {
      console.log('\n❌ No hay pedidos en revisión de cartera');
    }
    
    // 3. Verificar últimas validaciones
    console.log('\n\n📝 Últimas validaciones registradas:');
    const [validations] = await connection.promise().query(`
      SELECT 
        wv.*,
        o.order_number,
        u.full_name as validated_by_name
      FROM wallet_validations wv
      LEFT JOIN orders o ON wv.order_id = o.id
      LEFT JOIN users u ON wv.validated_by = u.id
      ORDER BY wv.validated_at DESC
      LIMIT 5
    `);
    
    if (validations.length > 0) {
      console.log(`\nEncontradas ${validations.length} validaciones:`);
      validations.forEach(val => {
        console.log(`\n  Validación ID ${val.id}:`);
        console.log(`    - Pedido: ${val.order_number}`);
        console.log(`    - Tipo: ${val.validation_type}`);
        console.log(`    - Método de pago: ${val.payment_method}`);
        console.log(`    - Validado por: ${val.validated_by_name}`);
        console.log(`    - Fecha: ${new Date(val.validated_at).toLocaleString('es-CO')}`);
      });
    } else {
      console.log('\n❌ No hay validaciones registradas');
    }
    
    // 4. Verificar permisos del directorio de uploads
    console.log('\n\n📁 Verificando directorio de uploads:');
    const fs = require('fs');
    const path = require('path');
    const uploadPath = path.join(__dirname, 'backend/uploads/payment-proofs');
    
    if (fs.existsSync(uploadPath)) {
      console.log(`✅ Directorio existe: ${uploadPath}`);
      
      // Verificar permisos
      try {
        fs.accessSync(uploadPath, fs.constants.W_OK);
        console.log('✅ Directorio tiene permisos de escritura');
      } catch (err) {
        console.log('❌ ERROR: Directorio sin permisos de escritura');
      }
    } else {
      console.log(`❌ Directorio NO existe: ${uploadPath}`);
      console.log('   Creando directorio...');
      
      try {
        fs.mkdirSync(uploadPath, { recursive: true });
        console.log('   ✅ Directorio creado exitosamente');
      } catch (err) {
        console.log('   ❌ Error creando directorio:', err.message);
      }
    }
    
    // 5. Solución propuesta
    console.log('\n\n💡 SOLUCIÓN PROPUESTA:');
    console.log('=' . repeat(80));
    console.log('\nEl error 400 puede deberse a:');
    console.log('\n1. Problema con el middleware de multer al manejar campos opcionales');
    console.log('2. Validación de campos requeridos en el backend');
    console.log('3. Formato incorrecto del FormData enviado desde el frontend');
    
    console.log('\n📝 Pasos para solucionar:');
    console.log('1. Actualizar el middleware para manejar archivos opcionales correctamente');
    console.log('2. Verificar que todos los campos requeridos se envíen desde el frontend');
    console.log('3. Agregar mejor manejo de errores en el controlador');
    
  } catch (error) {
    console.error('\n❌ Error durante la depuración:', error);
  } finally {
    connection.end();
    console.log('\n\n✅ Depuración completada');
  }
}

// Ejecutar la depuración
debugWalletValidation();
