const { exec, spawn } = require('child_process');
const path = require('path');

console.log('🔄 REINICIO COMPLETO DE LA APLICACIÓN');
console.log('====================================\n');

async function killNodeProcesses() {
  return new Promise((resolve) => {
    console.log('1️⃣ Matando todos los procesos Node.js...');
    
    // Matar procesos en Windows
    exec('taskkill /F /IM node.exe', (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      console.log('✅ Procesos Node.js terminados\n');
      
      // También intentar matar procesos específicos del puerto 3001
      exec('netstat -ano | findstr :3001', (err, out) => {
        if (out) {
          console.log('🔍 Procesos encontrados en puerto 3001:');
          console.log(out);
          
          // Extraer PIDs y matarlos
          const lines = out.split('\n');
          lines.forEach(line => {
            const match = line.match(/\s+(\d+)$/);
            if (match) {
              const pid = match[1];
              exec(`taskkill /F /PID ${pid}`, (e, o, er) => {
                if (o) console.log(`PID ${pid} terminado`);
              });
            }
          });
        }
        
        setTimeout(resolve, 3000);
      });
    });
  });
}

async function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('2️⃣ Iniciando backend...');
    
    const backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'backend'),
      shell: true,
      stdio: 'pipe'
    });
    
    let started = false;
    
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      if (output.includes('Servidor corriendo en puerto 3001') || 
          output.includes('Server running on port 3001')) {
        console.log('✅ Backend iniciado exitosamente\n');
        started = true;
        resolve(backendProcess);
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error('Backend error:', data.toString());
    });
    
    backendProcess.on('error', (error) => {
      console.error('Error iniciando backend:', error);
      reject(error);
    });
    
    // Timeout de 30 segundos
    setTimeout(() => {
      if (!started) {
        console.log('⚠️  Backend tardando en iniciar, pero continuando...');
        resolve(backendProcess);
      }
    }, 30000);
  });
}

async function startFrontend() {
  return new Promise((resolve, reject) => {
    console.log('3️⃣ Iniciando frontend...');
    
    const frontendProcess = spawn('npm', ['start'], {
      cwd: path.join(__dirname, 'frontend'),
      shell: true,
      stdio: 'pipe'
    });
    
    let started = false;
    
    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      if (output.includes('webpack compiled') || 
          output.includes('Local:') ||
          output.includes('On Your Network:')) {
        console.log('✅ Frontend iniciado exitosamente\n');
        started = true;
        resolve(frontendProcess);
      }
    });
    
    frontendProcess.stderr.on('data', (data) => {
      console.error('Frontend error:', data.toString());
    });
    
    frontendProcess.on('error', (error) => {
      console.error('Error iniciando frontend:', error);
      reject(error);
    });
    
    // Timeout de 30 segundos
    setTimeout(() => {
      if (!started) {
        console.log('⚠️  Frontend tardando en iniciar, pero continuando...');
        resolve(frontendProcess);
      }
    }, 30000);
  });
}

async function main() {
  try {
    // 1. Matar procesos existentes
    await killNodeProcesses();
    
    // 2. Iniciar backend
    const backendProc = await startBackend();
    
    // 3. Esperar un poco antes de iniciar frontend
    console.log('⏳ Esperando 5 segundos antes de iniciar frontend...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. Iniciar frontend
    const frontendProc = await startFrontend();
    
    console.log('🎉 APLICACIÓN INICIADA EXITOSAMENTE');
    console.log('=====================================\n');
    console.log('✅ Backend corriendo en: http://localhost:3001');
    console.log('✅ Frontend corriendo en: http://localhost:3000\n');
    
    console.log('📋 PRÓXIMOS PASOS:');
    console.log('1. Ve al navegador en http://localhost:3000');
    console.log('2. Inicia sesión como admin/admin123');
    console.log('3. Ve a la sección de Logística');
    console.log('4. Verifica que aparezcan las fichas de entrega\n');
    
    // Mantener procesos vivos
    process.on('SIGINT', () => {
      console.log('\n🛑 Cerrando aplicación...');
      backendProc.kill();
      frontendProc.kill();
      process.exit();
    });
    
  } catch (error) {
    console.error('❌ Error durante el reinicio:', error);
    console.log('\n💡 SOLUCIÓN MANUAL:');
    console.log('1. Abrir dos terminales');
    console.log('2. Terminal 1: cd backend && npm run dev');
    console.log('3. Terminal 2: cd frontend && npm start');
  }
}

// Ejecutar
main();
