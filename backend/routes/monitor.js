const express = require('express');
const MonitorController = require('../controllers/monitorController');
const { authenticateToken, verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas protegidas: autenticación + admin
router.use(authenticateToken, verifyAdmin);

// Estado general de servicios y logs resumidos
router.get('/status', MonitorController.getStatus);

// Control de servicios
router.post('/service/:name/start', MonitorController.startService);
router.post('/service/:name/stop', MonitorController.stopService);
router.post('/service/:name/restart', MonitorController.restartService);
router.post('/service/:name/config', MonitorController.saveConfig);

// Gestión de webhooks
router.get('/webhooks', MonitorController.listWebhooks);
router.post('/webhooks/subscribe', MonitorController.subscribeWebhook);

// Logs
router.get('/logs', MonitorController.getLogs);

// Prueba de webhook
router.post('/test/webhook', MonitorController.testWebhook);

module.exports = router;
