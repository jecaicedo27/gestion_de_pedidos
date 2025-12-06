const { pool } = require('../config/database');

async function ensureBaseChangesTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cartera_base_changes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        previous_base DECIMAL(12,2) NOT NULL DEFAULT 0,
        new_base DECIMAL(12,2) NOT NULL DEFAULT 0,
        changed_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    console.warn('No se pudo asegurar cartera_base_changes:', e.message);
  }
}

async function auditBaseChange(prevValue, newValue, userId) {
  try {
    await ensureBaseChangesTable();
    const prev = Number(prevValue || 0) || 0;
    const next = Number(newValue || 0) || 0;
    await pool.execute(
      `INSERT INTO cartera_base_changes (previous_base, new_base, changed_by, created_at) VALUES (?, ?, ?, NOW())`,
      [prev, next, userId || null]
    );
  } catch (e) {
    console.warn('No se pudo registrar cambio de base:', e.message);
  }
}

// Detectar columnas disponibles en system_config para compatibilidad de esquemas
let schemaState = { checked: false, hasUpdatedBy: false, hasDataType: false, hasUpdatedAt: false, hasCreatedAt: false, hasDescription: false };

async function detectSystemConfigSchema() {
  if (schemaState.checked) return schemaState;
  try {
    const [rows] = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_config'
    `);
    const cols = new Set(rows.map(r => r.COLUMN_NAME));
    schemaState.hasUpdatedBy = cols.has('updated_by');
    schemaState.hasDataType = cols.has('data_type');
    schemaState.hasUpdatedAt = cols.has('updated_at');
    schemaState.hasCreatedAt = cols.has('created_at');
    schemaState.hasDescription = cols.has('description');
    schemaState.checked = true;
  } catch (e) {
    console.warn('⚠️  No se pudo detectar esquema de system_config:', e.message);
    // Asumir esquema mínimo para evitar fallos
    schemaState.hasUpdatedBy = false;
    schemaState.hasDataType = false;
    schemaState.hasUpdatedAt = false;
    schemaState.hasCreatedAt = false;
    schemaState.hasDescription = false;
    schemaState.checked = true;
  }
  return schemaState;
}

const systemConfigController = {
  /**
   * GET /api/system-config
   * Obtener toda la configuración del sistema
   */
  async getSystemConfig(req, res) {
    try {
      console.log('📋 Obteniendo configuración del sistema...');
      
      await detectSystemConfigSchema();
      const partsAll = ['config_key', 'config_value'];
      if (schemaState.hasDescription) partsAll.push('description');
      if (schemaState.hasUpdatedAt) partsAll.push('updated_at');
      const fieldsAll = partsAll.join(', ');
      const [configs] = await pool.execute(`
        SELECT ${fieldsAll}
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
      
      await detectSystemConfigSchema();
      // Procesar cada configuración
      for (const config of configs) {
        const { config_key, config_value } = config;
        
        if (!config_key || config_value === undefined) {
          console.warn(`⚠️ Configuración inválida ignorada:`, config);
          continue;
        }
        
        // Si es la base de cartera, obtener valor previo para auditoría
        let prevBase = null;
        let isBaseKey = config_key === 'cartera_base_balance';
        if (isBaseKey) {
          try {
            const [rowPrev] = await pool.execute('SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1', [config_key]);
            if (rowPrev.length) prevBase = rowPrev[0].config_value;
          } catch (_) {}
        }
        
        // Verificar que la configuración existe
        const [existing] = await pool.execute(
          'SELECT config_key FROM system_config WHERE config_key = ?',
          [config_key]
        );
        
        if (existing.length === 0) {
          // Si no existe, crearla con columnas dinámicas
          await detectSystemConfigSchema();
          const cols = ['config_key', 'config_value'];
          const vals = [config_key, config_value];
          const ph = ['?', '?'];
          if (schemaState.hasDescription) { cols.push('description'); vals.push(`Configuración ${config_key}`); ph.push('?'); }
          if (schemaState.hasCreatedAt) { cols.push('created_at'); ph.push('NOW()'); }
          if (schemaState.hasUpdatedAt) { cols.push('updated_at'); ph.push('NOW()'); }
          if (schemaState.hasUpdatedBy) { cols.push('updated_by'); vals.push(userId); ph.push('?'); }
          const insertSql = `INSERT INTO system_config (${cols.join(', ')}) VALUES (${ph.join(', ')})`;
          await pool.execute(insertSql, vals);
          console.log(`✅ Creada configuración ${config_key}: ${config_value}`);
        } else {
          // Si existe, actualizarla con SET dinámico
          await detectSystemConfigSchema();
          const setParts = ['config_value = ?'];
          const params = [config_value];
          if (schemaState.hasUpdatedAt) setParts.push('updated_at = NOW()');
          if (schemaState.hasUpdatedBy) { setParts.push('updated_by = ?'); params.push(userId); }
          const updateSql = `UPDATE system_config SET ${setParts.join(', ')} WHERE config_key = ?`;
          params.push(config_key);
          await pool.execute(updateSql, params);
          console.log(`✅ Actualizada configuración ${config_key}: ${config_value}`);
        }

        // Registrar auditoría si cambia la base
        if (isBaseKey) {
          await auditBaseChange(prevBase, config_value, userId);
        }
      }
      
      // Obtener las configuraciones actualizadas
      const configKeys = configs.map(c => c.config_key);
      const placeholders = configKeys.map(() => '?').join(',');
      
      const partsUpd = ['config_key', 'config_value'];
      if (schemaState.hasUpdatedAt) partsUpd.push('updated_at');
      const fields = partsUpd.join(', ');
      const [updatedConfigs] = await pool.execute(`
        SELECT ${fields}
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
      
      await detectSystemConfigSchema();
      const partsSiigo = ['config_key', 'config_value'];
      if (schemaState.hasDescription) partsSiigo.push('description');
      if (schemaState.hasUpdatedAt) partsSiigo.push('updated_at');
      const fieldsSiigo = partsSiigo.join(', ');
      const [configs] = await pool.execute(`
        SELECT ${fieldsSiigo}
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
            siigoConfig.updated_at = schemaState.hasUpdatedAt ? config.updated_at : null;
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
      
      await detectSystemConfigSchema();
      for (const update of updates) {
        // Construir SET dinámico según columnas existentes
        const setParts = ['config_value = ?'];
        const params = [update.value];
        if (schemaState.hasUpdatedBy) {
          setParts.push('updated_by = ?');
          params.push(userId);
        }
        if (schemaState.hasUpdatedAt) {
          setParts.push('updated_at = NOW()');
        }
        const baseQuery = `UPDATE system_config SET ${setParts.join(', ')} WHERE config_key = ?`;
        params.push(update.key);

        const [result] = await pool.execute(baseQuery, params);

        if (result.affectedRows === 0) {
          // Si no existe la fila, crearla respetando el esquema disponible
          // Construir columnas dinámicas para INSERT
          const columns = ['config_key', 'config_value'];
          const values = [update.key, update.value];
          const placeholders = ['?', '?'];
          if (schemaState.hasDataType) {
            columns.push('data_type');
            values.push(update.type);
            placeholders.push('?');
          }
          if (schemaState.hasDescription) {
            columns.push('description');
            values.push(`Configuración ${update.key}`);
            placeholders.push('?');
          }
          if (schemaState.hasCreatedAt) {
            columns.push('created_at');
            placeholders.push('NOW()');
          }
          if (schemaState.hasUpdatedAt) {
            columns.push('updated_at');
            placeholders.push('NOW()');
          }
          if (schemaState.hasUpdatedBy) {
            columns.push('updated_by');
            values.push(userId);
            placeholders.push('?');
          }

          const insertSql = `INSERT INTO system_config (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
          await pool.execute(insertSql, values);
          
        }

        console.log(`✅ Actualizado ${update.key}: ${update.value}`);
      }
      
      // Obtener la configuración actualizada
      const partsReturn = ['config_key', 'config_value'];
      if (schemaState.hasUpdatedAt) partsReturn.push('updated_at');
      const fieldsReturn = partsReturn.join(', ');
      const [updatedConfigs] = await pool.execute(`
        SELECT ${fieldsReturn}
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
            result.updated_at = schemaState.hasUpdatedAt ? config.updated_at : null;
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
      
      // Verificar que la configuración existe y detectar esquema
      await detectSystemConfigSchema();
      const selectSql = schemaState.hasDataType
        ? 'SELECT config_key, data_type FROM system_config WHERE config_key = ?'
        : 'SELECT config_key FROM system_config WHERE config_key = ?';
      const [existing] = await pool.execute(selectSql, [key]);
      
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Configuración no encontrada'
        });
      }
      
      // Validar el valor según el tipo de dato (solo si la columna existe)
      const dataType = schemaState.hasDataType ? existing[0].data_type : null;
      let processedValue = value;
      
      if (dataType) {
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
      } else {
        // Sin información de tipo, almacenar como string para compatibilidad
        processedValue = typeof value === 'string' ? value : String(value);
      }
      
      // Si es base de cartera, leer valor previo
      let prevBase = null;
      const isBaseKey = key === 'cartera_base_balance';
      if (isBaseKey) {
        try {
          const [rowPrev] = await pool.execute('SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1', [key]);
          if (rowPrev.length) prevBase = rowPrev[0].config_value;
        } catch (_) {}
      }

      // Actualizar la configuración respetando el esquema disponible
      const setParts2 = ['config_value = ?'];
      const updateParams = [processedValue];
      if (schemaState.hasUpdatedBy) { setParts2.push('updated_by = ?'); updateParams.push(userId); }
      if (schemaState.hasUpdatedAt) { setParts2.push('updated_at = NOW()'); }
      const updateSql = `UPDATE system_config SET ${setParts2.join(', ')} WHERE config_key = ?`;
      updateParams.push(key);
      await pool.execute(updateSql, updateParams);

      // Registrar auditoría si corresponde
      if (isBaseKey) {
        await auditBaseChange(prevBase, processedValue, userId);
      }
      
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
