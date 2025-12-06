#!/usr/bin/env node
/**
 * Debug lector del Excel de ciudades para ver cómo vienen las filas/encabezados.
 */
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const EXCEL_PATH = path.join(__dirname, '..', '..', 'database', 'Países-Departamentos-Ciudades.xlsx');

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

(function main() {
  console.log('📄 Archivo:', EXCEL_PATH);
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('❌ No existe el archivo');
    process.exit(1);
  }
  const wb = xlsx.readFile(EXCEL_PATH, { cellDates: false, cellNF: false, cellText: false });
  console.log('🗂️ Hojas:', wb.SheetNames);
  const ws = wb.Sheets[wb.SheetNames[0]];

  // 1) Vista nominal (usa primera fila como encabezados)
  try {
    const nominal = xlsx.utils.sheet_to_json(ws, { defval: '', raw: false });
    console.log('🔎 Vista nominal - primeras 3 filas con keys:', Object.keys(nominal[0] || {}));
    console.log(JSON.stringify(nominal.slice(0, 3), null, 2));
  } catch (e) {
    console.log('⚠️ Error nominal:', e.message);
  }

  // 2) Vista AOA (header:1)
  const aoa = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  console.log('🔢 Total filas AOA:', aoa.length);
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const row = (aoa[i] || []).map(v => (typeof v === 'string' ? v : String(v || '')));
    const norm = row.map(stripAccents);
    console.log(`[${i}] len=${row.length}`, row);
    console.log(`   norm:`, norm);
  }

  // 2b) Buscar primeras filas con >= 6 columnas pobladas
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i] || [];
    if (row.length >= 6 && row.some((v, idx) => idx < 6 && String(v || '').trim() !== '')) {
      const preview = row.slice(0, 8).map(v => String(v || ''));
      console.log(`✅ Posible fila con 6+ columnas en índice ${i} ->`, preview);
      break;
    }
  }

  // 3) Intento de localizar fila de encabezados en AOA
  let headerIdx = -1;
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i].map(v => String(v || '').trim());
    const norm = row.map(stripAccents);
    const candIdxCountry = norm.findIndex(v => v === 'codigo pais' || v === 'pais' || v === 'codigo país');
    const candIdxDept = norm.findIndex(v => v.includes('estado') || v.includes('departamento'));
    const candIdxCity = norm.findIndex(v => v === 'ciudad');
    const candIdxStateCode = norm.findIndex(v => v.includes('codigo estado') || v.includes('codigo departamento'));
    const candIdxCityCode = norm.findIndex(v => v.includes('codigo ciudad'));
    if (candIdxDept !== -1 && candIdxCity !== -1 && candIdxStateCode !== -1 && candIdxCityCode !== -1) {
      headerIdx = i;
      console.log(`✅ Encabezados detectados en fila ${i}`, { candIdxCountry, candIdxDept, candIdxCity, candIdxStateCode, candIdxCityCode });
      break;
    }
  }
  if (headerIdx === -1) {
    console.log('❌ No se detectó fila de encabezados con heurística actual.');
  } else {
    console.log('📌 Fila siguiente a encabezados:', aoa[headerIdx + 1]);
  }
})();
