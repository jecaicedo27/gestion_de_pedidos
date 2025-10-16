const { spawn, exec } = require('child_process');
const axios = require('axios');
const path = require('path');

// Configuración
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 3000;
const MAX_RETRIES = 3;
const WAIT_TIMEOUT = 30000; // 30 segundos

// Función para ejecutar comando y obtener output
const executeCommand = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error && !options.ignoreErrors) {
        console.log(`Error ejecutando: ${command}`);
        console.log(`Error: ${error.message}`);
        return reject(error);
      }
      resolve({ stdout, stderr, error });
    });
  });
};

// Función para esperar un tiempo
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para verificar si un puerto está en uso
const checkPort = async (port) => {
  try {
    const result = await executeCommand(`netstat -ano | findstr :${port}`, { ignoreErrors: true });
    return result.stdout.trim() !== '';
  } catch (error) {
    return false;
  }
};

// Función para obtener PIDs usando un puerto
const getPortPIDs = async (port) => {
  try {
    const result = await executeCommand(`netstat -ano | findstr :${port}`, { ignoreErrors: true });
    const lines = result.stdout.split('\n').filter(line => line.trim());
    const pids = new Set();
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          pids.add(pid);
        }
      }
    });
    
    return Array.from(pids);
  } catch (error) {
    console.log(`Error obteniendo PIDs para puerto ${port}:`, error.message);
    return [];
  }
};

// Función para matar proceso por PID
const killProcess = async (pid) => {
  try {
    await executeCommand(`taskkill /F /PID ${pid}`, { ignoreErrors: true });
    console.log(`✅ Proceso ${pid} terminado`);
    return true;
  } catch (error) {
    console.log(`❌ Error terminando proceso ${pid}: ${error.message}`);
    return false;
  }
};

// Función para matar todos los procesos Node.js relacionados
const killAllNodeProcesses = async () => {
  try {
    console.log('🔍 Buscando procesos Node.js relacionados...');
    
    // Buscar procesos node.exe y npm.exe
    const nodeResult = await executeCommand(`wmic process where "name='node.exe' or name='npm.exe'" get ProcessId,CommandLine /format:csv`, { ignoreErrors: true });
    const lines = nodeResult.stdout.split('\n').filter(line => line.includes('node.exe') || line.includes('npm.exe'));
    
    const processesToKill = [];
    
    lines.forEach(line => {
      if (line.includes('gestion_de_pedidos') || line.includes('backend') || line.includes('frontend') || line.includes(':3000') || line.includes(':3001')) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const pid = parts[2].trim();
          if (pid && !isNaN(pid)) {
            processesToKill.push(pid);
          }
        }
      }
    });
    
    console.log(`📋 Procesos Node.js encontrados: ${processesToKill.length}`);
    
    for (const pid of processesToKill) {
      await killProcess(pid);
    }
    
    // Matar procesos adicionales por nombre
    await executeCommand(`taskkill /F /IM node.exe /T`, { ignoreErrors: true });
    await executeCommand(`taskkill /F /IM npm.exe /T`, { ignoreErrors: true });
    
    console.log('✅ Limpieza de procesos Node.js completada');
    
  } catch (error) {
    console.log('⚠️ Error en limpieza de procesos:', error.message);
  }
};

// Función para liberar puertos específicos
const freePort = async (port) => {
  console.log(`🔍 Liberando puerto ${port}...`);
  
  const pids = await getPortPIDs(port);
  console.log(`📋 PIDs usando puerto ${port}:`, pids);
  
  for (const pid of pids) {
    await killProcess(pid);
  }
  
  // Esperar un poco para que el puerto se libere
  await sleep(2000);
  
  const stillInUse = await checkPort(port);
  if (stillInUse) {
    console.log(`⚠️ Puerto ${port} aún en uso, intentando limpieza adicional...`);
    await executeCommand(`netstat -ano | findstr :${port}`, { ignoreErrors: true });
  } else {
    console.log(`✅ Puerto ${port} liberado`);
  }
  
  return !stillInUse;
};

// Función para esperar que un puerto esté libre
const waitForPortFree = async (port, maxWait = 10000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const inUse = await checkPort(port);
    if (!inUse) {
      console.log(`✅ Puerto ${port} está libre`);
      return true;
    }
    console.log(`⏳ Esperando que puerto ${port} se libere...`);
    await sleep(1000);
  }
  
  console.log(`❌ Puerto ${port} no se liberó en el tiempo esperado`);
  return false;
};

