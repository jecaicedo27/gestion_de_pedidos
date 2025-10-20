const { query } = require('../config/database');

// Obtener configuración de la empresa
const getCompanyConfig = async (req, res) => {
  try {
    const config = await query('SELECT * FROM company_config WHERE id = 1');
    
    if (!config.length) {
      return res.status(404).json({
        success: false,
        message: 'Configuración de empresa no encontrada'
      });
    }

    res.json({
      success: true,
      data: config[0]
    });

  } catch (error) {
    console.error('Error obteniendo configuración de empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar configuración de la empresa
const updateCompanyConfig = async (req, res) => {
  try {
    const {
      company_name,
      nit,
      email,
      address,
      whatsapp,
      city,
      department,
      postal_code,
      website,
      logo_url
    } = req.body;

    // Validaciones básicas
    if (!company_name || !nit || !email || !address || !whatsapp) {
      return res.status(400).json({
        success: false,
        message: 'Los campos Nombre, NIT, Email, Dirección y WhatsApp son obligatorios'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El formato del email no es válido'
      });
    }

    // Verificar si existe configuración
    const existingConfig = await query('SELECT id FROM company_config WHERE id = 1');

    if (!existingConfig.length) {
      // Crear nueva configuración
      await query(
        `INSERT INTO company_config (
          id, company_name, nit, email, address, whatsapp, 
          city, department, postal_code, website, logo_url, created_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [company_name, nit, email, address, whatsapp, city || null, 
         department || null, postal_code || null, website || null, logo_url || null]
      );
    } else {
      // Actualizar configuración existente
      await query(
        `UPDATE company_config SET 
         company_name = ?, nit = ?, email = ?, address = ?, whatsapp = ?,
         city = ?, department = ?, postal_code = ?, website = ?, logo_url = ?,
         updated_at = NOW()
         WHERE id = 1`,
        [company_name, nit, email, address, whatsapp, city || null,
         department || null, postal_code || null, website || null, logo_url || null]
      );
    }

    // Obtener configuración actualizada
    const updatedConfig = await query('SELECT * FROM company_config WHERE id = 1');

    res.json({
      success: true,
      message: 'Configuración de empresa actualizada exitosamente',
      data: updatedConfig[0]
    });

  } catch (error) {
    console.error('Error actualizando configuración de empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener configuración pública (para usar en guías, documentos, etc.)
const getPublicCompanyConfig = async (req, res) => {
  try {
    const config = await query(
      `SELECT company_name, nit, email, address, whatsapp, city, department, 
       postal_code, website, logo_url FROM company_config WHERE id = 1`
    );
    
    if (!config.length) {
      return res.json({
        success: true,
        data: {
          company_name: 'Tu Empresa',
          nit: '000000000-0',
          email: 'info@tuempresa.com',
          address: 'Dirección de tu empresa',
          whatsapp: '+57 300 000 0000',
          city: 'Bogotá',
          department: 'Cundinamarca',
          postal_code: null,
          website: null,
          logo_url: null
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

// Obtener configuración para usar en guías de envío
const getShippingCompanyInfo = async (req, res) => {
  try {
    const config = await query(
      `SELECT company_name, nit, address, whatsapp, city, department, email
       FROM company_config WHERE id = 1`
    );
    
    if (!config.length) {
      return res.json({
        success: true,
        data: {
          company_name: 'Tu Empresa',
          nit: '000000000-0',
          address: 'Dirección de tu empresa',
          whatsapp: '+57 300 000 0000',
          city: 'Bogotá',
          department: 'Cundinamarca',
          email: 'info@tuempresa.com'
        }
      });
    }

    res.json({
      success: true,
      data: config[0]
    });

  } catch (error) {
    console.error('Error obteniendo información para envíos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Resetear configuración a valores por defecto
const resetCompanyConfig = async (req, res) => {
  try {
    const defaultConfig = {
      company_name: 'Tu Empresa',
      nit: '000000000-0',
      email: 'info@tuempresa.com',
      address: 'Dirección de tu empresa',
      whatsapp: '+57 300 000 0000',
      city: 'Bogotá',
      department: 'Cundinamarca'
    };

    await query(
      `UPDATE company_config SET 
       company_name = ?, nit = ?, email = ?, address = ?, whatsapp = ?,
       city = ?, department = ?, postal_code = NULL, website = NULL, 
       logo_url = NULL, updated_at = NOW()
       WHERE id = 1`,
      [defaultConfig.company_name, defaultConfig.nit, defaultConfig.email,
       defaultConfig.address, defaultConfig.whatsapp, defaultConfig.city, defaultConfig.department]
    );

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

// Subir logo de empresa
const uploadCompanyLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó archivo de imagen'
      });
    }

    // Construir URL del archivo subido
    const logoUrl = `/uploads/logos/${req.file.filename}`;

    // Actualizar configuración con nueva URL del logo
    await query(
      'UPDATE company_config SET logo_url = ?, updated_at = NOW() WHERE id = 1',
      [logoUrl]
    );

    res.json({
      success: true,
      message: 'Logo subido exitosamente',
      data: {
        logo_url: logoUrl
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

// Validar datos de empresa
const validateCompanyData = (data) => {
  const errors = [];

  if (!data.company_name || data.company_name.trim().length < 2) {
    errors.push('El nombre de la empresa debe tener al menos 2 caracteres');
  }

  if (!data.nit || data.nit.trim().length < 5) {
    errors.push('El NIT debe tener al menos 5 caracteres');
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('El email debe tener un formato válido');
  }

  if (!data.address || data.address.trim().length < 10) {
    errors.push('La dirección debe tener al menos 10 caracteres');
  }

  if (!data.whatsapp || data.whatsapp.trim().length < 10) {
    errors.push('El WhatsApp debe tener al menos 10 caracteres');
  }

  return errors;
};

module.exports = {
  getCompanyConfig,
  updateCompanyConfig,
  getPublicCompanyConfig,
  getShippingCompanyInfo,
  resetCompanyConfig,
  uploadCompanyLogo,
  validateCompanyData
};
