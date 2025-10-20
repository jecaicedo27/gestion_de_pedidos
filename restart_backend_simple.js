const { exec } = require('child_process');

console.log('🔄 REINICIO RÁPIDO DEL BACKEND');
console.log('=============================\n');

console.log('1️⃣ Matando procesos Node.js...');

// Comando para matar específicamente el proceso en puerto 3001
exec('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :3001\') do taskkill /F /PID %a', (error, stdout, stderr) => {
  if (stdout) console.log(stdout);
  
  console.log('2️⃣ Esperando 2 segundos...');
  setTimeout(() => {
    console.log('3️⃣ Iniciando backend...\n');
    
    // Iniciar backend
    const { spawn } = require('child_process');
    const backend = spawn('npm', ['run', 'dev'], {
      cwd: './backend',
      shell: true,
      stdio: 'inherit'
    });
    
    console.log('✅ Backend iniciándose...\n');
    console.log('📋 INSTRUCCIONES:');
    console.log('1. Espera a ver "Servidor corriendo en puerto 3001"');
    console.log('2. Ve al navegador');
    console.log('3. Refresca con Ctrl+F5');
    console.log('4. Ve a Logística en el menú\n');
    
    backend.on('error', (err) => {
      console.error('❌ Error iniciando backend:', err.message);
    });
    
  }, 2000);
});
