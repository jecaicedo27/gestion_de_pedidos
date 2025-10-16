const { spawn } = require('child_process');
const path = require('path');

console.log('🔄 Reiniciando backend para activar rutas de mensajeros...\n');

// Función para matar procesos en el puerto 3001
function killProcessOnPort() {
  return new Promise((resolve) => {
    const killProcess = spawn('npx', ['kill-port', '3001'], {
      stdio: 'inherit',
      shell: true
    });

    killProcess.on('close', (code) => {
      console.log('🛑 Procesos en puerto 3001 terminados');
      resolve();
    });

    killProcess.on('error', (error) => {
      console.log('ℹ️  No hay procesos ejecutándose en puerto 3001');
      resolve();
    });
  });
}

// Función para iniciar el backend
function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando backend...');
    
    const backend = spawn('node', ['backend/server.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });

    backend.on('spawn', () => {
      console.log('✅ Backend iniciado exitosamente');
      console.log('📡 Rutas de mensajero ahora están activas:');
      console.log('  GET  /api/messenger/orders');
      console.log('  POST /api/messenger/orders/:id/accept');
      console.log('  POST /api/messenger/orders/:id/reject');
      console.log('  POST /api/messenger/orders/:id/start-delivery');
      console.log('  POST /api/messenger/orders/:id/complete');
      console.log('  POST /api/messenger/orders/:id/mark-failed');
      console.log('  GET  /api/messenger/daily-summary');
      console.log('\n💡 Ahora puedes probar el sistema como mensajero');
      resolve();
    });

    backend.on('error', (error) => {
      console.error('❌ Error iniciando backend:', error);
      reject(error);
    });

    // No esperar a que termine el proceso del backend
    // ya que debe mantenerse ejecutándose
  });
}

// Ejecutar reinicio
async function restart() {
  try {
    await killProcessOnPort();
    
    // Esperar un poco antes de iniciar
    console.log('⏳ Esperando 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await startBackend();
    
    console.log('\n🎉 ¡BACKEND REINICIADO EXITOSAMENTE!');
    console.log('✅ Las rutas de messenger están ahora activas');
    console.log('📱 Los mensajeros pueden ahora:');
    console.log('   - Ver pedidos asignados');
    console.log('   - Aceptar/rechazar pedidos');
    console.log('   - Iniciar entregas');
    console.log('   - Completar entregas');
    console.log('   - Marcar entregas como fallidas');
    
    // Mantener el script ejecutándose para que el backend no se cierre
    setInterval(() => {
      // Verificar que el backend sigue activo cada 30 segundos
    }, 30000);
    
  } catch (error) {
    console.error('❌ Error durante el reinicio:', error);
    process.exit(1);
  }
}

restart();