// Función para verificar si un servicio está respondiendo
const checkService = async (url, timeout = 5000) => {
  try {
    const response = await axios.get(url, { timeout });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// Función para iniciar el backend
const startBackend = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando backend...');
    
    const backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      detached: false
    });
    
    let startupComplete = false;
    let startupTimeout;
    
    const checkStartup = () => {
      startupTimeout = setTimeout(async () => {
        if (!startupComplete) {
          const isRunning = await checkService(`http://localhost:${BACKEND_PORT}/api/health`);
          if (isRunning) {
            console.log('✅ Backend iniciado correctamente');
            startupComplete = true;
            resolve(backendProcess);
          } else {
            console.log('⏳ Backend aún iniciando...');
            checkStartup();
          }
        }
      }, 3000);
    };
    
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[BACKEND] ${output.trim()}`);
      
      if (output.includes(`Server running on port ${BACKEND_PORT}`) || 
          output.includes('Server started') ||
          output.includes('Servidor iniciado')) {
        if (!startupComplete) {
          console.log('✅ Backend iniciado correctamente');
          startupComplete = true;
          clearTimeout(startupTimeout);
          resolve(backendProcess);
        }
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.log(`[BACKEND ERROR] ${data.toString().trim()}`);
    });
    
    backendProcess.on('error', (error) => {
      console.log('❌ Error iniciando backend:', error.message);
      clearTimeout(startupTimeout);
      if (!startupComplete) {
        reject(error);
      }
    });
    
    backendProcess.on('exit', (code) => {
      console.log(`❌ Backend terminó con código: ${code}`);
      clearTimeout(startupTimeout);
      if (!startupComplete) {
        reject(new Error(`Backend terminó inesperadamente con código ${code}`));
      }
    });
    
    // Iniciar verificación
    checkStartup();
    
    // Timeout de seguridad
    setTimeout(() => {
      if (!startupComplete) {
        console.log('⏰ Timeout iniciando backend');
        clearTimeout(startupTimeout);
        reject(new Error('Timeout iniciando backend'));
      }
    }, WAIT_TIMEOUT);
  });
};

// Función para iniciar el frontend
const startFrontend = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando frontend...');
    
    const frontendProcess = spawn('npm', ['start'], {
      cwd: path.join(__dirname, 'frontend'),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      detached: false
    });
    
    let startupComplete = false;
    let startupTimeout;
    
    const checkStartup = () => {
      startupTimeout = setTimeout(async () => {
        if (!startupComplete) {
          const isRunning = await checkService(`http://localhost:${FRONTEND_PORT}`);
          if (isRunning) {
            console.log('✅ Frontend iniciado correctamente');
            startupComplete = true;
            resolve(frontendProcess);
          } else {
            console.log('⏳ Frontend aún iniciando...');
            checkStartup();
          }
        }
      }, 5000);
    };
    
    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[FRONTEND] ${output.trim()}`);
      
      if (output.includes('compiled successfully') || 
          output.includes('webpack compiled') ||
          output.includes(`localhost:${FRONTEND_PORT}`)) {
        if (!startupComplete) {
          console.log('✅ Frontend iniciado correctamente');
          startupComplete = true;
          clearTimeout(startupTimeout);
          resolve(frontendProcess);
        }
      }
    });
    
    frontendProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`[FRONTEND ERROR] ${output.trim()}`);
    });
    
    frontendProcess.on('error', (error) => {
      console.log('❌ Error iniciando frontend:', error.message);
      clearTimeout(startupTimeout);
      if (!startupComplete) {
        reject(error);
      }
    });
    
    frontendProcess.on('exit', (code) => {
      console.log(`❌ Frontend terminó con código: ${code}`);
      clearTimeout(startupTimeout);
      if (!startupComplete) {
        reject(new Error(`Frontend terminó inesperadamente con código ${code}`));
      }
    });
    
    // Iniciar verificación
    checkStartup();
    
    // Timeout de seguridad  
    setTimeout(() => {
      if (!startupComplete) {
        console.log('⏰ Timeout iniciando frontend');
        clearTimeout(startupTimeout);
        reject(new Error('Timeout iniciando frontend'));
      }
    }, WAIT_TIMEOUT);
  });
};

// Función para verificar conectividad completa
const verifyConnectivity = async () => {
  console.log('\n🔍 Verificando conectividad completa...');
  
  const tests = [
    { name: 'Backend Health', url: `http://localhost:${BACKEND_PORT}/api/health` },
    { name: 'Frontend', url: `http://localhost:${FRONTEND_PORT}` },
    { name: 'Backend Auth', url: `http://localhost:${BACKEND_PORT}/api/auth/me` },
  ];
  
  for (const test of tests) {
    try {
      const response = await axios.get(test.url, { timeout: 5000 });
      console.log(`✅ ${test.name}: OK (${response.status})`);
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR (${error.code || error.response?.status || 'NO_RESPONSE'})`);
    }
  }
};

// Función principal
const restartCompleteApplication = async () => {
  console.log('🔄 REINICIO COMPLETO DE LA APLICACIÓN');
  console.log('═══════════════════════════════════════');
  
  try {
    // Paso 1: Mostrar puertos en uso
    console.log('\n📊 ESTADO INICIAL DE PUERTOS:');
    const backendInUse = await checkPort(BACKEND_PORT);
    const frontendInUse = await checkPort(FRONTEND_PORT);
    
    console.log(`Puerto ${BACKEND_PORT} (Backend): ${backendInUse ? '🔴 EN USO' : '🟢 LIBRE'}`);
    console.log(`Puerto ${FRONTEND_PORT} (Frontend): ${frontendInUse ? '🔴 EN USO' : '🟢 LIBRE'}`);
    
    // Paso 2: Matar todos los procesos relacionados
    console.log('\n💀 TERMINANDO PROCESOS EXISTENTES:');
    await killAllNodeProcesses();
    
    // Paso 3: Liberar puertos específicos
    console.log('\n🔓 LIBERANDO PUERTOS:');
    const backendFreed = await freePort(BACKEND_PORT);
    const frontendFreed = await freePort(FRONTEND_PORT);
    
    if (!backendFreed) {
      console.log(`❌ No se pudo liberar puerto ${BACKEND_PORT}`);
    }
    
    if (!frontendFreed) {
      console.log(`❌ No se pudo liberar puerto ${FRONTEND_PORT}`);
    }
    
    // Paso 4: Esperar que los puertos estén libres
    console.log('\n⏳ ESPERANDO LIBERACIÓN DE PUERTOS:');
    await waitForPortFree(BACKEND_PORT);
    await waitForPortFree(FRONTEND_PORT);
    
    // Paso 5: Limpiar archivos temporales y caché
    console.log('\n🧹 LIMPIANDO ARCHIVOS TEMPORALES:');
    await executeCommand('npm cache clean --force', { ignoreErrors: true });
    
    // Esperar un poco más para asegurar limpieza
    console.log('⏳ Esperando estabilización...');
    await sleep(3000);
    
    // Paso 6: Iniciar servicios
    console.log('\n🚀 INICIANDO SERVICIOS:');
    
    // Iniciar backend primero
    let backendProcess, frontendProcess;
    
    try {
      backendProcess = await startBackend();
      console.log('✅ Backend iniciado exitosamente');
      
      // Esperar un poco antes de iniciar frontend
      await sleep(3000);
      
      frontendProcess = await startFrontend();
      console.log('✅ Frontend iniciado exitosamente');
      
    } catch (error) {
      console.log('❌ Error iniciando servicios:', error.message);
      throw error;
    }
    
    // Paso 7: Verificar conectividad
    await sleep(5000); // Dar tiempo para que todo inicie completamente
    await verifyConnectivity();
    
    console.log('\n🎉 REINICIO COMPLETADO EXITOSAMENTE!');
    console.log('═══════════════════════════════════════');
    console.log(`🌐 Frontend: http://localhost:${FRONTEND_PORT}`);
    console.log(`🔧 Backend: http://localhost:${BACKEND_PORT}`);
    console.log('\n📱 La aplicación está lista para usar');
    
    // Mantener los procesos activos
    process.on('SIGINT', () => {
      console.log('\n🛑 Cerrando aplicación...');
      if (backendProcess) backendProcess.kill();
      if (frontendProcess) frontendProcess.kill();
      process.exit(0);
    });
    
    // Evitar que el script termine
    setInterval(() => {}, 1000);
    
  } catch (error) {
    console.error('\n❌ ERROR EN REINICIO:', error.message);
    process.exit(1);
  }
};

// Ejecutar reinicio
restartCompleteApplication();
