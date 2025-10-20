const { spawn } = require('child_process');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

console.log('🚀 INICIANDO BACKEND CON CHATGPT ASSISTANT');
console.log('============================================');

console.log('📋 Variables de entorno:');
console.log(`   ✅ OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Configurado' : 'NO configurado'}`);
console.log(`   ✅ USE_CUSTOM_ASSISTANT: ${process.env.USE_CUSTOM_ASSISTANT}`);
console.log(`   ✅ CUSTOM_GPT_ASSISTANT_ID: ${process.env.CUSTOM_GPT_ASSISTANT_ID}`);
console.log();

console.log('🔄 Iniciando servidor backend...');

// Cambiar al directorio backend
process.chdir(path.join(__dirname, 'backend'));

// Iniciar el servidor
const server = spawn('npm', ['start'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    FORCE_COLOR: '1' // Para mantener colores en la consola
  }
});

server.on('error', (error) => {
  console.error('❌ Error iniciando el servidor:', error.message);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`⚠️  Servidor terminó con código: ${code}`);
  process.exit(code);
});

// Manejo de señales para terminar el proceso limpiamente
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo servidor...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Deteniendo servidor...');
  server.kill('SIGTERM');
});

console.log('📌 El backend se está iniciando...');
console.log('📌 Para detener: Ctrl+C');
console.log('🌐 Una vez iniciado estará disponible en: http://localhost:3001');
