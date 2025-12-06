const StockSyncService = require('./stockSyncService');

/**
 * Manager singleton para el sistema de sincronización de stock.
 * Evita múltiples instancias/timers y expone helpers uniformes para el dashboard.
 */
class StockSyncManager {
  constructor() {
    this.service = new StockSyncService();
  }

  async start() {
    try {
      await this.service.startAutoSync();
      return { running: true };
    } catch (e) {
      throw e;
    }
  }

  stop() {
    try {
      this.service.stopAutoSync();
      return { running: false };
    } catch (e) {
      throw e;
    }
  }

  isRunning() {
    return this.service.syncInterval !== null;
  }

  async getStats() {
    try {
      return await this.service.getStockStats();
    } catch (e) {
      return null;
    }
  }

  // Exponer la instancia por si se requiere acceso directo
  getInstance() {
    return this.service;
  }
}

const stockSyncManager = new StockSyncManager();

module.exports = stockSyncManager;
