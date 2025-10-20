console.log('🔍 Verificando estado del dropdown después de la reparación');
console.log('===========================================================');

const fs = require('fs');
const { spawn } = require('child_process');

function checkFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${description} - existe`);
        return true;
    } else {
        console.log(`❌ ${description} - NO existe`);
        return false;
    }
}

function verifyComponentStructure() {
    console.log('🔍 Verificando estructura del componente...');
    
    const dropdownPath = './frontend/src/components/CustomerSearchDropdown.js';
    const testDropdownPath = './frontend/src/components/TestCustomerDropdown.js';
    const quotationsPath = './frontend/src/pages/QuotationsPage.js';
    
    let allGood = true;
    
    // Verificar archivos principales
    allGood &= checkFileExists(dropdownPath, 'CustomerSearchDropdown.js');
    allGood &= checkFileExists(quotationsPath, 'QuotationsPage.js');
    
    // Verificar si se creó el componente de prueba
    if (checkFileExists(testDropdownPath, 'TestCustomerDropdown.js (componente de prueba)')) {
        console.log('🧪 Se encontró componente de prueba - indica que se detectaron problemas');
    }
    
    // Verificar contenido del componente principal
    if (fs.existsSync(dropdownPath)) {
        try {
            const content = fs.readFileSync(dropdownPath, 'utf8');
            
            const requiredElements = [
                'CustomerSearchDropdown',
                'useState',
                'useEffect', 
                'debounce',
                'quotationService',
                'isOpen',
                'customers'
            ];
            
            console.log('🔍 Verificando elementos del componente...');
            requiredElements.forEach(element => {
                if (content.includes(element)) {
                    console.log(`✅ ${element} - encontrado`);
                } else {
                    console.log(`❌ ${element} - FALTA`);
                    allGood = false;
                }
            });
            
        } catch (error) {
            console.error('❌ Error leyendo CustomerSearchDropdown:', error.message);
            allGood = false;
        }
    }
    
    return allGood;
}

function checkFrontendStatus() {
    console.log('🌐 Verificando estado del frontend...');
    
    return new Promise((resolve) => {
        const http = require('http');
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/',
            method: 'GET',
            timeout: 5000
        };
        
        const req = http.request(options, (res) => {
            console.log(`✅ Frontend respondiendo en puerto 3000 (Status: ${res.statusCode})`);
            resolve(true);
        });
        
        req.on('error', () => {
            console.log('⚠️  Frontend no está respondiendo en puerto 3000');
            resolve(false);
        });
        
        req.on('timeout', () => {
            console.log('⏰ Timeout verificando frontend');
            resolve(false);
        });
        
        req.end();
    });
}

function checkCacheStatus() {
    console.log('🧹 Verificando estado de caches...');
    
    const cachePaths = [
        './frontend/node_modules/.cache',
        './frontend/.cache',
        './frontend/build'
    ];
    
    let cachesCleared = true;
    
    cachePaths.forEach(cachePath => {
        if (fs.existsSync(cachePath)) {
            console.log(`⚠️  Cache todavía existe: ${cachePath}`);
            cachesCleared = false;
        } else {
            console.log(`✅ Cache limpiado: ${cachePath}`);
        }
    });
    
    return cachesCleared;
}

async function runFullVerification() {
    console.log('🎯 INICIANDO VERIFICACIÓN COMPLETA');
    console.log('=================================\n');
    
    // Verificar estructura de archivos
    console.log('📁 VERIFICANDO ARCHIVOS');
    console.log('------------------------');
    const filesOk = verifyComponentStructure();
    console.log(`Resultado archivos: ${filesOk ? '✅ OK' : '❌ PROBLEMAS'}\n`);
    
    // Verificar caches
    console.log('🧹 VERIFICANDO CACHES');
    console.log('----------------------');
    const cachesOk = checkCacheStatus();
    console.log(`Resultado caches: ${cachesOk ? '✅ LIMPIOS' : '⚠️  ALGUNOS PERMANECEN'}\n`);
    
    // Verificar frontend
    console.log('🌐 VERIFICANDO FRONTEND');
    console.log('------------------------');
    const frontendOk = await checkFrontendStatus();
    console.log(`Resultado frontend: ${frontendOk ? '✅ EJECUTÁNDOSE' : '❌ NO DISPONIBLE'}\n`);
    
    // Resumen final
    console.log('📊 RESUMEN FINAL');
    console.log('================');
    
    if (filesOk && frontendOk) {
        console.log('🎉 ¡REPARACIÓN EXITOSA!');
        console.log('✅ Todos los componentes están en su lugar');
        console.log('✅ Frontend está ejecutándose correctamente');
        console.log('');
        console.log('🔗 PRUEBA EL DROPDOWN:');
        console.log('   1. Ve a http://localhost:3000/quotations');
        console.log('   2. Busca la sección "Seleccionar Cliente"');
        console.log('   3. Haz clic en el campo de búsqueda');
        console.log('   4. Escribe algunas letras para probar la búsqueda');
        console.log('   5. Verifica que aparezca el dropdown completo');
        
        if (fs.existsSync('./frontend/src/components/TestCustomerDropdown.js')) {
            console.log('');
            console.log('🧪 COMPONENTE DE PRUEBA DISPONIBLE:');
            console.log('   Si el dropdown principal no funciona, puedes usar TestCustomerDropdown temporalmente');
        }
        
    } else {
        console.log('⚠️  REPARACIÓN INCOMPLETA');
        console.log('');
        console.log('🔧 SIGUIENTES PASOS:');
        
        if (!filesOk) {
            console.log('   • Revisar errores en archivos de componentes');
            console.log('   • Verificar imports y exports');
        }
        
        if (!frontendOk) {
            console.log('   • Iniciar frontend manualmente: cd frontend && npm start');
            console.log('   • Verificar errores de compilación en la terminal');
        }
        
        console.log('   • Abrir DevTools del navegador para ver errores JavaScript');
        console.log('   • Limpiar cache del navegador (Ctrl+Shift+R)');
    }
    
    console.log('');
    console.log('💡 Si persisten problemas:');
    console.log('   • Revisa la consola del navegador (F12)');
    console.log('   • Verifica la pestaña Network para errores de API');
    console.log('   • Comprueba que el backend esté ejecutándose en puerto 3001');
}

// Ejecutar verificación
setTimeout(() => {
    runFullVerification();
}, 2000); // Esperar 2 segundos antes de verificar
