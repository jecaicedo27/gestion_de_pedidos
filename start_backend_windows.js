const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando backend...');

const backendPath = path.join(__dirname, 'backend');
const backend = spawn('npm', ['start'], {
  cwd: backendPath,
  shell: true,
  stdio: 'inherit'
});

backend.on('error', (err) => {
  console.error('❌ Error al iniciar el backend:', err);
});

backend.on('close', (code) => {
  console.log(`Backend terminado con código ${code}`);
});
