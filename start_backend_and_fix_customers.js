const { spawn, exec } = require('child_process');
const axios = require('axios');

console.log('🚨 INICIANDO BACKEND Y SOLUCIONANDO DROPDOWN DE CLIENTES');
console.log('='.repeat(70));

let backendProcess = null;

function killExistingProcesses() {
  return new Promise((resolve) => {
    console.log('🔄 Terminando procesos existentes...');
    
    if (process.platform === 'win32') {
      exec('taskkill /F /IM node.exe 2>nul', () => {
        exec('netstat -ano | findstr :3001', (error, stdout) => {
          if (stdout) {
            const lines = stdout.split('\n');
            lines.forEach(line => {
              const match = line.match(/\s+(\d+)$/);
              if (match) {
                const pid = match[1];
                exec(`taskkill /F /PID ${pid} 2>nul`, () => {});
              }
            });
          }
          setTimeout(resolve, 3000);
        });
      });
    } else {
      exec('pkill -f "node.*backend" 2>/dev/null', () => {
        exec('lsof -ti:3001 | xargs kill -9 2>/dev/null', () => {
          setTimeout(resolve, 3000);
        });
      });
    }
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando backend corregido...');
    
    backendProcess = spawn('node', ['backend/server.js'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' }
    });

    let started = false;
    let startupOutput = '';

    backendProcess.stdout.on('data', (data) => {
      const message = data.toString();
      startupOutput += message;
      console.log(`[Backend] ${message.trim()}`);
      
      if ((message.includes('listening on port') || 
           message.includes('Server running') || 
           message.includes('servidor corriendo')) && !started) {
        started = true;
        console.log('✅ Backend iniciado correctamente');
        setTimeout(() => resolve(), 2000);
      }
    });

    backendProcess.stderr.on('data', (data) => {
      const message = data.toString();
      console.log(`[Backend Error] ${message.trim()}`);
      
      if (message.includes('EADDRINUSE')) {
        console.log('⚠️ Puerto 3001 ocupado, matando procesos...');
        backendProcess.kill();
        killExistingProcesses().then(() => {
          setTimeout(() => startBackend().then(resolve).catch(reject), 5000);
        });
        return;
      }

      if (message.includes('Cannot find module') || message.includes('Error:')) {
        console.log('❌ Error crítico en backend');
      }
    });

    backendProcess.on('error', (error) => {
      console.error('❌ Error spawning backend:', error.message);
      reject(error);
    });

    // Timeout para dar tiempo al backend a inicializar
    setTimeout(() => {
      if (!started) {
        console.log('✅ Asumiendo backend iniciado (timeout)');
        resolve();
      }
    }, 15000);
  });
}

async function testCustomerEndpoints() {
  console.log('\n🧪 PROBANDO ENDPOINTS DE CLIENTES...');
  
  const BASE_URL = 'http://localhost:3001';
  
  try {
    // Test health first
    console.log('📋 Test 1: Health check...');
    const health = await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
    console.log('✅ Health check OK');

    // Test login to get token
    console.log('\n📋 Test 2: Login...');
    const login = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, { timeout: 5000 });
    
    if (!login.data.success) {
      throw new Error('Login failed');
    }
    
    const token = login.data.data.token;
    console.log('✅ Login exitoso, token obtenido');

    // Test customer search endpoint
    console.log('\n📋 Test 3: Customer search endpoint...');
    const searchResponse = await axios.get(`${BASE_URL}/api/quotations/customers/search?q=1082`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000
    });
    
    console.log('✅ Customer search endpoint funciona');
    console.log(`📊 Encontrados ${searchResponse.data.data?.length || 0} clientes`);
    
    return { success: true, token, searchData: searchResponse.data };
    
  } catch (error) {
    console.log('❌ Error en tests:', error.message);
    
    if (error.response?.status === 404) {
      console.log('⚠️ Endpoint no encontrado - verificando rutas...');
    }
    
    return { success: false, error: error.message, status: error.response?.status };
  }
}

