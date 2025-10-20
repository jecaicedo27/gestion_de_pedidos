const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function run() {
  console.log('📦 Migración: agregar columna delivery_fee_payment_method en delivery_tracking (si no existe)');

  const {
    DB_HOST,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    DB_PORT
  } = process.env;

  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error('❌ Variables de entorno de BD incompletas. Verifique backend/.env');
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD || '',
      database: DB_NAME,
      port: DB_PORT ? Number(DB_PORT) : 3306,
      multipleStatements: true
    });

    // Verificar existencia de la tabla
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'delivery_tracking';"
    );
    if (!tables.length) {
      console.error('❌ La tabla delivery_tracking no existe. Asegúrese de haber ejecutado las migraciones base.');
      process.exit(1);
    }

    // Verificar si la columna ya existe
    const [cols] = await connection.execute(
      "SHOW COLUMNS FROM delivery_tracking LIKE 'delivery_fee_payment_method';"
    );
    if (!cols.length) {
      console.log('📝 Agregando columna delivery_fee_payment_method (VARCHAR(50) NULL)...');
      await connection.execute(`
        ALTER TABLE delivery_tracking
        ADD COLUMN delivery_fee_payment_method VARCHAR(50) NULL AFTER payment_method;
      `);
      console.log('✅ Columna delivery_fee_payment_method agregada');
    } else {
      console.log('ℹ️ La columna delivery_fee_payment_method ya existe, no se realizan cambios');
    }

    // Mostrar estructura relevante
    const [desc] = await connection.execute("DESCRIBE delivery_tracking;");
    const relevant = desc.filter(r =>
      ['payment_collected', 'delivery_fee_collected', 'payment_method', 'delivery_fee_payment_method'].includes(r.Field)
    );
    console.log('\n📋 Estructura relevante de delivery_tracking:');
    for (const r of relevant) {
      console.log(`   - ${r.Field}: ${r.Type} ${r.Null === 'NO' ? 'NOT NULL' : '(NULL)'} ${r.Default !== null ? `DEFAULT ${r.Default}` : ''}`);
    }

    console.log('\n🎯 Siguiente paso sugerido:');
    console.log("- Actualizar messengerController.completeDelivery para guardar delivery_fee_payment_method y opcionalmente actualizar orders.payment_method cuando el mensajero cambie el método de pago del producto.");

    console.log('\n✅ Migración completada');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      try { await connection.end(); } catch (_) {}
    }
  }
}

run();
