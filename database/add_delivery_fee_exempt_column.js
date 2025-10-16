const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function run() {
  let connection;
  try {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    };

    console.log('📦 Migración: agregar columna delivery_fee_exempt en orders (si no existe)');
    connection = await mysql.createConnection(dbConfig);

    // 1) Verificar columna delivery_fee_exempt
    const [feeExemptCol] = await connection.execute(
      `SHOW COLUMNS FROM orders LIKE 'delivery_fee_exempt'`
    );

    if (feeExemptCol.length === 0) {
      console.log('📝 Agregando columna delivery_fee_exempt...');
      await connection.execute(`
        ALTER TABLE orders
        ADD COLUMN delivery_fee_exempt TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Excepción: no cobrar domicilio aun si aplica por regla'
        AFTER delivery_fee
      `);
      console.log('✅ Columna delivery_fee_exempt agregada');
    } else {
      console.log('✅ La columna delivery_fee_exempt ya existe');
    }

    // 2) (Opcional) Asegurar columna delivery_fee existe
    const [feeCol] = await connection.execute(
      `SHOW COLUMNS FROM orders LIKE 'delivery_fee'`
    );
    if (feeCol.length === 0) {
      console.log('📝 Agregando columna delivery_fee (faltante)...');
      await connection.execute(`
        ALTER TABLE orders
        ADD COLUMN delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'Valor de domicilio a cobrar (si aplica)'
        AFTER payment_amount
      `);
      console.log('✅ Columna delivery_fee agregada');
    } else {
      console.log('✅ La columna delivery_fee existe');
    }

    // 3) Mostrar estructura relevante
    console.log('\n📋 Estructura relevante de orders:');
    const [describe] = await connection.execute(`DESCRIBE orders`);
    describe
      .filter(col => ['shipping_payment_method', 'delivery_method', 'total_amount', 'delivery_fee', 'delivery_fee_exempt', 'requires_payment', 'payment_amount'].includes(col.Field))
      .forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
      });

    console.log('\n🎯 Siguiente paso sugerido:');
    console.log('- Aplicar regla de cobro de domicilio en el backend al actualizar pedidos (delivery_method/local + shipping_payment_method + umbral 150.000 + excepción).');

    await connection.end();
    console.log('\n✅ Migración completada');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    if (connection) {
      try { await connection.end(); } catch {}
    }
    process.exit(1);
  }
}

run();
