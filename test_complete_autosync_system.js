const autoSyncService = require('./backend/services/autoSyncService');

async function testAutoSyncSystem() {
    console.log('🧪 Probando sistema completo de AutoSync...');
    
    try {
        // Test 1: Obtener estadísticas del sistema
        console.log('\n📊 Test 1: Obteniendo estadísticas de sincronización...');
        const stats = await autoSyncService.getSyncStats();
        console.log('Estadísticas:', JSON.stringify(stats, null, 2));
        
        // Test 2: Forzar una sincronización manual
        console.log('\n🔄 Test 2: Ejecutando sincronización manual...');
        await autoSyncService.forcSync();
        
        // Test 3: Verificar estadísticas después de sync
        console.log('\n📊 Test 3: Estadísticas después de sincronización...');
        const newStats = await autoSyncService.getSyncStats();
        console.log('Nuevas estadísticas:', JSON.stringify(newStats, null, 2));
        
        console.log('\n✅ Sistema AutoSync funcionando correctamente!');
        
    } catch (error) {
        console.error('❌ Error en las pruebas:', error);
    } finally {
        process.exit(0);
    }
}

testAutoSyncSystem();
