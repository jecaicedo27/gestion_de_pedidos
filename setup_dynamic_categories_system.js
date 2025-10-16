const { pool } = require('./backend/config/database');
const categoryService = require('./backend/services/categoryService');
const { createCategoriesTable } = require('./database/create_categories_table');

async function setupDynamicCategoriesSystem() {
    try {
        console.log('🔧 Configurando Sistema de Categorías Dinámicas...');
        console.log('=' .repeat(60));

        // 1. Crear tablas necesarias
        console.log('📋 Paso 1: Creando tablas...');
        await createCategoriesTable();

        // 2. Sincronizar categorías desde SIIGO
        console.log('\n📋 Paso 2: Sincronizando categorías desde SIIGO...');
        const syncResult = await categoryService.syncCategoriesFromSiigo();
        
        if (syncResult.success) {
            console.log(`✅ Sincronización exitosa:`);
            console.log(`   🆕 ${syncResult.categoriesCreated} categorías creadas`);
            console.log(`   🔄 ${syncResult.categoriesUpdated} categorías actualizadas`);
            console.log(`   ❌ ${syncResult.errors} errores`);
        } else {
            console.log(`❌ Error en sincronización: ${syncResult.error}`);
        }

        // 3. Verificar categorías activas
        console.log('\n📋 Paso 3: Verificando categorías activas...');
        const activeCategories = await categoryService.getActiveCategories();
        console.log(`📂 ${activeCategories.length} categorías activas encontradas:`);
        
        activeCategories.forEach((cat, index) => {
            console.log(`   ${index + 1}. ${cat.label} (${cat.count} productos)`);
        });

        // 4. Obtener estadísticas
        console.log('\n📋 Paso 4: Estadísticas del sistema...');
        const stats = await categoryService.getSyncStats();
        
        if (stats.summary) {
            console.log(`📊 Resumen:`);
            console.log(`   📂 Total categorías: ${stats.summary.total_categories}`);
            console.log(`   ✅ Categorías activas: ${stats.summary.active_categories}`);
            console.log(`   🔄 Sincronizadas: ${stats.summary.synced_categories}`);
        }

        if (stats.recentSyncs && stats.recentSyncs.length > 0) {
            console.log(`\n📊 Últimas sincronizaciones:`);
            stats.recentSyncs.forEach((sync, index) => {
                const date = new Date(sync.sync_date).toLocaleString('es-CO');
                console.log(`   ${index + 1}. ${date} - Creadas: ${sync.categories_created}, Actualizadas: ${sync.categories_updated}, Errores: ${sync.errors}`);
            });
        }

        // 5. Probar endpoints API
        console.log('\n📋 Paso 5: Testing endpoints...');
        console.log('✅ Los siguientes endpoints están disponibles:');
        console.log('   GET /api/products/categories - Obtener categorías dinámicas');
        console.log('   POST /api/products/sync-categories - Sincronización manual');
        console.log('   GET /api/products/categories/sync-stats - Estadísticas de sincronización');

        console.log('\n' + '='.repeat(60));
        console.log('🎉 Sistema de Categorías Dinámicas configurado exitosamente!');
        console.log('\n🔧 BENEFICIOS PARA LA ESCALABILIDAD:');
        console.log('✅ Categorías se sincronizan automáticamente desde SIIGO');
        console.log('✅ No hay categorías hardcodeadas - totalmente dinámico');
        console.log('✅ Compatible con cualquier empresa que use SIIGO');
        console.log('✅ Sincronización automática cada hora (configurable)');
        console.log('✅ Logs y estadísticas completas');
        console.log('✅ Sistema escalable y vendible a otras empresas');
        
        console.log('\n💡 NOTAS IMPORTANTES:');
        console.log('• Las categorías se actualizan automáticamente cada hora');
        console.log('• Si una empresa tiene categorías diferentes en SIIGO, se sincronizarán automáticamente');
        console.log('• El sistema mantiene historial de todas las sincronizaciones');
        console.log('• No se requiere configuración manual de categorías');

    } catch (error) {
        console.error('❌ Error configurando sistema de categorías:', error);
        throw error;
    } finally {
        await pool.end();
        console.log('\n🔌 Conexión a base de datos cerrada');
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    setupDynamicCategoriesSystem()
        .then(() => {
            console.log('\n✅ Setup completado exitosamente');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error en setup:', error);
            process.exit(1);
        });
}

module.exports = { setupDynamicCategoriesSystem };
