#!/usr/bin/env node
/**
 * Script: Importar ciudades SIIGO a la tabla siigo_cities desde el Excel oficial.
 * Uso:
 *   node backend/scripts/import_siigo_cities.js            (upsert)
 *   node backend/scripts/import_siigo_cities.js --truncate (limpia y vuelve a cargar)
 */
const path = require('path');
const fs = require('fs');
const dotenvPath = path.join(__dirname, '..', process.env.NODE_ENV === 'development' ? '.env.development' : '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
} else {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const { pool } = require('../config/database');
const svc = require('../services/siigoCitiesService');

async function main() {
  const truncate = process.argv.includes('--truncate');
  console.log('🔧 Importador de ciudades SIIGO -> DB');
  console.log('   Archivo Excel:', path.join(__dirname, '..', '..', 'database', 'Países-Departamentos-Ciudades.xlsx'));
  console.log('   Modo:', truncate ? 'TRUNCATE + UPSERT' : 'UPSERT');

  try {
    await svc.ensureTable();

    const before = await pool.query('SELECT COUNT(*) AS c FROM siigo_cities');
    const beforeCount = before?.[0]?.[0]?.c || 0;
    console.log(`📊 Registros antes: ${beforeCount}`);

    const res = await svc.importFromExcel({ truncate });
    console.log(`✅ Importación completada. Filas insertadas/actualizadas: ${res.inserted_or_updated}`);

    const after = await pool.query('SELECT COUNT(*) AS c FROM siigo_cities');
    const afterCount = after?.[0]?.[0]?.c || 0;
    console.log(`📊 Registros después: ${afterCount}`);

    // Prueba rápida de búsqueda
    const test = await svc.searchCities('sandona', 5);
    console.log('🔎 Prueba "sandona":', test && test.length ? test : 'SIN RESULTADOS');

    process.exit(0);
  } catch (e) {
    console.error('❌ Error importando ciudades:', e.message);
    process.exit(1);
  }
}

main();
