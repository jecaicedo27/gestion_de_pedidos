const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metricsController');
const { verifyToken } = require('../middleware/auth'); // Assuming auth is required

// Get dailies for a month
router.get('/', verifyToken, metricsController.getDailyMetrics);

// Update specific daily metric
router.post('/update', verifyToken, metricsController.updateDailyMetric);

module.exports = router;
