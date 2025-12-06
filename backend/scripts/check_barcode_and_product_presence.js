#!/usr/bin/env node
/**
 * Diagnóstico de presencia de producto y restricciones de barcode.
 * - Verifica si existen GUD01/GUD02/GUD03 en la BD local
 * - Busca entradas por códigos de barras 7709001453565 y 7709001453572
 * - Muestra índices/constraints de la tabla products (para detectar UNIQUE en barcode)
 * - Muestra SHOW CREATE TABLE products para confirmar restricciones
 */
const { query, poolEnd } = require('../config/database');

async function main() {
  try {
    console.log('🔎 Diagnóstico de productos GUD* y barcodes en BD local\n');

    // 1) Productos por internal_code
    const rowsByCode = await query(
      `SELECT id, product_name, internal_code, barcode, siigo_id, is_active, category
       FROM products
       WHERE internal_code IN ('GUD01','GUD02','GUD03')
       ORDER BY internal_code`
    );
    console.log('📦 Por internal_code (GUD01/GUD02/GUD03):');
    if (rowsByCode.length === 0) {
      console.log('  ❌ No hay coincidencias por internal_code');
    } else {
      rowsByCode.forEach(r => {
        console.log(`  - id=${r.id} | ${r.internal_code} | ${r.product_name} | barcode=${r.barcode} | siigo_id=${r.siigo_id} | activo=${r.is_active} | cat=${r.category}`);
      });
    }
    console.log('');

    // 2) Productos por barcode
    const barcodes = ['7709001453565','7709001453572'];
    const rowsByBarcode = await query(
      `SELECT id, product_name, internal_code, barcode, siigo_id, is_active, category
       FROM products
       WHERE barcode IN (?, ?)`,
      barcodes
    );
    console.log(`🔢 Por barcode (${barcodes.join(', ')}):`);
    if (rowsByBarcode.length === 0) {
      console.log('  ❌ No hay coincidencias por barcode');
    } else {
      rowsByBarcode.forEach(r => {
        console.log(`  - id=${r.id} | ${r.internal_code} | ${r.product_name} | barcode=${r.barcode} | siigo_id=${r.siigo_id} | activo=${r.is_active} | cat=${r.category}`);
      });
    }
    console.log('');

    // 3) Duplicados por barcode (si los hubiera)
    const dupBarcodes = await query(
      `SELECT barcode, COUNT(*) as c
       FROM products
       WHERE barcode IS NOT NULL AND TRIM(barcode) <> ''
       GROUP BY barcode
       HAVING COUNT(*) > 1
       ORDER BY c DESC, barcode ASC
       LIMIT 20`
    );
    console.log('🧪 Posibles duplicados de barcode en products:');
    if (dupBarcodes.length === 0) {
      console.log('  ✅ No se encontraron barcodes duplicados en la tabla');
    } else {
      dupBarcodes.forEach(r => console.log(`  - ${r.barcode}: ${r.c} filas`));
    }
    console.log('');

    // 4) Índices en products
    try {
      const indexes = await query(`SHOW INDEX FROM products`);
      console.log('🧩 Índices en products:');
      if (Array.isArray(indexes) && indexes.length) {
        const grouped = {};
        indexes.forEach(ix => {
          const key = ix.Key_name;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(ix);
        });
        Object.entries(grouped).forEach(([name, parts]) => {
          const unique = parts[0].Non_unique === 0 ? 'UNIQUE' : 'NON-UNIQUE';
          const cols = parts.sort((a,b) => a.Seq_in_index - b.Seq_in_index).map(p => p.Column_name).join(', ');
          console.log(`  - ${name}: ${unique} (${cols})`);
        });
      } else {
        console.log('  (sin información de índices)');
      }
      console.log('');
    } catch (e) {
      console.log('⚠️ No fue posible obtener SHOW INDEX FROM products:', e.message);
    }

    // 5) SHOW CREATE TABLE products (estructura completa)
    try {
      const create = await query(`SHOW CREATE TABLE products`);
      if (Array.isArray(create) && create.length) {
        const ddl = create[0]['Create Table'] || create[0]['Create Table'] || JSON.stringify(create[0], null, 2);
        console.log('📐 SHOW CREATE TABLE products:\n');
        console.log(ddl);
      } else {
        console.log('⚠️ SHOW CREATE TABLE products no retornó filas');
      }
    } catch (e) {
      console.log('⚠️ No fue posible ejecutar SHOW CREATE TABLE products:', e.message);
    }
  } catch (err) {
    console.error('❌ Error en diagnóstico:', err.message);
  } finally {
    await poolEnd().catch(() => {});
  }
}

main();
