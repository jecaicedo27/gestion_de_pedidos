const express = require('express');
const router = express.Router();
const whapifyService = require('../services/whapifyService');
const { authenticateToken } = require('../middleware/auth');

// POST /api/whapify/send
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const { phone, name, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                message: 'Phone and message are required'
            });
        }

        // 1. Ensure contact exists
        const contact = await whapifyService.ensureContact(phone, name);

        if (!contact || !contact.id) {
            return res.status(500).json({
                success: false,
                message: 'Could not find or create contact in Whapify'
            });
        }

        // 2. Send message
        const result = await whapifyService.sendMessage(contact.id, message);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Whapify route error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

module.exports = router;
