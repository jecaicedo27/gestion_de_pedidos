const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const configService = require('../services/configService');
const axios = require('axios');
const { pool } = require('../config/database');

// Middleware para verificar que solo administradores accedan
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores pueden gestionar APIs.'
    });
  }
  next();
};

// Función helper para obtener credenciales SIIGO desde BD
const getSiigoCredentials = async (companyId = 1) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM siigo_credentials WHERE company_id = ? ORDER BY created_at DESC LIMIT 1',
      [companyId]
    );

    if (rows.length === 0) {
      return {
        configured: false,
        siigo_username: '',
        siigo_access_key: '',
        siigo_base_url: 'https://api.siigo.com',
        webhook_secret: '',
        is_enabled: false
      };
    }

    const cred = rows[0];
    return {
      configured: true,
      siigo_username: cred.siigo_username,
      siigo_access_key: cred.siigo_access_key, // Se mantiene encriptado para uso interno
      siigo_base_url: cred.siigo_base_url,
      webhook_secret: cred.webhook_secret,
      is_enabled: Boolean(cred.is_enabled),
      updated_at: cred.updated_at
    };
  } catch (error) {
    console.error('Error obteniendo credenciales SIIGO:', error);
    return {
      configured: false,
      siigo_username: '',
      siigo_access_key: '',
      siigo_base_url: 'https://api.siigo.com',
      webhook_secret: '',
      is_enabled: false
    };
  }
};

