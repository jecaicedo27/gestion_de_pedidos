/**
 * Catálogo mínimo de ciudades de Colombia con códigos SIIGO (DANE).
 * Estructura requerida por SIIGO:
 *   address.city.state_code (string, requerido)  -> Código del departamento, ej: '05'
 *   address.city.code (ó city_code) (string, req)-> Código de la ciudad/municipio, ej: '05001'
 *
 * Nota: Este catálogo inicial cubre las principales ciudades/áreas metropolitanas.
 * Se puede ampliar fácilmente agregando más entradas.
 */
const CITIES = [
  // Antioquia (05)
  { state_code: '05', city_code: '05001', city_name: 'Medellín', state_name: 'Antioquia' },
  { state_code: '05', city_code: '05088', city_name: 'Bello', state_name: 'Antioquia' },
  { state_code: '05', city_code: '05266', city_name: 'Envigado', state_name: 'Antioquia' },
  { state_code: '05', city_code: '05360', city_name: 'Itagüí', state_name: 'Antioquia' },
  { state_code: '05', city_code: '05615', city_name: 'Rionegro', state_name: 'Antioquia' },

  // Bogotá D.C. (11)
  { state_code: '11', city_code: '11001', city_name: 'Bogotá D.C.', state_name: 'Bogotá D.C.' },

  // Valle del Cauca (76)
  { state_code: '76', city_code: '76001', city_name: 'Cali', state_name: 'Valle del Cauca' },
  { state_code: '76', city_code: '76520', city_name: 'Palmira', state_name: 'Valle del Cauca' },
  { state_code: '76', city_code: '76834', city_name: 'Tuluá', state_name: 'Valle del Cauca' },
  { state_code: '76', city_code: '76892', city_name: 'Yumbo', state_name: 'Valle del Cauca' },

  // Atlántico (08)
  { state_code: '08', city_code: '08001', city_name: 'Barranquilla', state_name: 'Atlántico' },
  { state_code: '08', city_code: '08758', city_name: 'Soledad', state_name: 'Atlántico' },

  // Bolívar (13)
  { state_code: '13', city_code: '13001', city_name: 'Cartagena', state_name: 'Bolívar' },

  // Santander (68)
  { state_code: '68', city_code: '68001', city_name: 'Bucaramanga', state_name: 'Santander' },
  { state_code: '68', city_code: '68276', city_name: 'Floridablanca', state_name: 'Santander' },
  { state_code: '68', city_code: '68307', city_name: 'Girón', state_name: 'Santander' },
  { state_code: '68', city_code: '68547', city_name: 'Piedecuesta', state_name: 'Santander' },

  // Norte de Santander (54)
  { state_code: '54', city_code: '54001', city_name: 'Cúcuta', state_name: 'Norte de Santander' },

  // Risaralda (66)
  { state_code: '66', city_code: '66001', city_name: 'Pereira', state_name: 'Risaralda' },
  { state_code: '66', city_code: '66170', city_name: 'Dosquebradas', state_name: 'Risaralda' },

  // Caldas (17)
  { state_code: '17', city_code: '17001', city_name: 'Manizales', state_name: 'Caldas' },

  // Magdalena (47)
  { state_code: '47', city_code: '47001', city_name: 'Santa Marta', state_name: 'Magdalena' },

  // Córdoba (23)
  { state_code: '23', city_code: '23001', city_name: 'Montería', state_name: 'Córdoba' },

  // Tolima (73)
  { state_code: '73', city_code: '73001', city_name: 'Ibagué', state_name: 'Tolima' },

  // Cundinamarca (25)
  { state_code: '25', city_code: '25754', city_name: 'Soacha', state_name: 'Cundinamarca' },
  { state_code: '25', city_code: '25175', city_name: 'Chía', state_name: 'Cundinamarca' },
  { state_code: '25', city_code: '25286', city_name: 'Funza', state_name: 'Cundinamarca' },
  { state_code: '25', city_code: '25473', city_name: 'Mosquera', state_name: 'Cundinamarca' },
  { state_code: '25', city_code: '25899', city_name: 'Zipaquirá', state_name: 'Cundinamarca' },

  // Nariño (52)
  { state_code: '52', city_code: '52001', city_name: 'Pasto', state_name: 'Nariño' },
  { state_code: '52', city_code: '52683', city_name: 'Sandoná', state_name: 'Nariño' },

  // Huila (41)
  { state_code: '41', city_code: '41001', city_name: 'Neiva', state_name: 'Huila' },

  // Meta (50)
  { state_code: '50', city_code: '50001', city_name: 'Villavicencio', state_name: 'Meta' },

  // Quindío (63)
  { state_code: '63', city_code: '63001', city_name: 'Armenia', state_name: 'Quindío' },
];

/**
 * Búsqueda simple por texto/código (acento-insensible).
 * search: string para buscar por nombre de ciudad, departamento, o códigos.
 * Devuelve hasta 20 resultados ordenados por coincidencia.
 */
function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
function searchCities(search = '') {
  const q = stripAccents(search || '');
  if (!q) return CITIES.slice(0, 20);
  const scored = CITIES.map(c => {
    const hay = `${c.city_name} ${c.state_name} ${c.city_code} ${c.state_code}`;
    const norm = stripAccents(hay);
    const match = norm.indexOf(q);
    const score = match === -1 ? Infinity : match;
    return { score, c };
  }).filter(x => x.score !== Infinity)
    .sort((a, b) => a.score - b.score)
    .slice(0, 20)
    .map(x => x.c);
  return scored;
}

module.exports = {
  searchCities,
  all: CITIES
};
