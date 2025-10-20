const { spawn } = require('child_process');
const path = require('path');

console.log('🔄 REINICIANDO APLICACIÓN COMPLETA...');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function reiniciarAplicacion() {
    try {
        console.log('\n🔴 PASO 1: Deteniendo todos los procesos...');
        
        // Terminar todos los procesos Node.js
        const killProcess = spawn('taskkill', ['/f', '/im', 'node.exe'], { 
            stdio: 'inherit',
            shell: true 
        });
        
        await new Promise((resolve) => {
            killProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Procesos Node.js terminados');
                } else {
                    console.log('⚠️ No había procesos Node.js ejecutándose');
                }
                resolve();
            });
        });
        
        // Esperar 2 segundos
        console.log('\n⏳ Esperando 2 segundos...');
        await delay(2000);
        
        console.log('\n🚀 PASO 2: Iniciando BACKEND...');
        
        // Iniciar backend
        const backendProcess = spawn('node', ['server.js'], {
            cwd: path.join(process.cwd(), 'backend'),
            stdio: 'inherit',
            detached: true,
            shell: true
        });
        
        backendProcess.unref();
        console.log('✅ Backend iniciado en puerto 3001');
        
        // Esperar 3 segundos
        console.log('\n⏳ Esperando 3 segundos para que el backend se estabilice...');
        await delay(3000);
        
        console.log('\n🌐 PASO 3: Iniciando FRONTEND...');
        
        // Iniciar frontend
        const frontendProcess = spawn('npm', ['start'], {
            cwd: path.join(process.cwd(), 'frontend'),
            stdio: 'inherit',
            detached: true,
            shell: true
        });
        
        frontendProcess.unref();
        console.log('✅ Frontend iniciado en puerto 3000');
        
        console.log('\n🎉 APLICACIÓN REINICIADA COMPLETAMENTE:');
        console.log('   🖥️  Backend: http://localhost:3001');
        console.log('   🌐 Frontend: http://localhost:3000');
        console.log('   📊 Health Check: http://localhost:3001/api/health');
        console.log('\n✨ Sistema listo para usar!');
        
    } catch (error) {
        console.error('❌ Error reiniciando aplicación:', error.message);
    }
}

// Ejecutar reinicio
reiniciarAplicacion();
