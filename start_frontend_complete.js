const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando Frontend Completo');
console.log('==============================');

async function startFrontend() {
  const frontendPath = path.join(__dirname, 'frontend');
  
  console.log('📁 Directorio frontend:', frontendPath);
  console.log('⚡ Ejecutando npm start...');
  
  // Iniciar el frontend
  const frontend = spawn('npm', ['start'], {
    cwd: frontendPath,
    stdio: 'inherit',
    shell: true
  });
  
  frontend.on('error', (error) => {
    console.error('❌ Error iniciando frontend:', error.message);
  });
  
  frontend.on('close', (code) => {
    console.log(`🔚 Frontend terminó con código: ${code}`);
  });
  
  console.log('✅ Frontend iniciado - Se abrirá en http://localhost:3000');
  console.log('💡 Para detener: Ctrl+C');
}

startFrontend().catch(console.error);
