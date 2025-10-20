const express = require('express');
const router = express.Router();
const axios = require('axios');

// Middleware de autenticación - NO SE USA para categorías ya que son datos públicos
// const { authenticateToken } = require('../middleware/auth');

/**
 * Obtener categorías desde la tabla categories
 * Este endpoint obtiene las categorías correctas de la tabla categories
 * NO REQUIERE AUTENTICACIÓN - Las categorías son datos públicos necesarios para la interfaz
 */
router.get('/live', async (req, res) => {
  try {
    console.log('🔄 Obteniendo categorías desde tabla categories...');
    
    const db = require('../config/database');
    
    // Consulta para obtener categorías desde la tabla categories
    const query = `
      SELECT name 
      FROM categories 
      WHERE is_active = 1
      ORDER BY name ASC
    `;

    const results = await db.query(query);

    const categories = results.map(row => row.name);
    
    console.log(`✅ Categorías obtenidas desde tabla categories: ${categories.length}`);
    categories.forEach((category, index) => {
      console.log(`  ${index + 1}. ${category}`);
    });

    res.json({
      success: true,
      data: categories,
      source: 'CATEGORIES_TABLE',
      total_categories: categories.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error endpoint categorías live:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      source: 'LIVE_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Endpoint de respaldo - obtener categorías desde tabla categories
 * Se usa cuando el endpoint principal no esté disponible
 * NO REQUIERE AUTENTICACIÓN - Las categorías son datos públicos necesarios para la interfaz
 */
router.get('/local', async (req, res) => {
  try {
    const db = require('../config/database');
    
    const query = `
      SELECT name 
      FROM categories 
      WHERE is_active = 1
      ORDER BY name ASC
    `;

    const results = await db.query(query);

    const categories = results.map(row => row.name);

    console.log(`✅ Categorías enviadas: ${categories.length}`);
    categories.forEach((category, index) => {
      console.log(`  ${index + 1}. ${category}`);
    });
    
    // Return simple array that frontend expects
    res.json(categories);

  } catch (error) {
    console.error('❌ Error endpoint categorías locales:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;
