
const express = require('express');
const router = express.Router();

// Ruta pública para configuración básica (sin autenticación)
router.get('/public', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        name: 'Sistema de Gestión de Pedidos',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        features: {
          siigo_integration: true,
          chatgpt_integration: true,
          real_time_updates: true
        }
      }
    });
  } catch (error) {
    console.error('Error en configuración pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
