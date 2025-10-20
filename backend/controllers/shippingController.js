const shippingService = require('../services/shippingService');
const { query } = require('../config/database');

/**
 * Obtener todas las transportadoras activas
 */
const getActiveShippingCompanies = async (req, res) => {
  try {
    const companies = await shippingService.getActiveShippingCompanies();
    
    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Error obteniendo transportadoras activas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo transportadoras',
      error: error.message
    });
  }
};

/**
 * Obtener todas las transportadoras (admin)
 */
const getAllShippingCompanies = async (req, res) => {
  try {
    const companies = await shippingService.getAllShippingCompanies();
    
    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Error obteniendo todas las transportadoras:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo transportadoras',
      error: error.message
    });
  }
};

/**
 * Validar formato de número de guía
 */
const validateGuideFormat = async (req, res) => {
  try {
    const { shipping_company_id, guide_number } = req.body;
    
    if (!shipping_company_id || !guide_number) {
      return res.status(400).json({
        success: false,
        message: 'ID de transportadora y número de guía son requeridos'
      });
    }
    
    const company = await shippingService.getShippingCompanyById(shipping_company_id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Transportadora no encontrada'
      });
    }
    
    const isValid = shippingService.validateGuideNumber(guide_number, company.guide_format_pattern);
    
    res.json({
      success: true,
      data: {
        is_valid: isValid,
        company_name: company.name,
        expected_pattern: company.guide_format_pattern,
        guide_number: guide_number
      }
    });
  } catch (error) {
    console.error('Error validando formato de guía:', error);
    res.status(500).json({
      success: false,
      message: 'Error validando formato',
      error: error.message
    });
  }
};

/**
 * Crear guía de envío manual
 */
const createShippingGuide = async (req, res) => {
  try {
    const userId = req.user.id;
    const guideData = req.body;
    
    // Validaciones básicas
    const requiredFields = [
      'order_id', 'shipping_company_id', 'guide_number', 'guide_image_url',
      'payment_type', 'package_weight', 'package_content', 'declared_value'
    ];
    
    for (const field of requiredFields) {
      if (!guideData[field]) {
        return res.status(400).json({
          success: false,
          message: `Campo requerido: ${field}`
        });
      }
    }
    
    // Validar tipos de pago
    if (!['contraentrega', 'contado'].includes(guideData.payment_type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de pago debe ser "contraentrega" o "contado"'
      });
    }
    
    // Validar peso y valor declarado
    if (parseFloat(guideData.package_weight) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El peso del paquete debe ser mayor a 0'
      });
    }
    
    if (parseFloat(guideData.declared_value) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor declarado debe ser mayor a 0'
      });
    }
    
    const result = await shippingService.createManualShippingGuide(guideData, userId);
    
    res.status(201).json({
      success: true,
      message: 'Guía de envío creada exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error creando guía de envío:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creando guía de envío',
      error: error.message
    });
  }
};

/**
 * Obtener guías de envío con filtros
 */
const getShippingGuides = async (req, res) => {
  try {
    const filters = req.query;
    
    // Si no es admin, solo mostrar guías creadas por el usuario
    if (req.user.role !== 'admin') {
      filters.created_by_user_id = req.user.id;
    }
    
    const result = await shippingService.getShippingGuides(filters);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error obteniendo guías de envío:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo guías',
      error: error.message
    });
  }
};

/**
 * Obtener guía por ID
 */
const getShippingGuideById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const guide = await shippingService.getShippingGuideById(id);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Guía no encontrada'
      });
    }
    
    // Verificar permisos: admin o creador de la guía
    if (req.user.role !== 'admin' && guide.created_by_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta guía'
      });
    }
    
    res.json({
      success: true,
      data: guide
    });
  } catch (error) {
    console.error('Error obteniendo guía por ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo guía',
      error: error.message
    });
  }
};

/**
 * Actualizar estado de guía
 */
const updateGuideStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Estado es requerido'
      });
    }
    
    const validStatuses = ['generada', 'en_transito', 'entregada', 'devuelta'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no válido. Estados permitidos: ' + validStatuses.join(', ')
      });
    }
    
    // Verificar que la guía existe y permisos
    const guide = await shippingService.getShippingGuideById(id);
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Guía no encontrada'
      });
    }
    
    // Solo admin o creador pueden actualizar
    if (req.user.role !== 'admin' && guide.created_by_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar esta guía'
      });
    }
    
    await shippingService.updateGuideStatus(id, status, userId);
    
    res.json({
      success: true,
      message: 'Estado de guía actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando estado de guía:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error actualizando estado',
      error: error.message
    });
  }
};

/**
 * Obtener estadísticas de envíos
 */
const getShippingStats = async (req, res) => {
  try {
    const stats = await shippingService.getShippingStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de envío:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
};

/**
 * Activar/desactivar transportadora (solo admin)
 */
const toggleShippingCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active debe ser un valor booleano'
      });
    }
    
    await shippingService.toggleShippingCompanyStatus(id, is_active);
    
    res.json({
      success: true,
      message: `Transportadora ${is_active ? 'activada' : 'desactivada'} exitosamente`
    });
  } catch (error) {
    console.error('Error actualizando estado de transportadora:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando transportadora',
      error: error.message
    });
  }
};

/**
 * Actualizar URL de tracking (solo admin)
 */
const updateTrackingUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { tracking_url } = req.body;
    
    await shippingService.updateTrackingUrl(id, tracking_url || '');
    
    res.json({
      success: true,
      message: 'URL de tracking actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando URL de tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando URL',
      error: error.message
    });
  }
};

/**
 * Subir imagen de guía
 */
const uploadGuideImage = async (req, res) => {
  try {
    // Usar el middleware de multer del servicio
    const upload = shippingService.upload.single('guide_image');
    
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Error subiendo archivo'
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se recibió ningún archivo'
        });
      }
      
      // Generar URL relativa para acceder al archivo
      const imageUrl = `/uploads/shipping-guides/${req.file.filename}`;
      
      res.json({
        success: true,
        message: 'Imagen subida exitosamente',
        data: {
          filename: req.file.filename,
          original_name: req.file.originalname,
          size: req.file.size,
          url: imageUrl
        }
      });
    });
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    res.status(500).json({
      success: false,
      message: 'Error subiendo imagen',
      error: error.message
    });
  }
};

/**
 * Obtener configuración del remitente
 */
const getSenderConfiguration = async (req, res) => {
  try {
    const senderConfig = await shippingService.getDefaultSenderConfiguration();
    
    if (!senderConfig) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró configuración de remitente'
      });
    }
    
    res.json({
      success: true,
      data: senderConfig
    });
  } catch (error) {
    console.error('Error obteniendo configuración de remitente:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo configuración',
      error: error.message
    });
  }
};

/**
 * Obtener guías por pedido
 */
const getGuidesByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const guides = await shippingService.getShippingGuides({
      order_id: orderId
    });
    
    res.json({
      success: true,
      data: guides
    });
  } catch (error) {
    console.error('Error obteniendo guías por pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo guías',
      error: error.message
    });
  }
};

module.exports = {
  getActiveShippingCompanies,
  getAllShippingCompanies,
  validateGuideFormat,
  createShippingGuide,
  getShippingGuides,
  getShippingGuideById,
  updateGuideStatus,
  getShippingStats,
  toggleShippingCompanyStatus,
  updateTrackingUrl,
  uploadGuideImage,
  getSenderConfiguration,
  getGuidesByOrder
};
