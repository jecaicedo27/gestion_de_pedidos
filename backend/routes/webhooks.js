const express = require('express');
const WebhookService = require('../services/webhookService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const webhookService = new WebhookService();

// Ruta para recibir webhooks de SIIGO (no requiere autenticación porque viene de SIIGO)
router.post('/receive', async (req, res) => {
    try {
        console.log('📥 Webhook recibido de SIIGO:', JSON.stringify(req.body, null, 2));
        
        const payload = req.body;
        
        // Validar que tenga la estructura básica esperada
        if (!payload || !payload.topic || !payload.id) {
            console.error('❌ Webhook inválido - falta topic o id');
            return res.status(400).json({
                success: false,
                message: 'Payload de webhook inválido'
            });
        }

        // Procesar el webhook
        const processed = await webhookService.processWebhookPayload(payload);
        
        if (processed) {
            console.log('✅ Webhook procesado exitosamente');
            res.status(200).json({
                success: true,
                message: 'Webhook procesado exitosamente'
            });
        } else {
            console.log('⚠️  Webhook recibido pero no procesado completamente');
            res.status(200).json({
                success: true,
                message: 'Webhook recibido pero no procesado completamente'
            });
        }

    } catch (error) {
        console.error('❌ Error procesando webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor procesando webhook'
        });
    }
});

// Ruta para configurar webhooks (requiere autenticación)
router.post('/setup', authenticateToken, async (req, res) => {
    try {
        console.log('🚀 Configurando webhooks de stock...');
        
        const subscriptions = await webhookService.setupStockWebhooks();
        
        res.json({
            success: true,
            message: `Webhooks configurados exitosamente: ${subscriptions.length}`,
            subscriptions: subscriptions
        });

    } catch (error) {
        console.error('❌ Error configurando webhooks:', error);
        res.status(500).json({
            success: false,
            message: 'Error configurando webhooks',
            error: error.message
        });
    }
});

// Ruta para obtener suscripciones activas (requiere autenticación)
router.get('/subscriptions', authenticateToken, async (req, res) => {
    try {
        const subscriptions = await webhookService.getWebhookSubscriptions();
        
        res.json({
            success: true,
            subscriptions: subscriptions
        });

    } catch (error) {
        console.error('❌ Error obteniendo suscripciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo suscripciones',
            error: error.message
        });
    }
});

// Ruta para obtener logs de webhooks (requiere autenticación)
router.get('/logs', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = await webhookService.getWebhookLogs(limit);
        
        res.json({
            success: true,
            logs: logs
        });

    } catch (error) {
        console.error('❌ Error obteniendo logs de webhooks:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo logs de webhooks',
            error: error.message
        });
    }
});

// Ruta para test de webhook (desarrollo)
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const testPayload = {
            company_key: "test_company",
            username: "test_user",
            topic: "public.siigoapi.products.stock.update",
            id: req.body.product_id || "test_product_id",
            code: req.body.product_code || "TEST001",
            name: "Producto de Prueba",
            available_quantity: req.body.new_stock || 50,
            ...req.body
        };

        console.log('🧪 Procesando webhook de prueba...');
        const processed = await webhookService.processWebhookPayload(testPayload);
        
        res.json({
            success: true,
            message: 'Webhook de prueba procesado',
            processed: processed,
            payload: testPayload
        });

    } catch (error) {
        console.error('❌ Error procesando webhook de prueba:', error);
        res.status(500).json({
            success: false,
            message: 'Error procesando webhook de prueba',
            error: error.message
        });
    }
});

module.exports = router;
