#!/usr/bin/env node
/**
 * Inspecciona la tabla product_variants (estructura e índices) y muestra una muestra de datos.
 */
const { query, poolEnd } = require('../config/database');

(async () => {
  try {
    console.log('🔍 Inspeccionando tabla product_variants...\n');

    try {
      const desc = await query('DESCRIBE product_variants');
      console.log('📋 DESCRIBE product_variants:');
      desc.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} (Null: ${col.Null}, Key: ${col.Key}, Default: ${col.Default})`);
      });
      console.log('');
    } catch (e) {
      console.log('❌ DESCRIBE product_variants falló:', e.message);
    }

    try {
      const idx = await query('SHOW INDEX FROM product_variants');
      console.log('🧩 Índices en product_variants:');
      if (Array.isArray(idx) && idx.length) {
        const grouped = {};
        idx.forEach(ix => {
          if (!grouped[ix.Key_name]) grouped[ix.Key_name] = [];
          grouped[ix.Key_name].push(ix);
        });
        Object.entries(grouped).forEach(([name, parts]) => {
          const unique = parts[0].Non_unique === 0 ? 'UNIQUE' : 'NON-UNIQUE';
          const cols = parts.sort((a,b)=>a.Seq_in_index-b.Seq_in_index).map(p=>p.Column_name).join(', ');
          console.log(`  - ${name}: ${unique} (${cols})`);
        });
      } else {
        console.log('  (sin información de índices)');
      }
      console.log('');
    } catch (e) {
      console.log('⚠️ SHOW INDEX FROM product_variants falló:', e.message);
    }

    try {
      const create = await query('SHOW CREATE TABLE product_variants');
      if (Array.isArray(create) && create.length) {
        const ddl = create[0]['Create Table'] || create[0]['Create Table'] || JSON.stringify(create[0], null, 2);
        console.log('📐 SHOW CREATE TABLE product_variants:\n');
        console.log(ddl);
      } else {
        console.log('⚠️ SHOW CREATE TABLE product_variants no retornó filas');
      }
    } catch (e) {
      console.log('⚠️ SHOW CREATE TABLE product_variants falló:', e.message);
    }

    try {
      const sample = await query(
        `SELECT pv.id, pv.product_barcode_id, pv.variant_name, pv.variant_barcode, pv.is_active, pb.product_name
         FROM product_variants pv
         JOIN products pb ON pb.id = pv.product_barcode_id
         ORDER BY pv.id DESC
         LIMIT 5`
      );
      console.log('\n📦 Muestra de product_variants:');
      if (sample.length === 0) {
        console.log('  (sin filas)');
      } else {
        sample.forEach(r => {
          console.log(`  - id=${r.id} | product_id=${r.product_barcode_id} | name=${r.variant_name} | vbarcode=${r.variant_barcode} | activo=${r.is_active} | base=${r.product_name}`);
        });
      }
    } catch (e) {
      console.log('⚠️ Consulta de muestra falló:', e.message);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await poolEnd().catch(()=>{});
  }
})();
