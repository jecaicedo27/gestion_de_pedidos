const { exec } = require('child_process');
const path = require('path');

console.log('🔄 REINICIANDO BACKEND DE GESTIÓN DE PEDIDOS');
console.log('==========================================\n');

// Función para ejecutar comandos
function runCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`📌 ${description}...`);
    exec(command, (error, stdout, stderr) => {
      if (error && !command.includes('taskkill')) {
        console.error(`❌ Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stdout) console.log(stdout);
      if (stderr && !command.includes('taskkill')) console.error(stderr);
      console.log(`✅ ${description} completado\n`);
      resolve();
    });
  });
}

async function restartBackend() {
  try {
    // 1. Matar procesos en el puerto 3001
    console.log('1️⃣ MATANDO PROCESOS EN PUERTO 3001\n');
    
    // Para Windows
    await runCommand(
      'netstat -ano | findstr :3001',
      'Buscando procesos en puerto 3001'
    ).catch(() => console.log('No hay procesos activos en el puerto 3001'));
    
    // Matar procesos de Node.js
    await runCommand(
      'taskkill /F /IM node.exe',
      'Deteniendo todos los procesos Node.js'
    ).catch(() => console.log('No hay procesos Node.js activos'));
    
    // Esperar un momento
    console.log('⏳ Esperando 3 segundos...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 2. Iniciar el backend
    console.log('2️⃣ INICIANDO BACKEND\n');
    
    const backendPath = path.join(__dirname, 'backend');
    
    // Cambiar al directorio del backend e iniciar
    const { spawn } = require('child_process');
    const npmStart = spawn('npm', ['run', 'dev'], {
      cwd: backendPath,
      shell: true,
      stdio: 'inherit'
    });
    
    console.log('✅ Backend iniciándose...');
    console.log('📍 Directorio:', backendPath);
    console.log('🚀 Comando: npm run dev\n');
    
    console.log('⚠️  IMPORTANTE:');
    console.log('1. Espera a ver "Servidor corriendo en puerto 3001"');
    console.log('2. Luego ve al navegador y refresca con Ctrl+F5');
    console.log('3. Ve a la vista de Logística en el menú');
    console.log('\n🔄 El backend se está iniciando en esta ventana...\n');
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.log('\n💡 SOLUCIÓN MANUAL:');
    console.log('1. Abre el Administrador de Tareas (Ctrl+Shift+Esc)');
    console.log('2. Busca y termina todos los procesos "Node.js"');
    console.log('3. En una nueva terminal:');
    console.log('   cd backend');
    console.log('   npm run dev');
  }
}

// Ejecutar
restartBackend();
