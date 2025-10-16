const { spawn } = require('child_process');
const axios = require('axios');

console.log('🚀 INICIANDO BACKEND PARA SOLUCIONAR DROPDOWN DE CLIENTES');
console.log('=====================================================');

// Kill any existing node processes on port 3001
console.log('🔄 Terminando procesos existentes...');

const killProcess = spawn('netstat', ['-ano'], { shell: true });
let processesToKill = [];

killProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
        if (line.includes(':3001') && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid)) {
                processesToKill.push(pid);
            }
        }
    });
});

killProcess.on('close', (code) => {
    console.log(`📋 Encontrados ${processesToKill.length} procesos en puerto 3001`);
    
    // Kill processes
    processesToKill.forEach(pid => {
        try {
            spawn('taskkill', ['/F', '/PID', pid], { shell: true });
            console.log(`🔴 Proceso ${pid} terminado`);
        } catch (error) {
            console.log(`⚠️ Error terminando proceso ${pid}:`, error.message);
        }
    });
    
    // Wait a moment and start backend
    setTimeout(() => {
        console.log('\n🚀 Iniciando backend...');
        
        // Start backend
        const backend = spawn('node', ['backend/server.js'], {
            cwd: process.cwd(),
            stdio: 'pipe',
            shell: true
        });
        
        backend.stdout.on('data', (data) => {
            console.log(`📊 Backend: ${data.toString().trim()}`);
        });
        
        backend.stderr.on('data', (data) => {
            console.log(`⚠️ Backend Error: ${data.toString().trim()}`);
        });
        
        backend.on('close', (code) => {
            console.log(`❌ Backend process exited with code ${code}`);
        });
        
        // Test backend after 5 seconds
        setTimeout(async () => {
            try {
                console.log('\n🔍 Probando backend...');
                
                const configResponse = await axios.get('http://localhost:3001/api/config/public');
                console.log('✅ Config endpoint working:', configResponse.status);
                
                console.log('\n🎉 BACKEND INICIADO CORRECTAMENTE');
                console.log('✅ El dropdown de clientes debería funcionar ahora');
                console.log('📝 Puede probar el frontend en: http://localhost:3000');
                console.log('\n⚠️ Mantenga esta ventana abierta para que el backend siga funcionando');
                
            } catch (error) {
                console.log('❌ Error probando backend:', error.message);
                console.log('🔄 Reintentando en 5 segundos...');
                
                setTimeout(async () => {
                    try {
                        const retryResponse = await axios.get('http://localhost:3001/api/config/public');
                        console.log('✅ Backend funcionando en segundo intento');
                    } catch (retryError) {
                        console.log('❌ Backend aún no responde:', retryError.message);
                    }
                }, 5000);
            }
        }, 5000);
        
    }, 2000);
});
