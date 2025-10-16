console.log('🔄 Reiniciando servidor backend para aplicar rutas de webhooks...\n');

const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

// Función para matar procesos en puerto 3001
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const isWindows = os.platform() === 'win32';
    
    if (isWindows) {
      // En Windows, usar netstat y taskkill
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (stdout) {
          const lines = stdout.split('\n');
          const pids = [];
          
          lines.forEach(line => {
            const match = line.match(/\s+(\d+)$/);
            if (match) {
              pids.push(match[1]);
            }
          });
          
          if (pids.length > 0) {
            console.log(`🛑 Deteniendo procesos en puerto ${port}...`);
            const uniquePids = [...new Set(pids)];
            
            uniquePids.forEach(pid => {
              exec(`taskkill /PID ${pid} /F`, (killError) => {
                if (!killError) {
                  console.log(`✅ Proceso ${pid} terminado`);
                }
              });
            });
            
            // Esperar un momento antes de continuar
            setTimeout(resolve, 2000);
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });
    } else {
      // En Linux/macOS
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (stdout) {
          const pids = stdout.trim().split('\n');
          console.log(`🛑 Deteniendo procesos en puerto ${port}...`);
          
          pids.forEach(pid => {
            if (pid) {
              exec(`kill -9 ${pid}`, (killError) => {
                if (!killError) {
                  console.log(`✅ Proceso ${pid} terminado`);
                }
              });
            }
          });
          
          setTimeout(resolve, 2000);
        } else {
          resolve();
        }
      });
    }
  });
}

// Función para iniciar el servidor
function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando servidor backend...\n');
    
    const backendPath = path.join(__dirname, 'backend');
    
    // Cambiar al directorio backend y ejecutar npm start
    process.chdir(backendPath);
    
    const npmCommand = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
    const serverProcess = spawn(npmCommand, ['start'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    let startupOutput = '';
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      startupOutput += output;
      console.log(output);
      
      // Verificar si el servidor se inició correctamente
      if (output.includes('✅ Sistema listo para recibir peticiones') || 
          output.includes('Servidor iniciado exitosamente')) {
        console.log('\n✅ ¡Backend reiniciado con éxito!');
        console.log('📡 Las rutas de webhooks están ahora disponibles:');
        console.log('   - POST /api/webhooks/receive');
        console.log('   - POST /api/webhooks/setup');
        console.log('   - GET /api/webhooks/subscriptions');
        console.log('   - GET /api/webhooks/logs');
        console.log('   - POST /api/webhooks/test');
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('❌ Error:', data.toString());
    });

    serverProcess.on('error', (error) => {
      console.error('❌ Error iniciando servidor:', error);
      reject(error);
    });

    // Timeout de 30 segundos
    setTimeout(() => {
      if (!startupOutput.includes('Sistema listo para recibir peticiones')) {
        console.log('⏱️ Timeout alcanzado, pero el servidor debería estar iniciándose...');
        resolve(serverProcess);
      }
    }, 30000);
  });
}

// Función principal
async function restartBackend() {
  try {
    console.log('📋 Verificando sistema de webhooks implementado...\n');
    
    // Verificar que los archivos de webhook existen
    const fs = require('fs');
    const webhookFiles = [
      'backend/services/webhookService.js',
      'backend/routes/webhooks.js'
    ];
    
    for (const file of webhookFiles) {
      if (fs.existsSync(file)) {
        console.log(`✅ ${file} - Encontrado`);
      } else {
        console.log(`❌ ${file} - No encontrado`);
      }
    }
    
    // Verificar que server.js tiene las rutas registradas
    const serverContent = fs.readFileSync('backend/server.js', 'utf8');
    const hasWebhookImport = serverContent.includes("require('./routes/webhooks')");
    const hasWebhookRoute = serverContent.includes("'/api/webhooks'");
    
    console.log(`✅ Webhook import en server.js: ${hasWebhookImport ? 'Sí' : 'No'}`);
    console.log(`✅ Webhook route en server.js: ${hasWebhookRoute ? 'Sí' : 'No'}`);
    
    if (!hasWebhookImport || !hasWebhookRoute) {
      console.log('❌ Error: Las rutas de webhook no están correctamente registradas');
      return;
    }

    console.log('\n🔄 Iniciando proceso de reinicio...\n');

    // Paso 1: Detener procesos existentes
    await killProcessOnPort(3001);
    
    console.log('⏳ Esperando 3 segundos antes de reiniciar...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Paso 2: Iniciar el servidor
    const serverProcess = await startBackend();
    
    console.log('\n🎉 ¡Reinicio completado exitosamente!');
    console.log('\n📡 Sistema de webhooks SIIGO ahora activo y disponible.');
    console.log('📞 Para configurar webhooks, usa: POST /api/webhooks/setup');
    
    // Mantener el proceso activo
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo servidor...');
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error durante el reinicio:', error);
    process.exit(1);
  }
}

// Ejecutar el reinicio
restartBackend();
