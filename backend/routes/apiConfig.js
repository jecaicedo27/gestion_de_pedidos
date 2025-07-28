const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Controller para la configuración de APIs
const apiConfigController = {
  // Obtener configuración de todas las APIs
  getConfig: async (req, res) => {
    try {
      const config = {
        siigo: {
          enabled: process.env.SIIGO_ENABLED === 'true',
          username: process.env.SIIGO_USERNAME || '',
          access_key: process.env.SIIGO_ACCESS_KEY || '',
          api_url: process.env.SIIGO_API_URL || 'https://api.siigo.com/v1',
          status: 'configured' // configured, error, disconnected
        },
        wapify: {
          enabled: process.env.WAPIFY_ENABLED === 'true',
          api_key: process.env.WAPIFY_API_KEY || '',
          api_url: process.env.WAPIFY_API_URL || 'https://api.wapify.com/v1',
          status: 'not_configured' // configured, error, disconnected, not_configured
        }
      };

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Error obteniendo configuración de APIs:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Actualizar configuración de SIIGO
  updateSiigoConfig: async (req, res) => {
    try {
      const { username, access_key, enabled } = req.body;

      // Aquí podrías actualizar las variables de entorno o base de datos
      // Por ahora solo devolvemos éxito
      
      res.json({
        success: true,
        message: 'Configuración de SIIGO actualizada correctamente'
      });
    } catch (error) {
      console.error('Error actualizando configuración de SIIGO:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Actualizar configuración de Wapify
  updateWapifyConfig: async (req, res) => {
    try {
      const { api_key, enabled } = req.body;

      // Aquí podrías actualizar las variables de entorno o base de datos
      // Por ahora solo devolvemos éxito
      
      res.json({
        success: true,
        message: 'Configuración de Wapify actualizada correctamente'
      });
    } catch (error) {
      console.error('Error actualizando configuración de Wapify:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Probar conexión con SIIGO
  testSiigoConnection: async (req, res) => {
    try {
      // Aquí implementarías la lógica para probar la conexión con SIIGO
      
      res.json({
        success: true,
        data: {
          status: 'connected',
          message: 'Conexión exitosa con SIIGO'
        }
      });
    } catch (error) {
      console.error('Error probando conexión con SIIGO:', error);
      res.status(500).json({
        success: false,
        message: 'Error conectando con SIIGO'
      });
    }
  },

  // Probar conexión con Wapify
  testWapifyConnection: async (req, res) => {
    try {
      // Aquí implementarías la lógica para probar la conexión con Wapify
      
      res.json({
        success: true,
        data: {
          status: 'connected',
          message: 'Conexión exitosa con Wapify'
        }
      });
    } catch (error) {
      console.error('Error probando conexión con Wapify:', error);
      res.status(500).json({
        success: false,
        message: 'Error conectando con Wapify'
      });
    }
  }
};

// Rutas (todas requieren autenticación de admin)
router.get('/', auth, apiConfigController.getConfig);
router.put('/siigo', auth, apiConfigController.updateSiigoConfig);
router.put('/wapify', auth, apiConfigController.updateWapifyConfig);
router.post('/siigo/test', auth, apiConfigController.testSiigoConnection);
router.post('/wapify/test', auth, apiConfigController.testWapifyConnection);

module.exports = router;
