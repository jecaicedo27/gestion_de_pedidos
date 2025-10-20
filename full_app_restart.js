const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function restartApp() {
  console.log('🔄 REINICIANDO APLICACIÓN COMPLETA');
  console.log('================================\n');

  try {
    // 1. Matar todos los procesos Node.js
    console.log('🛑 Deteniendo procesos Node.js...');
    try {
      await execAsync('taskkill /F /IM node.exe');
      console.log('✅ Procesos Node.js detenidos');
    } catch (error) {
      console.log('⚠️ No había procesos Node.js activos o ya se detuvieron');
    }

    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Iniciar backend
    console.log('\n🚀 Iniciando backend...');
    exec('cd backend && npm start', (error, stdout, stderr) => {
      if (error) console.error('Error backend:', error.message);
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    });

    // Esperar a que el backend arranque
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. Iniciar frontend
    console.log('🚀 Iniciando frontend...');
    exec('cd frontend && npm start', (error, stdout, stderr) => {
      if (error) console.error('Error frontend:', error.message);
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    });

    console.log('\n✅ Aplicación reiniciada completamente');
    console.log('🌐 Backend: http://localhost:3001');
    console.log('🖥️ Frontend: http://localhost:3000');
    console.log('\n⏳ Espera unos segundos para que todo esté listo...');

  } catch (error) {
    console.error('❌ Error reiniciando:', error.message);
  }
}

// Ejecutar reinicio
restartApp();
