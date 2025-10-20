const http = require('http');

console.log('🔍 VERIFICANDO SERVICIOS DESPUÉS DEL REINICIO...');

function testEndpoint(url, name, port) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ ${name} funcionando correctamente en puerto ${port}`);
                    resolve(true);
                } else {
                    console.log(`❌ ${name} respondió con código: ${res.statusCode}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            console.log(`❌ ${name} no disponible en puerto ${port}: ${err.message}`);
            resolve(false);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            console.log(`⏱️ ${name} no respondió en 5 segundos`);
            resolve(false);
        });
    });
}

async function verificarServicios() {
    console.log('\n🔍 Probando Backend (puerto 3001)...');
    const backendOk = await testEndpoint('http://localhost:3001/api/health', 'Backend', 3001);
    
    console.log('\n🔍 Probando Frontend (puerto 3000)...');
    const frontendOk = await testEndpoint('http://localhost:3000', 'Frontend', 3000);
    
    console.log('\n📊 RESUMEN DEL ESTADO:');
    console.log(`Backend (API): ${backendOk ? '✅ FUNCIONANDO' : '❌ NO DISPONIBLE'}`);
    console.log(`Frontend (UI): ${frontendOk ? '✅ FUNCIONANDO' : '❌ NO DISPONIBLE'}`);
    
    if (backendOk && frontendOk) {
        console.log('\n🎉 APLICACIÓN COMPLETAMENTE REINICIADA Y FUNCIONANDO');
        console.log('🌐 Accede a: http://localhost:3000');
        console.log('📡 API disponible en: http://localhost:3001');
    } else if (backendOk && !frontendOk) {
        console.log('\n⚠️ Backend funcionando, pero Frontend aún no está disponible');
        console.log('💡 El Frontend puede tardar unos minutos en compilar');
    } else if (!backendOk && frontendOk) {
        console.log('\n⚠️ Frontend funcionando, pero Backend no está disponible');
        console.log('🔧 Revisar logs del Backend');
    } else {
        console.log('\n❌ Ambos servicios no están disponibles');
        console.log('🔧 Es posible que necesiten más tiempo para iniciarse');
    }
}

// Ejecutar verificación
verificarServicios();
