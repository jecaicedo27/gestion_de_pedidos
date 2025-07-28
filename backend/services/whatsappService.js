const axios = require('axios');
const { query } = require('../config/database');

class WhatsAppService {
  constructor() {
    this.enabled = process.env.WHATSAPP_ENABLED === 'true';
    this.apiToken = process.env.WAPIFY_API_TOKEN;
    this.baseURL = process.env.WAPIFY_API_BASE_URL;
    this.businessNumber = process.env.WHATSAPP_BUSINESS_NUMBER;
    this.retryAttempts = parseInt(process.env.WHATSAPP_RETRY_ATTEMPTS) || 3;
    this.retryDelayMinutes = parseInt(process.env.WHATSAPP_RETRY_DELAY_MINUTES) || 5;
    this.companyName = process.env.COMPANY_NAME || 'Mi Empresa';
    
    // Configurar axios instance
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Formatear número de teléfono a formato colombiano +57XXXXXXXXX
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remover espacios, guiones y caracteres especiales
    let cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Si empieza con +57, mantenerlo
    if (cleanPhone.startsWith('+57')) {
      return cleanPhone;
    }
    
    // Si empieza con 57, agregar +
    if (cleanPhone.startsWith('57') && cleanPhone.length === 12) {
      return '+' + cleanPhone;
    }
    
    // Si es número de 10 dígitos (formato local), agregar +57
    if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
      return '+57' + cleanPhone;
    }
    
    // Si es número de 7 dígitos (fijo), agregar código de área por defecto
    if (cleanPhone.length === 7) {
      return '+574' + cleanPhone; // Medellín por defecto
    }
    
