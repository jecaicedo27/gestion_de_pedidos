const { spawn, exec } = require('child_process');
const path = require('path');

console.log('🔄 REINICIANDO BACKEND CON VARIABLES DE ENTORNO');
console.log('=================================================');

async function killExistingBackend() {
  return new Promise((resolve) => {
    console.log('🔪 Terminando procesos backend existentes...');
    
    // Matar todos los procesos de Node.js
    const killCommand = process.platform === 'win32' ? 
      'taskkill /F /IM node.exe' : 
      'pkill -f node';
      
    exec(killCommand, (error) => {
      if (error) {
        console.log('⚠️  No hay procesos Node.js ejecutándose o error al terminar:', error.message);
      } else {
        console.log('✅ Procesos Node.js terminados');
      }
      
      // Esperar un poco para que se liberen los puertos
      setTimeout(resolve, 2000);
    });
  });
}

async function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando backend...');
    
    const backendPath = path.join(__dirname, 'backend');
    const serverPath = path.join(backendPath, 'server.js');
    
    console.log(`📂 Directorio: ${backendPath}`);
    console.log(`📄 Archivo: ${serverPath}`);
    
    // Iniciar el backend con las variables de entorno del .env
    const backend = spawn('node', ['server.js'], {
      cwd: backendPath,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });
    
    let startupComplete = false;
    
    backend.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📟 Backend:', output.trim());
      
      // Buscar indicadores de que el servidor está listo
      if (output.includes('ChatGPT Service initialized') || 
          output.includes('conecta a la base de datos') ||
          output.includes('Servidor iniciado')) {
        if (!startupComplete) {
          startupComplete = true;
          setTimeout(() => resolve(backend), 2000);
        }
      }
    });
    
    backend.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('❌ Backend Error:', error.trim());
    });
    
    backend.on('close', (code) => {
      console.log(`⚠️  Backend terminó con código: ${code}`);
      if (!startupComplete) {
        reject(new Error(`Backend falló con código ${code}`));
      }
    });
    
    // Timeout de seguridad
    setTimeout(() => {
      if (!startupComplete) {
        console.log('⏰ Timeout esperando backend - continuando...');
        resolve(backend);
      }
    }, 15000);
  });
}

async function testChatGPT() {
  console.log('\n🧪 PROBANDO CHATGPT CON NUEVAS VARIABLES...');
  console.log('===============================================');
  
  // Esperar un poco más para que el backend cargue completamente
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Cargar el servicio ChatGPT directamente para ver si las variables están bien
    delete require.cache[require.resolve('./backend/services/chatgptService.js')];
    const chatgptService = require('./backend/services/chatgptService.js');
    
    console.log('📝 Variables de entorno cargadas:');
    console.log(`   - OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : 'undefined'}`);
    console.log(`   - USE_CUSTOM_ASSISTANT: ${process.env.USE_CUSTOM_ASSISTANT}`);
    console.log(`   - CUSTOM_GPT_ASSISTANT_ID: ${process.env.CUSTOM_GPT_ASSISTANT_ID}`);
    
    // Probar procesamiento básico
    console.log('\n🤖 Probando procesamiento ChatGPT...');
    const result = await chatgptService.processNaturalLanguageOrder(
      null,
      'necesito 5 líquidos de fresa 350ml y 3 sal de limón 250ml'
    );
    
    console.log('\n📊 RESULTADO:');
    console.log(`   - Éxito: ${result.success}`);
    console.log(`   - Items: ${result.processedOrder?.items?.length || 0}`);
    console.log(`   - Tiempo: ${result.processingTimeMs}ms`);
    
    if (result.success) {
      console.log('✅ ChatGPT funcionando correctamente!');
      return true;
    } else {
      console.log(`❌ Error: ${result.error}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error probando ChatGPT:', error.message);
    return false;
  }
}

async function main() {
  try {
    // 1. Cargar variables de entorno
    require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
    
    // 2. Terminar backend existente
    await killExistingBackend();
    
    // 3. Iniciar nuevo backend
    const backend = await startBackend();
    
    // 4. Probar ChatGPT
    const chatGPTWorks = await testChatGPT();
    
    if (chatGPTWorks) {
      console.log('\n🎉 BACKEND REINICIADO EXITOSAMENTE');
      console.log('🌐 Backend disponible en: http://localhost:3001');
      console.log('🤖 ChatGPT configurado y funcionando');
      console.log('\n💡 Para probar el dropdown de clientes, inicia el frontend:');
      console.log('   npm start (en la carpeta frontend)');
    } else {
      console.log('\n⚠️  Backend iniciado pero ChatGPT tiene problemas');
      console.log('🔧 Revisa la configuración de la API key');
    }
    
    console.log('\n📌 Para detener el backend: Ctrl+C');
    
    // Mantener el proceso vivo
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo backend...');
      backend.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('💥 Error durante el reinicio:', error.message);
    process.exit(1);
  }
}

main();
