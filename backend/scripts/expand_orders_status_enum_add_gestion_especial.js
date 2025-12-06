const { query, poolEnd } = require('../config/database');

/**
 * Amplía dinámicamente el ENUM de orders.status para incluir 'gestion_especial'
 * sin eliminar valores existentes ni truncar datos legacy.
 *
 * Uso:
 *   node backend/scripts/expand_orders_status_enum_add_gestion_especial.js
 */
async function expandStatusEnum() {
  console.log('\n🔎 Inspeccionando ENUM y valores existentes en orders.status...');

  // 1) Leer tipo actual
  const cols = await query(`SHOW COLUMNS FROM orders LIKE 'status'`);
  if (!cols.length) {
    console.error('❌ La columna orders.status no existe. Abortando.');
    return false;
  }
  const currentType = cols[0].Type || '';
  console.log('📐 Tipo actual:', currentType);

  // 2) Obtener todos los valores distintos existentes en la tabla
  const distinctRows = await query(`SELECT DISTINCT status FROM orders`);
  const existing = new Set(
    (distinctRows || [])
      .map(r => (r && r.status != null ? String(r.status).trim() : ''))
      .filter(Boolean)
  );
  console.log('📊 Valores distintos actuales en BD:', Array.from(existing).join(', ') || '(ninguno)');

  // 3) Construir lista final de valores permitidos agregando los requeridos
  //    Incluimos valores comunes del flujo conocidos en el sistema para evitar sobresaltos,
  //    más los ya existentes para no romper datos legacy.
  const required = [
    'pendiente_facturacion',
    'pendiente_por_facturacion',
    'revision_cartera',
    'en_logistica',
    'en_preparacion',
    'pendiente_empaque',
    'en_empaque',
    'empacado',
    'listo',
    'listo_para_entrega',
    'listo_para_recoger',
    'en_reparto',
    'enviado',
    'entregado_transportadora',
    'entregado_cliente',
    'entregado_bodega',
    'cancelado',
    'gestion_especial'
  ];

  required.forEach(v => existing.add(v));

  // 4) Generar SQL ENUM dinámico que incluya TODOS los existentes + requeridos (evita truncado)
  const enumValues = Array.from(existing);
  const enumSql = enumValues.map(v => `'${v.replace(/'/g, "''")}'`).join(',');

  // 5) Si ya incluye 'gestion_especial', no hacer ALTER
  if ((currentType || '').includes("'gestion_especial'")) {
    console.log('✅ El ENUM ya incluye "gestion_especial". No se requieren cambios.');
    return true;
  }

  // 6) Aplicar ALTER para ampliar el ENUM sin eliminar valores legacy
  console.log('➡️  Aplicando ALTER TABLE con ENUM actualizado...');
  await query(`
    ALTER TABLE orders
    MODIFY COLUMN status
      ENUM(${enumSql})
      DEFAULT 'pendiente_facturacion'
  `);

  console.log('✅ ENUM de orders.status ampliado correctamente e incluye "gestion_especial"');
  return true;
}

(async () => {
  try {
    const ok = await expandStatusEnum();
    if (ok) {
      console.log('\n🎉 Expansión dinámica de orders.status completada.');
    } else {
      console.log('\n⚠️ No se aplicaron cambios.');
    }
  } catch (e) {
    console.error('❌ Error en expansión dinámica de orders.status:', e.message);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
  }
})();
