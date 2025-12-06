// Inicializador del sistema de importación automática
const siigoAutoImportService = require('./services/siigoAutoImportService');

async function initializeAutoImport() {
  try {
    console.log('🤖 Inicializando sistema de importación automática SIIGO...');
    // Habilitar solo si la variable de entorno lo permite (evitar duplicar peticiones con siigoUpdateService)
    if (process.env.SIIGO_AUTO_IMPORT_ENABLED !== 'true') {
      console.log('⏸️ Auto-import SIIGO deshabilitado por configuración (SIIGO_AUTO_IMPORT_ENABLED != "true")');
      return;
    }

    const delayMs = parseInt(process.env.SIIGO_AUTO_IMPORT_START_DELAY_MS || '30000', 10);

    // Esperar N segundos después del inicio del servidor
    setTimeout(async () => {
      try {
        await siigoAutoImportService.startAutoImport();
        console.log('✅ Sistema de importación automática iniciado correctamente');
      } catch (error) {
        console.error('❌ Error iniciando importación automática:', error.message);
      }
    }, delayMs);
    
  } catch (error) {
    console.error('❌ Error en inicialización:', error.message);
  }
}

module.exports = { initializeAutoImport };
