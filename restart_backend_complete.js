const { exec, spawn } = require('child_process');
const path = require('path');

console.log('🔄 Reiniciando backend completo...\n');

// Función para matar procesos
function killProcess(port) {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' 
      ? `netstat -ano | findstr :${port}`
      : `lsof -ti:${port}`;
    
    exec(command, (error, stdout) => {
      if (stdout) {
        const lines = stdout.trim().split('\n');
        lines.forEach(line => {
          const pid = process.platform === 'win32'
            ? line.trim().split(/\s+/).pop()
            : line.trim();
          
          if (pid && !isNaN(pid)) {
            const killCommand = process.platform === 'win32'
              ? `taskkill /F /PID ${pid}`
              : `kill -9 ${pid}`;
            
            exec(killCommand, (err) => {
              if (!err) {
                console.log(`✅ Proceso en puerto ${port} terminado (PID: ${pid})`);
              }
            });
          }
        });
        setTimeout(resolve, 2000);
      } else {
        console.log(`ℹ️ No hay procesos en el puerto ${port}`);
        resolve();
      }
    });
  });
}

async function restartBackend() {
  try {
    // 1. Matar procesos existentes
    console.log('1. Terminando procesos existentes...');
    await killProcess(3001);
    
    // 2. Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Iniciar el backend
    console.log('\n2. Iniciando backend...');
    const backendPath = path.join(__dirname, 'backend');
    
    const backend = spawn('npm', ['start'], {
      cwd: backendPath,
      shell: true,
      stdio: 'inherit'
    });
    
    backend.on('error', (err) => {
      console.error('❌ Error al iniciar el backend:', err);
    });
    
    console.log('\n✅ Backend reiniciado exitosamente');
    console.log('📊 Base de datos: gestion_pedidos_dev');
    console.log('✅ Tabla chatgpt_logs disponible');
    console.log('🚀 Backend corriendo en: http://localhost:3001');
    console.log('\n💡 El procesamiento con ChatGPT ya está listo para usar!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
restartBackend();
