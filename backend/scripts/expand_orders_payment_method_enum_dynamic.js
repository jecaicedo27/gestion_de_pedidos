const { query, poolEnd } = require('../config/database');

async function expandEnumDynamically() {
  console.log('\\n🔎 Inspeccionando ENUM y valores existentes en orders.payment_method...');

  // 1) Leer tipo actual
  const cols = await query(`SHOW COLUMNS FROM orders LIKE 'payment_method'`);
  if (!cols.length) {
    console.error('❌ La columna orders.payment_method no existe. Abortando.');
    return false;
  }
  const currentType = cols[0].Type || '';
  console.log('📐 Tipo actual:', currentType);

  // 2) Obtener todos los valores distintos existentes en la tabla
  const distinctRows = await query(`SELECT DISTINCT payment_method FROM orders`);
  const existing = new Set(
    (distinctRows || [])
      .map(r => (r && r.payment_method != null ? String(r.payment_method).trim() : ''))
      .filter(Boolean)
  );
  console.log('📊 Valores distintos actuales en BD:', Array.from(existing).join(', ') || '(ninguno)');

  // 3) Construir lista final de valores permitidos agregando los requeridos
  const required = ['efectivo','transferencia','tarjeta_credito','pago_electronico','cliente_credito','contraentrega','publicidad','reposicion'];
  required.forEach(v => existing.add(v));

  // 4) Generar SQL ENUM dinámico que incluya TODOS los existentes + requeridos (evita truncado)
  const enumValues = Array.from(existing);
  const enumSql = enumValues.map(v => `'${v.replace(/'/g, "''")}'`).join(',');

  // 5) Aplicar ALTER para ampliar el ENUM sin eliminar valores legacy
  console.log('➡️  Aplicando ALTER TABLE con ENUM:', enumValues.join(', '));
  await query(`
    ALTER TABLE orders
    MODIFY COLUMN payment_method
      ENUM(${enumSql})
      DEFAULT 'efectivo'
  `);

  // 6) Normalizar datos legacy mínimos (ej: 'credito' -> 'cliente_credito')
  console.log('🧹 Normalizando valores legacy en orders.payment_method...');
  await query(`
    UPDATE orders
    SET payment_method = 'cliente_credito'
    WHERE payment_method IN ('credito','crédito')
  `);

  console.log('✅ ENUM ampliado y datos normalizados (sin eliminar legacy todavía)');
  return true;
}

(async () => {
  try {
    const ok = await expandEnumDynamically();
    if (ok) {
      console.log('\\n🎉 Expansión dinámica de orders.payment_method completada correctamente.');
    } else {
      console.log('\\n⚠️ No se aplicaron cambios.');
    }
  } catch (e) {
    console.error('❌ Error en expansión dinámica de orders.payment_method:', e.message);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
  }
})();
