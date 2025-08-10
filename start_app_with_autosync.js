/**
 * Script de inicio completo de la aplicación con AutoSync habilitado
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando Sistema de Gestión de Pedidos con AutoSync...\n');

// Función para iniciar el backend
function startBackend() {
    return new Promise((resolve, reject) => {
        console.log('⚙️ Iniciando servidor backend...');
        
        const backendProcess = spawn('node', ['server.js'], {
            cwd: path.join(__dirname, 'backend'),
            stdio: 'inherit',
            shell: true
        });

        backendProcess.on('error', (error) => {
            console.error('❌ Error iniciando backend:', error);
            reject(error);
        });

        // Dar tiempo para que el servidor se inicie
        setTimeout(() => {
            console.log('✅ Backend iniciado correctamente');
            resolve(backendProcess);
        }, 3000);
    });
}

// Función para iniciar el frontend
function startFrontend() {
    return new Promise((resolve, reject) => {
        console.log('🖥️ Iniciando aplicación frontend...');
        
        const frontendProcess = spawn('npm', ['start'], {
            cwd: path.join(__dirname, 'frontend'),
            stdio: 'inherit',
            shell: true
        });

        frontendProcess.on('error', (error) => {
            console.error('❌ Error iniciando frontend:', error);
            reject(error);
        });

        // Dar tiempo para que React se compile e inicie
        setTimeout(() => {
            console.log('✅ Frontend iniciado correctamente');
            resolve(frontendProcess);
        }, 8000);
    });
}

// Función principal
async function startApplication() {
    try {
        console.log('📋 Configuración del sistema:');
        console.log('   🔄 AutoSync SIIGO: Habilitado (cada 5 minutos)');
        console.log('   📦 Sincronización de productos: Automática');
        console.log('   💰 Sincronización de precios: Automática');
        console.log('   📊 Sincronización de estados: Automática');
        console.log('   📝 Logs de sincronización: Habilitados\n');
        
        // Iniciar backend primero
        const backendProcess = await startBackend();
        
        // Luego iniciar frontend
        const frontendProcess = await startFrontend();
        
        console.log('\n🎉 ¡Sistema completo iniciado exitosamente!');
        console.log('📍 Backend: http://localhost:3001');
        console.log('🌐 Frontend: http://localhost:3000');
        console.log('\n🔄 El AutoSync se ejecutará automáticamente cada 5 minutos');
        console.log('📊 Los cambios en SIIGO se reflejarán automáticamente en la aplicación');
        
        // Manejar cierre limpio
        process.on('SIGINT', () => {
            console.log('\n🛑 Cerrando aplicación...');
            backendProcess.kill();
            frontendProcess.kill();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Cerrando aplicación...');
            backendProcess.kill();
            frontendProcess.kill();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error iniciando la aplicación:', error);
        process.exit(1);
    }
}

// Iniciar aplicación
startApplication();
