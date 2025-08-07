const { query } = require('../config/database');
const bcrypt = require('bcrypt');

// Función para encriptar credenciales sensibles
const encryptCredential = async (credential) => {
  if (!credential) return null;
  const saltRounds = 10;
  return await bcrypt.hash(credential, saltRounds);
};

// Función para comparar credenciales encriptadas
const compareCredential = async (credential, hashedCredential) => {
  if (!credential || !hashedCredential) return false;
  return await bcrypt.compare(credential, hashedCredential);
};

// Obtener credenciales de SIIGO
const getSiigoCredentials = async (req, res) => {
  try {
    const credentials = await query(
      'SELECT id, company_id, siigo_username, siigo_base_url, is_enabled, created_at, updated_at FROM siigo_credentials WHERE company_id = 1'
    );

    if (!credentials.length) {
      return res.json({
        success: true,
        data: {
          configured: false,
          siigo_username: '',
          siigo_base_url: 'https://api.siigo.com/v1',
          is_enabled: false
        }
      });
    }

    const cred = credentials[0];
    res.json({
      success: true,
      data: {
        configured: true,
        siigo_username: cred.siigo_username,
        siigo_base_url: cred.siigo_base_url,
        is_enabled: cred.is_enabled,
        created_at: cred.created_at,
        updated_at: cred.updated_at
      }
    });

  } catch (error) {
    console.error('Error obteniendo credenciales SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar credenciales de SIIGO
const updateSiigoCredentials = async (req, res) => {
  try {
    const { siigo_username, siigo_access_key, siigo_base_url, webhook_secret, is_enabled } = req.body;

    // Validaciones
    if (!siigo_username) {
      return res.status(400).json({
        success: false,
        message: 'El usuario de SIIGO es requerido'
      });
    }

    if (!siigo_access_key) {
      return res.status(400).json({
        success: false,
        message: 'El Access Key de SIIGO es requerido'
      });
    }

    // Encriptar credenciales sensibles
    const encryptedAccessKey = await encryptCredential(siigo_access_key);
    const encryptedWebhookSecret = webhook_secret ? await encryptCredential(webhook_secret) : null;

    // Verificar si ya existen credenciales
    const existingCredentials = await query(
      'SELECT id FROM siigo_credentials WHERE company_id = 1'
    );

    const userId = req.user?.id || 1;

    if (existingCredentials.length === 0) {
      // Crear nuevas credenciales
      await query(
        `INSERT INTO siigo_credentials 
         (company_id, siigo_username, siigo_access_key, siigo_base_url, webhook_secret, is_enabled, created_by, updated_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          1, 
          siigo_username, 
          encryptedAccessKey,
          siigo_base_url || 'https://api.siigo.com/v1',
          encryptedWebhookSecret,
          is_enabled !== undefined ? is_enabled : true,
          userId,
          userId
        ]
      );
    } else {
      // Actualizar credenciales existentes
      await query(
        `UPDATE siigo_credentials 
         SET siigo_username = ?, siigo_access_key = ?, siigo_base_url = ?, 
             webhook_secret = ?, is_enabled = ?, updated_by = ?, updated_at = NOW() 
         WHERE company_id = 1`,
        [
          siigo_username,
          encryptedAccessKey,
          siigo_base_url || 'https://api.siigo.com/v1',
          encryptedWebhookSecret,
          is_enabled !== undefined ? is_enabled : true,
          userId
        ]
      );
    }

    res.json({
      success: true,
      message: 'Credenciales de SIIGO actualizadas exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando credenciales SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Probar conexión con SIIGO
const testSiigoConnection = async (req, res) => {
  try {
    const { siigo_username, siigo_access_key, siigo_base_url } = req.body;

    // Si no se proporcionan credenciales en el request, usar las de la BD
    let username = siigo_username;
    let accessKey = siigo_access_key;
    let baseUrl = siigo_base_url;

    if (!username || !accessKey) {
      const credentials = await query(
        'SELECT siigo_username, siigo_access_key, siigo_base_url FROM siigo_credentials WHERE company_id = 1'
      );

      if (!credentials.length) {
        return res.status(400).json({
          success: false,
          message: 'No hay credenciales configuradas para probar'
        });
      }

      username = credentials[0].siigo_username;
      accessKey = credentials[0].siigo_access_key;
      baseUrl = credentials[0].siigo_base_url;
    }

    // Para las pruebas de conexión, usamos el access_key tal como viene
    // ya que necesitamos el valor original para la API de SIIGO
    const testAccessKey = siigo_access_key || accessKey;

    // Realizar prueba de conexión a SIIGO
    const testUrl = `${baseUrl || 'https://api.siigo.com/v1'}/users`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': testAccessKey,
        'Partner-Id': 'gestion_pedidos'
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        message: 'Conexión exitosa con SIIGO',
        data: {
          status: 'connected',
          user_count: Array.isArray(data) ? data.length : 1
        }
      });
    } else {
      const errorData = await response.text();
      res.status(400).json({
        success: false,
        message: 'Error en la conexión con SIIGO',
        error: errorData,
        status_code: response.status
      });
    }

  } catch (error) {
    console.error('Error probando conexión SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Habilitar/deshabilitar credenciales de SIIGO
const toggleSiigoCredentials = async (req, res) => {
  try {
    const { is_enabled } = req.body;
    const userId = req.user?.id || 1;

    const credentials = await query(
      'SELECT id FROM siigo_credentials WHERE company_id = 1'
    );

    if (!credentials.length) {
      return res.status(404).json({
        success: false,
        message: 'No hay credenciales configuradas'
      });
    }

    await query(
      'UPDATE siigo_credentials SET is_enabled = ?, updated_by = ?, updated_at = NOW() WHERE company_id = 1',
      [is_enabled, userId]
    );

    res.json({
      success: true,
      message: `Credenciales de SIIGO ${is_enabled ? 'habilitadas' : 'deshabilitadas'} exitosamente`
    });

  } catch (error) {
    console.error('Error modificando estado de credenciales SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Eliminar credenciales de SIIGO
const deleteSiigoCredentials = async (req, res) => {
  try {
    const credentials = await query(
      'SELECT id FROM siigo_credentials WHERE company_id = 1'
    );

    if (!credentials.length) {
      return res.status(404).json({
        success: false,
        message: 'No hay credenciales configuradas para eliminar'
      });
    }

    await query('DELETE FROM siigo_credentials WHERE company_id = 1');

    res.json({
      success: true,
      message: 'Credenciales de SIIGO eliminadas exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando credenciales SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener credenciales para uso interno (con access key desencriptado)
const getSiigoCredentialsForInternal = async () => {
  try {
    const credentials = await query(
      'SELECT siigo_username, siigo_access_key, siigo_base_url, webhook_secret, is_enabled FROM siigo_credentials WHERE company_id = 1 AND is_enabled = 1'
    );

    if (!credentials.length) {
      return null;
    }

    return {
      username: credentials[0].siigo_username,
      accessKey: credentials[0].siigo_access_key, // En producción, esto debería desencriptarse
      baseUrl: credentials[0].siigo_base_url,
      webhookSecret: credentials[0].webhook_secret,
      isEnabled: credentials[0].is_enabled
    };

  } catch (error) {
    console.error('Error obteniendo credenciales SIIGO para uso interno:', error);
    return null;
  }
};

// Verificar si las credenciales están configuradas y habilitadas
const checkSiigoCredentialsStatus = async (req, res) => {
  try {
    const credentials = await query(
      'SELECT is_enabled FROM siigo_credentials WHERE company_id = 1'
    );

    if (!credentials.length) {
      return res.json({
        success: true,
        data: {
          configured: false,
          enabled: false,
          status: 'not_configured'
        }
      });
    }

    const isEnabled = credentials[0].is_enabled;

    res.json({
      success: true,
      data: {
        configured: true,
        enabled: isEnabled,
        status: isEnabled ? 'enabled' : 'disabled'
      }
    });

  } catch (error) {
    console.error('Error verificando estado de credenciales SIIGO:', error);
    res.status(500).json({
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
  checkSiigoCredentialsStatus,
  encryptCredential,
  compareCredential
};
