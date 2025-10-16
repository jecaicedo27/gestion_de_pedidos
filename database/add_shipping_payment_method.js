const { query } = require('../backend/config/database');

const addShippingPaymentMethod = async () => {
  try {
    console.log('✅ Conectado a la base de datos');
    console.log('🔄 Agregando campo shipping_payment_method a la tabla orders...');

    // Agregar la columna shipping_payment_method
    await query(`
      ALTER TABLE orders 
      ADD COLUMN shipping_payment_method ENUM('contado', 'contraentrega') 
      DEFAULT 'contado' 
      AFTER payment_method
    `);

    console.log('✅ Campo shipping_payment_method agregado exitosamente');

    // Verificar la estructura de la tabla
    const tableStructure = await query('DESCRIBE orders');
    
    console.log('\n📋 Estructura actual de la tabla orders:');
    tableStructure.forEach(column => {
      if (['payment_method', 'shipping_payment_method', 'delivery_method'].includes(column.Field)) {
        console.log(`   - ${column.Field}: ${column.Type} (${column.Null === 'YES' ? 'NULL' : 'NOT NULL'}) ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
      }
    });

    console.log('\n🎉 Migración completada exitosamente');

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  El campo shipping_payment_method ya existe en la tabla');
    } else {
      console.error('❌ Error durante la migración:', error);
      process.exit(1);
    }
  }
};

// Ejecutar migración
addShippingPaymentMethod()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  });