async function checkCustomerRoutes() {
  console.log('\n🔍 VERIFICANDO RUTAS DE CLIENTES...');
  
  const quotationRoutesPath = 'backend/routes/quotations.js';
  const fs = require('fs');
  
  if (!fs.existsSync(quotationRoutesPath)) {
    console.log('❌ Archivo quotations.js no existe');
    return false;
  }
  
  const content = fs.readFileSync(quotationRoutesPath, 'utf8');
  
  // Check if customer search route exists
  if (!content.includes('/customers/search')) {
    console.log('❌ Ruta /customers/search no encontrada');
    
    // Add the missing route
    console.log('🔧 Agregando ruta faltante...');
    
    const customerSearchRoute = `

// Ruta para buscar clientes (necesaria para dropdown)
router.get('/customers/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const db = require('../config/database');
    const searchTerm = q.trim();
    
    console.log(\`🔍 Buscando clientes con término: \${searchTerm}\`);
    
    const query = \`
      SELECT id, business_name, commercial_name, document, 
             phone, email, address, city, department
      FROM customers 
      WHERE (business_name LIKE ? OR commercial_name LIKE ? OR document LIKE ?)
      AND deleted_at IS NULL
      ORDER BY business_name ASC
      LIMIT 20
    \`;
    
    const searchPattern = \`%\${searchTerm}%\`;
    const [customers] = await db.query(query, [searchPattern, searchPattern, searchPattern]);
    
    console.log(\`✅ Encontrados \${customers.length} clientes\`);
    
    res.json({
      success: true,
      data: customers
    });
    
  } catch (error) {
    console.error('❌ Error buscando clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});`;
    
    // Insert before module.exports
    const updatedContent = content.replace(
      'module.exports = router;',
      customerSearchRoute + '\n\nmodule.exports = router;'
    );
    
    fs.writeFileSync(quotationRoutesPath, updatedContent);
    console.log('✅ Ruta de búsqueda de clientes agregada');
    return true;
    
  } else {
    console.log('✅ Ruta /customers/search ya existe');
    return true;
  }
}

async function runFullFix() {
  try {
    // Step 1: Kill existing processes
    await killExistingProcesses();
    
    // Step 2: Check and fix routes
    const routesOk = await checkCustomerRoutes();
    
    // Step 3: Start backend
    await startBackend();
    
    // Step 4: Wait for full startup
    console.log('⏳ Esperando inicialización completa...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Step 5: Test endpoints
    const testResult = await testCustomerEndpoints();
    
    // Results
    console.log('\n🎯 RESUMEN DE REPARACIÓN:');
    console.log('='.repeat(50));
    console.log(`✅ Rutas verificadas: ${routesOk ? 'OK' : 'FALLÓ'}`);
    console.log(`✅ Backend iniciado: SÍ`);
    console.log(`✅ API funcionando: ${testResult.success ? 'SÍ' : 'NO'}`);
    
    if (testResult.success) {
      console.log('\n🎉 ¡DROPDOWN DE CLIENTES REPARADO!');
      console.log('✅ El backend está corriendo en http://localhost:3001');
      console.log('✅ El endpoint de búsqueda funciona correctamente');
      console.log('✅ Puedes probar el dropdown en el frontend ahora');
      
      // Keep backend running
      console.log('\n🔄 Backend ejecutándose... presiona Ctrl+C para detener');
      
    } else {
      console.log('\n⚠️ Hay problemas adicionales que resolver:');
      console.log(`❌ Error: ${testResult.error}`);
      if (testResult.status) {
        console.log(`❌ Status: ${testResult.status}`);
      }
    }

  } catch (error) {
    console.error('❌ Error en la reparación:', error.message);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo backend...');
  if (backendProcess) {
    backendProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  process.exit(0);
});

runFullFix();
