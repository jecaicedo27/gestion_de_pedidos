require('dotenv').config({ path: './backend/.env' });
const fs = require('fs');
const path = require('path');

async function configureSiigoCredentials() {
    console.log('🔧 CONFIGURACIÓN DE CREDENCIALES SIIGO PARA SINCRONIZACIÓN');
    console.log('==========================================================');
    
    // Verificar estado actual de credenciales
    const currentUsername = process.env.SIIGO_USERNAME;
    const currentAccessKey = process.env.SIIGO_ACCESS_KEY;
    
    console.log('📋 1. Estado actual de credenciales:');
    console.log(`   SIIGO_USERNAME: ${currentUsername || 'NO CONFIGURADO'}`);
    console.log(`   SIIGO_ACCESS_KEY: ${currentAccessKey ? '***configurado***' : 'NO CONFIGURADO'}`);
    
    // Verificar archivo .env
    const envPath = path.join(__dirname, 'backend', '.env');
    console.log(`\n📁 2. Verificando archivo: ${envPath}`);
    
    if (fs.existsSync(envPath)) {
        console.log('✅ Archivo .env existe');
        
        const envContent = fs.readFileSync(envPath, 'utf8');
        const hasUsername = envContent.includes('SIIGO_USERNAME=');
        const hasAccessKey = envContent.includes('SIIGO_ACCESS_KEY=');
        
        console.log(`   Contiene SIIGO_USERNAME: ${hasUsername ? '✅' : '❌'}`);
        console.log(`   Contiene SIIGO_ACCESS_KEY: ${hasAccessKey ? '✅' : '❌'}`);
        
        if (!hasUsername || !hasAccessKey) {
            console.log('\n⚠️  CREDENCIALES FALTANTES DETECTADAS');
            console.log('🔧 RECOMENDACIÓN: Agregue las siguientes líneas al archivo backend/.env:');
            console.log('');
            console.log('# === CREDENCIALES SIIGO PARA SINCRONIZACIÓN ===');
            if (!hasUsername) {
                console.log('SIIGO_USERNAME=su_usuario_siigo');
            }
            if (!hasAccessKey) {
                console.log('SIIGO_ACCESS_KEY=su_access_key_siigo');
            }
            console.log('');
            console.log('📝 NOTA: Reemplace con sus credenciales reales de SIIGO');
            console.log('🔄 Después de configurar, reinicie la aplicación para que tome efecto');
        } else if (!currentUsername || !currentAccessKey) {
            console.log('\n⚠️  Las credenciales están definidas pero vacías');
            console.log('🔧 RECOMENDACIÓN: Verifique que tengan valores válidos');
        } else {
            console.log('\n✅ Las credenciales SIIGO están configuradas');
            console.log('🎯 El servicio de sincronización debería funcionar correctamente');
        }
        
    } else {
        console.log('❌ Archivo .env no encontrado');
        console.log('🔧 RECOMENDACIÓN: Cree el archivo backend/.env con las credenciales SIIGO');
    }
    
    console.log('\n📊 3. Impacto de la configuración:');
    console.log('   • Permitirá sincronización automática de estados de productos');
    console.log('   • Evitará errores "siigoProducts is not iterable"');
    console.log('   • Mantendrá consistencia entre SIIGO y la base de datos');
    
    console.log('\n🎉 ANÁLISIS DE CONFIGURACIÓN COMPLETADO');
    console.log('===========================================');
}

// Ejecutar configuración
configureSiigoCredentials().catch(error => {
    console.error('❌ Error durante configuración:', error);
    process.exit(1);
});
