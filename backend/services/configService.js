const crypto = require('crypto');
const db = require('../config/database');

class ConfigService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.secretKey = this.getSecretKey();
  }

  /**
   * Obtiene la clave secreta para encriptar/desencriptar
   * En producción, esto debería venir de una variable de entorno segura
   */
  getSecretKey() {
    const envKey = process.env.CONFIG_ENCRYPTION_KEY;
    if (!envKey) {
      console.warn('⚠️  CONFIG_ENCRYPTION_KEY no configurada. Usando clave temporal.');
      // En producción, esto debe fallar
      return crypto.scryptSync('temporary-key-change-this', 'salt', 32);
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
   * Guarda una configuración sensible en la base de datos
   */
  async setSecureConfig(key, value, description = null) {
    try {
      const encryptedData = this.encrypt(value);
      const configValue = JSON.stringify(encryptedData);
      
      const query = `
        INSERT INTO system_config (config_key, config_value, config_type, description, is_sensitive)
        VALUES (?, ?, 'encrypted', ?, true)
        ON DUPLICATE KEY UPDATE 
          config_value = VALUES(config_value),
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await db.execute(query, [key, configValue, description]);
      
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
      const [rows] = await db.execute(
        'SELECT config_value FROM system_config WHERE config_key = ? AND is_sensitive = true',
        [key]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      const encryptedData = JSON.parse(rows[0].config_value);
      return this.decrypt(encryptedData);
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
      const [rows] = await db.execute(
        'SELECT config_value, config_type FROM system_config WHERE config_key = ?',
        [key]
      );
      
      if (rows.length === 0) {
        return defaultValue;
      }
      
      const { config_value, config_type } = rows[0];
      
      // Convertir según el tipo
      switch (config_type) {
        case 'boolean':
          return config_value === 'true';
        case 'number':
          return Number(config_value);
        case 'json':
          return JSON.parse(config_value);
        case 'date':
          return new Date(config_value);
        default:
          return config_value;
      }
    } catch (error) {
      console.error(`❌ Error obteniendo configuración: ${error.message}`);
      return defaultValue;
    }
  }

  /**
   * Guarda configuración no sensible
   */
  async setConfig(key, value, type = 'string', description = null) {
    try {
      let configValue = value;
      
      // Convertir según el tipo
      if (type === 'json') {
        configValue = JSON.stringify(value);
      } else {
        configValue = String(value);
      }
      
      const query = `
        INSERT INTO system_config (config_key, config_value, config_type, description, is_sensitive)
        VALUES (?, ?, ?, ?, false)
        ON DUPLICATE KEY UPDATE 
          config_value = VALUES(config_value),
          config_type = VALUES(config_type),
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await db.execute(query, [key, configValue, type, description]);
      
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
