const { query } = require('../config/database');
const whatsappService = require('./whatsappService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

class ShippingService {
  constructor() {
    // Configurar multer para subida de imágenes de guías
    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/shipping-guides');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'guide-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

    this.upload = multer({
      storage: this.storage,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Solo se permiten archivos de imagen (JPG, PNG) o PDF'));
        }
      }
    });
  }

  /**
   * Obtener todas las transportadoras activas
   */
  async getActiveShippingCompanies() {
    try {
      const companies = await query(`
        SELECT id, name, code, guide_format_pattern, website_tracking_url, logo_url
        FROM shipping_companies 
        WHERE is_active = true 
        ORDER BY name ASC
      `);
      
      return companies;
    } catch (error) {
      console.error('Error obteniendo transportadoras:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las transportadoras (para admin)
   */
  async getAllShippingCompanies() {
    try {
      const companies = await query(`
        SELECT * FROM shipping_companies 
        ORDER BY name ASC
      `);
      
      return companies;
    } catch (error) {
      console.error('Error obteniendo todas las transportadoras:', error);
      throw error;
    }
  }

  /**
   * Obtener transportadora por ID
   */
  async getShippingCompanyById(id) {
    try {
      const companies = await query(`
        SELECT * FROM shipping_companies WHERE id = ?
      `, [id]);
      
      return companies[0] || null;
    } catch (error) {
      console.error('Error obteniendo transportadora:', error);
      throw error;
    }
  }

  /**
   * Validar formato de número de guía
   */
  validateGuideNumber(guideNumber, pattern) {
    if (!pattern || !guideNumber) return true; // Si no hay patrón, aceptar cualquier formato
    
    try {
      const regex = new RegExp(pattern);
      return regex.test(guideNumber);
    } catch (error) {
      console.error('Error validando formato de guía:', error);
      return true; // En caso de error, permitir el formato
    }
  }

  /**
   * Obtener configuración del remitente por defecto
   */
  async getDefaultSenderConfiguration() {
    try {
      const senders = await query(`
        SELECT * FROM sender_configurations 
        WHERE is_default = true 
        LIMIT 1
      `);
      
      return senders[0] || null;
    } catch (error) {
      console.error('Error obteniendo configuración de remitente:', error);
      throw error;
    }
  }

  /**
   * Generar URL de tracking
   */
  generateTrackingUrl(trackingUrlTemplate, guideNumber) {
    if (!trackingUrlTemplate) return null;
    
    return trackingUrlTemplate.replace('{guide_number}', guideNumber);
  }

  /**
   * Crear guía de envío manual
   */
  async createManualShippingGuide(guideData, userId) {
    try {
      // Validar que el pedido existe
      const orderResult = await query(`
        SELECT * FROM orders WHERE id = ?
      `, [guideData.order_id]);
      
      if (orderResult.length === 0) {
        throw new Error('Pedido no encontrado');
      }
      
      const order = orderResult[0];
      
      // Validar que la transportadora existe y está activa
      const company = await this.getShippingCompanyById(guideData.shipping_company_id);
      if (!company || !company.is_active) {
        throw new Error('Transportadora no válida o inactiva');
      }
      
      // Validar formato de número de guía
      if (!this.validateGuideNumber(guideData.guide_number, company.guide_format_pattern)) {
        throw new Error(`Formato de guía inválido para ${company.name}. Patrón esperado: ${company.guide_format_pattern}`);
      }
      
      // Verificar que no existe otra guía con el mismo número para la misma transportadora
      const existingGuide = await query(`
        SELECT id FROM manual_shipping_guides 
        WHERE shipping_company_id = ? AND guide_number = ?
      `, [guideData.shipping_company_id, guideData.guide_number]);
      
      if (existingGuide.length > 0) {
        throw new Error('Ya existe una guía con este número para esta transportadora');
      }
      
      // Obtener configuración del remitente
      const senderConfig = await this.getDefaultSenderConfiguration();
      if (!senderConfig) {
        throw new Error('No se encontró configuración de remitente');
      }
      
      // Preparar información del remitente
      const senderInfo = {
        company_name: senderConfig.company_name,
        company_nit: senderConfig.company_nit,
        address: senderConfig.address_line1,
        city: senderConfig.city,
        department: senderConfig.department,
        country: senderConfig.country,
        phone: senderConfig.phone,
        email: senderConfig.email
      };
      
      // Preparar información del destinatario
      const recipientInfo = {
        name: order.customer_name,
        phone: order.customer_phone,
        address: order.customer_address,
        email: order.customer_email || ''
      };
      
      // Generar URL de tracking
      const trackingUrl = this.generateTrackingUrl(company.website_tracking_url, guideData.guide_number);
      
      // Crear la guía en la base de datos
      const result = await query(`
        INSERT INTO manual_shipping_guides (
          order_id, shipping_company_id, guide_number, guide_image_url,
          payment_type, package_weight, package_dimensions, package_content,
          declared_value, shipping_cost, special_observations,
          sender_info, recipient_info, tracking_url, created_by_user_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        guideData.order_id,
        guideData.shipping_company_id,
        guideData.guide_number,
        guideData.guide_image_url,
        guideData.payment_type,
        guideData.package_weight,
        guideData.package_dimensions || null,
        guideData.package_content,
        guideData.declared_value,
        guideData.shipping_cost || 0,
        guideData.special_observations || null,
        JSON.stringify(senderInfo),
        JSON.stringify(recipientInfo),
        trackingUrl,
        userId
      ]);
      
      const guideId = result.insertId;
      
      // Actualizar el pedido con la guía asignada y cambiar método de entrega
      await query(`
        UPDATE orders 
        SET assigned_guide_id = ?, 
            delivery_method = ?,
            status = 'enviado',
            updated_at = NOW()
        WHERE id = ?
      `, [guideId, guideData.delivery_method || 'envio_nacional', guideData.order_id]);
      
      // Enviar notificación WhatsApp automática
      try {
        const shippingData = {
          shipping_company: company.name,
          guide_number: guideData.guide_number,
          tracking_url: trackingUrl || `Contactar a ${company.name} con guía ${guideData.guide_number}`
        };
        
        await whatsappService.sendGuiaEnvioNotification(
          guideData.order_id,
          shippingData,
          guideData.guide_image_url
        );
        
        console.log('✅ Notificación WhatsApp enviada para guía:', guideData.guide_number);
      } catch (whatsappError) {
        console.error('❌ Error enviando WhatsApp (no crítico):', whatsappError.message);
        // No fallar la creación de la guía si WhatsApp falla
      }
      
      return {
        id: guideId,
        guide_number: guideData.guide_number,
        company_name: company.name,
        tracking_url: trackingUrl
      };
      
    } catch (error) {
      console.error('Error creando guía de envío:', error);
      throw error;
    }
  }

  /**
   * Obtener guías de envío con filtros
   */
  async getShippingGuides(filters = {}) {
    try {
      let whereConditions = [];
      let queryParams = [];
      
      // Filtros disponibles
      if (filters.order_id) {
        whereConditions.push('msg.order_id = ?');
        queryParams.push(filters.order_id);
      }
      
      if (filters.shipping_company_id) {
        whereConditions.push('msg.shipping_company_id = ?');
        queryParams.push(filters.shipping_company_id);
      }
      
      if (filters.current_status) {
        whereConditions.push('msg.current_status = ?');
        queryParams.push(filters.current_status);
      }
      
      if (filters.guide_number) {
        whereConditions.push('msg.guide_number LIKE ?');
        queryParams.push(`%${filters.guide_number}%`);
      }
      
      if (filters.created_by_user_id) {
        whereConditions.push('msg.created_by_user_id = ?');
        queryParams.push(filters.created_by_user_id);
      }
      
      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
      
      // Paginación
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const offset = (page - 1) * limit;
      
      const guides = await query(`
        SELECT 
          msg.*,
          sc.name as company_name,
          sc.code as company_code,
          o.order_number,
          o.customer_name,
          o.customer_phone,
          u.full_name as created_by_name
        FROM manual_shipping_guides msg
        LEFT JOIN shipping_companies sc ON msg.shipping_company_id = sc.id
        LEFT JOIN orders o ON msg.order_id = o.id
        LEFT JOIN users u ON msg.created_by_user_id = u.id
        ${whereClause}
        ORDER BY msg.created_at DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, limit, offset]);
      
      // Contar total para paginación
      const totalResult = await query(`
        SELECT COUNT(*) as total
        FROM manual_shipping_guides msg
        LEFT JOIN shipping_companies sc ON msg.shipping_company_id = sc.id
        LEFT JOIN orders o ON msg.order_id = o.id
        LEFT JOIN users u ON msg.created_by_user_id = u.id
        ${whereClause}
      `, queryParams);
      
      const total = totalResult[0].total;
      const totalPages = Math.ceil(total / limit);
      
      return {
        guides,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_records: total,
          per_page: limit
        }
      };
      
    } catch (error) {
      console.error('Error obteniendo guías de envío:', error);
      throw error;
    }
  }

  /**
   * Obtener guía por ID
   */
  async getShippingGuideById(id) {
    try {
      const guides = await query(`
        SELECT 
          msg.*,
          sc.name as company_name,
          sc.code as company_code,
          sc.website_tracking_url,
          o.order_number,
          o.customer_name,
          o.customer_phone,
          u.full_name as created_by_name
        FROM manual_shipping_guides msg
        LEFT JOIN shipping_companies sc ON msg.shipping_company_id = sc.id
        LEFT JOIN orders o ON msg.order_id = o.id
        LEFT JOIN users u ON msg.created_by_user_id = u.id
        WHERE msg.id = ?
      `, [id]);
      
      if (guides.length === 0) {
        return null;
      }
      
      const guide = guides[0];
      
      // Parsear JSON fields
      if (guide.sender_info) {
        guide.sender_info = JSON.parse(guide.sender_info);
      }
      
      if (guide.recipient_info) {
        guide.recipient_info = JSON.parse(guide.recipient_info);
      }
      
      return guide;
      
    } catch (error) {
      console.error('Error obteniendo guía por ID:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de guía
   */
  async updateGuideStatus(id, newStatus, userId) {
    try {
      const validStatuses = ['generada', 'en_transito', 'entregada', 'devuelta'];
      
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Estado de guía no válido');
      }
      
      // Verificar que la guía existe
      const guide = await this.getShippingGuideById(id);
      if (!guide) {
        throw new Error('Guía no encontrada');
      }
      
      // Actualizar estado
      await query(`
        UPDATE manual_shipping_guides 
        SET current_status = ?, updated_at = NOW()
        WHERE id = ?
      `, [newStatus, id]);
      
      // Si se marca como entregada, enviar notificación WhatsApp
      if (newStatus === 'entregada') {
        try {
          const deliveryData = {
            amount_collected: guide.declared_value // Usar valor declarado como monto cobrado
          };
          
          await whatsappService.sendPedidoEntregadoNotification(guide.order_id, deliveryData);
          console.log('✅ Notificación de entrega enviada por WhatsApp');
        } catch (whatsappError) {
          console.error('❌ Error enviando WhatsApp de entrega (no crítico):', whatsappError.message);
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('Error actualizando estado de guía:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de guías
   */
  async getShippingStats() {
    try {
      // Estadísticas generales
      const generalStats = await query(`
        SELECT 
          COUNT(*) as total_guides,
          SUM(CASE WHEN current_status = 'generada' THEN 1 ELSE 0 END) as generated,
          SUM(CASE WHEN current_status = 'en_transito' THEN 1 ELSE 0 END) as in_transit,
          SUM(CASE WHEN current_status = 'entregada' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN current_status = 'devuelta' THEN 1 ELSE 0 END) as returned,
          SUM(CASE WHEN payment_type = 'contraentrega' THEN 1 ELSE 0 END) as cash_on_delivery,
          SUM(CASE WHEN payment_type = 'contado' THEN 1 ELSE 0 END) as prepaid
        FROM manual_shipping_guides
      `);
      
      // Estadísticas por transportadora
      const companyStats = await query(`
        SELECT 
          sc.name as company_name,
          COUNT(*) as total_guides,
          SUM(CASE WHEN msg.current_status = 'entregada' THEN 1 ELSE 0 END) as delivered,
          AVG(msg.declared_value) as avg_declared_value
        FROM manual_shipping_guides msg
        LEFT JOIN shipping_companies sc ON msg.shipping_company_id = sc.id
        GROUP BY msg.shipping_company_id, sc.name
        ORDER BY total_guides DESC
        LIMIT 10
      `);
      
      // Estadísticas por día (últimos 7 días)
      const dailyStats = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN current_status = 'entregada' THEN 1 ELSE 0 END) as delivered
        FROM manual_shipping_guides
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      
      return {
        general: generalStats[0],
        by_company: companyStats,
        daily: dailyStats
      };
      
    } catch (error) {
      console.error('Error obteniendo estadísticas de envío:', error);
      throw error;
    }
  }

  /**
   * Activar/desactivar transportadora (solo admin)
   */
  async toggleShippingCompanyStatus(id, isActive) {
    try {
      await query(`
        UPDATE shipping_companies 
        SET is_active = ?, updated_at = NOW()
        WHERE id = ?
      `, [isActive, id]);
      
      return true;
    } catch (error) {
      console.error('Error actualizando estado de transportadora:', error);
      throw error;
    }
  }

  /**
   * Actualizar URL de tracking de transportadora (solo admin)
   */
  async updateTrackingUrl(id, trackingUrl) {
    try {
      await query(`
        UPDATE shipping_companies 
        SET website_tracking_url = ?, updated_at = NOW()
        WHERE id = ?
      `, [trackingUrl, id]);
      
      return true;
    } catch (error) {
      console.error('Error actualizando URL de tracking:', error);
      throw error;
    }
  }
}

// Instancia singleton
const shippingService = new ShippingService();

module.exports = shippingService;
