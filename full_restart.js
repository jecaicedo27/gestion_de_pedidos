const { exec, spawn } = require('child_process');
const path = require('path');

const fullRestart = async () => {
  console.log('🔄 Realizando reinicio completo de la aplicación...\n');

  try {
    // 1. Matar procesos Node.js existentes
    console.log('⏹️  Terminando procesos existentes...');
    
    // En Windows, matar procesos node
    await new Promise((resolve) => {
      exec('taskkill /f /im node.exe', (error) => {
        // Ignorar errores si no hay procesos que matar
        resolve();
      });
    });
    
    console.log('✅ Procesos terminados');
    
    // 2. Esperar un poco para que los puertos se liberen
    console.log('⏳ Esperando liberación de puertos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Iniciar backend
    console.log('🚀 Iniciando backend...');
    const backend = spawn('npm', ['run', 'backend:dev'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      detached: false
    });
    
    // 4. Esperar un poco antes de iniciar frontend
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 5. Iniciar frontend
    console.log('🚀 Iniciando frontend...');
    const frontend = spawn('npm', ['run', 'frontend:dev'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      detached: false
    });
    
    console.log('✅ Aplicación reiniciada completamente');
    console.log('🌐 Backend: http://localhost:3001');
    console.log('🌐 Frontend: http://localhost:3000');
    console.log('🌸 Estado "En Preparación" ya disponible en filtros');
    
  } catch (error) {
    console.error('❌ Error en reinicio:', error);
  }
};

fullRestart();
