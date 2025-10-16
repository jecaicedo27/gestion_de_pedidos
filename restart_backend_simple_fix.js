const { spawn } = require('child_process');

console.log('🔄 Reiniciando backend para activar rutas de mensajeros...\n');

// Función simple para iniciar el backend
function startBackend() {
  console.log('🚀 Iniciando backend con rutas de mensajero habilitadas...');
  
  const backend = spawn('node', ['backend/server.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });

  backend.on('spawn', () => {
    console.log('\n✅ ¡BACKEND INICIADO CON ÉXITO!');
    console.log('📡 Rutas de mensajero ahora están activas:');
    console.log('  GET  /api/messenger/orders - Ver pedidos asignados');
    console.log('  POST /api/messenger/orders/:id/accept - Aceptar pedido');
    console.log('  POST /api/messenger/orders/:id/reject - Rechazar pedido');
    console.log('  POST /api/messenger/orders/:id/start-delivery - Iniciar entrega');
    console.log('  POST /api/messenger/orders/:id/complete - Completar entrega');
    console.log('  POST /api/messenger/orders/:id/mark-failed - Marcar como fallida');
    console.log('  GET  /api/messenger/daily-summary - Resumen diario');
    console.log('\n🎉 ¡El sistema de mensajeros está listo!');
    console.log('💡 Ahora puedes probar el sistema como mensajero en el frontend');
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

// Iniciar inmediatamente
startBackend();
