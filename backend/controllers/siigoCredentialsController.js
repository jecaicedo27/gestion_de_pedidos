const { query } = require('../config/database');
const configService = require('../services/configService');

/**
 * A partir de ahora las credenciales de SIIGO se almacenan CIFRADAS de forma reversible
 * mediante configService (AES-256-GCM) en la tabla system_config.
 * No se utiliza hashing irreversible para estos secretos porque deben enviarse a la API.
 */

// Obtener credenciales de SIIGO (desde system_config con cifrado)
const getSiigoCredentials = async (req, res) => {
  try {
    const username = await configService.getSecureConfig('siigo_username');
    const baseUrl = await configService.getConfig('siigo_base_url', 'https://api.siigo.com/v1');
    const enabled = await configService.getConfig('siigo_enabled', 'false') === 'true';

    return res.json({
      success: true,
      data: {
        configured: Boolean(username),
        siigo_username: username || '',
        siigo_base_url: baseUrl || 'https://api.siigo.com/v1',
        is_enabled: enabled
      }
    });
  } catch (error) {
    console.error('Error obteniendo credenciales SIIGO:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Actualizar credenciales de SIIGO (persistencia en system_config con cifrado)
const updateSiigoCredentials = async (req, res) => {
  try {
    const { siigo_username, siigo_access_key, siigo_base_url, webhook_secret, is_enabled } = req.body;

    if (!siigo_username) {
      return res.status(400).json({ success: false, message: 'El usuario de SIIGO es requerido' });
    }
    if (!siigo_access_key) {
      return res.status(400).json({ success: false, message: 'El Access Key de SIIGO es requerido' });
    }

    // Guardar de forma cifrada los secretos y en texto controlado los no sensibles
    await configService.setSecureConfig('siigo_username', siigo_username, 'Usuario API SIIGO');
    await configService.setSecureConfig('siigo_access_key', siigo_access_key, 'Access Key API SIIGO');
    if (webhook_secret) {
      await configService.setSecureConfig('siigo_webhook_secret', webhook_secret, 'Secreto para validar webhooks de SIIGO');
    }
    await configService.setConfig('siigo_base_url', siigo_base_url || 'https://api.siigo.com/v1', 'string', 'URL base de la API de SIIGO');
    await configService.setConfig('siigo_enabled', (is_enabled !== undefined ? Boolean(is_enabled) : true).toString(), 'boolean', 'Habilitar integración SIIGO');

    return res.json({ success: true, message: 'Credenciales de SIIGO actualizadas exitosamente' });
  } catch (error) {
    console.error('Error actualizando credenciales SIIGO:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Probar conexión con SIIGO (POST /auth con credenciales de DB si no vienen en body)
const testSiigoConnection = async (req, res) => {
  try {
    let { siigo_username, siigo_access_key, siigo_base_url } = req.body || {};

    if (!siigo_username || !siigo_access_key) {
      siigo_username = siigo_username || (await configService.getSecureConfig('siigo_username'));
      siigo_access_key = siigo_access_key || (await configService.getSecureConfig('siigo_access_key'));
    }
    const baseUrl = siigo_base_url || (await configService.getConfig('siigo_base_url', 'https://api.siigo.com/v1'));

    if (!siigo_username || !siigo_access_key) {
      return res.status(400).json({ success: false, message: 'No hay credenciales configuradas para probar' });
    }

    const response = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: siigo_username, access_key: siigo_access_key })
    });

    const text = await response.text();
    if (response.ok) {
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.json({
        success: true,
        message: 'Conexión exitosa con SIIGO',
        data: {
          status: 'connected',
          expires_in: data?.expires_in || null
        }
      });
    } else {
      return res.status(response.status).json({
        success: false,
        message: 'Error en la conexión con SIIGO',
        error: text
      });
    }
  } catch (error) {
    console.error('Error probando conexión SIIGO:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
  }
};

// Habilitar/deshabilitar credenciales de SIIGO (flag en system_config)
const toggleSiigoCredentials = async (req, res) => {
  try {
    const { is_enabled } = req.body;
    await configService.setConfig('siigo_enabled', Boolean(is_enabled).toString(), 'boolean', 'Habilitar integración SIIGO');
    res.json({ success: true, message: `Credenciales de SIIGO ${is_enabled ? 'habilitadas' : 'deshabilitadas'} exitosamente` });
  } catch (error) {
    console.error('Error modificando estado de credenciales SIIGO:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Eliminar credenciales de SIIGO (borrar claves en system_config)
const deleteSiigoCredentials = async (req, res) => {
  try {
    await query(`DELETE FROM system_config WHERE config_key IN ('siigo_username','siigo_access_key','siigo_base_url','siigo_webhook_secret','siigo_enabled')`);
    res.json({ success: true, message: 'Credenciales de SIIGO eliminadas exitosamente' });
  } catch (error) {
    console.error('Error eliminando credenciales SIIGO:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Obtener credenciales para uso interno (desde system_config con descifrado)
const getSiigoCredentialsForInternal = async () => {
  try {
    const username = await configService.getSecureConfig('siigo_username');
    const accessKey = await configService.getSecureConfig('siigo_access_key');
    const baseUrl = await configService.getConfig('siigo_base_url', 'https://api.siigo.com/v1');
    const webhookSecret = await configService.getSecureConfig('siigo_webhook_secret');
    const isEnabled = (await configService.getConfig('siigo_enabled', 'false')) === 'true';

    if (!username || !accessKey || !isEnabled) {
      return null;
    }

    return { username, accessKey, baseUrl, webhookSecret, isEnabled };
  } catch (error) {
    console.error('Error obteniendo credenciales SIIGO para uso interno:', error);
    return null;
  }
};

// Verificar si las credenciales están configuradas y habilitadas (desde system_config)
const checkSiigoCredentialsStatus = async (req, res) => {
  try {
    const username = await configService.getSecureConfig('siigo_username');
    const enabled = (await configService.getConfig('siigo_enabled', 'false')) === 'true';
    const configured = Boolean(username);

    return res.json({
      success: true,
      data: {
        configured,
        enabled,
        status: configured ? (enabled ? 'enabled' : 'disabled') : 'not_configured'
      }
    });
  } catch (error) {
    console.error('Error verificando estado de credenciales SIIGO:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getSiigoCredentials,
  updateSiigoCredentials,
  testSiigoConnection,
  toggleSiigoCredentials,
  deleteSiigoCredentials,
  getSiigoCredentialsForInternal,
  checkSiigoCredentialsStatus
};
