const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

console.log('🌐 INICIANDO FRONTEND\n');
console.log('='.repeat(50));

// Encuentra un puerto disponible a partir de uno inicial
async function findAvailablePort(startPort) {
  const isFree = (port) => new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    // Limitar a localhost para evitar prompts de firewall
    srv.listen(port, '127.0.0.1');
  });

  let port = startPort;
  // Evitar bucles infinitos: prueba hasta 20 puertos consecutivos
  for (let i = 0; i < 20; i++) {
    if (await isFree(port)) return port;
    port++;
  }
  // Si no se encontró, deja que CRA decida (puede preguntar)
  return startPort;
}

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
    
    // Determinar puerto a usar (evita prompt interactivo si está ocupado)
    const desired = Number(process.env.PORT) || 3002;
    const port = await findAvailablePort(desired);
    console.log(`🔧 Usando puerto de desarrollo: ${port}`);
    
    // Ejecutar npm start en el directorio frontend con PORT forzado
    const frontend = spawn('npm', ['start'], {
      cwd: frontendPath,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: port }
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
    console.log(`🌐 Frontend disponible en: http://localhost:${port}`);
    console.log('🔗 Backend conectado en: http://localhost:3001');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

startFrontend();
