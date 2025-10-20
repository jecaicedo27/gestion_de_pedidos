async function diagnoseAndFixBackend() {
    const { execSync, spawn } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    console.log('🚨 DIAGNOSTIC: Identificando problemas del backend...\n');
    
    // 1. Verificar si hay procesos Node corriendo en el puerto 3001
    console.log('1. Verificando procesos en puerto 3001...');
    try {
        const result = execSync('netstat -ano | findstr :3001', { encoding: 'utf8' });
        console.log('Procesos encontrados en puerto 3001:');
        console.log(result);
        
        // Extraer PID y terminar proceso
        const lines = result.split('\n').filter(line => line.includes('LISTENING'));
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
                console.log(`Terminando proceso PID: ${pid}`);
                try {
                    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                } catch (error) {
                    console.log(`Error terminando proceso ${pid}: ${error.message}`);
                }
            }
        });
    } catch (error) {
        console.log('No se encontraron procesos en puerto 3001');
    }
    
    // 2. Verificar estructura del proyecto
    console.log('\n2. Verificando estructura del proyecto...');
    const backendPath = path.join(__dirname, 'backend');
    const packageJsonPath = path.join(backendPath, 'package.json');
    const serverPath = path.join(backendPath, 'server.js');
    const envPath = path.join(backendPath, '.env');
    
    console.log(`Backend directory exists: ${fs.existsSync(backendPath)}`);
    console.log(`package.json exists: ${fs.existsSync(packageJsonPath)}`);
    console.log(`server.js exists: ${fs.existsSync(serverPath)}`);
    console.log(`Environment file exists: ${fs.existsSync(envPath)}`);
    
    // 3. Verificar dependencias
    console.log('\n3. Verificando dependencias...');
    try {
        const nodeModulesPath = path.join(backendPath, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            console.log('⚠️  node_modules no existe, instalando dependencias...');
            process.chdir(backendPath);
            execSync('npm install', { stdio: 'inherit' });
            process.chdir(__dirname);
        } else {
            console.log('✅ node_modules existe');
        }
    } catch (error) {
        console.log(`Error verificando/instalando dependencias: ${error.message}`);
    }
    
    // 4. Verificar archivo .env
    console.log('\n4. Verificando configuración de ambiente...');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
        
        requiredVars.forEach(varName => {
            if (envContent.includes(`${varName}=`)) {
                console.log(`✅ ${varName} configurado`);
            } else {
                console.log(`⚠️  ${varName} falta en .env`);
            }
        });
    } else {
        console.log('⚠️  Archivo .env no encontrado');
        
        // Crear archivo .env básico
        const envContent = `# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=gestion_pedidos_dev
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=3001
NODE_ENV=development

# SIIGO API Configuration
SIIGO_USERNAME=your-siigo-username
SIIGO_ACCESS_KEY=your-siigo-access-key

# Other configurations
CORS_ORIGIN=http://localhost:3000
`;
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Archivo .env básico creado');
    }
    
    // 5. Verificar conexión a la base de datos
    console.log('\n5. Verificando conexión a la base de datos...');
    try {
        const mysql = require('mysql2/promise');
        
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            port: 3306
        });
        
        await connection.execute('SELECT 1');
        console.log('✅ Conexión a MySQL exitosa');
        
        // Verificar si la base de datos existe
        const [databases] = await connection.execute('SHOW DATABASES');
        const dbExists = databases.some(db => db.Database === 'gestion_pedidos_dev');
        console.log(`Base de datos gestion_pedidos_dev existe: ${dbExists}`);
        
        await connection.end();
        
    } catch (error) {
        console.log(`❌ Error conectando a MySQL: ${error.message}`);
    }
    
    // 6. Limpiar y reiniciar el backend
    console.log('\n6. Limpiando y reiniciando backend...');
    
    // Esperar un poco para que los procesos terminen
    setTimeout(() => {
        console.log('Cambiando al directorio backend...');
        process.chdir(backendPath);
        
        console.log('Iniciando servidor backend...');
        
        // Usar spawn para mantener el proceso vivo
        const backendProcess = spawn('npm', ['run', 'dev'], {
            stdio: 'inherit',
            shell: true
        });
        
        backendProcess.on('error', (error) => {
            console.log(`Error iniciando backend: ${error.message}`);
        });
        
        backendProcess.on('exit', (code) => {
            console.log(`Backend terminó con código: ${code}`);
        });
        
        // Verificar después de 10 segundos si el backend está corriendo
        setTimeout(async () => {
            try {
                const http = require('http');
                const options = {
                    hostname: 'localhost',
                    port: 3001,
                    path: '/health',
                    method: 'GET',
                    timeout: 5000
                };
                
                const req = http.request(options, (res) => {
                    console.log(`\n✅ Backend respondiendo en puerto 3001 - Status: ${res.statusCode}`);
                });
                
                req.on('error', (error) => {
                    console.log(`\n❌ Backend aún no responde: ${error.message}`);
                    console.log('Verificando logs para identificar el problema...');
                });
                
                req.on('timeout', () => {
                    console.log('\n❌ Timeout conectando al backend');
                    req.destroy();
                });
                
                req.end();
                
            } catch (error) {
                console.log(`Error verificando backend: ${error.message}`);
            }
        }, 10000);
        
    }, 2000);
    
    console.log('\n🔄 Script de diagnóstico completado. Reiniciando backend...');
}

// Ejecutar la función
diagnoseAndFixBackend().catch(console.error);
