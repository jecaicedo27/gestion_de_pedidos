const { exec } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando Frontend React...');

// Cambiar al directorio frontend y ejecutar npm start
const frontendDir = path.join(__dirname, 'frontend');
const command = 'npm start';

console.log('📂 Directorio frontend:', frontendDir);
console.log('⚡ Ejecutando comando:', command);

const child = exec(command, { cwd: frontendDir }, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error ejecutando npm start:', error);
        return;
    }
});

child.stdout.on('data', (data) => {
    console.log(data.toString());
});

child.stderr.on('data', (data) => {
    console.error(data.toString());
});

child.on('close', (code) => {
    console.log(`🏁 Frontend cerrado con código: ${code}`);
});

console.log('✅ Frontend iniciándose...');
console.log('📱 La aplicación React estará disponible en http://localhost:3000');
console.log('🔗 Proxy configurado hacia backend en http://localhost:3001');
console.log('');
console.log('Para detener el frontend, presiona Ctrl+C');
