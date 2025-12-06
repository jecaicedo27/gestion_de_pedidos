const { query } = require('../config/database');
const stockSyncManager = require('../services/stockSyncManager');
const siigoUpdateService = require('../services/siigoUpdateService');
const WebhookService = require('../services/webhookService');

const webhookService = new WebhookService();

const minutesFromMs = (ms) => Math.max(1, Math.round((Number(ms) || 0) / 60000));
const msFromMinutes = (m) => Math.max(60000, Math.round(Number(m) * 60000 || 0));

async function upsertSystemConfig(key, value) {
  try {
    await query(`
      INSERT INTO system_config (config_key, config_value, updated_at, created_at)
      VALUES (?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()
    `, [key, String(value)]);
  } catch (e) {
    console.warn('system_config upsert failed:', key, value, e.message);
  }
}

const MonitorController = {
  // GET /api/monitor/status
  async getStatus(req, res) {
    try {
      const stockStats = await stockSyncManager.getStats();
      let siigoStats = null;
      try {
        siigoStats = await siigoUpdateService.getUpdateStats();
      } catch (e) {
        siigoStats = null;
      }

      const stockInstance = stockSyncManager.getInstance();
      const status = {
        services: {
          stockSync: {
            running: stockSyncManager.isRunning(),
            intervalMinutes: minutesFromMs(stockInstance.SYNC_INTERVAL || (5 * 60000)),
            stats: stockStats || {},
            webhooksConfigured: !!(stockStats && stockStats.webhooksConfigured),
          },
          siigoUpdate: {
            running: !!siigoUpdateService.isRunning,
            intervalMinutes: minutesFromMs(siigoUpdateService.updateInterval || (10 * 60000)),
            stats: siigoStats || {},
          }
        }
      };

      // Últimos logs resumidos
      const [webhookLogs] = await Promise.all([
        query(`SELECT id, topic, processed, error_message, created_at 
               FROM webhook_logs ORDER BY created_at DESC LIMIT 20`)
      ]);

      status.logs = {
        webhook_logs: webhookLogs
      };

      return res.json({ success: true, data: status });
    } catch (e) {
      console.error('monitor.getStatus error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // POST /api/monitor/service/:name/start
  async startService(req, res) {
    try {
      const name = String(req.params.name || '').toLowerCase();
      if (name === 'stocksync') {
        await stockSyncManager.start();
      } else if (name === 'siigoupdate') {
        siigoUpdateService.start();
      } else {
        return res.status(400).json({ success: false, message: 'Servicio desconocido' });
      }
      return res.json({ success: true, message: `Servicio ${name} iniciado` });
    } catch (e) {
      console.error('monitor.startService error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // POST /api/monitor/service/:name/stop
  async stopService(req, res) {
    try {
      const name = String(req.params.name || '').toLowerCase();
      if (name === 'stocksync') {
        stockSyncManager.stop();
      } else if (name === 'siigoupdate') {
        siigoUpdateService.stop();
      } else {
        return res.status(400).json({ success: false, message: 'Servicio desconocido' });
      }
      return res.json({ success: true, message: `Servicio ${name} detenido` });
    } catch (e) {
      console.error('monitor.stopService error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // POST /api/monitor/service/:name/restart
  async restartService(req, res) {
    try {
      const name = String(req.params.name || '').toLowerCase();
      if (name === 'stocksync') {
        stockSyncManager.stop();
        await stockSyncManager.start();
      } else if (name === 'siigoupdate') {
        siigoUpdateService.stop();
        siigoUpdateService.start();
      } else {
        return res.status(400).json({ success: false, message: 'Servicio desconocido' });
      }
      return res.json({ success: true, message: `Servicio ${name} reiniciado` });
    } catch (e) {
      console.error('monitor.restartService error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // POST /api/monitor/service/:name/config  { intervalMinutes?: number, enabled?: boolean }
  async saveConfig(req, res) {
    try {
      const name = String(req.params.name || '').toLowerCase();
      const { intervalMinutes, enabled } = req.body || {};

      if (name === 'stocksync') {
        const instance = stockSyncManager.getInstance();

        if (typeof intervalMinutes === 'number' && !Number.isNaN(intervalMinutes)) {
          instance.SYNC_INTERVAL = msFromMinutes(intervalMinutes);
          // reaplicar si está corriendo
          if (stockSyncManager.isRunning()) {
            stockSyncManager.stop();
            await stockSyncManager.start();
          }
          await upsertSystemConfig('autosync_stock_interval_minutes', intervalMinutes);
        }

        if (typeof enabled === 'boolean') {
          await upsertSystemConfig('autosync_stock_enabled', enabled ? 'true' : 'false');
          if (enabled && !stockSyncManager.isRunning()) {
            await stockSyncManager.start();
          } else if (!enabled && stockSyncManager.isRunning()) {
            stockSyncManager.stop();
          }
        }
      } else if (name === 'siigoupdate') {
        if (typeof intervalMinutes === 'number' && !Number.isNaN(intervalMinutes)) {
          siigoUpdateService.stop();
          siigoUpdateService.updateInterval = msFromMinutes(intervalMinutes);
          siigoUpdateService.start();
          await upsertSystemConfig('siigo_updates_interval_minutes', intervalMinutes);
        }

        if (typeof enabled === 'boolean') {
          await upsertSystemConfig('siigo_updates_enabled', enabled ? 'true' : 'false');
          if (enabled && !siigoUpdateService.isRunning) {
            siigoUpdateService.start();
          } else if (!enabled && siigoUpdateService.isRunning) {
            siigoUpdateService.stop();
          }
        }
      } else {
        return res.status(400).json({ success: false, message: 'Servicio desconocido' });
      }

      return res.json({ success: true, message: `Configuración aplicada a ${name}` });
    } catch (e) {
      console.error('monitor.saveConfig error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // GET /api/monitor/webhooks
  async listWebhooks(req, res) {
    try {
      const subscriptions = await webhookService.getWebhookSubscriptions();
      return res.json({ success: true, data: { subscriptions } });
    } catch (e) {
      console.error('monitor.listWebhooks error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // POST /api/monitor/webhooks/subscribe  { topic: string }
  async subscribeWebhook(req, res) {
    try {
      const { topic } = req.body || {};
      if (!topic) {
        return res.status(400).json({ success: false, message: 'topic requerido' });
      }
      const sub = await webhookService.subscribeToWebhook(topic);
      return res.json({ success: true, data: sub });
    } catch (e) {
      console.error('monitor.subscribeWebhook error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // POST /api/monitor/test/webhook { topic: string, id?: string, code?: string, available_quantity?: number }
  async testWebhook(req, res) {
    try {
      const { topic, id, code, available_quantity } = req.body || {};
      if (!topic) {
        return res.status(400).json({ success: false, message: 'topic requerido' });
      }
      const payload = {
        company_key: 'test_company',
        topic,
        id: id || 'test-id',
        code: code || 'TEST-CODE',
        available_quantity: typeof available_quantity === 'number' ? available_quantity : 10,
        name: 'Producto/Cliente de Prueba',
        active: true
      };
      const ok = await webhookService.processWebhookPayload(payload);
      return res.json({ success: true, processed: !!ok, payload });
    } catch (e) {
      console.error('monitor.testWebhook error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  },

  // GET /api/monitor/logs?source=webhooks|siigo&limit=100
  async getLogs(req, res) {
    try {
      const source = String(req.query.source || 'webhooks').toLowerCase();
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10)));

      if (source === 'webhooks') {
        const rows = await query(`
          SELECT id, topic, product_id, siigo_product_id, product_code, processed, error_message, created_at
          FROM webhook_logs
          ORDER BY created_at DESC
          LIMIT ?
        `, [limit]);
        return res.json({ success: true, data: rows });
      }
      if (source === 'siigo') {
        const rows = await query(`
          SELECT id, siigo_invoice_id, order_id, sync_type, sync_status, error_message, processed_at
          FROM siigo_sync_log
          ORDER BY processed_at DESC
          LIMIT ?
        `, [limit]);
        return res.json({ success: true, data: rows });
      }
      return res.status(400).json({ success: false, message: 'source inválido' });
    } catch (e) {
      console.error('monitor.getLogs error:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }
};

module.exports = MonitorController;