// Ping de depuración para validar montaje del router
router.get('/__ping', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// GET /api/api-config - Obtener configuración de todas las APIs
router.get('/', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const siigoConfig = await getSiigoCredentials();
    
    const config = {
      siigo: {
        configured: siigoConfig.configured,
        enabled: siigoConfig.is_enabled,
        siigo_username: siigoConfig.configured ? siigoConfig.siigo_username : '',
        siigo_access_key: siigoConfig.configured && siigoConfig.siigo_access_key ? '••••••••••••••••••••' : '',
        siigo_base_url: siigoConfig.siigo_base_url,
        webhook_secret: siigoConfig.configured && siigoConfig.webhook_secret ? '••••••••••••••••' : '',
        updated_at: siigoConfig.updated_at,
        status: siigoConfig.configured ? 
          (siigoConfig.is_enabled ? 'configured' : 'disabled') : 
          'not_configured'
      },
      wapify: {
        configured: false,
        enabled: process.env.WAPIFY_ENABLED === 'true',
        api_key: process.env.WAPIFY_API_KEY ? '***hidden***' : '',
        api_url: process.env.WAPIFY_API_URL || 'https://api.wapify.com/v1',
        status: 'not_configured'
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
});

// PUT /api/api-config/siigo - Actualizar configuración SIIGO
router.put('/siigo', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const { siigo_username, siigo_access_key, siigo_base_url, webhook_secret, is_enabled } = req.body;
    const userId = req.user.id;
    const companyId = 1; // Por ahora hardcodeado
    const baseUrlSanitized = (siigo_base_url || 'https://api.siigo.com').replace(/\/v1\/?$/, '');

    // Validación
    if (!siigo_username || !siigo_access_key) {
      return res.status(400).json({
        success: false,
        message: 'Usuario SIIGO y Access Key son obligatorios'
      });
    }

    // Encriptar access key y webhook secret (cifrado reversible con AES-256-GCM)
    const encAccessKey = JSON.stringify(configService.encrypt(siigo_access_key));
    const encWebhookSecret = webhook_secret ? JSON.stringify(configService.encrypt(webhook_secret)) : null;

    // Verificar si ya existen credenciales
    const [existing] = await pool.execute(
      'SELECT id FROM siigo_credentials WHERE company_id = ?',
      [companyId]
    );

    if (existing.length > 0) {
      // Actualizar existentes
      await pool.execute(`
        UPDATE siigo_credentials 
        SET siigo_username = ?, siigo_access_key = ?, siigo_base_url = ?, 
            webhook_secret = ?, is_enabled = ?, updated_by = ?, updated_at = NOW()
        WHERE company_id = ?
      `, [
        siigo_username,
        encAccessKey,
        baseUrlSanitized,
        encWebhookSecret,
        is_enabled || false,
        userId,
        companyId
      ]);
    } else {
      // Crear nuevas
      await pool.execute(`
        INSERT INTO siigo_credentials 
        (company_id, siigo_username, siigo_access_key, siigo_base_url, webhook_secret, is_enabled, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        companyId,
        siigo_username,
        encAccessKey,
        baseUrlSanitized,
        encWebhookSecret,
        is_enabled || false,
        userId,
        userId
      ]);
    }

    res.json({
      success: true,
      message: 'Configuración de SIIGO actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando configuración SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PATCH /api/api-config/siigo/toggle - Habilitar/deshabilitar SIIGO
router.patch('/siigo/toggle', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const { is_enabled } = req.body;
    const userId = req.user.id;
    const companyId = 1;

    const [existing] = await pool.execute(
      'SELECT id FROM siigo_credentials WHERE company_id = ?',
      [companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron credenciales SIIGO para actualizar'
      });
    }

    await pool.execute(
      'UPDATE siigo_credentials SET is_enabled = ?, updated_by = ?, updated_at = NOW() WHERE company_id = ?',
      [is_enabled, userId, companyId]
    );

    res.json({
      success: true,
      message: `Credenciales SIIGO ${is_enabled ? 'habilitadas' : 'deshabilitadas'} exitosamente`
    });
  } catch (error) {
    console.error('Error cambiando estado SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// DELETE /api/api-config/siigo - Eliminar credenciales SIIGO
router.delete('/siigo', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const companyId = 1;

    const [result] = await pool.execute(
      'DELETE FROM siigo_credentials WHERE company_id = ?',
      [companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron credenciales SIIGO para eliminar'
      });
    }

    res.json({
      success: true,
      message: 'Credenciales SIIGO eliminadas exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando credenciales SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/api-config/siigo/test - Probar conexión SIIGO
router.post('/siigo/test', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    console.log('🧪 /api-config/siigo/test recibido', {
      bodyKeys: Object.keys(req.body || {}),
      rawBase: req.body?.siigo_base_url
    });
    const { siigo_username, siigo_access_key, siigo_base_url, dryRun } = req.body || {};

    // Permitir usar valores almacenados si el cliente envía valores enmascarados
    let username = siigo_username;
    let accessKey = siigo_access_key;
    let baseUrlRaw = siigo_base_url || 'https://api.siigo.com';

    // Detectar si la clave viene enmascarada o no válida
    const isMasked = !accessKey || (typeof accessKey === 'string' && (/[\u2022\*]/.test(accessKey) || accessKey.length < 12));

    // Si vienen bullets (•••) o está vacío, intentar cargar credenciales reales
    if (!username || isMasked) {
      // 1) Intentar desde system_config (vía configService)
      try {
        const cfgUser = await configService.getSecureConfig('siigo_username');
        const cfgKey = await configService.getSecureConfig('siigo_access_key');
        if (cfgUser && cfgKey) {
          username = username || cfgUser;
          accessKey = (!accessKey || accessKey.includes('•')) ? cfgKey : accessKey;
          console.log('🔑 Usando credenciales SIIGO desde system_config');
        }
      } catch (e) {
        console.log('⚠️ No se pudo leer system_config:', e.message);
      }

      // 2) Intentar desde siigo_credentials (tabla directa)
      if (!username || !accessKey) {
        try {
          const [rows] = await pool.execute(
            'SELECT siigo_username, siigo_access_key, siigo_base_url FROM siigo_credentials WHERE company_id = ? ORDER BY updated_at DESC LIMIT 1',
            [1]
          );
          if (rows && rows.length > 0) {
            username = username || rows[0].siigo_username;
            if (!accessKey || accessKey.includes('•')) {
              try {
                const encObj = JSON.parse(rows[0].siigo_access_key);
                accessKey = configService.decrypt(encObj);
              } catch (e) {
                // Puede estar en texto plano si viene de migraciones viejas
                if (typeof rows[0].siigo_access_key === 'string' && rows[0].siigo_access_key.length > 20) {
                  accessKey = rows[0].siigo_access_key;
                } else {
                  console.log('⚠️ No se pudo desencriptar access_key de siigo_credentials:', e.message);
                }
              }
            }
            if (!siigo_base_url) baseUrlRaw = rows[0].siigo_base_url || baseUrlRaw;
            console.log('🔑 Usando credenciales SIIGO desde siigo_credentials');
          }
        } catch (e) {
          console.log('⚠️ No se pudo cargar credenciales SIIGO desde BD:', e.message);
        }
      }

      // 3) Fallback a variables de entorno
      if ((!username || !accessKey) && process.env.SIIGO_API_USERNAME && process.env.SIIGO_API_ACCESS_KEY) {
        username = username || process.env.SIIGO_API_USERNAME;
        accessKey = (!accessKey || accessKey.includes('•')) ? process.env.SIIGO_API_ACCESS_KEY : accessKey;
        console.log('🔑 Usando credenciales SIIGO desde variables de entorno');
      }
    }

    if (!username || !accessKey) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y Access Key son necesarios para probar la conexión'
      });
    }

    const baseUrl = baseUrlRaw.replace(/\/v1\/?$/, '');
    console.log('🧪 SIIGO test usando baseUrl:', baseUrl);

    if (dryRun) {
      return res.json({
        success: true,
        message: 'Dry run OK',
        data: { baseUrl, bodyKeys: Object.keys(req.body || {}) }
      });
    }
    
    try {
      // Intentar autenticar con SIIGO
      const authResponse = await axios.post(`${baseUrl}/auth`, {
        username,
        access_key: accessKey
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Partner-Id': process.env.SIIGO_API_PARTNER_ID || process.env.SIIGO_PARTNER_ID || 'siigo'
        }
      });

      if (authResponse.data && authResponse.data.access_token) {
        res.json({
          success: true,
          message: 'Conexión SIIGO exitosa',
          data: {
            status: 'connected',
            user: siigo_username,
            timestamp: new Date().toISOString(),
            api_url: baseUrl
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Credenciales SIIGO inválidas',
          status_code: 401
        });
      }
    } catch (apiError) {
      console.error('Error en API SIIGO:', apiError.response?.data || apiError.message);
      
      if (apiError.response?.status === 401) {
        res.status(400).json({
          success: false,
          message: 'Credenciales SIIGO inválidas',
          status_code: 401
        });
      } else if (apiError.response?.status === 403) {
        res.status(400).json({
          success: false,
          message: 'Acceso denegado por SIIGO',
          status_code: 403
        });
      } else if (apiError.code === 'ENOTFOUND' || apiError.code === 'ECONNREFUSED') {
        res.status(400).json({
          success: false,
          message: 'No se pudo conectar con los servidores de SIIGO',
          status_code: 503
        });
      } else {
        res.status(400).json({
          success: false,
          message: apiError.response?.data?.message || 'Error conectando con SIIGO',
          status_code: apiError.response?.status || 500
        });
      }
    }
  } catch (error) {
    console.error('Error probando conexión SIIGO:', error?.stack || error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/api-config/siigo/status - Estado de configuración SIIGO
router.get('/siigo/status', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const siigoConfig = await getSiigoCredentials();
    
    res.json({
      success: true,
      data: {
        configured: siigoConfig.configured,
        enabled: siigoConfig.is_enabled,
        status: siigoConfig.configured ? 
          (siigoConfig.is_enabled ? 'enabled' : 'disabled') : 
          'not_configured'
      }
    });
  } catch (error) {
    console.error('Error obteniendo estado SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/api-config/siigo/taxes - Obtener configuración de IVA (ID impuesto, tasa, y si precios incluyen IVA)
router.get('/siigo/taxes', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const taxId = await configService.getConfig('siigo_tax_iva_id', null);
    const ivaRateCfg = await configService.getConfig('siigo_iva_rate', '19');
    const pricesIncludeCfg = await configService.getConfig('siigo_prices_include_tax', false);

    const ivaRate = Number(ivaRateCfg) || 19;
    const pricesIncludeTax = (pricesIncludeCfg === true || pricesIncludeCfg === 'true' || pricesIncludeCfg === 1 || pricesIncludeCfg === '1');

    res.json({
      success: true,
      data: {
        tax_id: taxId ? Number(taxId) : null,
        iva_rate: ivaRate,
        prices_include_tax: pricesIncludeTax
      }
    });
  } catch (error) {
    console.error('Error obteniendo configuración de IVA SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PUT /api/api-config/siigo/taxes - Actualizar configuración de IVA (ID impuesto, tasa, y si precios incluyen IVA)
router.put('/siigo/taxes', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const { tax_id, iva_rate, prices_include_tax } = req.body || {};

    // Permitir actualizaciones parciales; validar tipos cuando vengan
    if (typeof tax_id !== 'undefined' && tax_id !== null && tax_id !== '') {
      await configService.setConfig('siigo_tax_iva_id', Number(tax_id), 'number', 'ID impuesto IVA 19% de SIIGO');
    }
    if (typeof iva_rate !== 'undefined' && iva_rate !== null && iva_rate !== '') {
      await configService.setConfig('siigo_iva_rate', Number(iva_rate), 'number', 'Tasa IVA (%)');
    }
    if (typeof prices_include_tax !== 'undefined') {
      const val = (prices_include_tax === true || prices_include_tax === 'true' || prices_include_tax === 1 || prices_include_tax === '1');
      await configService.setConfig('siigo_prices_include_tax', val ? 'true' : 'false', 'boolean', 'Indica si los precios de los ítems ya incluyen IVA');
    }

    res.json({
      success: true,
      message: 'Configuración de IVA para SIIGO actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando configuración de IVA SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PUT /api/api-config/wapify - Actualizar configuración Wapify (placeholder)
router.put('/wapify', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const { api_key, base_url, enabled } = req.body;

    // Validación básica
    if (!api_key) {
      return res.status(400).json({
        success: false,
        message: 'API Key es obligatorio'
      });
    }

    // TODO: Implementar guardado en base de datos para Wapify
    
    res.json({
      success: true,
      message: 'Configuración Wapify actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando configuración Wapify:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/api-config/wapify/test - Probar conexión Wapify (placeholder)
router.post('/wapify/test', auth.authenticateToken, adminOnly, async (req, res) => {
  try {
    const { api_key, base_url } = req.body;

    if (!api_key) {
      return res.status(400).json({
        success: false,
        message: 'API Key es necesario para probar la conexión'
      });
    }

    // TODO: Implementar prueba real con Wapify API
    
    res.json({
      success: true,
      message: 'Conexión Wapify exitosa',
      data: {
        status: 'connected',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error probando conexión Wapify:', error);
    res.status(500).json({
      success: false,
      message: 'Error en la conexión con Wapify'
    });
  }
});

module.exports = router;
