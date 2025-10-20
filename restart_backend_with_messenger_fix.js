const { spawn, exec } = require('child_process');

console.log('🔄 Reiniciando backend para aplicar cambios del controlador de mensajeros...\n');

// Función para matar procesos en Windows
function killProcessOnPort() {
  return new Promise((resolve) => {
    console.log('🔍 Matando procesos en puerto 3001...');
    
    exec('netstat -ano | findstr :3001', (error, stdout, stderr) => {
      if (!stdout) {
        console.log('ℹ️  No hay procesos en puerto 3001');
        resolve();
        return;
      }
      
      const lines = stdout.split('\n');
      const pids = [];
      
      lines.forEach(line => {
        const match = line.trim().match(/\s+(\d+)$/);
        if (match && match[1]) {
          pids.push(match[1]);
        }
      });
      
      if (pids.length === 0) {
        resolve();
        return;
      }
      
      console.log(`🎯 Matando PIDs: ${pids.join(', ')}`);
      
      let killed = 0;
      pids.forEach(pid => {
        exec(`taskkill /F /PID ${pid}`, (killError) => {
          killed++;
          if (!killError) {
            console.log(`✅ PID ${pid} terminado`);
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
  console.log('🚀 Iniciando backend con controlador de mensajeros corregido...');
  
  const backend = spawn('node', ['backend/server.js'], {
    stdio: 'inherit',
    shell: true
  });

  backend.on('spawn', () => {
    console.log('\n✅ ¡BACKEND REINICIADO EXITOSAMENTE!');
    console.log('🔧 Cambios aplicados:');
    console.log('   - Controlador de mensajeros corregido');
    console.log('   - Query SQL actualizada con nombres de columnas correctos');
    console.log('   - Lógica para buscar pedidos "listo_para_entrega" implementada');
    console.log('\n📡 Rutas de mensajero activas y corregidas:');
    console.log('   GET  /api/messenger/orders - Obtener pedidos para mensajero');
    console.log('   POST /api/messenger/orders/:id/accept - Aceptar pedido');
    console.log('   POST /api/messenger/orders/:id/reject - Rechazar pedido');
    console.log('\n💡 Ahora los mensajeros deberían ver pedidos reales');
  });

  backend.on('error', (error) => {
    console.error('❌ Error iniciando backend:', error);
  });

  backend.on('exit', (code) => {
    if (code !== 0) {
      console.log(`\n⚠️  Backend terminó con código ${code}`);
    }
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo backend...');
    backend.kill('SIGINT');
    process.exit(0);
  });
}

// Ejecutar reinicio
async function restartWithFix() {
  try {
    await killProcessOnPort();
    console.log('⏳ Esperando 3 segundos para limpiar puerto...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    startBackend();
  } catch (error) {
    console.error('❌ Error durante el reinicio:', error);
    process.exit(1);
  }
}

restartWithFix();
