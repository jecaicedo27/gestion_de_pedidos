const crypto = require('crypto');
const db = require('../config/database');

class ConfigService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.secretKey = this.getSecretKey();
    // Flags de compatibilidad de esquema (system_config)
    this.schemaChecked = false;
    this.hasIsSensitive = false;
    this.hasConfigType = false;
    this.hasDataType = false;
  }

  /**
   * Obtiene la clave secreta para encriptar/desencriptar
   * En producción, esto debería venir de una variable de entorno segura
   */
  getSecretKey() {
    const envKey = process.env.CONFIG_ENCRYPTION_KEY;
    const isProd = (process.env.NODE_ENV === 'production');

    if (!envKey) {
      if (isProd) {
        throw new Error('CONFIG_ENCRYPTION_KEY is required in production (64 hex chars)');
      }
      console.warn('⚠️  CONFIG_ENCRYPTION_KEY no configurada. Usando clave temporal SOLO para desarrollo.');
      return crypto.scryptSync('temporary-key-change-this', 'salt', 32);
    }

    // Validar longitud/formato (hex de 64 caracteres -> 256 bits)
    if (!/^[0-9a-fA-F]{64}$/.test(envKey)) {
      if (isProd) {
        throw new Error('CONFIG_ENCRYPTION_KEY inválida. Debe ser hex de 64 caracteres (256 bits).');
      }
      console.warn('⚠️  CONFIG_ENCRYPTION_KEY no parece hex de 64 chars. Intentando continuar en desarrollo.');
    }

    return Buffer.from(envKey, 'hex');
  }

  /**
   * Encripta un valor sensible
   */
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Desencripta un valor
   */
  decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.secretKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Detecta columnas disponibles en system_config para soportar ambos esquemas:
   * - (config_type, is_sensitive)
   * - (data_type) sin is_sensitive
   */
  async detectSchema() {
    if (this.schemaChecked) return;
    try {
      const rows = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_config'
      `);
      const cols = new Set(rows.map(r => r.COLUMN_NAME));
      this.hasIsSensitive = cols.has('is_sensitive');
      this.hasConfigType = cols.has('config_type');
      this.hasDataType = cols.has('data_type');
      this.schemaChecked = true;
    } catch (e) {
      console.warn('⚠️  No se pudo detectar esquema de system_config:', e.message);
      // Asumir esquema antiguo para evitar fallos
      this.hasIsSensitive = false;
      this.hasConfigType = false;
      this.hasDataType = true;
      this.schemaChecked = true;
    }
  }

  /**
   * Guarda una configuración sensible en la base de datos
   */
  async setSecureConfig(key, value, description = null) {
    try {
      await this.detectSchema();
      const encryptedData = this.encrypt(value);
      const configValue = JSON.stringify(encryptedData);

      if (this.hasIsSensitive && this.hasConfigType) {
        const query = `
          INSERT INTO system_config (config_key, config_value, config_type, description, is_sensitive)
          VALUES (?, ?, 'encrypted', ?, true)
          ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            updated_at = CURRENT_TIMESTAMP
        `;
        await db.query(query, [key, configValue, description]);
      } else if (this.hasDataType) {
        const query = `
          INSERT INTO system_config (config_key, config_value, data_type, description)
          VALUES (?, ?, 'encrypted', ?)
          ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            updated_at = CURRENT_TIMESTAMP
        `;
        await db.query(query, [key, configValue, description]);
      } else {
        // Fallback mínimo
        const query = `
          INSERT INTO system_config (config_key, config_value, description)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            updated_at = CURRENT_TIMESTAMP
        `;
        await db.query(query, [key, configValue, description]);
      }

      console.log(`✅ Configuración segura guardada: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ Error guardando configuración segura: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene una configuración sensible de la base de datos
   */
  async getSecureConfig(key) {
    try {
      await this.detectSchema();
      let rows;
      if (this.hasIsSensitive) {
        rows = await db.query(
          'SELECT config_value FROM system_config WHERE config_key = ? AND is_sensitive = true',
          [key]
        );
      } else {
        rows = await db.query(
          'SELECT config_value FROM system_config WHERE config_key = ?',
          [key]
        );
      }
      
      if (!rows || rows.length === 0) {
        return null;
      }
      
      const raw = rows[0].config_value;
      
      // Compatibilidad: si el valor es JSON con {encrypted, iv, authTag} -> desencriptar
      // Si no es JSON válido, asumir texto plano guardado previamente y devolverlo tal cual
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.encrypted &&
          parsed.iv &&
          parsed.authTag
        ) {
          return this.decrypt(parsed);
        }
        // Si es JSON pero no tiene formato de cifrado, devolver como string
        return raw;
      } catch {
        // No es JSON: devolver el valor en texto plano
        return raw;
      }
    } catch (error) {
      console.error(`❌ Error obteniendo configuración segura: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene configuración no sensible
   */
  async getConfig(key, defaultValue = null) {
    try {
      await this.detectSchema();

      let rows;
      // Construir SELECT según columnas disponibles para evitar ER_BAD_FIELD_ERROR
      if (this.hasConfigType || this.hasDataType) {
        const cols = ['config_value'];
        if (this.hasConfigType) cols.push('config_type');
        if (this.hasDataType) cols.push('data_type');
        const sql = `SELECT ${cols.join(', ')} FROM system_config WHERE config_key = ?`;
        rows = await db.query(sql, [key]);
      } else {
        rows = await db.query(
          'SELECT config_value FROM system_config WHERE config_key = ?',
          [key]
        );
      }
      
      if (!rows || rows.length === 0) {
        return defaultValue;
      }
      
      const { config_value } = rows[0];
      const type =
        (this.hasConfigType ? rows[0].config_type : null) ??
        (this.hasDataType ? rows[0].data_type : null) ??
        null;
      
      switch (type) {
        case 'boolean':
          return config_value === 'true' || config_value === true || config_value === 1 || config_value === '1';
        case 'number':
          return Number(config_value);
        case 'json':
          try { return JSON.parse(config_value); } catch { return defaultValue; }
        case 'date':
          return new Date(config_value);
        default:
          return config_value;
      }
    } catch (error) {
      console.warn(`⚠️  getConfig fallback (${key}): ${error.message}`);
      return defaultValue;
    }
  }

  /**
   * Guarda configuración no sensible
   */
  async setConfig(key, value, type = 'string', description = null) {
    try {
      await this.detectSchema();
      let configValue;
      
      if (type === 'json') {
        configValue = JSON.stringify(value);
      } else {
        configValue = String(value);
      }

      if (this.hasConfigType && this.hasIsSensitive) {
        const query = `
          INSERT INTO system_config (config_key, config_value, config_type, description, is_sensitive)
          VALUES (?, ?, ?, ?, false)
          ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            config_type = VALUES(config_type),
            updated_at = CURRENT_TIMESTAMP
        `;
        await db.query(query, [key, configValue, type, description]);
      } else if (this.hasDataType) {
        const query = `
          INSERT INTO system_config (config_key, config_value, data_type, description)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            data_type = VALUES(data_type),
            updated_at = CURRENT_TIMESTAMP
        `;
        await db.query(query, [key, configValue, type, description]);
      } else {
        const query = `
          INSERT INTO system_config (config_key, config_value, description)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            updated_at = CURRENT_TIMESTAMP
        `;
        await db.query(query, [key, configValue, description]);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error guardando configuración: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene las credenciales de SIIGO
   */
  async getSiigoCredentials() {
    try {
      // Primero intentar desde la base de datos (más seguro)
      const username = await this.getSecureConfig('siigo_username');
      const accessKey = await this.getSecureConfig('siigo_access_key');
      
      if (username && accessKey) {
        return { username, accessKey };
      }
      
      // Si no están en la BD, usar variables de entorno (menos seguro)
      if (process.env.SIIGO_API_USERNAME && process.env.SIIGO_API_ACCESS_KEY) {
        // Guardar en BD para futuro uso
        await this.setSecureConfig('siigo_username', process.env.SIIGO_API_USERNAME, 'Usuario API SIIGO');
        await this.setSecureConfig('siigo_access_key', process.env.SIIGO_API_ACCESS_KEY, 'Access Key API SIIGO');
        
        return {
          username: process.env.SIIGO_API_USERNAME,
          accessKey: process.env.SIIGO_API_ACCESS_KEY
        };
      }
      
      throw new Error('Credenciales de SIIGO no configuradas');
    } catch (error) {
      console.error('❌ Error obteniendo credenciales SIIGO:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene las credenciales de WhatsApp
   */
  async getWhatsappCredentials() {
    try {
      // Primero intentar desde la base de datos
      const token = await this.getSecureConfig('wapify_api_token');
      
      if (token) {
        return { token };
      }
      
      // Si no está en la BD, usar variable de entorno
      if (process.env.WAPIFY_API_TOKEN) {
        // Guardar en BD para futuro uso
        await this.setSecureConfig('wapify_api_token', process.env.WAPIFY_API_TOKEN, 'Token API Wapify');
        
        return { token: process.env.WAPIFY_API_TOKEN };
      }
      
      throw new Error('Token de Wapify no configurado');
    } catch (error) {
      console.error('❌ Error obteniendo credenciales WhatsApp:', error.message);
      throw error;
    }
  }

  /**
   * Verifica que todas las configuraciones críticas estén presentes
   */
  async validateCriticalConfigs() {
    const criticalConfigs = [
      { key: 'JWT_SECRET', env: true },
      { key: 'siigo_username', secure: true },
      { key: 'siigo_access_key', secure: true },
      { key: 'wapify_api_token', secure: true }
    ];
    
    const missing = [];
    
    for (const config of criticalConfigs) {
      if (config.env) {
        if (!process.env[config.key]) {
          missing.push(config.key);
        }
      } else if (config.secure) {
        const value = await this.getSecureConfig(config.key);
        if (!value) {
          missing.push(config.key);
        }
      }
    }
    
    if (missing.length > 0) {
      console.error('❌ Configuraciones críticas faltantes:', missing.join(', '));
      return false;
    }
    
    console.log('✅ Todas las configuraciones críticas están presentes');
    return true;
  }
}

// Exportar instancia única
module.exports = new ConfigService();
