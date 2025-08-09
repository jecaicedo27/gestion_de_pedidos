const { exec, spawn } = require('child_process');
const path = require('path');

async function reiniciarAplicacionCompleta() {
    console.log('🔄 Iniciando reinicio completo de la aplicación...');
    
    try {
        // Detener procesos existentes
        console.log('⏹️ Deteniendo procesos actuales...');
        
        // Matar procesos de Node.js específicos
        await new Promise((resolve) => {
            exec('taskkill /f /im node.exe', (error) => {
                // Ignorar errores ya que puede que no haya procesos corriendo
                console.log('📋 Procesos de Node.js detenidos');
                resolve();
            });
        });
        
        // Esperar un poco para que se liberen los puertos
        console.log('⏳ Esperando liberación de puertos...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('🚀 Iniciando backend...');
        
        // Iniciar backend
        const backendProcess = spawn('node', ['server.js'], {
            cwd: path.join(__dirname, 'backend'),
            stdio: 'inherit',
            detached: false
        });
        
        // Esperar un poco para que el backend inicie
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('🌐 Iniciando frontend...');
        
        // Iniciar frontend
        const frontendProcess = spawn('npm', ['start'], {
            cwd: path.join(__dirname, 'frontend'),
            stdio: 'inherit',
            detached: false
        });
        
        console.log('✅ Aplicación reiniciada exitosamente');
        console.log('📋 Backend ejecutándose en puerto 3001');
        console.log('📋 Frontend ejecutándose en puerto 3000');
        console.log('🌍 Abrir: http://localhost:3000');
        
    } catch (error) {
        console.error('❌ Error durante el reinicio:', error);
    }
}

reiniciarAplicacionCompleta();
