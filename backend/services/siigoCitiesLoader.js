/**
 * Loader de ciudades desde Excel oficial de SIIGO colocado en database/Países-Departamentos-Ciudades.xlsx
 * - Devuelve objetos: { state_code, city_code, city_name, state_name }
 * - Búsqueda acento-insensible por nombre/códigos
 */
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '..', '..', 'database', 'Países-Departamentos-Ciudades.xlsx');

// Cache en memoria para evitar re-lectura constante del archivo
const CACHE = {
  items: null,
  mtimeMs: 0
};

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function padState(code) {
  const s = String(code || '').replace(/\D/g, '');
  return s.padStart(2, '0');
}
function padCity(code) {
  const s = String(code || '').replace(/\D/g, '');
  return s.padStart(5, '0');
}

/**
 * Carga y parsea el Excel si:
 *  - el cache está vacío
 *  - o el archivo cambió (mtime distinto)
 */
async function loadCitiesIfNeeded() {
  const fs = require('fs');
  let stat;
  try {
    stat = fs.statSync(EXCEL_PATH);
  } catch (e) {
    // No existe el archivo -> dejar cache vacío
    CACHE.items = [];
    CACHE.mtimeMs = 0;
    return;
  }

  if (CACHE.items && CACHE.mtimeMs === stat.mtimeMs) {
    return; // Cache vigente
  }

  // Intentar leer con 'xlsx'
  let xlsx;
  try {
    xlsx = require('xlsx');
  } catch (e) {
    // Librería no instalada
    console.warn('⚠️ Falta dependencia "xlsx" para leer el archivo de ciudades. Instale con: npm install xlsx');
    CACHE.items = [];
    CACHE.mtimeMs = stat.mtimeMs;
    return;
  }

  try {
    const wb = xlsx.readFile(EXCEL_PATH, { cellDates: false, cellNF: false, cellText: false });
    const ws = wb.Sheets[wb.SheetNames[0]];

    let items = [];

    // 1) Modo encabezados por nombre (si el archivo ya viene "limpio")
    try {
      const rowsByHeader = xlsx.utils.sheet_to_json(ws, { defval: '', raw: false });
      // Intentar detectar nombres de columnas (admite variantes)
      const colCountry = 'País';
      const colDept = 'Estado / Departamento';
      const colCity = 'Ciudad';
      const colStateCode = 'Código Estado / Departamento';
      const colCityCode = 'Código ciudad';

      const tmp = [];
      for (const r of rowsByHeader) {
        const countryNorm = stripAccents(r[colCountry] || '');
        // Aceptar "Colombia" o código "Co"/"CO"
        if (!countryNorm || !(countryNorm === 'colombia' || countryNorm === 'co')) continue;
        const stateName = r[colDept] || '';
        const cityName = r[colCity] || '';
        const stCode = padState(r[colStateCode]);
        const ctCode = padCity(r[colCityCode]);
        if (!stateName || !cityName || !stCode || !ctCode) continue;
        tmp.push({
          country_code: 'CO',
          state_name: stateName,
          city_name: cityName,
          state_code: stCode,
          city_code: ctCode
        });
      }
      if (tmp.length > 0) {
        items = tmp;
      }
    } catch {}

    // 2) Fallback: el archivo incluye cabeceras arriba y la fila real de encabezados está más abajo
    if (items.length === 0) {
      const rowsAoA = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      // Buscar fila que contenga las cabeceras reales
      let headerIdx = -1;
      let idxCountry = -1, idxDept = -1, idxCity = -1, idxStateCode = -1, idxCityCode = -1;

      for (let i = 0; i < rowsAoA.length; i++) {
        const row = rowsAoA[i].map(v => String(v || '').trim());
        const norm = row.map(stripAccents);
        const candIdxCountry = norm.findIndex(v => v === 'codigo pais' || v === 'pais' || v === 'codigo país');
        const candIdxDept = norm.findIndex(v => v.includes('estado') || v.includes('departamento'));
        const candIdxCity = norm.findIndex(v => v === 'ciudad');
        const candIdxStateCode = norm.findIndex(v => v.includes('codigo estado') || v.includes('codigo departamento'));
        const candIdxCityCode = norm.findIndex(v => v.includes('codigo ciudad'));

        if (candIdxDept !== -1 && candIdxCity !== -1 && candIdxStateCode !== -1 && candIdxCityCode !== -1) {
          headerIdx = i;
          idxCountry = candIdxCountry;
          idxDept = candIdxDept;
          idxCity = candIdxCity;
          idxStateCode = candIdxStateCode;
          idxCityCode = candIdxCityCode;
          break;
        }
      }

      const tmp = [];
      if (headerIdx !== -1) {
        for (let r = headerIdx + 1; r < rowsAoA.length; r++) {
          const row = rowsAoA[r];
          if (!row || row.length === 0) continue;

          const country = idxCountry >= 0 ? row[idxCountry] : 'Colombia';
          const countryNorm = stripAccents(country);
          if (idxCountry >= 0 && !(countryNorm === 'colombia' || countryNorm === 'co')) continue;

          const stateName = idxDept >= 0 ? String(row[idxDept] || '').trim() : '';
          const cityName = idxCity >= 0 ? String(row[idxCity] || '').trim() : '';
          const stCodeRaw = idxStateCode >= 0 ? row[idxStateCode] : '';
          const ctCodeRaw = idxCityCode >= 0 ? row[idxCityCode] : '';
          const stCode = padState(stCodeRaw);
          const ctCode = padCity(ctCodeRaw);

          if (!stateName || !cityName || !stCode || !ctCode) continue;

          tmp.push({
            country_code: 'CO',
            state_name: stateName,
            city_name: cityName,
            state_code: stCode,
            city_code: ctCode
          });
        }
      }

      items = tmp;
    }

    CACHE.items = items;
    CACHE.mtimeMs = stat.mtimeMs;
    console.log(`✅ Catálogo SIIGO cargado desde Excel: ${items.length} ciudades`);
  } catch (e) {
    console.error('❌ Error leyendo Excel de ciudades SIIGO:', e.message);
    CACHE.items = [];
    CACHE.mtimeMs = stat.mtimeMs;
  }
}

/**
 * Búsqueda acento-insensible por nombre o códigos
 * @param {string} search
 */
async function searchCitiesExcel(search = '') {
  const q = stripAccents(search || '');
  await loadCitiesIfNeeded();
  const items = Array.isArray(CACHE.items) ? CACHE.items : [];
  if (!q) return items.slice(0, 20);

  // Scoring simple: preferir empieza por query > contiene
  const scored = [];
  for (const c of items) {
    const hay = `${c.city_name} ${c.state_name} ${c.city_code} ${c.state_code}`;
    const norm = stripAccents(hay);
    if (norm.includes(q)) {
      const score = norm.startsWith(q) ? 0 : norm.indexOf(q);
      scored.push({ score, c });
    }
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, 20).map(x => x.c);
}

/**
 * Resolve por nombre suelto (primer match) -> { country_code, state_code, city_code }
 */
async function resolveCityByName(name = '') {
  const list = await searchCitiesExcel(name);
  if (list && list.length) {
    const f = list[0];
    return { country_code: 'CO', state_code: f.state_code, code: f.city_code };
  }
  return null;
}

module.exports = {
  searchCitiesExcel,
  resolveCityByName,
  _internals: { loadCitiesIfNeeded, EXCEL_PATH }
};
