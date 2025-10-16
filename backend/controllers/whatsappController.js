const whatsappService = require('../services/whatsappService');
const { query } = require('../config/database');

/**
 * Obtener estado de conexión con Wapify
 */
const getConnectionStatus = async (req, res) => {
  try {
    const status = await whatsappService.checkConnection();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error obteniendo estado de conexión WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estado de conexión',
      error: error.message
    });
  }
};

/**
 * Obtener estadísticas de WhatsApp
 */
const getWhatsAppStats = async (req, res) => {
  try {
    const stats = await whatsappService.getWhatsAppStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
};

/**
 * Obtener logs de notificaciones WhatsApp
 */
const getNotificationLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, message_type, phone_number } = req.query;
    const offset = (page - 1) * limit;
    
    // Construir filtros
    let whereConditions = [];
    let queryParams = [];
    
    if (status) {
      whereConditions.push('wn.status = ?');
      queryParams.push(status);
    }
    
    if (message_type) {
      whereConditions.push('wn.message_type = ?');
      queryParams.push(message_type);
    }
    
    if (phone_number) {
      whereConditions.push('wn.phone_number LIKE ?');
      queryParams.push(`%${phone_number}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Obtener logs con información del pedido
    const logs = await query(`
      SELECT 
        wn.*,
        o.order_number,
        o.customer_name,
        o.siigo_invoice_number
      FROM whatsapp_notifications wn
      LEFT JOIN orders o ON wn.order_id = o.id
      ${whereClause}
      ORDER BY wn.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);
    
    // Contar total para paginación
    const totalResult = await query(`
      SELECT COUNT(*) as total
      FROM whatsapp_notifications wn
      LEFT JOIN orders o ON wn.order_id = o.id
      ${whereClause}
    `, queryParams);
    
    const total = totalResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_records: total,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo logs de WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo logs',
      error: error.message
    });
  }
};

/**
 * Enviar mensaje de prueba
 */
const sendTestMessage = async (req, res) => {
  try {
    const { phone_number, message } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Número de teléfono es requerido'
      });
    }
    
    const result = await whatsappService.sendTestMessage(phone_number, message);
    
    res.json({
      success: true,
      message: 'Mensaje de prueba enviado exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error enviando mensaje de prueba:', error);
    res.status(500).json({
      success: false,
      message: 'Error enviando mensaje de prueba',
      error: error.message
    });
  }
};

/**
 * Reintentar notificación fallida
 */
const retryNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // Obtener datos de la notificación
    const notificationResult = await query(`
      SELECT wn.*, o.customer_phone, o.order_number, o.siigo_invoice_number
      FROM whatsapp_notifications wn
      LEFT JOIN orders o ON wn.order_id = o.id
      WHERE wn.id = ?
    `, [notificationId]);
    
    if (notificationResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }
    
    const notification = notificationResult[0];
    
    // Solo reintentar si está fallida
    if (notification.status !== 'fallido') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden reintentar notificaciones fallidas'
      });
    }
    
    // Reintentar envío
    let result;
    if (notification.image_url) {
      result = await whatsappService.sendImageWithRetry(
        notification.phone_number,
        notification.image_url,
        notification.message_content,
        notificationId
      );
    } else {
      result = await whatsappService.sendWithRetry(
        notification.phone_number,
        notification.message_content,
        notificationId
      );
    }
    
    res.json({
      success: true,
      message: 'Notificación reenviada exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error reintentando notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error reintentando notificación',
      error: error.message
    });
  }
};

/**
 * Enviar notificación manual para un pedido
 */
