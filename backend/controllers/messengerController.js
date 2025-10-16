const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const configService = require('../services/configService');

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
        o.requires_payment,
        o.payment_amount,
        o.payment_method,
        o.shipping_payment_method,
        o.delivery_fee_exempt,
        o.delivery_fee,
        o.siigo_balance,
        o.status,
        o.delivery_method,
        o.created_at,
        o.shipping_date,
        o.notes,
        o.assigned_messenger_id,
        u.full_name as messenger_name,
        o.messenger_status,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE (
        (o.status = 'listo_para_entrega' AND o.delivery_method IN ('mensajeria_urbana', 'domicilio', 'mensajeria_local'))
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

    // Calcular regla de cobro de domicilio para cada pedido (local < umbral y no exento y flete 'contraentrega')
    const localThreshold = await configService.getConfig('local_delivery_threshold', 150000);
    const localMethods = ['domicilio', 'domicilio_ciudad', 'mensajeria_urbana', 'mensajeria_local'];

    const enriched = orders.map(o => {
      const method = (o.delivery_method || '').toLowerCase();
      const shippingPay = (o.shipping_payment_method || '').toLowerCase();
      const isLocal = localMethods.includes(method);
      const underThreshold = Number(o.total || 0) < Number(localThreshold || 0);
      const exempt = o.delivery_fee_exempt === 1 || o.delivery_fee_exempt === true;
      const shouldCollectDeliveryFee = isLocal && underThreshold && shippingPay === 'contraentrega' && !exempt;

      // Derivar obligación de cobro de PRODUCTO desde facturación (fuente de verdad adicional)
      // Si facturación marcó 'efectivo' o 'contraentrega' para el producto, el mensajero debe cobrar
      const productPayMethod = (o.payment_method || '').toLowerCase();
      const baseRequiresPayment = o.requires_payment === 1 || o.requires_payment === true || o.requires_payment === '1';
      const derivedRequiresPayment =
        ['efectivo', 'contraentrega', 'cash', 'contra-entrega'].includes(productPayMethod) ||
        Number(o.siigo_balance || 0) > 0;
      const requiresPayment = baseRequiresPayment || derivedRequiresPayment;

      // Asegurar payment_amount consistente si se debe cobrar el producto
      // Si payment_amount viene 0 o nulo, usar siigo_balance o total/total_amount como respaldo
      let paymentAmount = requiresPayment ? Number(o.payment_amount) : 0;
      if (requiresPayment && (!paymentAmount || paymentAmount <= 0)) {
        const totalCandidate = (o.siigo_balance ?? o.total ?? o.total_amount ?? 0);
        paymentAmount = Number(totalCandidate) || 0;
      }

      // Si no viene método de pago pero se debe cobrar, exponer 'contraentrega' como método efectivo para UI
      const effectivePaymentMethod =
        (o.payment_method && String(o.payment_method).trim() !== '')
          ? o.payment_method
          : (requiresPayment ? 'contraentrega' : null);

      return {
        ...o,
        payment_method: effectivePaymentMethod,
        requires_payment: requiresPayment ? 1 : 0,
        payment_amount: paymentAmount,
        should_collect_delivery_fee: shouldCollectDeliveryFee,
        local_delivery_threshold: Number(localThreshold || 0)
      };
    });

    res.json({
      success: true,
      data: enriched,
      message: `${enriched.length} pedidos encontrados`
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
      deliveryFeePaymentMethod,
      deliveryNotes,
      latitude,
      longitude 
    } = req.body;
  const messengerId = req.user.id;

    // Verificar que el pedido esté en entrega
    const orderResult = await query(
      'SELECT id, messenger_status, requires_payment, payment_amount, payment_method, delivery_fee, delivery_method, shipping_payment_method, total_amount, delivery_fee_exempt FROM orders WHERE id = ? AND assigned_messenger_id = ?',
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

    // Validar montos si requiere pago (permitir transferencia sin efectivo)
    const productPayMethod = (paymentMethod || '').toLowerCase();
    // Enforce billing-mandated cash for product: cannot override to transferencia at delivery time
    if (order.requires_payment && (order.payment_method || '').toLowerCase() === 'efectivo' && productPayMethod === 'transferencia') {
      return res.status(400).json({
        success: false,
        message: 'El método de pago del producto está definido como efectivo por facturación; no puede cambiarse a transferencia en la entrega'
      });
    }
    if (order.requires_payment && productPayMethod !== 'transferencia' && (!paymentCollected || paymentCollected <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Este pedido requiere recolección de dinero (o marcar transferencia como método de pago)'
      });
    }

    // Validar cobro de domicilio según reglas locales
    const localThreshold = await configService.getConfig('local_delivery_threshold', 150000);
    const localMethods = ['domicilio', 'domicilio_ciudad', 'mensajeria_urbana', 'mensajeria_local'];
    const isLocal = localMethods.includes((order.delivery_method || '').toLowerCase());
    const shippingPay = (order.shipping_payment_method || '').toLowerCase();
    const underThreshold = Number(order.total_amount || 0) < Number(localThreshold || 0);
    const exempt = order.delivery_fee_exempt === 1 || order.delivery_fee_exempt === true;

    if (isLocal && shippingPay === 'contraentrega' && underThreshold && !exempt) {
      const feePayMethod = (deliveryFeePaymentMethod || '').toLowerCase();
      if (feePayMethod !== 'transferencia' && (!deliveryFeeCollected || Number(deliveryFeeCollected) <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'Debe registrar el cobro del domicilio (efectivo o marcar transferencia)'
        });
      }
    }

    // Reflejar método de pago actualizado en orders (si fue proporcionado)
    if (productPayMethod) {
      try {
        await query('UPDATE orders SET payment_method = ? WHERE id = ?', [productPayMethod, orderId]);
      } catch (e) {
        console.warn('No se pudo actualizar payment_method en orders:', e.message);
      }
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
         delivery_fee_payment_method = ?,
         delivery_notes = ?,
         delivery_latitude = ?,
         delivery_longitude = ?
       WHERE order_id = ? AND messenger_id = ?`,
      [
        paymentCollected || 0,
        deliveryFeeCollected || 0,
        paymentMethod || null,
        deliveryFeePaymentMethod || null,
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
       (delivery_tracking_id, order_id, messenger_id, photo_filename, photo_path, photo_size, photo_type, description, taken_at, evidence_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        trackingId,
        orderId,
        messengerId,
        req.file.filename,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        description || null,
        'photo'
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
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn('No se pudo eliminar archivo temporal:', e.message);
      }
    }

    // Exponer mensaje de error para diagnóstico (dev)
    // Mapear a 400 para errores de validación/referencias y evitar 500 genérico
    const status = 400;
    return res.status(status).json({
      success: false,
      message: error?.message || 'Error al subir evidencia'
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

/**
 * Resumen de dinero recaudado por el mensajero en un rango de fechas
 * GET /api/messenger/cash-summary?from=ISO&to=ISO
 */
const getCashSummary = async (req, res) => {
  try {
    const messengerId = req.user.id;
    const { from, to } = req.query;

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const rangeStart = from ? new Date(from) : startOfDay;
    const rangeEnd = to ? new Date(to) : now;

    const formatLocal = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const fromStr = formatLocal(rangeStart);
    const toStr = formatLocal(rangeEnd);

    // Totales del rango
    const totals = await query(
      `
      SELECT 
        COUNT(*) AS delivered_count,
        COALESCE(SUM(dt.payment_collected), 0) AS total_payment_collected,
        COALESCE(SUM(dt.delivery_fee_collected), 0) AS total_delivery_fees
      FROM orders o
      JOIN delivery_tracking dt 
        ON o.id = dt.order_id AND dt.messenger_id = ?
      WHERE o.assigned_messenger_id = ?
        AND o.messenger_status = 'delivered'
        AND dt.delivered_at IS NOT NULL
        AND dt.delivered_at BETWEEN ? AND ?
      `,
      [messengerId, messengerId, fromStr, toStr]
    );

    // Desglose por día
    const breakdown = await query(
      `
      SELECT 
        DATE(dt.delivered_at) AS date,
        COUNT(*) AS delivered_count,
        COALESCE(SUM(dt.payment_collected), 0) AS total_payment_collected,
        COALESCE(SUM(dt.delivery_fee_collected), 0) AS total_delivery_fees
      FROM orders o
      JOIN delivery_tracking dt 
        ON o.id = dt.order_id AND dt.messenger_id = ?
      WHERE o.assigned_messenger_id = ?
        AND o.messenger_status = 'delivered'
        AND dt.delivered_at IS NOT NULL
        AND dt.delivered_at BETWEEN ? AND ?
      GROUP BY DATE(dt.delivered_at)
      ORDER BY date DESC
      `,
      [messengerId, messengerId, fromStr, toStr]
    );

    res.json({
      success: true,
      data: {
        range: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
        totals: totals[0] || {
          delivered_count: 0,
          total_payment_collected: 0,
          total_delivery_fees: 0
        },
        breakdown
      }
    });
  } catch (error) {
    console.error('Error obteniendo resumen de caja del mensajero:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Historial paginado de entregas del mensajero
 * GET /api/messenger/deliveries?from=ISO&to=ISO&page=1&page_size=20
 */
const getDeliveryHistory = async (req, res) => {
  try {
    const messengerId = req.user.id;
    const { page = 1, page_size = 20, from, to } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const sizeNum = Math.min(Math.max(parseInt(page_size) || 20, 1), 100);
    const offset = (pageNum - 1) * sizeNum;

    let whereClauses = [
      'o.assigned_messenger_id = ?',
      "o.messenger_status = 'delivered'",
      'dt.messenger_id = ?',
      'dt.delivered_at IS NOT NULL'
    ];
    const params = [messengerId, messengerId];

    if (from) {
      whereClauses.push('dt.delivered_at >= ?');
      params.push(new Date(from).toISOString().slice(0, 19).replace('T', ' '));
    }
    if (to) {
      whereClauses.push('dt.delivered_at <= ?');
      params.push(new Date(to).toISOString().slice(0, 19).replace('T', ' '));
    }

    const whereSql = whereClauses.join(' AND ');

    const totalRows = await query(
      `SELECT COUNT(*) AS total
       FROM orders o
       JOIN delivery_tracking dt ON o.id = dt.order_id
       WHERE ${whereSql}`,
      params
    );

    const rows = await query(
      `SELECT 
         o.id,
         o.order_number,
         o.customer_name,
         o.customer_phone,
         o.customer_address,
         o.total_amount,
         dt.payment_collected,
         dt.delivery_fee_collected,
         dt.payment_method,
         dt.delivered_at,
         dt.delivery_notes,
         ccd.collection_status AS cash_status,
         ccd.collected_amount AS cash_declared,
         ccd.collected_at AS cash_collected_at
       FROM orders o
       JOIN delivery_tracking dt ON o.id = dt.order_id
       LEFT JOIN cash_closing_details ccd ON ccd.order_id = o.id
       LEFT JOIN messenger_cash_closings mcc ON ccd.closing_id = mcc.id AND mcc.messenger_id = ?
       WHERE ${whereSql}
       ORDER BY dt.delivered_at DESC
       LIMIT ? OFFSET ?`,
      [...params, messengerId, sizeNum, offset]
    );

    const total = totalRows[0]?.total || 0;
    res.json({
      success: true,
      data: {
        results: rows,
        pagination: {
          page: pageNum,
          page_size: sizeNum,
          total,
          pages: Math.ceil(total / sizeNum)
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo historial de entregas del mensajero:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Estadísticas del mensajero
 * GET /api/messenger/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - summary (hoy)
 * - trends (últimos 14 días o rango): assigned/accepted/in_delivery/delivered/failed por día
 * - performance: successRate7d/30d, avgDeliveryMinutes7d/30d
 * - byMethod: agrupación por delivery_method en rango
 * - byHour: histograma por hora de delivered_at en rango
 */
const getStats = async (req, res) => {
  try {
    const messengerId = req.user.id;
    const { from, to } = req.query;

    // Fechas por defecto: últimos 14 días
    const now = new Date();
    const end = to ? new Date(to) : now;
    const start = from ? new Date(from) : new Date(end);
    if (!from) {
      // 14 días hacia atrás (incluye hoy)
      start.setDate(end.getDate() - 13);
      start.setHours(0, 0, 0, 0);
    }
    const toSql = (d) => new Date(d).toISOString().slice(0, 19).replace('T', ' ');

    const rangeFrom = toSql(start);
    const rangeTo = toSql(end);

    // Hoy (para summary)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // Summary de hoy (consultas agregadas)
    const summaryRows = await query(
      `
      SELECT
        (SELECT COUNT(*) 
           FROM delivery_tracking dt1 
          WHERE dt1.messenger_id = ? AND DATE(dt1.assigned_at) = ?) AS assignedToday,
        (SELECT COUNT(*) 
           FROM delivery_tracking dt2 
          WHERE dt2.messenger_id = ? AND DATE(dt2.accepted_at) = ?) AS acceptedToday,
        (SELECT COUNT(*) 
           FROM delivery_tracking dt3 
          WHERE dt3.messenger_id = ? 
            AND DATE(dt3.started_delivery_at) = ?
            AND dt3.delivered_at IS NULL
            AND dt3.failed_at IS NULL) AS inDeliveryToday,
        (SELECT COUNT(*) 
           FROM delivery_tracking dt4 
          WHERE dt4.messenger_id = ? AND DATE(dt4.delivered_at) = ?) AS deliveredToday,
        (SELECT COALESCE(SUM(o.payment_amount), 0)
           FROM delivery_tracking dta
           JOIN orders o ON o.id = dta.order_id
          WHERE dta.messenger_id = ?
            AND DATE(dta.assigned_at) = ?
            AND o.requires_payment = 1) AS cashToCollectToday,
        (SELECT COALESCE(SUM(dtb.payment_collected), 0)
           FROM delivery_tracking dtb
          WHERE dtb.messenger_id = ?
            AND DATE(dtb.delivered_at) = ?) AS cashCollectedToday
      `,
      [
        messengerId, todayStr,
        messengerId, todayStr,
        messengerId, todayStr,
        messengerId, todayStr,
        messengerId, todayStr,
        messengerId, todayStr
      ]
    );

    const summary = summaryRows[0] || {
      assignedToday: 0,
      acceptedToday: 0,
      inDeliveryToday: 0,
      deliveredToday: 0,
      cashToCollectToday: 0,
      cashCollectedToday: 0
    };
    summary.cashGapToday = (summary.cashToCollectToday || 0) - (summary.cashCollectedToday || 0);

    // Trends por día dentro del rango
    const [assignedDaily, acceptedDaily, inDeliveryDaily, deliveredDaily, failedDaily] = await Promise.all([
      query(
        `
        SELECT DATE(assigned_at) AS date, COUNT(*) AS cnt
          FROM delivery_tracking
         WHERE messenger_id = ?
           AND assigned_at IS NOT NULL
           AND assigned_at BETWEEN ? AND ?
         GROUP BY DATE(assigned_at)
         ORDER BY DATE(assigned_at)
        `,
        [messengerId, rangeFrom, rangeTo]
      ),
      query(
        `
        SELECT DATE(accepted_at) AS date, COUNT(*) AS cnt
          FROM delivery_tracking
         WHERE messenger_id = ?
           AND accepted_at IS NOT NULL
           AND accepted_at BETWEEN ? AND ?
         GROUP BY DATE(accepted_at)
         ORDER BY DATE(accepted_at)
        `,
        [messengerId, rangeFrom, rangeTo]
      ),
      query(
        `
        SELECT DATE(started_delivery_at) AS date, COUNT(*) AS cnt
          FROM delivery_tracking
         WHERE messenger_id = ?
           AND started_delivery_at IS NOT NULL
           AND started_delivery_at BETWEEN ? AND ?
         GROUP BY DATE(started_delivery_at)
         ORDER BY DATE(started_delivery_at)
        `,
        [messengerId, rangeFrom, rangeTo]
      ),
      query(
        `
        SELECT DATE(delivered_at) AS date, COUNT(*) AS cnt
          FROM delivery_tracking
         WHERE messenger_id = ?
           AND delivered_at IS NOT NULL
           AND delivered_at BETWEEN ? AND ?
         GROUP BY DATE(delivered_at)
         ORDER BY DATE(delivered_at)
        `,
        [messengerId, rangeFrom, rangeTo]
      ),
      query(
        `
        SELECT DATE(failed_at) AS date, COUNT(*) AS cnt
          FROM delivery_tracking
         WHERE messenger_id = ?
           AND failed_at IS NOT NULL
           AND failed_at BETWEEN ? AND ?
         GROUP BY DATE(failed_at)
         ORDER BY DATE(failed_at)
        `,
        [messengerId, rangeFrom, rangeTo]
      )
    ]);

    // Combinar en una sola serie por fecha
    const padDate = (d) => d; // ya viene YYYY-MM-DD
    const map = {};

    const applySeries = (rows, key) => {
      for (const r of rows) {
        const k = padDate(r.date);
        if (!map[k]) {
          map[k] = { date: k, assigned: 0, accepted: 0, in_delivery: 0, delivered: 0, failed: 0 };
        }
        map[k][key] = Number(r.cnt) || 0;
      }
    };

    applySeries(assignedDaily, 'assigned');
    applySeries(acceptedDaily, 'accepted');
    applySeries(inDeliveryDaily, 'in_delivery');
    applySeries(deliveredDaily, 'delivered');
    applySeries(failedDaily, 'failed');

    // Ordenar por fecha asc
    const trendsDaily = Object.values(map).sort((a, b) => (a.date < b.date ? -1 : 1));

    // Performance 7d y 30d
    const daysAgo = (n) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d;
    };
    const sevenDaysFrom = toSql(daysAgo(6)); // incluye hoy (7 días corridos)
    const thirtyDaysFrom = toSql(daysAgo(29)); // 30 días corridos
    const nowSql = toSql(now);

    const [perf7, perf30] = await Promise.all([
      query(
        `
        SELECT
          (SELECT COUNT(*) FROM delivery_tracking p7 WHERE p7.messenger_id = ? AND p7.delivered_at BETWEEN ? AND ?) AS delivered,
          (SELECT COUNT(*) FROM delivery_tracking p7f WHERE p7f.messenger_id = ? AND p7f.failed_at BETWEEN ? AND ?) AS failed,
          (SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(p7s.started_delivery_at, p7s.accepted_at), p7s.delivered_at))
             FROM delivery_tracking p7s
            WHERE p7s.messenger_id = ?
              AND p7s.delivered_at BETWEEN ? AND ?) AS avgMinutes
        `,
        [messengerId, sevenDaysFrom, nowSql, messengerId, sevenDaysFrom, nowSql, messengerId, sevenDaysFrom, nowSql]
      ),
      query(
        `
        SELECT
          (SELECT COUNT(*) FROM delivery_tracking p30 WHERE p30.messenger_id = ? AND p30.delivered_at BETWEEN ? AND ?) AS delivered,
          (SELECT COUNT(*) FROM delivery_tracking p30f WHERE p30f.messenger_id = ? AND p30f.failed_at BETWEEN ? AND ?) AS failed,
          (SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(p30s.started_delivery_at, p30s.accepted_at), p30s.delivered_at))
             FROM delivery_tracking p30s
            WHERE p30s.messenger_id = ?
              AND p30s.delivered_at BETWEEN ? AND ?) AS avgMinutes
        `,
        [messengerId, thirtyDaysFrom, nowSql, messengerId, thirtyDaysFrom, nowSql, messengerId, thirtyDaysFrom, nowSql]
      )
    ]);

    const s7 = perf7[0] || { delivered: 0, failed: 0, avgMinutes: null };
    const s30 = perf30[0] || { delivered: 0, failed: 0, avgMinutes: null };
    const rate = (d, f) => {
      const total = Number(d || 0) + Number(f || 0);
      return total > 0 ? Number(d || 0) / total : 0;
    };

    const performance = {
      successRate7d: rate(s7.delivered, s7.failed),
      successRate30d: rate(s30.delivered, s30.failed),
      avgDeliveryMinutes7d: s7.avgMinutes !== null ? Number(s7.avgMinutes) : null,
      avgDeliveryMinutes30d: s30.avgMinutes !== null ? Number(s30.avgMinutes) : null
    };

    // byMethod en rango (solo entregados)
    const byMethod = await query(
      `
      SELECT 
        o.delivery_method,
        COUNT(*) AS count,
        COALESCE(SUM(o.total_amount), 0) AS total_amount
      FROM delivery_tracking dt
      JOIN orders o ON o.id = dt.order_id
      WHERE dt.messenger_id = ?
        AND dt.delivered_at IS NOT NULL
        AND dt.delivered_at BETWEEN ? AND ?
      GROUP BY o.delivery_method
      ORDER BY count DESC
      `,
      [messengerId, rangeFrom, rangeTo]
    );

    // byHour en rango (solo entregados)
    const byHour = await query(
      `
      SELECT 
        HOUR(dt.delivered_at) AS hour,
        COUNT(*) AS delivered
      FROM delivery_tracking dt
      WHERE dt.messenger_id = ?
        AND dt.delivered_at IS NOT NULL
        AND dt.delivered_at BETWEEN ? AND ?
      GROUP BY HOUR(dt.delivered_at)
      ORDER BY hour ASC
      `,
      [messengerId, rangeFrom, rangeTo]
    );

    return res.json({
      success: true,
      data: {
        summary,
        trends: { daily: trendsDaily },
        performance,
        byMethod,
        byHour,
        range: { from: new Date(rangeFrom).toISOString(), to: new Date(rangeTo).toISOString() }
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas del mensajero:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Declarar entrega de dinero por pedido (mensajero)
 * POST /api/messenger/orders/:orderId/declare-cash
 * body: { amount?: number, notes?: string }
 * - Crea/actualiza el detalle en cash_closing_details con estado 'pending'
 * - Crea el cierre del día si no existe
 */
const declareCashForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, notes } = req.body || {};
    const messengerId = req.user.id;

    // Verificar que el pedido pertenece al mensajero y fue entregado
    const delivered = await query(
      `SELECT 
         o.id, o.order_number, o.assigned_messenger_id,
         dt.payment_collected, dt.delivery_fee_collected, dt.delivered_at, dt.payment_method
       FROM orders o
       JOIN delivery_tracking dt ON o.id = dt.order_id
       WHERE o.id = ? AND o.assigned_messenger_id = ? AND dt.delivered_at IS NOT NULL`,
      [orderId, messengerId]
    );

    if (!delivered.length) {
      return res.status(400).json({
        success: false,
        message: 'El pedido no está marcado como entregado por este mensajero'
      });
    }

    const row = delivered[0];
    const expectedAmount = Number(row.payment_collected || 0) + Number(row.delivery_fee_collected || 0);
    const declaredAmount = amount !== undefined ? Number(amount) : expectedAmount;

    // Determinar fecha de cierre (día de la entrega)
    const deliveredAt = new Date(row.delivered_at);
    const closingDate = new Date(deliveredAt.getFullYear(), deliveredAt.getMonth(), deliveredAt.getDate())
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    // Crear/obtener cierre del día
    let closing = await query(
      'SELECT id, expected_amount, declared_amount, status FROM messenger_cash_closings WHERE messenger_id = ? AND closing_date = ?',
      [messengerId, closingDate]
    );

    if (!closing.length) {
      // expected_amount inicial: el esperado de este pedido
      const insert = await query(
        `INSERT INTO messenger_cash_closings (messenger_id, closing_date, expected_amount, declared_amount, status, notes)
         VALUES (?, ?, ?, ?, 'pending', NULL)`,
        [messengerId, closingDate, expectedAmount, 0]
      );
      closing = [{ id: insert.insertId, expected_amount: expectedAmount, declared_amount: 0, status: 'pending' }];
    }

    const closingId = closing[0].id;

    // Verificar si ya existe detalle para este pedido
    const existingDetail = await query(
      'SELECT id, collection_status FROM cash_closing_details WHERE closing_id = ? AND order_id = ?',
      [closingId, orderId]
    );

    if (existingDetail.length) {
      // Actualizar monto declarado y dejar pendiente si aún no está aceptado
      const status = existingDetail[0].collection_status === 'collected' ? 'collected' : 'pending';
      await query(
        `UPDATE cash_closing_details 
           SET collected_amount = ?, collection_status = ?, collection_notes = CONCAT(IFNULL(collection_notes,''), ?), collected_at = IF(? = 'collected', NOW(), collected_at)
         WHERE id = ?`,
        [
          declaredAmount,
          status,
          notes ? `\n[Declaración mensajero] ${notes}` : '',
          status,
          existingDetail[0].id
        ]
      );
    } else {
      // Crear detalle
      await query(
        `INSERT INTO cash_closing_details (
           closing_id, order_id, order_number, payment_method, order_amount, collected_amount, collection_status, collection_notes, collected_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL)`,
        [
          closingId,
          row.id,
          row.order_number,
          row.payment_method || 'cash',
          expectedAmount,
          declaredAmount,
          notes ? `[Declaración mensajero] ${notes}` : null
        ]
      );

      // Actualizar expected_amount del cierre sumando el pedido si el cierre se creó sin contemplarlo
      // (si el cierre ya existía, asumimos expected_amount agregado previamente por otro proceso)
      if (closing[0].expected_amount < expectedAmount) {
        await query(
          'UPDATE messenger_cash_closings SET expected_amount = expected_amount + ? WHERE id = ?',
          [expectedAmount, closingId]
        );
      }
    }

    // Actualizar declarado acumulado del cierre
    await query(
      'UPDATE messenger_cash_closings SET declared_amount = (SELECT COALESCE(SUM(collected_amount),0) FROM cash_closing_details WHERE closing_id = ?) WHERE id = ?',
      [closingId, closingId]
    );

    res.json({
      success: true,
      message: 'Entrega de dinero declarada. Queda pendiente por aceptación.',
      data: {
        closing_id: closingId,
        order_id: row.id,
        expected_amount: expectedAmount,
        declared_amount: declaredAmount
      }
    });
  } catch (error) {
    console.error('Error declarando efectivo por pedido:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Aceptar recepción de dinero por pedido (admin/logística/cartera)
 * POST /api/messenger/orders/:orderId/accept-cash
 * body: { messengerId?: number } (opcional si el pedido ya tiene assigned_messenger_id)
 */
const acceptCashForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const receiverUserId = req.user.id;

    // 1) Intentar con un detalle existente (flujo normal si el mensajero ya declaró)
    const existing = await query(
      `
      SELECT ccd.id AS detail_id, mcc.id AS closing_id, mcc.messenger_id, ccd.collection_status
      FROM cash_closing_details ccd
      JOIN messenger_cash_closings mcc ON mcc.id = ccd.closing_id
      WHERE ccd.order_id = ?
      ORDER BY ccd.id DESC
      LIMIT 1
      `,
      [orderId]
    );

    if (existing.length) {
      await query(
        `
        UPDATE cash_closing_details 
           SET collection_status = 'collected',
               collected_at = NOW(),
               collection_notes = CONCAT(IFNULL(collection_notes,''), '\n[Recepción] Aceptado por usuario ID ', ?)
         WHERE id = ?
        `,
        [receiverUserId, existing[0].detail_id]
      );

      const [agg] = await query(
        `
        SELECT 
          COALESCE(SUM(order_amount),0) AS expected_amount,
          COALESCE(SUM(collected_amount),0) AS declared_amount,
          SUM(CASE WHEN collection_status = 'collected' THEN 1 ELSE 0 END) AS accepted_count,
          COUNT(*) AS total_count
        FROM cash_closing_details
        WHERE closing_id = ?
        `,
        [existing[0].closing_id]
      );

      let newStatus = 'partial';
      if (agg && agg.accepted_count === agg.total_count) {
        newStatus = 'completed';
        await query(
          `
          UPDATE messenger_cash_closings
             SET status = 'completed',
                 approved_by = ?,
                 approved_at = NOW(),
                 expected_amount = ?,
                 declared_amount = ?
           WHERE id = ?
          `,
          [receiverUserId, Number(agg.expected_amount || 0), Number(agg.declared_amount || 0), existing[0].closing_id]
        );
      } else {
        await query(
          `
          UPDATE messenger_cash_closings
             SET status = 'partial',
                 approved_by = NULL,
                 approved_at = NULL,
                 expected_amount = ?,
                 declared_amount = ?
           WHERE id = ?
          `,
          [Number(agg.expected_amount || 0), Number(agg.declared_amount || 0), existing[0].closing_id]
        );
      }

      return res.json({
        success: true,
        message: 'Recepción de efectivo aceptada',
        data: { closing_id: existing[0].closing_id, status: newStatus }
      });
    }

    // 2) No hay declaración previa: crear automáticamente el detalle y, si es necesario, el cierre
    //    a partir del tracking de entrega.
    const deliveredRows = await query(
      `
      SELECT 
        o.id AS order_id,
        o.order_number,
        COALESCE(dt.messenger_id, o.assigned_messenger_id) AS messenger_id,
        dt.payment_collected,
        dt.delivery_fee_collected,
        dt.payment_method,
        dt.delivered_at
      FROM orders o
      LEFT JOIN delivery_tracking dt ON dt.order_id = o.id
      WHERE o.id = ?
      ORDER BY dt.id DESC
      LIMIT 1
      `,
      [orderId]
    );

    if (!deliveredRows.length || !deliveredRows[0].delivered_at) {
      return res.status(400).json({
        success: false,
        message: 'El pedido no está marcado como entregado; no puede aceptarse efectivo.'
      });
    }

    const row = deliveredRows[0];
    const messengerId = row.messenger_id;
    if (!messengerId) {
      return res.status(400).json({ success: false, message: 'No se pudo determinar el mensajero del pedido' });
    }

    const expectedAmount = Number(row.payment_collected || 0) + Number(row.delivery_fee_collected || 0);

    const deliveredAt = new Date(row.delivered_at);
    const pad = (n) => String(n).padStart(2, '0');
    const closingDate = `${deliveredAt.getFullYear()}-${pad(deliveredAt.getMonth() + 1)}-${pad(deliveredAt.getDate())}`;

    // Obtener/crear cierre del día del mensajero
    let closings = await query(
      `SELECT id FROM messenger_cash_closings WHERE messenger_id = ? AND closing_date = ?`,
      [messengerId, closingDate]
    );
    let closingId;
    if (!closings.length) {
      const ins = await query(
        `INSERT INTO messenger_cash_closings (messenger_id, closing_date, expected_amount, declared_amount, status, notes)
         VALUES (?, ?, 0, 0, 'pending', NULL)`,
        [messengerId, closingDate]
      );
      closingId = ins.insertId;
    } else {
      closingId = closings[0].id;
    }

    // Insertar detalle como aceptado
    const paymentMethodRow = row.payment_method || 'cash';
    await query(
      `INSERT INTO cash_closing_details (
         closing_id, order_id, order_number, payment_method, order_amount, collected_amount, collection_status, collection_notes, collected_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'collected', ?, NOW())`,
      [
        closingId,
        row.order_id,
        row.order_number,
        paymentMethodRow,
        expectedAmount,
        expectedAmount,
        `[Recepción] Aceptado por usuario ID ${receiverUserId} (auto-creado)`
      ]
    );

    // Recalcular agregados del cierre y actualizar estado
    const [agg2] = await query(
      `SELECT 
         COALESCE(SUM(order_amount),0) AS expected_amount,
         COALESCE(SUM(collected_amount),0) AS declared_amount,
         SUM(CASE WHEN collection_status = 'collected' THEN 1 ELSE 0 END) AS accepted_count,
         COUNT(*) AS total_count
       FROM cash_closing_details
       WHERE closing_id = ?`,
      [closingId]
    );

    let newStatus2 = 'partial';
    if (agg2 && agg2.accepted_count === agg2.total_count) {
      newStatus2 = 'completed';
      await query(
        `UPDATE messenger_cash_closings 
            SET status = 'completed', approved_by = ?, approved_at = NOW(), expected_amount = ?, declared_amount = ?
         WHERE id = ?`,
        [receiverUserId, Number(agg2.expected_amount || 0), Number(agg2.declared_amount || 0), closingId]
      );
    } else {
      await query(
        `UPDATE messenger_cash_closings 
            SET status = 'partial', approved_by = NULL, approved_at = NULL, expected_amount = ?, declared_amount = ?
         WHERE id = ?`,
        [Number(agg2.expected_amount || 0), Number(agg2.declared_amount || 0), closingId]
      );
    }

    return res.json({
      success: true,
      message: 'Recepción de efectivo aceptada y registrada',
      data: { closing_id: closingId, status: newStatus2 }
    });
  } catch (error) {
    console.error('Error aceptando efectivo por pedido:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Declaración agregada de entrega diaria de efectivo del mensajero
 * POST /api/messenger/cash-deliveries
 * body: { amount: number, notes?: string }
 */
const createCashDelivery = async (req, res) => {
  try {
    const messengerId = req.user.id;
    const { amount, deliveredTo, referenceNumber, notes } = req.body || {};

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Monto inválido' });
    }

    // Validar receptor
    const receivers = await query(
      `SELECT id, role FROM users WHERE id = ? AND role IN ('admin','logistica','cartera') AND active = TRUE`,
      [deliveredTo]
    );
    if (!receivers.length) {
      return res.status(400).json({ success: false, message: 'Usuario receptor no válido' });
    }

    // Insertar registro
    await query(
      `INSERT INTO cash_deliveries (messenger_id, amount, delivered_to, reference_number, notes, delivery_date, created_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [messengerId, amt, deliveredTo, referenceNumber || null, notes || null]
    );

    return res.json({ success: true, message: 'Entrega de efectivo registrada' });
  } catch (error) {
    console.error('Error registrando entrega agregada de efectivo:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Listar entregas agregadas de efectivo del mensajero
 * GET /api/messenger/cash-deliveries?from=ISO&to=ISO
 */
const getCashDeliveries = async (req, res) => {
  try {
    const messengerId = req.user.id;
    const { from, to } = req.query;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const formatLocal = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const fromDate = from ? new Date(from) : startOfMonth;
    const toDate = to ? new Date(to) : now;
    const fromStr = formatLocal(fromDate);
    const toStr = formatLocal(toDate);

    const rows = await query(
      `SELECT cd.id, cd.amount, cd.delivered_to, u.full_name as delivered_to_name, cd.reference_number, cd.notes, cd.delivery_date
       FROM cash_deliveries cd
       LEFT JOIN users u ON u.id = cd.delivered_to
       WHERE cd.messenger_id = ? AND cd.delivery_date BETWEEN ? AND ?
       ORDER BY cd.delivery_date DESC`,
      [messengerId, fromStr, toStr]
    );

    const totals = await query(
      `SELECT COALESCE(SUM(amount),0) as total_amount, COUNT(*) as deliveries
       FROM cash_deliveries
       WHERE messenger_id = ? AND delivery_date BETWEEN ? AND ?`,
      [messengerId, fromStr, toStr]
    );

    return res.json({
      success: true,
      data: {
        range: { from: fromStr, to: toStr },
        deliveries: rows,
        totals: totals[0] || { total_amount: 0, deliveries: 0 }
      }
    });
  } catch (error) {
    console.error('Error listando entregas agregadas de efectivo:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Recibo HTML imprimible por factura para firma de mensajero y cartera.
 * GET /api/messenger/orders/:orderId/cash-receipt
 * Roles: cartera/admin/logistica
 */
const getCashReceiptHtml = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Datos del pedido + tracking + mensajero
    const rows = await query(
      `
      SELECT 
        o.id AS order_id,
        o.order_number,
        o.customer_name,
        o.total_amount,
        o.assigned_messenger_id,
        COALESCE(dt.messenger_id, o.assigned_messenger_id) AS messenger_id,
        u.full_name AS messenger_name,
        COALESCE(dt.payment_collected, 0) AS product_collected,
        COALESCE(dt.delivery_fee_collected, 0) AS delivery_fee_collected,
        dt.payment_method,
        dt.delivered_at
      FROM orders o
      LEFT JOIN delivery_tracking dt ON dt.order_id = o.id
      LEFT JOIN users u ON u.id = COALESCE(dt.messenger_id, o.assigned_messenger_id)
      WHERE o.id = ?
      ORDER BY dt.id DESC
      LIMIT 1
      `,
      [orderId]
    );

    if (!rows.length) {
      res.status(404).send('Pedido no encontrado');
      return;
    }

    const o = rows[0];
    if (!o.delivered_at) {
      res.status(400).send('El pedido aún no está marcado como entregado');
      return;
    }

    // Último detalle de caja (si existe)
    const detailRows = await query(
      `
      SELECT 
        ccd.id,
        ccd.order_amount,
        ccd.collected_amount,
        ccd.collection_status,
        ccd.collected_at,
        mcc.id AS closing_id
      FROM cash_closing_details ccd
      LEFT JOIN messenger_cash_closings mcc ON mcc.id = ccd.closing_id
      WHERE ccd.order_id = ?
      ORDER BY ccd.id DESC
      LIMIT 1
      `,
      [orderId]
    );

    const expectedAmount = Number(o.product_collected || 0) + Number(o.delivery_fee_collected || 0);
    const declaredAmount =
      detailRows.length ? Number(detailRows[0].collected_amount || 0) : expectedAmount;
    const cashStatus = detailRows.length ? (detailRows[0].collection_status || 'pending') : 'pending';
    const collectedAt = detailRows.length ? detailRows[0].collected_at : null;

    // Datos de "cajero" (usuario receptor actual)
    let cashierName = req.user?.full_name || req.user?.username || `Usuario ${req.user?.id || ''}`;
    try {
      const cashierRows = await query('SELECT full_name, username FROM users WHERE id = ?', [req.user.id]);
      if (cashierRows.length) {
        cashierName = cashierRows[0].full_name || cashierRows[0].username || cashierName;
      }
    } catch (_) {
      // no-op
    }

    const fmt = (n) =>
      Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    const dateStr = (d) => (d ? new Date(d).toLocaleString('es-CO') : '-');

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8"/>
        <title>Recibo Entrega Efectivo - Factura ${o.order_number}</title>
        <style>
          :root { color-scheme: light; }
          body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
          h1 { font-size: 18px; margin: 0 0 6px; }
          .meta, .section { font-size: 13px; color: #374151; margin-bottom: 12px; }
          .label { color: #6b7280; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
          .amounts { margin: 12px 0; }
          .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
          .num { font-weight: 600; }
          .status { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; border: 1px solid #e5e7eb; }
          .status.pending { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }
          .status.collected { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
          th { background: #f9fafb; text-align: left; }
          .footer { margin-top: 28px; display: flex; gap: 40px; }
          .sign { width: 45%; border-top: 1px solid #111827; padding-top: 8px; text-align: center; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align:right;margin-bottom:8px;">
          <button onclick="window.print()" style="padding:6px 12px;border:1px solid #e5e7eb;background:#111827;color:#fff;border-radius:4px;cursor:pointer;">Imprimir</button>
        </div>
        <h1>Recibo de Entrega de Efectivo - Factura ${o.order_number}</h1>
        <div class="meta grid">
          <div><span class="label">Cliente:</span> <strong>${o.customer_name || '-'}</strong></div>
          <div><span class="label">Fecha de entrega:</span> <strong>${dateStr(o.delivered_at)}</strong></div>
          <div><span class="label">Mensajero:</span> <strong>${o.messenger_name ? `${o.messenger_name} (ID ${o.messenger_id})` : `ID ${o.messenger_id || '-'}`}</strong></div>
          <div><span class="label">Emitido por:</span> <strong>${cashierName}</strong></div>
          <div><span class="label">Fecha emisión:</span> <strong>${dateStr(new Date())}</strong></div>
          <div><span class="label">Estado de caja:</span> <span class="status ${cashStatus}">${cashStatus}</span></div>
        </div>

        <div class="box amounts">
          <div class="row"><span>Valor producto cobrado:</span> <span class="num">${fmt(o.product_collected)}</span></div>
          <div class="row"><span>Valor flete cobrado:</span> <span class="num">${fmt(o.delivery_fee_collected)}</span></div>
          <div class="row"><span>Total esperado:</span> <span class="num">${fmt(expectedAmount)}</span></div>
          <div class="row"><span>Total declarado/aceptado:</span> <span class="num">${fmt(declaredAmount)}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th class="num">Monto</th>
              <th>Método</th>
              <th>Fecha aceptación</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pago de producto</td>
              <td class="num">${fmt(o.product_collected)}</td>
              <td>${(o.payment_method || '').toUpperCase() || 'EFECTIVO'}</td>
              <td>${dateStr(collectedAt)}</td>
            </tr>
            <tr>
              <td>Flete / Domicilio</td>
              <td class="num">${fmt(o.delivery_fee_collected)}</td>
              <td>${o.delivery_fee_collected > 0 ? 'EFECTIVO' : '-'}</td>
              <td>${dateStr(collectedAt)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div class="sign">Firma Mensajero</div>
          <div class="sign">Firma Cartera</div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error generando recibo por factura:', error);
    res.status(500).send('Error interno del servidor');
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
  getCashSummary,
  getDeliveryHistory,
  getStats,
  declareCashForOrder,
  acceptCashForOrder,
  createCashDelivery,
  getCashDeliveries,
  getCashReceiptHtml,
  upload // Middleware de multer para subir archivos
};
