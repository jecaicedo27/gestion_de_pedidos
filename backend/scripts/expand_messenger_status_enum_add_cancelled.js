const { query, poolEnd } = require('../config/database');

/**
 * Amplía dinámicamente el ENUM de orders.messenger_status para incluir 'cancelled'
 * sin eliminar valores existentes ni truncar datos legacy.
 *
 * Uso:
 *   node backend/scripts/expand_messenger_status_enum_add_cancelled.js
 */
async function expandMessengerStatusEnum() {
  console.log('\n🔎 Inspeccionando ENUM y valores existentes en orders.messenger_status...');

  // 1) Leer columna actual
  const cols = await query(`SHOW COLUMNS FROM orders LIKE 'messenger_status'`);
  if (!cols.length) {
    console.error('❌ La columna orders.messenger_status no existe. Abortando.');
    return false;
  }
  const col = cols[0];
  const currentType = col.Type || '';
  const currentNull = (col.Null || '').toUpperCase() === 'YES';
  const currentDefault = col.Default;

  console.log('📐 Tipo actual:', currentType);
  console.log('🔧 NULL permitido:', currentNull ? 'YES' : 'NO');
  console.log('🔧 DEFAULT actual:', currentDefault == null ? 'NULL' : String(currentDefault));

  // 2) Obtener valores distintos existentes en la tabla (evita truncado de datos)
  const distinctRows = await query(`SELECT DISTINCT messenger_status FROM orders WHERE messenger_status IS NOT NULL`);
  const existing = new Set(
    (distinctRows || [])
      .map(r => (r && r.messenger_status != null ? String(r.messenger_status).trim() : ''))
      .filter(Boolean)
  );
  console.log('📊 Valores distintos actuales en BD:', Array.from(existing).join(', ') || '(ninguno)');

  // 3) Agregar valores conocidos del flujo + 'cancelled'
  const required = [
    'pending_assignment',
    'assigned',
    'accepted',
    'rejected',
    'in_delivery',
    'delivered',
    'delivery_failed',
    'returned_to_logistics',
    'failed',
    'returned',
    'cancelled'
  ];
  required.forEach(v => existing.add(v));

  // 4) Si ya incluye 'cancelled', no hacer ALTER
  if ((currentType || '').includes("'cancelled'")) {
    console.log('✅ El ENUM ya incluye "cancelled". No se requieren cambios.');
    return true;
  }

  // 5) Generar SQL ENUM dinámico con TODOS los valores (existentes + requeridos)
  const enumValues = Array.from(existing);
  const enumSql = enumValues.map(v => `'${v.replace(/'/g, "''")}'`).join(',');

  // 6) Construir ALTER TABLE preservando NULL/DEFAULT actuales
  const nullSql = currentNull ? 'NULL' : 'NOT NULL';
  const defaultSql = currentDefault == null ? 'DEFAULT NULL' : `DEFAULT '${String(currentDefault).replace(/'/g, "''")}'`;

  const alterSql = `
    ALTER TABLE orders
    MODIFY COLUMN messenger_status
      ENUM(${enumSql})
      ${nullSql}
      ${defaultSql}
  `;

  console.log('➡️  Aplicando ALTER TABLE con ENUM actualizado...');
  await query(alterSql);

  console.log('✅ ENUM de orders.messenger_status ampliado correctamente e incluye "cancelled"');
  return true;
}

(async () => {
  try {
    const ok = await expandMessengerStatusEnum();
    if (ok) {
      console.log('\n🎉 Expansión dinámica de orders.messenger_status completada.');
    } else {
      console.log('\n⚠️ No se aplicaron cambios.');
    }
  } catch (e) {
    console.error('❌ Error en expansión dinámica de orders.messenger_status:', e.message);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
  }
})();
