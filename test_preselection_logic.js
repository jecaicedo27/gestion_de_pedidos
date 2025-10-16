// Test para verificar la lógica de preselección de transportadoras

const testData = {
  order: {
    id: 26,
    order_number: 'FV-2-12752',
    carrier_id: 32
  },
  carriersList: [
    {id: 8, name: 'Camión Externo', code: null},
    {id: 2, name: 'COORDINADORA', code: 'coordinadora'},
    {id: 6, name: 'DEPRISA', code: 'deprisa'},
    {id: 4, name: 'ENVIA', code: 'envia'},
    {id: 3, name: 'INTERRAPIDÍSIMO', code: 'interrapidisimo'},
    {id: 32, name: 'MENSAJERO LOCAL', code: null},
    {id: 28, name: 'Mercado Envíos', code: null},
    {id: 21, name: 'Saferbo', code: null},
    {id: 1, name: 'SERVIENTREGA', code: 'servientrega'},
    {id: 5, name: 'TCC', code: 'tcc'}
  ]
};

console.log('🧪 TESTING PRESELECTION LOGIC...\n');

// Test 1: Verificar que tenemos los datos correctos
console.log('📦 DATOS DEL PEDIDO:');
console.log('Order ID:', testData.order.id);
console.log('Carrier ID:', testData.order.carrier_id);
console.log('Carrier ID type:', typeof testData.order.carrier_id);
console.log('');

// Test 2: Buscar la transportadora
const carrierId = parseInt(testData.order.carrier_id);
console.log('🔍 BÚSQUEDA:');
console.log('Buscando carrier ID:', carrierId);
console.log('Tipo después de parseInt:', typeof carrierId);
console.log('');

// Test 3: Verificar la búsqueda
const selectedCarrier = testData.carriersList.find(c => {
  console.log(`Comparando: ${c.id} (${typeof c.id}) === ${carrierId} (${typeof carrierId}) -> ${parseInt(c.id) === carrierId}`);
  return parseInt(c.id) === carrierId;
});

console.log('');
console.log('✅ RESULTADO:');
if (selectedCarrier) {
  console.log('Transportadora encontrada:', selectedCarrier.name);
  console.log('ID encontrado:', selectedCarrier.id);
} else {
  console.log('❌ No se encontró la transportadora');
}

console.log('');
console.log('📋 LISTA COMPLETA DE CARRIERS:');
testData.carriersList.forEach(c => {
  console.log(`- ID: ${c.id} (${typeof c.id}) -> ${c.name}`);
});
