const { spawn, exec } = require('child_process');
const path = require('path');

console.log('🔄 Forzando reinicio del backend para mensajeros...\n');

// Función para matar procesos en Windows usando netstat y taskkill
function killProcessOnPort() {
  return new Promise((resolve) => {
    console.log('🔍 Buscando procesos en puerto 3001...');
    
    // En Windows, usar netstat para encontrar el proceso
    exec('netstat -ano | findstr :3001', (error, stdout, stderr) => {
      if (error || !stdout) {
        console.log('ℹ️  No hay procesos ejecutándose en puerto 3001');
        resolve();
        return;
      }
      
      // Extraer PID del resultado
      const lines = stdout.split('\n');
      const pids = [];
      
      lines.forEach(line => {
        const match = line.trim().match(/\s+(\d+)$/);
        if (match && match[1]) {
          pids.push(match[1]);
        }
      });
      
      if (pids.length === 0) {
        console.log('ℹ️  No se encontraron PIDs para matar');
        resolve();
        return;
      }
      
      console.log(`🎯 Matando procesos: ${pids.join(', ')}`);
      
      // Matar cada proceso
      let killed = 0;
      pids.forEach(pid => {
        exec(`taskkill /F /PID ${pid}`, (killError) => {
          killed++;
          if (killError) {
            console.log(`⚠️  No se pudo matar proceso ${pid}`);
          } else {
            console.log(`✅ Proceso ${pid} terminado`);
          }
          
          if (killed === pids.length) {
            resolve();
          }
        });
      });
    });
  });
}

// Función para iniciar el backend
function startBackend() {
  console.log('🚀 Iniciando backend con rutas de mensajero...');
  
  const backend = spawn('node', ['backend/server.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });

  backend.on('spawn', () => {
    console.log('\n✅ ¡BACKEND INICIADO EXITOSAMENTE!');
    console.log('📡 Rutas de mensajero activas:');
    console.log('  GET  /api/messenger/test - Prueba de conectividad');
    console.log('  GET  /api/messenger/orders - Ver pedidos (sin auth por ahora)');
    console.log('\n💡 El backend está listo para probar');
  });

  backend.on('error', (error) => {
    console.error('❌ Error iniciando backend:', error);
  });

  backend.on('exit', (code) => {
    if (code !== 0) {
      console.log(`\n⚠️  Backend terminó con código ${code}`);
    }
  });

  // Manejar ctrl+c para salir limpiamente
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo backend...');
    backend.kill('SIGINT');
    process.exit(0);
  });
}

// Ejecutar reinicio forzado
async function forceRestart() {
  try {
    await killProcessOnPort();
    
    // Esperar un poco antes de iniciar
    console.log('⏳ Esperando 2 segundos...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    startBackend();
    
  } catch (error) {
    console.error('❌ Error durante el reinicio forzado:', error);
    process.exit(1);
  }
}

forceRestart();
