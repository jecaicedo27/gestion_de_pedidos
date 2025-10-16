const express = require('express');
const router = express.Router();
const messengerController = require('../controllers/messengerController');

// Ruta simple de prueba sin middlewares
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Rutas de mensajero funcionando'
  });
});

// Ruta simple para obtener pedidos (sin auth por ahora para testing)
router.get('/orders', (req, res) => {
  res.json({
    success: true,
    message: 'Endpoint de pedidos activo - implementar auth después',
    data: []
  });
});

module.exports = router;
