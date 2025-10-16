// Inicializador del sistema de importación automática
const siigoAutoImportService = require('./services/siigoAutoImportService');

async function initializeAutoImport() {
  try {
    console.log('🤖 Inicializando sistema de importación automática SIIGO...');
    
    // Esperar 30 segundos después del inicio del servidor
    setTimeout(async () => {
      try {
        await siigoAutoImportService.startAutoImport();
        console.log('✅ Sistema de importación automática iniciado correctamente');
      } catch (error) {
        console.error('❌ Error iniciando importación automática:', error.message);
      }
    }, 30000);
    
  } catch (error) {
    console.error('❌ Error en inicialización:', error.message);
  }
}

module.exports = { initializeAutoImport };
