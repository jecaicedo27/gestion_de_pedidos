const { query, poolEnd } = require('../config/database');

async function ensureOrdersPaymentMethodEnum() {
  console.log('\n🔎 Verificando ENUM de orders.payment_method...');
  const cols = await query(`SHOW COLUMNS FROM orders LIKE 'payment_method'`);
  if (!cols.length) {
    console.error('❌ La columna orders.payment_method no existe. Abortando.');
    return false;
  }
  const currentType = cols[0].Type || '';
  console.log('📐 Tipo actual:', currentType);

  // Valores requeridos
  const required = ['efectivo','transferencia','tarjeta_credito','pago_electronico','cliente_credito','contraentrega','publicidad','reposicion'];
  const missing = required.filter(v => !currentType.includes(v));

  if (missing.length === 0) {
    console.log('✅ ENUM ya contiene todos los valores requeridos');
    return true;
  }

  console.log('🛠️ Faltan en ENUM:', missing.join(', '));
  console.log('➡️  Aplicando ALTER TABLE para incluir todos los valores permitidos...');

  await query(`
    ALTER TABLE orders 
    MODIFY COLUMN payment_method 
      ENUM('efectivo','transferencia','tarjeta_credito','pago_electronico','cliente_credito','contraentrega','publicidad','reposicion')
      DEFAULT 'efectivo'
  `);

  const colsAfter = await query(`SHOW COLUMNS FROM orders LIKE 'payment_method'`);
  console.log('📐 Tipo actualizado:', colsAfter[0].Type || '');

  // Normalizar posibles valores legacy
  console.log('🧹 Normalizando valores legacy en orders.payment_method...');
  await query(`
    UPDATE orders 
    SET payment_method = 'cliente_credito'
    WHERE payment_method IN ('credito','crédito')
  `);

  console.log('✅ ENUM actualizado y datos normalizados');
  return true;
}

(async () => {
  try {
    const ok = await ensureOrdersPaymentMethodEnum();
    if (ok) {
      console.log('\n🎉 Migración de orders.payment_method completada correctamente.');
    } else {
      console.log('\n⚠️ Migración no aplicada.');
    }
  } catch (e) {
    console.error('❌ Error actualizando ENUM de orders.payment_method:', e.message);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
  }
})();
