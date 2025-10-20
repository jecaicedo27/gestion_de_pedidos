const { exec } = require('child_process');
const path = require('path');

console.log('🔄 Reiniciando backend con sistema de transportadoras...');

// Matar procesos en el puerto 3001
const killPort = () => {
  return new Promise((resolve) => {
    console.log('🛑 Deteniendo procesos en puerto 3001...');
    
    // Para Windows
    exec('netstat -ano | findstr :3001', (error, stdout) => {
      if (stdout) {
        const lines = stdout.split('\n');
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            exec(`taskkill /F /PID ${pid}`, (err) => {
              if (!err) console.log(`✅ Proceso ${pid} terminado`);
            });
          }
        });
      }
      
      // Esperar un poco y continuar
      setTimeout(resolve, 2000);
    });
  });
};

// Iniciar el backend
const startBackend = () => {
  console.log('🚀 Iniciando backend...');
  
  const backendPath = path.join(__dirname, 'backend');
  const backend = exec('npm start', { 
    cwd: backendPath,
    shell: true
  });
  
  backend.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });
  
  backend.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
  
  backend.on('close', (code) => {
    console.log(`Backend terminado con código ${code}`);
  });
};

// Ejecutar
(async () => {
  await killPort();
  startBackend();
})();