    console.warn(`⚠️  Formato de teléfono no reconocido: ${phone}`);
    return cleanPhone.startsWith('+') ? cleanPhone : '+57' + cleanPhone;
  }

  /**
   * Enviar mensaje de texto
   */
  async sendTextMessage(phoneNumber, message, orderId = null) {
    if (!this.enabled) {
      console.log('📱 WhatsApp deshabilitado, mensaje no enviado');
      return { success: false, message: 'WhatsApp deshabilitado' };
    }

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      throw new Error('Número de teléfono inválido');
    }

    try {
      console.log(`📱 Enviando mensaje WhatsApp a ${formattedPhone}`);
      
      const response = await this.api.post('/send-message', {
        phone: formattedPhone,
        message: message,
        type: 'text'
      });

      if (response.data && response.data.success) {
        console.log('✅ Mensaje WhatsApp enviado exitosamente');
        
        return {
          success: true,
          messageId: response.data.messageId || response.data.id,
          data: response.data
        };
      } else {
        throw new Error(response.data?.message || 'Error desconocido enviando mensaje');
      }
      
    } catch (error) {
      console.error('❌ Error enviando mensaje WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Enviar imagen con caption
   */
  async sendImageMessage(phoneNumber, imageUrl, caption, orderId = null) {
    if (!this.enabled) {
      console.log('📱 WhatsApp deshabilitado, imagen no enviada');
      return { success: false, message: 'WhatsApp deshabilitado' };
    }

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      throw new Error('Número de teléfono inválido');
    }

    try {
      console.log(`📱 Enviando imagen WhatsApp a ${formattedPhone}`);
      
      const response = await this.api.post('/send-message', {
        phone: formattedPhone,
        message: caption,
        type: 'image',
        media_url: imageUrl
      });

      if (response.data && response.data.success) {
        console.log('✅ Imagen WhatsApp enviada exitosamente');
        
        return {
          success: true,
          messageId: response.data.messageId || response.data.id,
          data: response.data
        };
      } else {
        throw new Error(response.data?.message || 'Error desconocido enviando imagen');
      }
      
    } catch (error) {
      console.error('❌ Error enviando imagen WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Consultar estado del mensaje
   */
  async getMessageStatus(messageId) {
    if (!this.enabled || !messageId) {
      return { status: 'unknown' };
    }

    try {
      const response = await this.api.get(`/message-status/${messageId}`);
      
      if (response.data) {
        return {
          status: response.data.status,
          delivered: response.data.delivered,
          read: response.data.read,
          timestamp: response.data.timestamp
        };
      }
      
      return { status: 'unknown' };
    } catch (error) {
      console.error('❌ Error consultando estado del mensaje:', error.message);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Registrar notificación en base de datos
   */
  async logNotification(orderId, phoneNumber, messageType, messageContent, imageUrl = null, wapifyMessageId = null, status = 'pendiente', errorMessage = null) {
    try {
      const result = await query(`
        INSERT INTO whatsapp_notifications 
        (order_id, phone_number, message_type, message_content, image_url, wapify_message_id, status, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [orderId, phoneNumber, messageType, messageContent, imageUrl, wapifyMessageId, status, errorMessage]);
      
      return result.insertId;
    } catch (error) {
      console.error('❌ Error guardando log de WhatsApp:', error.message);
      throw error;
    }
  }

  /**
   * Actualizar estado de notificación
   */
  async updateNotificationStatus(notificationId, status, wapifyMessageId = null, errorMessage = null) {
    try {
      const updateFields = ['status = ?'];
      const values = [status];
      
      if (wapifyMessageId) {
        updateFields.push('wapify_message_id = ?');
        values.push(wapifyMessageId);
      }
      
      if (status === 'enviado') {
        updateFields.push('sent_at = NOW()');
      } else if (status === 'entregado') {
        updateFields.push('delivered_at = NOW()');
      }
      
      if (errorMessage) {
        updateFields.push('error_message = ?');
        values.push(errorMessage);
      }
      
      values.push(notificationId);
      
      await query(`
        UPDATE whatsapp_notifications 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
      
    } catch (error) {
      console.error('❌ Error actualizando estado de notificación:', error.message);
    }
  }

  /**
   * Generar mensaje "Pedido en Ruta"
   */
  generatePedidoEnRutaMessage(orderData, messengerData) {
    const estimatedTime = 30; // Tiempo estimado por defecto
    
    return `🚚 ¡Hola ${orderData.customer_name}!
Tu pedido #${orderData.siigo_invoice_number || orderData.order_number} ya está en camino.

📦 Detalles:
• Mensajero: ${messengerData.full_name}
• Teléfono: ${messengerData.phone}
• Valor: $${orderData.total_amount.toLocaleString('es-CO')}
• Dirección: ${orderData.customer_address}

⏰ Tiempo estimado: ${estimatedTime} minutos

¡Gracias por confiar en ${this.companyName}! 🍦`;
  }

  /**
   * Generar mensaje "Guía de Envío"
   */
  generateGuiaEnvioMessage(orderData, shippingData) {
    return `📦 ¡Tu pedido está en tránsito!

Pedido: #${orderData.siigo_invoice_number || orderData.order_number}
Transportadora: ${shippingData.shipping_company}
Número de Guía: ${shippingData.guide_number}

Puedes rastrear tu pedido en:
🔗 ${shippingData.tracking_url}

¡Te llegará muy pronto! 🍦`;
  }

  /**
   * Generar mensaje "Entrega Confirmada"
   */
  generatePedidoEntregadoMessage(orderData, deliveryData) {
    const deliveryDate = new Date().toLocaleDateString('es-CO');
    
    return `✅ ¡Entregado con éxito!

Tu pedido #${orderData.siigo_invoice_number || orderData.order_number} ha sido entregado.

💰 Monto cobrado: $${deliveryData.amount_collected.toLocaleString('es-CO')}
📅 Fecha: ${deliveryDate}

¡Esperamos que disfrutes tus productos! 🍦

¿Cómo calificarías nuestro servicio?
⭐ ⭐ ⭐ ⭐ ⭐`;
  }

  /**
   * Enviar notificación "Pedido en Ruta"
   */
  async sendPedidoEnRutaNotification(orderId, messengerData) {
    try {
      // Obtener datos del pedido
      const orderResult = await query(`
        SELECT o.*, u.full_name as created_by_name
        FROM orders o
        LEFT JOIN users u ON o.created_by = u.id
        WHERE o.id = ?
      `, [orderId]);
      
      if (orderResult.length === 0) {
        throw new Error('Pedido no encontrado');
      }
      
      const orderData = orderResult[0];
      const message = this.generatePedidoEnRutaMessage(orderData, messengerData);
      
      // Registrar en base de datos
      const notificationId = await this.logNotification(
        orderId,
        orderData.customer_phone,
        'pedido_en_ruta',
        message
      );
      
      // Enviar mensaje con reintentos
      const result = await this.sendWithRetry(
        orderData.customer_phone,
        message,
        notificationId
      );
      
      return result;
      
    } catch (error) {
      console.error('❌ Error enviando notificación pedido en ruta:', error.message);
      throw error;
    }
  }

  /**
   * Enviar notificación "Guía de Envío"
   */
  async sendGuiaEnvioNotification(orderId, shippingData, imageUrl = null) {
    try {
      // Obtener datos del pedido
      const orderResult = await query(`
        SELECT * FROM orders WHERE id = ?
      `, [orderId]);
      
      if (orderResult.length === 0) {
        throw new Error('Pedido no encontrado');
      }
      
      const orderData = orderResult[0];
      const message = this.generateGuiaEnvioMessage(orderData, shippingData);
      
      // Registrar en base de datos
      const notificationId = await this.logNotification(
        orderId,
        orderData.customer_phone,
        'guia_envio',
        message,
        imageUrl
      );
      
      // Enviar mensaje (con imagen si está disponible)
      let result;
      if (imageUrl) {
        result = await this.sendImageWithRetry(
          orderData.customer_phone,
          imageUrl,
          message,
          notificationId
        );
      } else {
        result = await this.sendWithRetry(
          orderData.customer_phone,
          message,
          notificationId
        );
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error enviando notificación guía de envío:', error.message);
      throw error;
    }
  }

  /**
   * Enviar notificación "Pedido Entregado"
   */
  async sendPedidoEntregadoNotification(orderId, deliveryData) {
    try {
      // Obtener datos del pedido
      const orderResult = await query(`
        SELECT * FROM orders WHERE id = ?
      `, [orderId]);
      
      if (orderResult.length === 0) {
        throw new Error('Pedido no encontrado');
      }
      
      const orderData = orderResult[0];
      const message = this.generatePedidoEntregadoMessage(orderData, deliveryData);
      
      // Registrar en base de datos
      const notificationId = await this.logNotification(
        orderId,
        orderData.customer_phone,
        'pedido_entregado',
        message
      );
      
      // Enviar mensaje con reintentos
      const result = await this.sendWithRetry(
        orderData.customer_phone,
        message,
        notificationId
      );
      
      return result;
      
    } catch (error) {
      console.error('❌ Error enviando notificación pedido entregado:', error.message);
      throw error;
    }
  }

  /**
   * Enviar mensaje con reintentos automáticos
   */
  async sendWithRetry(phoneNumber, message, notificationId, attempt = 1) {
    try {
      const result = await this.sendTextMessage(phoneNumber, message);
      
      if (result.success) {
        await this.updateNotificationStatus(notificationId, 'enviado', result.messageId);
        return result;
      } else {
        throw new Error(result.message);
      }
      
    } catch (error) {
      console.error(`❌ Intento ${attempt} fallido:`, error.message);
      
      if (attempt < this.retryAttempts) {
        console.log(`🔄 Reintentando en ${this.retryDelayMinutes} minutos...`);
        
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMinutes * 60 * 1000));
        
        return this.sendWithRetry(phoneNumber, message, notificationId, attempt + 1);
      } else {
        // Todos los intentos fallaron
        await this.updateNotificationStatus(notificationId, 'fallido', null, error.message);
        throw error;
      }
    }
  }

  /**
   * Enviar imagen con reintentos automáticos
   */
  async sendImageWithRetry(phoneNumber, imageUrl, caption, notificationId, attempt = 1) {
    try {
      const result = await this.sendImageMessage(phoneNumber, imageUrl, caption);
      
      if (result.success) {
        await this.updateNotificationStatus(notificationId, 'enviado', result.messageId);
        return result;
      } else {
        throw new Error(result.message);
      }
      
    } catch (error) {
      console.error(`❌ Intento ${attempt} fallido (imagen):`, error.message);
      
      if (attempt < this.retryAttempts) {
        console.log(`🔄 Reintentando en ${this.retryDelayMinutes} minutos...`);
        
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMinutes * 60 * 1000));
        
        return this.sendImageWithRetry(phoneNumber, imageUrl, caption, notificationId, attempt + 1);
      } else {
        // Todos los intentos fallaron
        await this.updateNotificationStatus(notificationId, 'fallido', null, error.message);
        throw error;
      }
    }
  }

  /**
   * Enviar mensaje de prueba
   */
  async sendTestMessage(phoneNumber, customMessage = null) {
    const message = customMessage || `🧪 Mensaje de prueba desde ${this.companyName}

Este es un mensaje de prueba para verificar que la integración con WhatsApp está funcionando correctamente.

📱 Sistema de Gestión de Pedidos
⏰ ${new Date().toLocaleString('es-CO')}

¡Todo funciona perfectamente! ✅`;

    try {
      // Crear registro de prueba (sin order_id)
      const notificationId = await this.logNotification(
        null, // No hay pedido asociado
        phoneNumber,
        'test',
        message
      );
      
      const result = await this.sendWithRetry(phoneNumber, message, notificationId);
      return result;
      
    } catch (error) {
      console.error('❌ Error enviando mensaje de prueba:', error.message);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de WhatsApp
   */
  async getWhatsAppStats() {
    try {
      // Estadísticas generales
      const generalStats = await query(`
        SELECT 
          COUNT(*) as total_messages,
          SUM(CASE WHEN status = 'enviado' THEN 1 ELSE 0 END) as sent_messages,
          SUM(CASE WHEN status = 'entregado' THEN 1 ELSE 0 END) as delivered_messages,
          SUM(CASE WHEN status = 'fallido' THEN 1 ELSE 0 END) as failed_messages,
          SUM(CASE WHEN message_type = 'pedido_en_ruta' THEN 1 ELSE 0 END) as pedido_en_ruta,
          SUM(CASE WHEN message_type = 'guia_envio' THEN 1 ELSE 0 END) as guia_envio,
          SUM(CASE WHEN message_type = 'pedido_entregado' THEN 1 ELSE 0 END) as pedido_entregado,
          SUM(CASE WHEN message_type = 'test' THEN 1 ELSE 0 END) as test_messages
        FROM whatsapp_notifications
      `);
      
      // Estadísticas por día (últimos 7 días)
      const dailyStats = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'enviado' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'fallido' THEN 1 ELSE 0 END) as failed
        FROM whatsapp_notifications
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      
      // Errores recientes
      const recentErrors = await query(`
        SELECT 
          phone_number,
          message_type,
          error_message,
          created_at
        FROM whatsapp_notifications
        WHERE status = 'fallido'
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      return {
        general: generalStats[0],
        daily: dailyStats,
        recent_errors: recentErrors
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas WhatsApp:', error.message);
      throw error;
    }
  }

  /**
   * Verificar estado de conexión con Wapify
   */
  async checkConnection() {
    if (!this.enabled) {
      return {
        connected: false,
        error: 'WhatsApp deshabilitado en configuración'
      };
    }

    try {
      // Hacer una petición simple para verificar conectividad
      const response = await this.api.get('/profile');
      
      if (response.data) {
        return {
          connected: true,
          profile: response.data,
          business_number: this.businessNumber
        };
      }
      
      return {
        connected: false,
        error: 'Respuesta inválida del servidor'
      };
      
    } catch (error) {
      return {
        connected: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

// Instancia singleton
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
