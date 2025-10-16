const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando aplicación completa...');

// Función para matar procesos en puertos específicos
async function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'netstat' : 'lsof';
    const args = isWindows ? ['-ano', '|', 'findstr', `:${port}`] : ['-ti', `:${port}`];
    
    if (isWindows) {
      // En Windows, usar taskkill
      const netstat = spawn('cmd', ['/c', `netstat -ano | findstr :${port}`], { stdio: 'pipe' });
      let output = '';
      
      netstat.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      netstat.on('close', (code) => {
        const lines = output.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid)) {
              console.log(`🔪 Matando proceso en puerto ${port} (PID: ${pid})`);
              spawn('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
            }
          }
        }
        setTimeout(resolve, 1000);
      });
      
      netstat.on('error', () => resolve());
    } else {
      resolve();
    }
  });
}

async function startApp() {
  try {
    // Matar procesos existentes
    console.log('🧹 Limpiando procesos existentes...');
    await killProcessOnPort(3001); // Backend
    await killProcessOnPort(3000); // Frontend
    
    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Iniciar Backend
    console.log('🔧 Iniciando Backend (puerto 3001)...');
    const backendPath = path.join(__dirname, 'backend');
    const backendProcess = spawn('npm', ['start'], {
      cwd: backendPath,
      stdio: 'pipe',
      shell: true
    });
    
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running') || output.includes('listening')) {
        console.log('✅ Backend iniciado correctamente');
      }
      console.log(`[Backend] ${output.trim()}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.log(`[Backend Error] ${data.toString().trim()}`);
    });
    
    // Esperar que el backend se inicie
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Iniciar Frontend
    console.log('🎨 Iniciando Frontend (puerto 3000)...');
    const frontendPath = path.join(__dirname, 'frontend');
    const frontendProcess = spawn('npm', ['start'], {
      cwd: frontendPath,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, BROWSER: 'none' } // Evitar abrir browser automáticamente
    });
    
    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('compiled successfully') || output.includes('webpack compiled')) {
        console.log('✅ Frontend iniciado correctamente');
        console.log('🌐 Aplicación disponible en: http://localhost:3000');
      }
      console.log(`[Frontend] ${output.trim()}`);
    });
    
    frontendProcess.stderr.on('data', (data) => {
      console.log(`[Frontend Error] ${data.toString().trim()}`);
    });
    
    // Manejar cierre graceful
    process.on('SIGINT', () => {
      console.log('\n🛑 Cerrando aplicación...');
      backendProcess.kill('SIGTERM');
      frontendProcess.kill('SIGTERM');
      process.exit(0);
    });
    
    console.log('\n🎉 Aplicación iniciada correctamente!');
    console.log('📋 Puertos:');
    console.log('   - Backend:  http://localhost:3001');
    console.log('   - Frontend: http://localhost:3000');
    console.log('\n💡 Presiona Ctrl+C para detener la aplicación\n');
    
    // Verificar que los servicios estén funcionando
    setTimeout(async () => {
      console.log('🔍 Verificando servicios...');
      
      try {
        const fetch = await import('node-fetch').then(m => m.default);
        
        // Verificar backend
        try {
          const backendResponse = await fetch('http://localhost:3001/api/health');
          if (backendResponse.ok) {
            console.log('✅ Backend funcionando correctamente');
          } else {
            console.log('⚠️ Backend respondiendo pero con errores');
          }
        } catch (error) {
          console.log('❌ Backend no está respondiendo');
        }
        
        // Verificar frontend
        try {
          const frontendResponse = await fetch('http://localhost:3000');
          if (frontendResponse.ok) {
            console.log('✅ Frontend funcionando correctamente');
          } else {
            console.log('⚠️ Frontend respondiendo pero con errores');
          }
        } catch (error) {
          console.log('❌ Frontend no está respondiendo');
        }
      } catch (importError) {
        console.log('⚠️ No se pudo verificar los servicios (falta node-fetch)');
      }
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error iniciando la aplicación:', error);
    process.exit(1);
  }
}

startApp();
