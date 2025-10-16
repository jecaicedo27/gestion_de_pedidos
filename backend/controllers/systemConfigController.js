const { pool } = require('../config/database');

const systemConfigController = {
  /**
   * GET /api/system-config
   * Obtener toda la configuración del sistema
   */
  async getSystemConfig(req, res) {
    try {
      console.log('📋 Obteniendo configuración del sistema...');
      
      const [configs] = await pool.execute(`
        SELECT config_key, config_value, description, updated_at
        FROM system_config 
        ORDER BY config_key
      `);
      
      console.log(`✅ ${configs.length} configuraciones obtenidas`);
      
      res.json({
        success: true,
        data: configs
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo configuración del sistema:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo configuración del sistema',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/system-config
   * Actualizar múltiples configuraciones del sistema
   */
  async updateMultipleConfigs(req, res) {
    try {
      console.log('🔧 Actualizando múltiples configuraciones...');
      console.log('Body recibido:', req.body);
      
      const { configs } = req.body;
      const userId = req.user?.id || 1;
      
      if (!configs || !Array.isArray(configs)) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de configuraciones'
        });
      }
      
      if (configs.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El array de configuraciones no puede estar vacío'
        });
      }
      
      console.log(`📝 Actualizando ${configs.length} configuraciones...`);
      
      // Procesar cada configuración
      for (const config of configs) {
        const { config_key, config_value } = config;
        
        if (!config_key || config_value === undefined) {
          console.warn(`⚠️ Configuración inválida ignorada:`, config);
          continue;
        }
        
        // Verificar que la configuración existe
        const [existing] = await pool.execute(
          'SELECT config_key FROM system_config WHERE config_key = ?',
          [config_key]
        );
        
        if (existing.length === 0) {
          // Si no existe, crearla
          await pool.execute(`
            INSERT INTO system_config (config_key, config_value, description, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
          `, [config_key, config_value, `Configuración ${config_key}`]);
          
          console.log(`✅ Creada configuración ${config_key}: ${config_value}`);
        } else {
          // Si existe, actualizarla
          await pool.execute(`
            UPDATE system_config 
            SET config_value = ?, updated_at = NOW()
            WHERE config_key = ?
          `, [config_value, config_key]);
          
          console.log(`✅ Actualizada configuración ${config_key}: ${config_value}`);
        }
      }
      
      // Obtener las configuraciones actualizadas
      const configKeys = configs.map(c => c.config_key);
      const placeholders = configKeys.map(() => '?').join(',');
      
      const [updatedConfigs] = await pool.execute(`
        SELECT config_key, config_value, updated_at
        FROM system_config 
        WHERE config_key IN (${placeholders})
        ORDER BY config_key
      `, configKeys);
      
      console.log('✅ Configuraciones múltiples actualizadas exitosamente');
      
      res.json({
        success: true,
        message: 'Configuraciones actualizadas exitosamente',
        data: updatedConfigs
      });
      
    } catch (error) {
      console.error('❌ Error actualizando configuraciones múltiples:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando configuraciones',
        error: error.message
      });
    }
  },

  /**
   * GET /api/system-config/siigo-start-date
   * Obtener específicamente la configuración de fecha de inicio de SIIGO
   */
  async getSiigoStartDate(req, res) {
    try {
      console.log('📅 Obteniendo fecha de inicio de SIIGO...');
      
      const [configs] = await pool.execute(`
        SELECT config_key, config_value, description, data_type, updated_at
        FROM system_config 
        WHERE config_key IN ('siigo_start_date', 'siigo_start_date_enabled', 'siigo_historical_warning')
        ORDER BY config_key
      `);
      
      const siigoConfig = {
        start_date: null,
        enabled: true,
        show_warning: true,
        updated_at: null
      };
      
      configs.forEach(config => {
        switch (config.config_key) {
          case 'siigo_start_date':
            siigoConfig.start_date = config.config_value;
            siigoConfig.updated_at = config.updated_at;
            break;
          case 'siigo_start_date_enabled':
            siigoConfig.enabled = config.config_value === 'true';
            break;
          case 'siigo_historical_warning':
            siigoConfig.show_warning = config.config_value === 'true';
            break;
        }
      });
      
      console.log(`✅ Configuración SIIGO obtenida - Fecha: ${siigoConfig.start_date}, Habilitado: ${siigoConfig.enabled}`);
      
      res.json({
        success: true,
        data: siigoConfig
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo fecha de inicio SIIGO:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo configuración de fecha de inicio',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/system-config/siigo-start-date
   * Actualizar la configuración de fecha de inicio de SIIGO
   */
  async updateSiigoStartDate(req, res) {
    try {
      console.log('📅 Actualizando fecha de inicio de SIIGO...');
      console.log('Body recibido:', req.body);
      
      const { start_date, enabled = true, show_warning = true } = req.body;
      const userId = req.user?.id || 1; // Usar admin por defecto si no hay usuario
      
      // Validar fecha
      if (!start_date) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de inicio es requerida'
        });
      }
      
      // Validar formato de fecha
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(start_date)) {
        return res.status(400).json({
          success: false,
          message: 'La fecha debe estar en formato YYYY-MM-DD'
        });
      }
      
      // Validar que la fecha no sea futura
      const inputDate = new Date(start_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Final del día de hoy
      
      if (inputDate > today) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de inicio no puede ser futura'
        });
      }
      
      console.log(`📝 Actualizando configuraciones - Fecha: ${start_date}, Habilitado: ${enabled}`);
      
      // Actualizar las tres configuraciones
      const updates = [
        { key: 'siigo_start_date', value: start_date, type: 'date' },
        { key: 'siigo_start_date_enabled', value: enabled.toString(), type: 'boolean' },
        { key: 'siigo_historical_warning', value: show_warning.toString(), type: 'boolean' }
      ];
      
      for (const update of updates) {
        await pool.execute(`
          UPDATE system_config 
          SET config_value = ?, updated_by = ?, updated_at = NOW()
          WHERE config_key = ?
        `, [update.value, userId, update.key]);
        
        console.log(`✅ Actualizado ${update.key}: ${update.value}`);
      }
      
      // Obtener la configuración actualizada
      const [updatedConfigs] = await pool.execute(`
        SELECT config_key, config_value, updated_at
        FROM system_config 
        WHERE config_key IN ('siigo_start_date', 'siigo_start_date_enabled', 'siigo_historical_warning')
      `);
      
      const result = {
        start_date: null,
        enabled: true,
        show_warning: true,
        updated_at: null
      };
      
      updatedConfigs.forEach(config => {
        switch (config.config_key) {
          case 'siigo_start_date':
            result.start_date = config.config_value;
            result.updated_at = config.updated_at;
            break;
          case 'siigo_start_date_enabled':
            result.enabled = config.config_value === 'true';
            break;
          case 'siigo_historical_warning':
            result.show_warning = config.config_value === 'true';
            break;
        }
      });
      
      console.log('✅ Fecha de inicio de SIIGO actualizada exitosamente');
      
      res.json({
        success: true,
        message: 'Configuración de fecha de inicio actualizada exitosamente',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Error actualizando fecha de inicio SIIGO:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando configuración de fecha de inicio',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/system-config/:key
   * Actualizar una configuración específica del sistema
   */
  async updateSystemConfig(req, res) {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const userId = req.user?.id || 1;
      
      console.log(`🔧 Actualizando configuración ${key}: ${value}`);
      
      // Verificar que la configuración existe
      const [existing] = await pool.execute(
        'SELECT config_key, data_type FROM system_config WHERE config_key = ?',
        [key]
      );
      
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Configuración no encontrada'
        });
      }
      
      // Validar el valor según el tipo de dato
      const dataType = existing[0].data_type;
      let processedValue = value;
      
      switch (dataType) {
        case 'boolean':
          if (typeof value !== 'boolean') {
            return res.status(400).json({
              success: false,
              message: 'El valor debe ser un booleano'
            });
          }
          processedValue = value.toString();
          break;
        case 'number':
          if (isNaN(value)) {
            return res.status(400).json({
              success: false,
              message: 'El valor debe ser un número'
            });
          }
          processedValue = value.toString();
          break;
        case 'json':
          try {
            JSON.parse(value);
            processedValue = typeof value === 'string' ? value : JSON.stringify(value);
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: 'El valor debe ser un JSON válido'
            });
          }
          break;
        case 'date':
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return res.status(400).json({
              success: false,
              message: 'La fecha debe estar en formato YYYY-MM-DD'
            });
          }
          break;
        // 'string' no necesita validación especial
      }
      
      // Actualizar la configuración
      await pool.execute(`
        UPDATE system_config 
        SET config_value = ?, updated_by = ?, updated_at = NOW()
        WHERE config_key = ?
      `, [processedValue, userId, key]);
      
      console.log(`✅ Configuración ${key} actualizada exitosamente`);
      
      res.json({
        success: true,
        message: 'Configuración actualizada exitosamente'
      });
      
    } catch (error) {
      console.error('❌ Error actualizando configuración:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando configuración',
        error: error.message
      });
    }
  }
};

module.exports = systemConfigController;