const sendOrderNotification = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notification_type, messenger_data, shipping_data, delivery_data, image_url } = req.body;
    
    if (!notification_type) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de notificación es requerido'
      });
    }
    
    let result;
    
    switch (notification_type) {
      case 'pedido_en_ruta':
        if (!messenger_data) {
          return res.status(400).json({
            success: false,
            message: 'Datos del mensajero son requeridos'
          });
        }
        result = await whatsappService.sendPedidoEnRutaNotification(orderId, messenger_data);
        break;
        
      case 'guia_envio':
        if (!shipping_data) {
          return res.status(400).json({
            success: false,
            message: 'Datos de envío son requeridos'
          });
        }
        result = await whatsappService.sendGuiaEnvioNotification(orderId, shipping_data, image_url);
        break;
        
      case 'pedido_entregado':
        if (!delivery_data) {
          return res.status(400).json({
            success: false,
            message: 'Datos de entrega son requeridos'
          });
        }
        result = await whatsappService.sendPedidoEntregadoNotification(orderId, delivery_data);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de notificación no válido'
        });
    }
    
    res.json({
      success: true,
      message: 'Notificación enviada exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error enviando notificación de pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error enviando notificación',
      error: error.message
    });
  }
};

/**
 * Actualizar estado de mensaje (webhook desde Wapify)
 */
const updateMessageStatus = async (req, res) => {
  try {
    const { message_id, status, delivered, read, timestamp } = req.body;
    
    if (!message_id) {
      return res.status(400).json({
        success: false,
        message: 'ID del mensaje es requerido'
      });
    }
    
    // Buscar notificación por wapify_message_id
    const notificationResult = await query(`
      SELECT id FROM whatsapp_notifications 
      WHERE wapify_message_id = ?
    `, [message_id]);
    
    if (notificationResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }
    
    const notificationId = notificationResult[0].id;
    
    // Determinar nuevo estado
    let newStatus = 'enviado';
    if (delivered) {
      newStatus = 'entregado';
    }
    
    // Actualizar estado
    await whatsappService.updateNotificationStatus(notificationId, newStatus);
    
    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando estado del mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando estado',
      error: error.message
    });
  }
};

/**
 * Obtener configuración de templates
 */
const getMessageTemplates = async (req, res) => {
  try {
    // Templates por defecto (podrían venir de base de datos en el futuro)
    const templates = {
      pedido_en_ruta: {
        name: 'Pedido en Ruta',
        description: 'Notificación cuando el pedido sale para entrega',
        variables: ['customer_name', 'order_number', 'messenger_name', 'messenger_phone', 'total_amount', 'customer_address', 'company_name'],
        template: whatsappService.generatePedidoEnRutaMessage({
          customer_name: '{customer_name}',
          siigo_invoice_number: '{invoice_number}',
          order_number: '{order_number}',
          total_amount: 50000,
          customer_address: '{customer_address}'
        }, {
          full_name: '{messenger_name}',
          phone: '{messenger_phone}'
        })
      },
      guia_envio: {
        name: 'Guía de Envío',
        description: 'Notificación con información de rastreo',
        variables: ['order_number', 'shipping_company', 'guide_number', 'tracking_url'],
        template: whatsappService.generateGuiaEnvioMessage({
          siigo_invoice_number: '{invoice_number}',
          order_number: '{order_number}'
        }, {
          shipping_company: '{shipping_company}',
          guide_number: '{guide_number}',
          tracking_url: '{tracking_url}'
        })
      },
      pedido_entregado: {
        name: 'Pedido Entregado',
        description: 'Confirmación de entrega exitosa',
        variables: ['order_number', 'amount_collected', 'shipping_date'],
        template: whatsappService.generatePedidoEntregadoMessage({
          siigo_invoice_number: '{invoice_number}',
          order_number: '{order_number}'
        }, {
          amount_collected: 50000
        })
      }
    };
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error obteniendo templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo templates',
      error: error.message
    });
  }
};

module.exports = {
  getConnectionStatus,
  getWhatsAppStats,
  getNotificationLogs,
  sendTestMessage,
  retryNotification,
  sendOrderNotification,
  updateMessageStatus,
  getMessageTemplates
};
