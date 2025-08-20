const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subida de fotos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/delivery_evidence');
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'delivery-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Solo permitir imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Obtener pedidos asignados al mensajero
const getAssignedOrders = async (req, res) => {
  try {
    const messengerId = req.user.id;
    console.log('🚚 Obteniendo pedidos para mensajero ID:', messengerId);

    console.log('🔍 Intentando consulta a base de datos...');
    
    // Buscar pedidos que estén listos para entrega y asignados a mensajería urbana
    const orders = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.total_amount as total,
        o.status,
        o.delivery_method,
        o.created_at,
        o.shipping_date,
        o.notes,
        o.assigned_messenger_id,
        u.full_name as messenger_name,
        o.messenger_status
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE (
        (o.status = 'listo_para_entrega' AND o.delivery_method IN ('mensajeria_urbana', 'domicilio'))
        OR 
        (o.assigned_messenger_id = ? AND o.status IN ('en_reparto', 'listo_para_entrega'))
      )
      ORDER BY 
        CASE 
          WHEN o.assigned_messenger_id = ? THEN 1
          ELSE 2
        END,
        o.created_at DESC
    `, [messengerId, messengerId]);

    console.log(`📋 Query ejecutada exitosamente`);
    console.log(`📦 Encontrados ${orders.length} pedidos para el mensajero`);

    res.json({
      success: true,
      data: orders,
      message: `${orders.length} pedidos encontrados`
    });

  } catch (error) {
    console.error('❌ Error obteniendo pedidos asignados:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Aceptar un pedido asignado
const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const messengerId = req.user.id;

    // Verificar que el pedido esté asignado al mensajero
    const orderResult = await query(
      'SELECT id, messenger_status FROM orders WHERE id = ? AND assigned_messenger_id = ?',
      [orderId, messengerId]
    );

    if (!orderResult.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o no asignado a este mensajero'
      });
    }

    if (orderResult[0].messenger_status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'El pedido no está en estado "asignado"'
      });
    }

    // Actualizar estado del pedido
    await query(
      'UPDATE orders SET messenger_status = ? WHERE id = ?',
      ['accepted', orderId]
    );

    // Crear o actualizar registro de tracking
    const existingTracking = await query(
      'SELECT id FROM delivery_tracking WHERE order_id = ? AND messenger_id = ?',
      [orderId, messengerId]
    );

    if (existingTracking.length) {
      await query(
        'UPDATE delivery_tracking SET accepted_at = NOW() WHERE id = ?',
        [existingTracking[0].id]
      );
    } else {
      await query(
        `INSERT INTO delivery_tracking (order_id, messenger_id, assigned_at, accepted_at) 
         VALUES (?, ?, NOW(), NOW())`,
        [orderId, messengerId]
      );
    }

    res.json({
      success: true,
      message: 'Pedido aceptado exitosamente'
    });

  } catch (error) {
    console.error('Error aceptando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Rechazar un pedido asignado
const rejectOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const messengerId = req.user.id;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar una razón para rechazar el pedido'
      });
    }

    // Verificar que el pedido esté asignado al mensajero
    const orderResult = await query(
      'SELECT id, messenger_status FROM orders WHERE id = ? AND assigned_messenger_id = ?',
      [orderId, messengerId]
    );

    if (!orderResult.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o no asignado a este mensajero'
      });
    }

    if (orderResult[0].messenger_status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'El pedido no está en estado "asignado"'
      });
    }

    // Actualizar estado del pedido y liberar asignación
    await query(
      'UPDATE orders SET messenger_status = ?, assigned_messenger_id = NULL WHERE id = ?',
      ['returned_to_logistics', orderId]
    );

    // Crear o actualizar registro de tracking
    const existingTracking = await query(
      'SELECT id FROM delivery_tracking WHERE order_id = ? AND messenger_id = ?',
      [orderId, messengerId]
    );

    if (existingTracking.length) {
      await query(
        'UPDATE delivery_tracking SET rejected_at = NOW(), rejection_reason = ? WHERE id = ?',
        [reason, existingTracking[0].id]
      );
    } else {
      await query(
        `INSERT INTO delivery_tracking (order_id, messenger_id, assigned_at, rejected_at, rejection_reason) 
         VALUES (?, ?, NOW(), NOW(), ?)`,
        [orderId, messengerId, reason]
      );
    }

    res.json({
      success: true,
      message: 'Pedido rechazado y devuelto a logística'
    });

  } catch (error) {
    console.error('Error rechazando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Iniciar entrega
const startDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const messengerId = req.user.id;

    // Verificar que el pedido esté aceptado por el mensajero
    const orderResult = await query(
      'SELECT id, messenger_status FROM orders WHERE id = ? AND assigned_messenger_id = ?',
      [orderId, messengerId]
    );

    if (!orderResult.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o no asignado a este mensajero'
      });
    }

    if (orderResult[0].messenger_status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe estar aceptado para iniciar entrega'
      });
    }

    // Actualizar estado del pedido
    await query(
      'UPDATE orders SET messenger_status = ? WHERE id = ?',
      ['in_delivery', orderId]
    );

    // Actualizar registro de tracking
    await query(
      'UPDATE delivery_tracking SET started_delivery_at = NOW() WHERE order_id = ? AND messenger_id = ?',
      [orderId, messengerId]
    );

    res.json({
      success: true,
      message: 'Entrega iniciada exitosamente'
    });

  } catch (error) {
    console.error('Error iniciando entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Marcar pedido como entregado
const completeDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { 
      paymentCollected, 
      deliveryFeeCollected, 
      paymentMethod, 
      deliveryNotes,
      latitude,
      longitude 
    } = req.body;
    const messengerId = req.user.id;

    // Verificar que el pedido esté en entrega
    const orderResult = await query(
      'SELECT id, messenger_status, requires_payment, payment_amount, delivery_fee FROM orders WHERE id = ? AND assigned_messenger_id = ?',
      [orderId, messengerId]
    );

    if (!orderResult.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o no asignado a este mensajero'
      });
    }

    if (orderResult[0].messenger_status !== 'in_delivery') {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe estar en entrega para completarlo'
      });
    }

    const order = orderResult[0];

    // Validar montos si requiere pago
    if (order.requires_payment && (!paymentCollected || paymentCollected <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Este pedido requiere recolección de dinero'
      });
    }

    // Actualizar estado del pedido
    await query(
      'UPDATE orders SET messenger_status = ?, status = ? WHERE id = ?',
      ['delivered', 'entregado', orderId]
    );

    // Actualizar registro de tracking
    await query(
      `UPDATE delivery_tracking SET 
         delivered_at = NOW(),
         payment_collected = ?,
         delivery_fee_collected = ?,
         payment_method = ?,
         delivery_notes = ?,
         delivery_latitude = ?,
         delivery_longitude = ?
       WHERE order_id = ? AND messenger_id = ?`,
      [
        paymentCollected || 0,
        deliveryFeeCollected || 0,
        paymentMethod || null,
        deliveryNotes || null,
        latitude || null,
        longitude || null,
        orderId,
        messengerId
      ]
    );

    res.json({
      success: true,
      message: 'Pedido entregado exitosamente'
    });

  } catch (error) {
    console.error('Error completando entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Marcar pedido como entrega fallida
const markDeliveryFailed = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const messengerId = req.user.id;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar una razón para la entrega fallida'
      });
    }

    // Verificar que el pedido esté en entrega
    const orderResult = await query(
      'SELECT id, messenger_status, delivery_attempts FROM orders WHERE id = ? AND assigned_messenger_id = ?',
      [orderId, messengerId]
    );

    if (!orderResult.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o no asignado a este mensajero'
      });
    }

    if (orderResult[0].messenger_status !== 'in_delivery') {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe estar en entrega para marcarlo como fallido'
      });
    }

    // Incrementar intentos de entrega
    const newAttempts = (orderResult[0].delivery_attempts || 0) + 1;

    // Actualizar estado del pedido
    await query(
      'UPDATE orders SET messenger_status = ?, delivery_attempts = ? WHERE id = ?',
      ['delivery_failed', newAttempts, orderId]
    );

    // Actualizar registro de tracking
    await query(
      `UPDATE delivery_tracking SET 
         failed_at = NOW(),
         failure_reason = ?
       WHERE order_id = ? AND messenger_id = ?`,
      [reason, orderId, messengerId]
    );

    res.json({
      success: true,
      message: 'Entrega marcada como fallida',
      deliveryAttempts: newAttempts
    });

  } catch (error) {
    console.error('Error marcando entrega fallida:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Subir evidencia fotográfica
const uploadEvidence = async (req, res) => {
  try {
    const { orderId } = req.params;
    const messengerId = req.user.id;
    const { description } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó archivo de imagen'
      });
    }

    // Verificar que el mensajero tenga acceso a este pedido
    const orderResult = await query(
      'SELECT id FROM orders WHERE id = ? AND assigned_messenger_id = ?',
      [orderId, messengerId]
    );

    if (!orderResult.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o no asignado a este mensajero'
      });
    }

    // Obtener o crear tracking
    let trackingResult = await query(
      'SELECT id FROM delivery_tracking WHERE order_id = ? AND messenger_id = ?',
      [orderId, messengerId]
    );

    let trackingId;
    if (!trackingResult.length) {
      const newTracking = await query(
        'INSERT INTO delivery_tracking (order_id, messenger_id, assigned_at) VALUES (?, ?, NOW())',
        [orderId, messengerId]
      );
      trackingId = newTracking.insertId;
    } else {
      trackingId = trackingResult[0].id;
    }

    // Guardar evidencia
    const result = await query(
      `INSERT INTO delivery_evidence 
       (delivery_tracking_id, order_id, messenger_id, photo_filename, photo_path, photo_size, photo_type, description, taken_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        trackingId,
        orderId,
        messengerId,
        req.file.filename,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        description || null
      ]
    );

    res.json({
      success: true,
      message: 'Evidencia subida exitosamente',
      data: {
        evidenceId: result.insertId,
        filename: req.file.filename,
        path: `/uploads/delivery_evidence/${req.file.filename}`
      }
    });

  } catch (error) {
    console.error('Error subiendo evidencia:', error);
    
    // Eliminar archivo si hubo error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener resumen diario del mensajero
const getDailySummary = async (req, res) => {
  try {
    const messengerId = req.user.id;
    const { date } = req.query;
    
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Obtener estadísticas del día
    const summary = await query(`
      SELECT 
        COUNT(*) as total_assigned,
        SUM(CASE WHEN o.messenger_status = 'delivered' THEN 1 ELSE 0 END) as total_delivered,
        SUM(CASE WHEN o.messenger_status = 'delivery_failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(CASE WHEN o.messenger_status IN ('assigned', 'accepted', 'in_delivery') THEN 1 ELSE 0 END) as total_pending,
        SUM(CASE WHEN o.messenger_status = 'delivered' THEN dt.payment_collected ELSE 0 END) as total_payment_collected,
        SUM(CASE WHEN o.messenger_status = 'delivered' THEN dt.delivery_fee_collected ELSE 0 END) as total_delivery_fees
      FROM orders o
      LEFT JOIN delivery_tracking dt ON o.id = dt.order_id AND dt.messenger_id = ?
      WHERE o.assigned_messenger_id = ? 
        AND DATE(o.created_at) = ?
    `, [messengerId, messengerId, dateStr]);

    // Obtener pedidos recientes
    const recentOrders = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.client_name,
        o.messenger_status,
        o.total_amount,
        dt.delivered_at,
        dt.failed_at,
        dt.payment_collected
      FROM orders o
      LEFT JOIN delivery_tracking dt ON o.id = dt.order_id AND dt.messenger_id = ?
      WHERE o.assigned_messenger_id = ? 
        AND DATE(o.created_at) = ?
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [messengerId, messengerId, dateStr]);

    res.json({
      success: true,
      data: {
        date: dateStr,
        summary: summary[0] || {
          total_assigned: 0,
          total_delivered: 0,
          total_failed: 0,
          total_pending: 0,
          total_payment_collected: 0,
          total_delivery_fees: 0
        },
        recent_orders: recentOrders
      }
    });

  } catch (error) {
    console.error('Error obteniendo resumen diario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getAssignedOrders,
  acceptOrder,
  rejectOrder,
  startDelivery,
  completeDelivery,
  markDeliveryFailed,
  uploadEvidence,
  getDailySummary,
  upload // Middleware de multer para subir archivos
};
