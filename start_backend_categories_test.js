const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando backend para probar categorías...\n');

// Cambiar al directorio backend
process.chdir(path.join(__dirname, 'backend'));

// Iniciar el servidor
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error('❌ Error iniciando servidor:', error);
});

server.on('close', (code) => {
  console.log(`\n🔴 Servidor terminado con código: ${code}`);
});

console.log('💡 El servidor se está iniciando en el puerto 3001...');
console.log('💡 Presiona Ctrl+C para detener el servidor');
console.log('💡 Una vez que veas "Servidor corriendo en puerto 3001", ejecuta:');
console.log('   node test_categories_endpoints_fixed.js');
