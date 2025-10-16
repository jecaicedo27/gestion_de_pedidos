const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 INICIANDO BACKEND MANUALMENTE\n');
console.log('=' . repeat(50));

async function startBackend() {
  try {
    const backendPath = path.join(__dirname, 'backend');
    
    // Verificar que existe el directorio backend
    if (!fs.existsSync(backendPath)) {
      console.error('❌ Error: Directorio backend no encontrado');
      return;
    }
    
    // Verificar que existe package.json
    const packageJsonPath = path.join(backendPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.error('❌ Error: package.json no encontrado en backend');
      return;
    }
    
    console.log('📂 Directorio backend:', backendPath);
    console.log('⚙️  Iniciando servidor...\n');
    
    // Ejecutar npm start en el directorio backend
    const backend = spawn('npm', ['start'], {
      cwd: backendPath,
      stdio: 'inherit',
      shell: true
    });
    
    backend.on('error', (error) => {
      console.error('❌ Error iniciando backend:', error.message);
    });
    
    backend.on('exit', (code) => {
      console.log(`\n⚠️  Backend terminado con código: ${code}`);
    });
    
    // Manejar cierre graceful
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo backend...');
      backend.kill('SIGTERM');
      process.exit(0);
    });
    
    console.log('✅ Backend iniciado en proceso separado');
    console.log('📌 Para detener: Ctrl+C\n');
    console.log('🌐 Backend disponible en: http://localhost:3001');
    console.log('❤️  Health check: http://localhost:3001/api/health');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

startBackend();
