const express = require('express');
const router = express.Router();
const siigoAutoImportService = require('../services/siigoAutoImportService');
const { authenticateToken } = require('../middleware/auth');

// Iniciar importación automática
router.post('/start', authenticateToken, async (req, res) => {
  try {
    await siigoAutoImportService.startAutoImport();
    
    res.json({
      success: true,
      message: 'Sistema de importación automática iniciado',
      data: siigoAutoImportService.getStatus()
    });
  } catch (error) {
    console.error('Error iniciando auto-import:', error);
    res.status(500).json({
      success: false,
      message: 'Error iniciando importación automática',
      error: error.message
    });
  }
});

// Detener importación automática
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    siigoAutoImportService.stopAutoImport();
    
    res.json({
      success: true,
      message: 'Sistema de importación automática detenido',
      data: siigoAutoImportService.getStatus()
    });
  } catch (error) {
    console.error('Error deteniendo auto-import:', error);
    res.status(500).json({
      success: false,
      message: 'Error deteniendo importación automática',
      error: error.message
    });
  }
});

// Obtener estado del sistema
router.get('/status', authenticateToken, (req, res) => {
  try {
    const status = siigoAutoImportService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error obteniendo estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estado del sistema',
      error: error.message
    });
  }
});

module.exports = router;
