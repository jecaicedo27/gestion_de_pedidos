const { query } = require('../config/database');

// Obtener configuración de la empresa
const getConfig = async (req, res) => {
  try {
    const config = await query('SELECT * FROM company_config WHERE id = 1');
    
    if (!config.length) {
      // Si no existe configuración, crear una por defecto
      const defaultConfig = {
        name: process.env.COMPANY_NAME || 'Mi Empresa',
        logo_url: process.env.COMPANY_LOGO_URL || '',
        primary_color: process.env.COMPANY_PRIMARY_COLOR || '#3B82F6',
        secondary_color: process.env.COMPANY_SECONDARY_COLOR || '#1E40AF',
        address: '',
        phone: '',
        email: ''
      };

      await query(
        `INSERT INTO company_config (id, name, logo_url, primary_color, secondary_color, address, phone, email, created_at) 
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [defaultConfig.name, defaultConfig.logo_url, defaultConfig.primary_color, 
         defaultConfig.secondary_color, defaultConfig.address, defaultConfig.phone, defaultConfig.email]
      );

      const newConfig = await query('SELECT * FROM company_config WHERE id = 1');
      return res.json({
        success: true,
        data: newConfig[0]
      });
    }

    res.json({
      success: true,
      data: config[0]
    });

  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar configuración de la empresa (solo admin)
const updateConfig = async (req, res) => {
  try {
    const updateData = req.validatedData;

    // Verificar si existe configuración
    const existingConfig = await query('SELECT id FROM company_config WHERE id = 1');

    if (!existingConfig.length) {
      // Crear configuración si no existe
      const defaultValues = {
        name: updateData.name || process.env.COMPANY_NAME || 'Mi Empresa',
        logoUrl: updateData.logoUrl || process.env.COMPANY_LOGO_URL || '',
        primaryColor: updateData.primaryColor || process.env.COMPANY_PRIMARY_COLOR || '#3B82F6',
        secondaryColor: updateData.secondaryColor || process.env.COMPANY_SECONDARY_COLOR || '#1E40AF',
        address: updateData.address || '',
        phone: updateData.phone || '',
        email: updateData.email || ''
      };

      await query(
        `INSERT INTO company_config (id, name, logo_url, primary_color, secondary_color, address, phone, email, created_at) 
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [defaultValues.name, defaultValues.logoUrl, defaultValues.primaryColor, 
         defaultValues.secondaryColor, defaultValues.address, defaultValues.phone, defaultValues.email]
      );
    } else {
      // Actualizar configuración existente
      const updateFields = [];
      const updateValues = [];

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          const dbField = key === 'logoUrl' ? 'logo_url' :
                         key === 'primaryColor' ? 'primary_color' :
                         key === 'secondaryColor' ? 'secondary_color' : key;
          
          updateFields.push(`${dbField} = ?`);
          updateValues.push(updateData[key]);
        }
      });

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(1); // ID siempre es 1 para configuración única

        await query(
          `UPDATE company_config SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }
    }

    // Obtener configuración actualizada
    const updatedConfig = await query('SELECT * FROM company_config WHERE id = 1');

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: updatedConfig[0]
    });

  } catch (error) {
    console.error('Error actualizando configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener configuración pública (sin autenticación)
const getPublicConfig = async (req, res) => {
  try {
    const config = await query(
      'SELECT company_name, nit, email, address, whatsapp, city, logo_url FROM company_config WHERE id = 1'
    );
    
    if (!config.length) {
      // Configuración por defecto si no existe
      return res.json({
        success: true,
        data: {
          company_name: process.env.COMPANY_NAME || 'Mi Empresa',
          nit: '000000000-0',
          email: 'info@miempresa.com',
          address: 'Dirección de mi empresa',
          whatsapp: '+57 300 000 0000',
          city: 'Bogotá',
          logo_url: process.env.COMPANY_LOGO_URL || ''
        }
      });
    }

    res.json({
      success: true,
      data: config[0]
    });

  } catch (error) {
    console.error('Error obteniendo configuración pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Resetear configuración a valores por defecto (solo admin)
const resetConfig = async (req, res) => {
  try {
    const defaultConfig = {
      name: 'Mi Empresa',
      logo_url: '',
      primary_color: '#3B82F6',
      secondary_color: '#1E40AF',
      address: '',
      phone: '',
      email: ''
    };

    // Verificar si existe configuración
    const existingConfig = await query('SELECT id FROM company_config WHERE id = 1');

    if (!existingConfig.length) {
      // Crear configuración por defecto
      await query(
        `INSERT INTO company_config (id, name, logo_url, primary_color, secondary_color, address, phone, email, created_at) 
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [defaultConfig.name, defaultConfig.logo_url, defaultConfig.primary_color, 
         defaultConfig.secondary_color, defaultConfig.address, defaultConfig.phone, defaultConfig.email]
      );
    } else {
      // Actualizar a valores por defecto
      await query(
        `UPDATE company_config 
         SET name = ?, logo_url = ?, primary_color = ?, secondary_color = ?, 
             address = ?, phone = ?, email = ?, updated_at = NOW() 
         WHERE id = 1`,
        [defaultConfig.name, defaultConfig.logo_url, defaultConfig.primary_color, 
         defaultConfig.secondary_color, defaultConfig.address, defaultConfig.phone, defaultConfig.email]
      );
    }

    // Obtener configuración reseteada
    const resetConfig = await query('SELECT * FROM company_config WHERE id = 1');

    res.json({
      success: true,
      message: 'Configuración reseteada a valores por defecto',
      data: resetConfig[0]
    });

  } catch (error) {
    console.error('Error reseteando configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Validar colores hexadecimales
const validateColor = (color) => {
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexColorRegex.test(color);
};

// Obtener configuración para el tema del frontend
const getThemeConfig = async (req, res) => {
  try {
    const config = await query(
      'SELECT name, logo_url, primary_color, secondary_color FROM company_config WHERE id = 1'
    );
    
    let themeConfig;
    
    if (!config.length) {
      themeConfig = {
        companyName: process.env.COMPANY_NAME || 'Mi Empresa',
        logoUrl: process.env.COMPANY_LOGO_URL || '',
        colors: {
          primary: process.env.COMPANY_PRIMARY_COLOR || '#3B82F6',
          secondary: process.env.COMPANY_SECONDARY_COLOR || '#1E40AF'
        }
      };
    } else {
      themeConfig = {
        companyName: config[0].name,
        logoUrl: config[0].logo_url,
        colors: {
          primary: config[0].primary_color,
          secondary: config[0].secondary_color
        }
      };
    }

    res.json({
      success: true,
      data: themeConfig
    });

  } catch (error) {
    console.error('Error obteniendo configuración de tema:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Subir logo de empresa (requiere multer middleware)
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó archivo de imagen'
      });
    }

    // Construir URL del archivo subido
    const logoUrl = `/uploads/${req.file.filename}`;

    // Actualizar configuración con nueva URL del logo
    const existingConfig = await query('SELECT id FROM company_config WHERE id = 1');

    if (!existingConfig.length) {
      // Crear configuración si no existe
      await query(
        `INSERT INTO company_config (id, name, logo_url, primary_color, secondary_color, address, phone, email, created_at) 
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [process.env.COMPANY_NAME || 'Mi Empresa', logoUrl, '#3B82F6', '#1E40AF', '', '', '']
      );
    } else {
      // Actualizar logo existente
      await query(
        'UPDATE company_config SET logo_url = ?, updated_at = NOW() WHERE id = 1',
        [logoUrl]
      );
    }

    res.json({
      success: true,
      message: 'Logo subido exitosamente',
      data: {
        logoUrl
      }
    });

  } catch (error) {
    console.error('Error subiendo logo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getConfig,
  updateConfig,
  getPublicConfig,
  resetConfig,
  getThemeConfig,
  uploadLogo,
  validateColor
};
