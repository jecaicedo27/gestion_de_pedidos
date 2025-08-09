const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🌐 INICIANDO FRONTEND\n');
console.log('=' . repeat(50));

async function startFrontend() {
  try {
    const frontendPath = path.join(__dirname, 'frontend');
    
    // Verificar que existe el directorio frontend
    if (!fs.existsSync(frontendPath)) {
      console.error('❌ Error: Directorio frontend no encontrado');
      return;
    }
    
    // Verificar que existe package.json
    const packageJsonPath = path.join(frontendPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.error('❌ Error: package.json no encontrado en frontend');
      return;
    }
    
    console.log('📂 Directorio frontend:', frontendPath);
    console.log('⚙️  Iniciando servidor React...\n');
    
    // Ejecutar npm start en el directorio frontend
    const frontend = spawn('npm', ['start'], {
      cwd: frontendPath,
      stdio: 'inherit',
      shell: true
    });
    
    frontend.on('error', (error) => {
      console.error('❌ Error iniciando frontend:', error.message);
    });
    
    frontend.on('exit', (code) => {
      console.log(`\n⚠️  Frontend terminado con código: ${code}`);
    });
    
    // Manejar cierre graceful
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo frontend...');
      frontend.kill('SIGTERM');
      process.exit(0);
    });
    
    console.log('✅ Frontend iniciado en proceso separado');
    console.log('📌 Para detener: Ctrl+C\n');
    console.log('🌐 Frontend disponible en: http://localhost:3000');
    console.log('🔗 Backend conectado en: http://localhost:3001');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

startFrontend();
