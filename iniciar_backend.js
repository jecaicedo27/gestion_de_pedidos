// Script para iniciar el backend correctamente
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando el backend del sistema de gestión de pedidos');
console.log('=====================================================\n');

// Cambiar al directorio del backend
const backendDir = path.join(__dirname, 'backend');
console.log('📂 Directorio del backend:', backendDir);

// Verificar que existe el directorio backend
const fs = require('fs');
if (!fs.existsSync(backendDir)) {
    console.log('❌ ERROR: No se encuentra el directorio backend');
    console.log('💡 Asegúrate de estar en la raíz del proyecto');
    process.exit(1);
}

// Verificar que existe package.json
const packageJsonPath = path.join(backendDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ ERROR: No se encuentra package.json en backend');
    console.log('💡 El proyecto backend no está configurado correctamente');
    process.exit(1);
}

console.log('✅ Verificaciones pasadas, iniciando servidor...\n');

// Iniciar el servidor usando npm start
const npmProcess = spawn('npm', ['start'], {
    cwd: backendDir,
    stdio: 'inherit', // Mostrar output en tiempo real
    shell: true // Necesario en Windows
});

npmProcess.on('error', (error) => {
    console.log('❌ Error al iniciar el backend:', error.message);
    
    if (error.message.includes('ENOENT')) {
        console.log('💡 No se encuentra npm. Asegúrate de tener Node.js instalado');
        console.log('   Descarga desde: https://nodejs.org/');
    }
});

npmProcess.on('close', (code) => {
    if (code !== 0) {
        console.log(`❌ El backend terminó con código de error: ${code}`);
        console.log('💡 Revisa los errores anteriores para más información');
    } else {
        console.log('✅ Backend cerrado correctamente');
    }
});

// Manejar Ctrl+C para cerrar limpiamente
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando backend...');
    npmProcess.kill('SIGINT');
});

console.log('🔧 Instrucciones:');
console.log('• El servidor debería iniciar en unos segundos');
console.log('• Verás "Server running on port 3001" cuando esté listo');
console.log('• Presiona Ctrl+C para detener el servidor');
console.log('• Una vez que esté corriendo, prueba el botón "Procesar con ChatGPT"');
