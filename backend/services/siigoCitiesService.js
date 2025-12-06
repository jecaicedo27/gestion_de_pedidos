/**
 * Servicio de ciudades SIIGO basado en base de datos (fuente oficial Excel).
 * - Tabla: siigo_cities
 * - Columnas: country_code(2), state_code(2), city_code(5), state_name, city_name, search_text (normalizado)
 * - Índices: UNIQUE(state_code, city_code), FULL/BTREE sobre search_text
 *
 * Flujo:
 *  1) ensureTable(): crea tabla e índices si no existen.
 *  2) importFromExcel(): carga database/Países-Departamentos-Ciudades.xlsx y llena la tabla (upsert).
 *  3) searchCities(q): consulta por DB (acento-insensible) y retorna hasta 20 resultados.
 *  4) resolveCityByName(name): primer match -> { country_code, state_code, code }
 *
 * Nota: si la tabla está vacía, intenta cargar desde Excel automáticamente (una sola vez).
 */
const path = require('path');
const xlsx = require('xlsx');
const { pool } = require('../config/database');

const EXCEL_PATH = path.join(__dirname, '..', '..', 'database', 'Países-Departamentos-Ciudades.xlsx');

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

async function ensureTable() {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS siigo_cities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      country_code VARCHAR(2) NOT NULL,
      state_code   VARCHAR(2) NOT NULL,
      city_code    VARCHAR(5) NOT NULL,
      state_name   VARCHAR(100) NOT NULL,
      city_name    VARCHAR(120) NOT NULL,
      search_text  VARCHAR(300) NOT NULL,
      UNIQUE KEY uniq_state_city (state_code, city_code),
      KEY idx_search_text (search_text)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
  `;
  await pool.execute(createSQL);
}

function parseExcelCities() {
  const wb = xlsx.readFile(EXCEL_PATH, { cellDates: false, cellNF: false, cellText: false });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Intento con encabezados nominales
  let rows = [];
  try {
    const nominal = xlsx.utils.sheet_to_json(ws, { defval: '', raw: false });
    const colCountry = 'País';
    const colDept = 'Estado / Departamento';
    const colCity = 'Ciudad';
    const colStateCode = 'Código Estado / Departamento';
    const colCityCode = 'Código ciudad';

    const tmp = [];
    for (const r of nominal) {
      const countryNorm = stripAccents(r[colCountry] || '');
      if (!countryNorm || !(countryNorm === 'colombia' || countryNorm === 'co')) continue;
      const stateName = r[colDept] || '';
      const cityName = r[colCity] || '';
      const stCode = padState(r[colStateCode]);
      const ctCode = padCity(r[colCityCode]);
      if (!stateName || !cityName || !stCode || !ctCode) continue;
      tmp.push({ country_code: 'CO', state_name: stateName, city_name: cityName, state_code: stCode, city_code: ctCode });
    }
    if (tmp.length > 0) rows = tmp;
  } catch {}

  if (rows.length === 0) {
    // Fallback detectando fila de encabezados entre contenido decorativo
    const aoa = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    let headerIdx = -1;
    let idxCountry = -1, idxDept = -1, idxCity = -1, idxStateCode = -1, idxCityCode = -1;

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
      for (let r = headerIdx + 1; r < aoa.length; r++) {
        const row = aoa[r];
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
        tmp.push({ country_code: 'CO', state_name: stateName, city_name: cityName, state_code: stCode, city_code: ctCode });
      }
    }
    rows = tmp;
  }

  // Fallback 3: parse por posiciones fijas A..F cuando el archivo viene exactamente en 6 columnas
  if (!rows || rows.length === 0) {
    const aoa2 = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    const tmp2 = [];
    for (const r of aoa2) {
      if (!Array.isArray(r) || r.length < 6) continue;
      const country = String(r[0] || '').trim();
      const stateName = String(r[1] || '').trim();
      const cityName = String(r[2] || '').trim();
      // r[3] = Código país (no usado)
      const stCodeRaw = r[4];
      const ctCodeRaw = r[5];

      const countryNorm = stripAccents(country);
      const stCode = padState(stCodeRaw);
      const ctCode = padCity(ctCodeRaw);

      if (!(countryNorm === 'colombia' || countryNorm === 'co')) continue;
      if (!stateName || !cityName || stCode.length !== 2 || ctCode.length !== 5) continue;

      tmp2.push({
        country_code: 'CO',
        state_name: stateName,
        city_name: cityName,
        state_code: stCode,
        city_code: ctCode
      });
    }
    rows = tmp2;
  }

  // Fallback 4: exportar a CSV y parsear por columnas (por si el fichero viene con celdas no estándar)
  if (!rows || rows.length === 0) {
    try {
      const csv = xlsx.utils.sheet_to_csv(ws, { FS: ',', RS: '\n' });
      const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      // Identificar fila de encabezados aproximada
      let start = -1;
      for (let i = 0; i < lines.length; i++) {
        const norm = stripAccents(lines[i]);
        if (norm.includes('pais') && (norm.includes('ciudad') || norm.includes('estado'))) {
          start = i;
          break;
        }
      }

      const tmp3 = [];
      for (let i = (start >= 0 ? start + 1 : 0); i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.replace(/^"|"$/g, '').trim());
        if (parts.length < 6) continue;

        const country = parts[0];
        const stateName = parts[1];
        const cityName = parts[2];
        // parts[3] = Código país (no usado)
        const stCodeRaw = parts[4];
        const ctCodeRaw = parts[5];

        const countryNorm = stripAccents(country);
        const stCode = padState(stCodeRaw);
        const ctCode = padCity(ctCodeRaw);

        if (!(countryNorm === 'colombia' || countryNorm === 'co')) continue;
        if (!stateName || !cityName || stCode.length !== 2 || ctCode.length !== 5) continue;

        tmp3.push({
          country_code: 'CO',
          state_name: stateName,
          city_name: cityName,
          state_code: stCode,
          city_code: ctCode
        });
      }
      rows = tmp3;
    } catch (e) {
      // Ignorar, caerá en error más adelante si rows sigue vacío
    }
  }

  // Construir search_text
  return rows.map(r => ({
    ...r,
    search_text: stripAccents(`${r.city_name} ${r.state_name} ${r.city_code} ${r.state_code}`)
  }));
}

async function importFromExcel({ truncate = false } = {}) {
  await ensureTable();

  const cities = parseExcelCities();
  if (!Array.isArray(cities) || cities.length === 0) {
    throw new Error('El Excel no produjo filas válidas para importar.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (truncate) {
      await conn.query('TRUNCATE TABLE siigo_cities');
    }
    // Upsert por lotes
    const sql = `
      INSERT INTO siigo_cities (country_code, state_code, city_code, state_name, city_name, search_text)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        country_code = VALUES(country_code),
        state_name   = VALUES(state_name),
        city_name    = VALUES(city_name),
        search_text  = VALUES(search_text)
    `;
    for (const c of cities) {
      await conn.query(sql, [c.country_code, c.state_code, c.city_code, c.state_name, c.city_name, c.search_text]);
    }
    await conn.commit();
    return { inserted_or_updated: cities.length };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function countCities() {
  await ensureTable();
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM siigo_cities');
  return rows?.[0]?.c || 0;
}

async function ensureSeedFromExcelIfEmpty() {
  const total = await countCities();
  if (total === 0) {
    await importFromExcel({ truncate: false });
  }
}

async function searchCities(q = '', limit = 20) {
  await ensureTable();
  await ensureSeedFromExcelIfEmpty();
  const query = stripAccents(q);
  if (!query) {
    const [rows] = await pool.query(
      'SELECT state_code, city_code, city_name, state_name FROM siigo_cities ORDER BY city_name LIMIT ?',
      [limit]
    );
    return rows;
  }
  const like = `%${query}%`;
  const [rows] = await pool.query(
    'SELECT state_code, city_code, city_name, state_name FROM siigo_cities WHERE search_text LIKE ? ORDER BY city_name LIMIT ?',
    [like, limit]
  );
  return rows;
}

async function resolveCityByName(name = '') {
  const list = await searchCities(name, 1);
  if (list && list.length) {
    const f = list[0];
    return { country_code: 'CO', state_code: f.state_code, code: f.city_code };
  }
  return null;
}

module.exports = {
  ensureTable,
  importFromExcel,
  searchCities,
  resolveCityByName,
  _internals: { EXCEL_PATH, parseExcelCities, stripAccents }
};
