const { query, transaction } = require('../config/database');
const pdfService = require('../services/pdfService');

// Helper: emitir evento de cambio de estado para notificaciones en tiempo real
const emitStatusChange = (orderId, orderNumber, fromStatus, toStatus) => {
  try {
    const payload = {
      orderId,
      order_number: orderNumber,
      from_status: fromStatus,
      to_status: toStatus,
      timestamp: new Date().toISOString()
    };
    if (global.io) {
      global.io.to('orders-updates').emit('order-status-changed', payload);
    }
    console.log('📡 (logistica) Emitido order-status-changed:', payload);
  } catch (e) {
    console.error('⚠️  Error emitiendo order-status-changed (logistica):', e?.message || e);
  }
};

// Obtener transportadoras disponibles
const getCarriers = async (req, res) => {
  try {
    const carriers = await query(
      'SELECT id, name, code, contact_phone, contact_email, website FROM carriers WHERE active = TRUE ORDER BY name',
      []
    );

    res.json({
      success: true,
      data: carriers
    });

  } catch (error) {
    console.error('Error obteniendo transportadoras:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Cambiar transportadora de un pedido listo para entregar o empacado
const changeOrderCarrier = async (req, res) => {
  try {
    const { id } = req.params;
    const { carrierId, reason, override = false } = req.body || {};

    if (!carrierId) {
      return res.status(400).json({ success: false, message: 'carrierId es requerido' });
    }
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Debes ingresar un motivo del cambio' });
    }

    // Obtener pedido y validar estado
    const rows = await query(
      'SELECT id, order_number, status, delivery_method, carrier_id FROM orders WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const order = rows[0];
    const status = String(order.status || '').toLowerCase();
    const blockedStatuses = ['entregado_transportadora', 'en_reparto', 'entregado_cliente', 'cancelado', 'enviado'];
    if (blockedStatuses.includes(status) && !override) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cambiar la transportadora: el pedido ya fue entregado a transportadora/en ruta/entregado/cancelado'
      });
    }

    // No aplica a recoge bodega
    const dmNorm = String(order.delivery_method || '').toLowerCase();
    if (['recoge_bodega', 'recogida_tienda'].includes(dmNorm)) {
      return res.status(400).json({ success: false, message: 'El pedido es de recogida en bodega/tienda. No requiere transportadora.' });
    }

    // Validar transportadora destino
    const carriers = await query('SELECT id, name, active FROM carriers WHERE id = ? AND active = TRUE', [carrierId]);
    if (!carriers.length) {
      return res.status(400).json({ success: false, message: 'Transportadora destino no válida o inactiva' });
    }

    // Si no hay cambio, responder idempotente
    const oldCarrierId = order.carrier_id ?? null;
    if (Number(oldCarrierId) === Number(carrierId)) {
      return res.json({
        success: true,
        message: 'La transportadora ya estaba asignada. No hay cambios.'
      });
    }

    // Actualizar pedido: limpiar tracking/guía para regenerar con la nueva transportadora
    try {
      await query(
        `UPDATE orders
             SET carrier_id = ?, tracking_number = NULL, shipping_guide_generated = FALSE, shipping_guide_path = NULL, updated_at = NOW()
           WHERE id = ?`,
        [carrierId, id]
      );
    } catch (e) {
      const msg = e?.sqlMessage || e?.message || '';
      // Fallback tolerante si faltan columnas en producción (Unknown column)
      if ((e?.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(msg)) && /(shipping_guide_generated|shipping_guide_path)/i.test(msg)) {
        console.warn('⚠️ Columns shipping_guide_* missing in orders. Applying fallback UPDATE without those columns.');
        await query(
          `UPDATE orders
               SET carrier_id = ?, tracking_number = NULL, updated_at = NOW()
             WHERE id = ?`,
          [carrierId, id]
        );
      } else {
        throw e;
      }
    }

    // Intentar registrar auditoría si existe la tabla
    try {
      const userId = req.user?.id || null;
      await query(
        `INSERT INTO carrier_change_logs (order_id, old_carrier_id, new_carrier_id, user_id, reason, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, oldCarrierId, carrierId, userId, String(reason).trim()]
      );
    } catch (auditErr) {
      // Tabla puede no existir aún; no bloquear el flujo
      console.warn('⚠️ carrier_change_logs no disponible o error insertando auditoría:', auditErr?.sqlMessage || auditErr?.message || auditErr);
    }

    // Emitir evento de "cambio" con el mismo estado para forzar refresco en UI si aplica
    try {
      emitStatusChange(order.id, order.order_number, order.status, order.status);
    } catch { }

    return res.json({
      success: true,
      message: 'Transportadora cambiada exitosamente. La guía se regenerará con la nueva transportadora.',
      data: { orderId: Number(id), old_carrier_id: oldCarrierId, new_carrier_id: Number(carrierId) }
    });
  } catch (error) {
    console.error('Error cambiando transportadora:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Actualizar método de envío y transportadora
const updateDeliveryMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_method, carrier_id, tracking_number } = req.body;

    // Verificar que el pedido existe y está en logística
    const order = await query(
      'SELECT id, status, order_number FROM orders WHERE id = ?',
      [id]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    if (order[0].status !== 'en_logistica') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden modificar pedidos en logística'
      });
    }

    // Verificar que la transportadora existe si se proporciona
    if (carrier_id) {
      const carrier = await query(
        'SELECT id FROM carriers WHERE id = ? AND active = TRUE',
        [carrier_id]
      );

      if (!carrier.length) {
        return res.status(400).json({
          success: false,
          message: 'Transportadora no válida'
        });
      }
    }

    // Actualizar pedido
    await query(
      `UPDATE orders 
       SET delivery_method = ?, carrier_id = ?, tracking_number = ?, updated_at = NOW()
       WHERE id = ?`,
      [delivery_method, carrier_id || null, tracking_number || null, id]
    );

    res.json({
      success: true,
      message: 'Método de envío actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando método de envío:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Generar guía de envío en PDF
const generateShippingGuide = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener datos del pedido con información de transportadora
    const orderData = await query(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.customer_document,
        o.customer_phone AS phone, o.customer_address AS address, o.customer_email AS email,
        o.customer_city AS city, o.customer_department AS department,
        o.delivery_method, o.tracking_number,
        o.payment_method, o.total_amount, o.notes, o.shipping_date, o.status,
        c.name as carrier_name, c.code as carrier_code, 
        c.contact_phone as carrier_phone, c.contact_email as carrier_email,
        cu.identification AS customer_identification
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       LEFT JOIN customers cu ON o.customer_id = cu.id
       WHERE o.id = ?`,
      [id]
    );

    if (!orderData.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const order = orderData[0];

    // Verificar que el pedido tiene método de envío y transportadora
    if (!order.delivery_method) {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe tener un método de envío asignado'
      });
    }

    if (!order.carrier_name && order.delivery_method !== 'recoge_bodega') {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe tener una transportadora asignada'
      });
    }

    // Datos de la transportadora (usar datos por defecto para recogida en bodega)
    const carrierData = {
      name: order.carrier_name || 'Recogida en Bodega',
      code: order.carrier_code || 'BODEGA',
      contact_phone: order.carrier_phone || '3105244298',
      contact_email: order.carrier_email || 'logistica@perlas-explosivas.com'
    };

    // Prioridad de datos para destinatario: Notas > datos del pedido
    const isPickup = String(order.delivery_method || '').toLowerCase() === 'recoge_bodega';
    const extracted = extractRecipientDataFromNotes(order.notes);
    if (extracted) {
      console.log('📦 (generateShippingGuide) Usando datos de SIIGO para destinatario:', extracted);
    }

    const recipientData = extracted
      ? {
        name: extracted.name || order.customer_name || '',
        phone: extracted.phone || order.phone || '',
        address: extracted.address || order.address || '',
        city: extracted.city || order.city || '',
        department: extracted.department || order.department || '',
        nit: extracted.nit || '',
        paymentMethod: extracted.paymentMethod || (isPickup ? 'SIN COBRO' : 'CONTRA ENTREGA')
      }
      : {
        name: order.customer_name || '',
        phone: order.phone || '',
        address: order.address || '',
        city: order.city || '',
        department: order.department || '',
        nit: '',
        paymentMethod: isPickup ? 'SIN COBRO' : 'CONTRA ENTREGA'
      };

    // Documento del cliente: preferir customers.identification > orders.customer_document > notas
    {
      const docFromCustomers = order.customer_identification ? String(order.customer_identification).trim() : '';
      const docFromOrder = order.customer_document ? String(order.customer_document).trim() : '';
      const docFromNotes = recipientData.nit ? String(recipientData.nit).trim() : '';
      recipientData.nit = docFromCustomers || docFromOrder || docFromNotes || '';
    }

    // Remitente por defecto
    const senderData = {
      name: 'PERLAS EXPLOSIVAS COLOMBIA SAS',
      nit: '901749888',
      phone: '3105244298',
      address: 'Calle 50 # 31-46',
      city: 'Medellín',
      department: 'Antioquia',
      email: 'logistica@perlas-explosivas.com'
    };

    // Construir payload unificado para el PDF (alineado con generateGuide)
    const guideData = {
      order_number: order.order_number,
      delivery_method: order.delivery_method,
      transport_company: carrierData.name,
      total_amount: isPickup ? 0 : order.total_amount,
      notes: order.notes || '',
      created_at: new Date(),

      // Campos legacy esperados por la plantilla
      customer_name: recipientData.name,
      phone: recipientData.phone,
      address: recipientData.address,
      city: recipientData.city,
      department: recipientData.department,
      customer_nit: recipientData.nit,
      payment_method: recipientData.paymentMethod,
      email: order.email || '',

      // Estructurados
      sender: senderData,
      recipient: recipientData,
      driver: {}
    };

    // Generar PDF
    const pdfBuffer = await pdfService.generateShippingGuide(guideData, carrierData);

    // Guardar archivo
    const savedFile = await pdfService.saveShippingGuide(order.order_number, pdfBuffer);

    // Actualizar pedido con la ruta del archivo
    await query(
      `UPDATE orders 
       SET shipping_guide_generated = TRUE, shipping_guide_path = ?, updated_at = NOW()
       WHERE id = ?`,
      [savedFile.relativePath, id]
    );

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="guia-envio-${order.order_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Enviar PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generando guía de envío:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando guía de envío'
    });
  }
};

// Obtener pedidos para logística
const getLogisticsOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      delivery_method,
      carrier_id,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;

    // Construir query base - solo pedidos en logística
    let whereClause = 'WHERE o.status = "en_logistica"';
    const params = [];

    if (search) {
      whereClause += ' AND (o.customer_name LIKE ? OR o.order_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (delivery_method) {
      whereClause += ' AND o.delivery_method = ?';
      params.push(delivery_method);
    }

    if (carrier_id) {
      whereClause += ' AND o.carrier_id = ?';
      params.push(carrier_id);
    }

    // Validar campos de ordenamiento
    const validSortFields = ['created_at', 'order_number', 'customer_name', 'delivery_method'];
    const validSortOrders = ['ASC', 'DESC'];

    const orderBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Obtener pedidos
    const orders = await query(
      `SELECT 
        o.id, o.order_number, o.customer_name,
        o.customer_phone as phone, o.customer_address as address, o.customer_email as email,
        o.customer_city as city, o.customer_department as department,
        o.delivery_method, o.carrier_id, o.tracking_number,
        o.payment_method, o.electronic_payment_type, o.shipping_payment_method, o.total_amount, o.shipping_date, o.shipping_guide_generated,
        o.created_at, o.updated_at,
        c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       ${whereClause}
       ORDER BY o.${orderBy} ${order}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Obtener total para paginación
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );
    const total = totalResult[0].total;

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo pedidos de logística:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Marcar pedido como listo para envío
const markOrderReady = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el pedido existe y está en logística
    const order = await query(
      'SELECT id, status, delivery_method, carrier_id FROM orders WHERE id = ?',
      [id]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    if (order[0].status !== 'en_logistica') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden marcar como listos pedidos en logística'
      });
    }

    // Verificar que tiene método de envío
    if (!order[0].delivery_method) {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe tener un método de envío asignado'
      });
    }

    // Verificar que tiene transportadora (excepto recogida en bodega)
    if (order[0].delivery_method !== 'recoge_bodega' && !order[0].carrier_id) {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe tener una transportadora asignada'
      });
    }

    // Actualizar estado
    await query(
      'UPDATE orders SET status = "listo", updated_at = NOW() WHERE id = ?',
      [id]
    );

    emitStatusChange(id, null, order[0].status, 'listo');
    res.json({
      success: true,
      message: 'Pedido marcado como listo para envío'
    });

  } catch (error) {
    console.error('Error marcando pedido como listo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de logística
const getLogisticsStats = async (req, res) => {
  try {
    // Pedidos por método de envío
    const shippingMethodStats = await query(
      `SELECT 
        COALESCE(delivery_method, 'sin_asignar') as method,
        COUNT(*) as count
       FROM orders 
       WHERE status = 'en_logistica'
       GROUP BY delivery_method`,
      []
    );

    // Pedidos por transportadora
    const carrierStats = await query(
      `SELECT 
        c.name as carrier_name,
        COUNT(o.id) as count
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.status = 'en_logistica' AND o.carrier_id IS NOT NULL
       GROUP BY c.id, c.name
       ORDER BY count DESC`,
      []
    );

    // Pedidos sin asignar
    const unassignedOrders = await query(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE status = 'en_logistica' AND (delivery_method IS NULL OR carrier_id IS NULL)`,
      []
    );

    // Guías generadas hoy
    const guidesGeneratedToday = await query(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE shipping_guide_generated = TRUE AND DATE(CONVERT_TZ(updated_at, '+00:00', '-05:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '-05:00'))`,
      []
    );

    res.json({
      success: true,
      data: {
        shippingMethodStats,
        carrierStats,
        unassignedOrders: unassignedOrders[0].count,
        guidesGeneratedToday: guidesGeneratedToday[0].count
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de logística:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Procesar pedido de logística (nuevo endpoint para el modal)
const processOrder = async (req, res) => {
  try {
    const {
      orderId,
      shippingMethod,
      transportCompany,
      trackingNumber,
      shippingPaymentMethod,
      notes
    } = req.body;

    console.log(`📦 Procesando pedido ${orderId} desde logística a empaque`);

    // Verificar que el pedido existe y está en logística
    const order = await query(
      'SELECT id, status, order_number, delivery_method, requires_payment, payment_method, total_amount FROM orders WHERE id = ?',
      [orderId]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    if (order[0].status !== 'en_logistica') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden procesar pedidos en logística'
      });
    }

    // Buscar o crear transportadora si se proporciona
    let carrierId = null;
    if (transportCompany && shippingMethod !== 'recoge_bodega') {
      // Buscar transportadora existente
      const existingCarrier = await query(
        'SELECT id FROM carriers WHERE name = ? AND active = TRUE',
        [transportCompany]
      );

      if (existingCarrier.length) {
        carrierId = existingCarrier[0].id;
      } else {
        // Crear nueva transportadora
        const newCarrier = await query(
          'INSERT INTO carriers (name, code, active, created_at) VALUES (?, ?, TRUE, NOW())',
          [transportCompany, transportCompany.toUpperCase().replace(/\s+/g, '_')]
        );
        carrierId = newCarrier.insertId;
      }
    }

    // CORREGIDO: Actualizar pedido y enviarlo a empaque en lugar de directamente a reparto
    if (shippingMethod === 'recoge_bodega') {
      // Para Recoge en Bodega: no debe cobrar dinero (forzar sin_cobro explícito)
      await query(
        `UPDATE orders 
         SET 
           delivery_method = ?, 
           carrier_id = ?, 
           tracking_number = ?, 
           shipping_payment_method = ?,
           logistics_notes = ?,
           status = 'en_empaque',
           shipping_date = NOW(),
           updated_at = NOW()
         WHERE id = ?`,
        [shippingMethod, carrierId, trackingNumber || null, shippingPaymentMethod || null, notes || null, orderId]
      );
    } else {
      await query(
        `UPDATE orders 
         SET 
           delivery_method = ?, 
           carrier_id = ?, 
           tracking_number = ?, 
           shipping_payment_method = ?,
           logistics_notes = ?,
           status = 'en_empaque',
           shipping_date = NOW(),
           updated_at = NOW()
         WHERE id = ?`,
        [shippingMethod, carrierId, trackingNumber || null, shippingPaymentMethod || null, notes || null, orderId]
      );
    }



    console.log(`✅ Pedido ${order[0].order_number} enviado correctamente a empaque`);
    emitStatusChange(order[0].id, order[0].order_number, order[0].status, 'en_empaque');

    res.json({
      success: true,
      message: 'Pedido enviado a empaque exitosamente'
    });

  } catch (error) {
    console.error('Error procesando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando pedido: ' + error.message
    });
  }
};

/**
 * Extrae datos del destinatario desde notas (prioridad alta).
 * Acepta variantes con/sin acentos y diferentes claves.
 * Devuelve objeto si hay información útil (address o city + (name|phone)).
 */
const extractRecipientDataFromNotes = (notes) => {
  if (!notes) return null;

  const raw = String(notes || '');
  const lines = raw.split(/\r?\n/);

  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const getAfterColon = (s) => s.split(':').slice(1).join(':').trim();

  const data = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const ln = norm(trimmed);

    // Formas de pago de envío
    if (/^forma\s*de\s*pago\s*de\s*envio\s*:/.test(ln) || /^pago\s*envio\s*:/.test(ln) || /^metodo\s*envio\s*:/.test(ln)) {
      data.shippingPaymentMethod = getAfterColon(trimmed);
      continue;
    }
    // Medio de pago del pedido
    if (/^medio\s*de\s*pago\s*:/.test(ln) || /^metodo\s*de\s*pago\s*:/.test(ln) || /^pago\s*:/.test(ln)) {
      data.paymentMethod = getAfterColon(trimmed);
      continue;
    }
    // Nombre/NIT
    if (/^(nombre|destinatario)\s*:/.test(ln)) {
      data.name = getAfterColon(trimmed);
      continue;
    }
    if (/^nit\s*:/.test(ln) || /^documento\s*:/.test(ln)) {
      data.nit = getAfterColon(trimmed);
      continue;
    }
    // Teléfono / WhatsApp
    if (/^(telefono|tel|celular|cel|whatsapp)\s*:/.test(ln)) {
      data.phone = getAfterColon(trimmed);
      continue;
    }
    // Departamento
    if (/^(departamento(\s*destino)?|depto|dpto|department)\s*:/.test(ln)) {
      data.department = getAfterColon(trimmed);
      continue;
    }
    // Ciudad y variantes
    if (/^(ciudad(\s*destino)?|municipio|city)\s*:/.test(ln)) {
      data.city = getAfterColon(trimmed);
      continue;
    }
    // Destino: puede venir "DESTINO: Ciudad - Departamento"
    if (/^destino\s*:/.test(ln)) {
      const v = getAfterColon(trimmed);
      const parts = v.split(/[-,]/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 1 && !data.city) data.city = parts[0];
      if (parts.length >= 2 && !data.department) data.department = parts[1];
      continue;
    }
    // Dirección y variantes
    if (/^(direccion(\s*de\s*(envio|entrega))?|dir|direccion envio|direccion entrega|direccion destinatario)\s*:/.test(ln)) {
      data.address = getAfterColon(trimmed);
      continue;
    }
  }

  // Retornar si hay dirección, o ciudad con algún identificador de persona
  const hasUseful =
    !!data.address ||
    (!!data.city && (!!data.name || !!data.phone || !!data.nit));

  return hasUseful ? data : null;
};

// Generar guía simplificada (para el modal)
const generateGuide = async (req, res) => {
  try {
    const {
      orderId,
      shippingMethod,
      transportCompany,
      // Datos legacy (mantener compatibilidad)
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerDepartment,
      notes,
      // Nuevos objetos para guía personalizada
      sender,
      recipient,
      driver
    } = (req.body || {});

    // Obtener información del pedido
    const orderInfo = await query(
      'SELECT o.order_number, o.total_amount, o.notes, o.delivery_method, o.customer_document, o.customer_identification FROM orders o WHERE o.id = ?',
      [orderId]
    );

    if (!orderInfo.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // ... (resto del código de generateGuide)
    // Para simplificar, asumimos que el resto de generateGuide sigue igual y solo agregamos la nueva función al final
    // Pero como view_file truncó, mejor agrego la función al final del archivo exportándola correctamente.
    // Voy a usar un bloque al final del archivo.



    const order = orderInfo[0];
    const isPickup = String(shippingMethod || order.delivery_method || '').toLowerCase() === 'recoge_bodega';

    // 1) Remitente (sender): usar el proporcionado o valores por defecto de la empresa
    const senderData = {
      name: sender?.name || 'PERLAS EXPLOSIVAS COLOMBIA SAS',
      nit: sender?.nit || '901749888',
      phone: sender?.phone || '3105244298',
      address: sender?.address || 'Calle 50 # 31-46',
      city: sender?.city || 'Medellín',
      department: sender?.department || 'Antioquia',
      email: sender?.email || 'logistica@perlas-explosivas.com'
    };

    // 2) Destinatario (recipient): Prioridad Notas > recipient del body > datos del pedido
    const extractedData = extractRecipientDataFromNotes(notes ?? order.notes);
    let recipientData;
    if (extractedData) {
      console.log('📦 Usando datos extraídos de SIIGO para destinatario:', extractedData);
      recipientData = {
        name: extractedData.name || recipient?.name || customerName,
        phone: extractedData.phone || recipient?.phone || customerPhone,
        address: extractedData.address || recipient?.address || customerAddress,
        city: extractedData.city || recipient?.city || customerCity,
        department: extractedData.department || recipient?.department || customerDepartment,
        nit: extractedData.nit || recipient?.nit || '',
        paymentMethod: extractedData.paymentMethod || (isPickup ? 'SIN COBRO' : 'CONTRA ENTREGA')
      };
    } else if (recipient && (recipient.name || recipient.address)) {
      recipientData = {
        name: recipient.name || customerName,
        phone: recipient.phone || customerPhone,
        address: recipient.address || customerAddress,
        city: recipient.city || customerCity,
        department: recipient.department || customerDepartment,
        nit: recipient.nit || '',
        paymentMethod: recipient.paymentMethod || (isPickup ? 'SIN COBRO' : 'CONTRA ENTREGA')
      };
    } else {
      console.log('📦 Usando datos del pedido para destinatario');
      recipientData = {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        city: customerCity,
        department: customerDepartment,
        nit: '',
        paymentMethod: (isPickup ? 'SIN COBRO' : 'CONTRA ENTREGA')
      };
    }
    if (isPickup) {
      recipientData.paymentMethod = 'SIN COBRO';
    }

    // Documento del cliente: preferir customers.identification > orders.customer_document > notas
    {
      const docFromCustomers = order.customer_identification ? String(order.customer_identification).trim() : '';
      const docFromOrder = order.customer_document ? String(order.customer_document).trim() : '';
      const docFromNotes = recipientData.nit ? String(recipientData.nit).trim() : '';
      recipientData.nit = docFromCustomers || docFromOrder || docFromNotes || '';
    }

    // 3) Datos del conductor (driver) opcionales
    const driverData = {
      plate: driver?.plate || '',
      name: driver?.name || '',
      whatsapp: driver?.whatsapp || '',
      boxes: driver?.boxes || '',
    };

    // Generar payload para el servicio PDF
    const guideData = {
      order_number: order.order_number,
      delivery_method: shippingMethod,
      transport_company: transportCompany || 'Camión Externo',
      total_amount: isPickup ? 0 : order.total_amount,
      notes: notes || '',
      created_at: new Date(),

      // Destinatario (para compatibilidad con plantillas actuales)
      customer_name: recipientData.name,
      phone: recipientData.phone,
      address: recipientData.address,
      city: recipientData.city,
      department: recipientData.department,
      customer_nit: recipientData.nit,
      payment_method: recipientData.paymentMethod,
      email: order.email || '',

      // Nuevos campos estructurados
      sender: senderData,
      recipient: recipientData,
      driver: driverData
    };

    const carrierData = {
      name: transportCompany || 'Camión Externo',
      code: transportCompany ? transportCompany.toUpperCase().replace(/\s+/g, '_') : 'CAMION_EXTERNO',
      contact_phone: '3105244298',
      contact_email: 'logistica@perlas-explosivas.com'
    };

    // Generar PDF
    const pdfBuffer = await pdfService.generateShippingGuide(guideData, carrierData);

    // Verificar que el PDF se generó correctamente
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF buffer está vacío');
    }

    console.log(`📄 PDF generado exitosamente: ${pdfBuffer.length} bytes`);

    // Guardar archivo en el sistema de archivos
    try {
      const savedFile = await pdfService.saveShippingGuide(order.order_number, pdfBuffer);
      console.log('📄 PDF guardado exitosamente:', savedFile.fileName);
      console.log('📁 Ruta completa:', savedFile.filePath);
    } catch (saveError) {
      console.error('❌ Error guardando PDF:', saveError);
      // Continuar con el envío aunque no se haya guardado
    }

    // Verificar integridad del PDF
    const header = pdfBuffer.toString('ascii', 0, Math.min(10, pdfBuffer.length));
    if (!header.startsWith('%PDF-')) {
      console.error('❌ PDF generado no tiene header válido:', header);
      throw new Error('PDF generado está corrupto');
    }

    console.log('✅ PDF válido con header:', header.substring(0, 8));

    // Configurar headers correctos para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="guia-envio-${order.order_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Enviar PDF como buffer (usar send con Buffer para evitar problemas de encoding)
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generando guía:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando guía de envío',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener pedidos listos para entrega agrupados por tipo
const getReadyForDeliveryOrders = async (req, res) => {
  try {
    console.log('🔍 Iniciando getReadyForDeliveryOrders...');

    // Parámetros de monitor para depurar un pedido específico (por id o número)
    const { monitorId: monitorIdRaw, monitorNumber: monitorNumberRaw } = req.query || {};
    const monitorId = monitorIdRaw ? Number(monitorIdRaw) : null;
    const monitorNumber = monitorNumberRaw ? String(monitorNumberRaw).trim() : null;
    let debugMonitor = null;

    if (monitorId || monitorNumber) {
      debugMonitor = {
        monitorId,
        monitorNumber,
        foundInReady: false,
        reasonExcluded: null,
        orderSnapshot: null,
        classification: null
      };
      try {
        const monitorRows = await query(
          `SELECT id, order_number, status, delivery_method, payment_method, requires_payment, carrier_id 
           FROM orders 
           WHERE ${monitorId ? 'id = ?' : 'order_number = ?'} 
           LIMIT 1`,
          [monitorId ? monitorId : monitorNumber]
        );
        if (monitorRows.length) {
          debugMonitor.orderSnapshot = monitorRows[0];
          const s = String(monitorRows[0].status || '');
          const allowed = ['listo_para_entrega', 'empacado', 'listo', 'en_reparto'];
          if (!allowed.includes(s)) {
            debugMonitor.reasonExcluded = `status_excluded:${s}`;
          }
        } else {
          debugMonitor.reasonExcluded = 'not_found';
        }
      } catch (e) {
        console.log('⚠️ Monitor fetch error:', e?.message);
      }
    }

    // Primero hacer una query simple para debuggear
    const simpleOrders = await query(
      `SELECT id, order_number, customer_name, status, delivery_method 
       FROM orders 
       WHERE status IN ('listo_para_entrega', 'empacado', 'listo')
       LIMIT 5`,
      []
    );

    console.log('📦 Pedidos simples encontrados:', simpleOrders.length);

    if (simpleOrders.length === 0) {
      return res.json({
        success: true,
        data: {
          groupedOrders: {
            recoge_bodega: [],
            interrapidisimo: [],
            transprensa: [],
            envia: [],
            camion_externo: [],
            mensajero_julian: [],
            mensajero_juan: [],
            otros: []
          },
          stats: {
            total: 0,
            recoge_bodega: 0,
            interrapidisimo: 0,
            transprensa: 0,
            envia: 0,
            camion_externo: 0,
            mensajero_julian: 0,
            mensajero_juan: 0,
            otros: 0
          },
          totalReady: 0,
          monitor: debugMonitor
        }
      });
    }

    // Obtener pedidos listos para entrega con información de transportadora y mensajero
    const readyOrders = await query(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.status, o.delivery_method,
        o.total_amount, o.created_at, o.updated_at, o.carrier_id,
        o.assigned_messenger_id,
        o.assigned_messenger,
        o.payment_method,
        o.requires_payment,
        o.payment_amount,
        o.paid_amount,
        o.siigo_balance,
        o.shipping_payment_method,
        o.delivery_fee_exempt,
        o.delivery_fee,
        o.validation_status,
        o.payment_evidence_path,
        o.is_pending_payment_evidence,
        o.notes,
        o.siigo_observations,
        c.name as carrier_name,
        u.username as messenger_username,
        u.full_name as messenger_name,
        (SELECT COUNT(*) FROM cash_register cr WHERE cr.order_id = o.id) AS cash_register_count,
        (SELECT COUNT(*) FROM wallet_validations wv WHERE wv.order_id = o.id AND wv.validation_status = 'approved') AS wallet_validations_approved,
        (SELECT COUNT(*) FROM cash_register crc WHERE crc.order_id = o.id AND crc.status = 'collected') AS cash_register_collected_count
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       LEFT JOIN users u ON (CASE WHEN o.assigned_messenger IS NOT NULL AND o.assigned_messenger <> '' THEN CAST(o.assigned_messenger AS UNSIGNED) ELSE o.assigned_messenger_id END) = u.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo', 'en_reparto')
       ORDER BY o.created_at ASC`,
      []
    );

    console.log('📦 Pedidos completos encontrados:', readyOrders.length);

    // Agrupar por tipo de entrega
    const groupedOrders = {
      recoge_bodega: [],
      recoge_bodega_credito: [],
      interrapidisimo: [],
      transprensa: [],
      envia: [],
      camion_externo: [],
      mensajeria_local: [],
      mensajero_julian: [],
      mensajero_juan: [],
      otros: []
    };

    readyOrders.forEach(order => {
      // Helper para normalizar texto
      const normalizeText = (text) => {
        if (!text) return '';
        return text.toLowerCase()
          .replace(/á/g, 'a')
          .replace(/é/g, 'e')
          .replace(/í/g, 'i')
          .replace(/ó/g, 'o')
          .replace(/ú/g, 'u')
          .replace(/ñ/g, 'n')
          .trim();
      };

      const deliveryMethod = order.delivery_method;
      const carrierName = order.carrier_name;

      // Determinar mensajero asignado (compatibilidad con assigned_messenger_id y assigned_messenger)
      const messengerId = order.assigned_messenger_id || (order.assigned_messenger ? parseInt(order.assigned_messenger, 10) : null);
      const messengerName = order.messenger_name || order.messenger_username || '';

      const normalizedCarrier = normalizeText(carrierName);
      const normalizedMethod = normalizeText(deliveryMethod);
      const normalizedMessenger = normalizeText(messengerName);

      // Pre-parsear datos de envío desde notas para el frontend
      // Priorizar notes solo si tiene contenido real, si no usar siigo_observations
      const textToParse = (order.notes && order.notes.trim().length > 0)
        ? order.notes
        : order.siigo_observations;

      order.parsed_shipping_data = extractRecipientDataFromNotes(textToParse);

      // Si hay mensajero asignado, priorizar agrupación por mensajero
      if (messengerId) {
        if (normalizedMessenger.includes('julian')) {
          groupedOrders.mensajero_julian.push(order);
        } else if (normalizedMessenger.includes('juan')) {
          groupedOrders.mensajero_juan.push(order);
        } else {
          // Otros mensajeros: mantener en mensajería local
          groupedOrders.mensajeria_local.push(order);
        }
        return;
      }

      // Sin mensajero asignado: clasificar por método/transportadora
      // Detección de cliente crédito/no cobro para separar tarjeta
      const pmNorm = normalizeText(order.payment_method);
      const isCredit = pmNorm.includes('cliente_credito') || pmNorm.includes('credito') || pmNorm.includes('credit');
      const requiresPayment = order.requires_payment === 1 || order.requires_payment === true || order.requires_payment === '1';
      const walletApproved = Number(order.wallet_validations_approved || 0) > 0;
      const cashPaid = Number(order.cash_register_count || 0) > 0; // legado
      const cashLike = pmNorm === 'efectivo' || pmNorm === 'contraentrega' || pmNorm === 'contado' || pmNorm === 'cash';
      // Considerar SIN COBRO únicamente si ya está validado por cartera o explícitamente no requiere pago y no es efectivo/contraentrega
      const isNoCharge = walletApproved || (!requiresPayment && !cashLike);

      if (normalizedMethod === 'recoge_bodega' || normalizedMethod === 'recogida_tienda') {
        if (isCredit || isNoCharge) {
          groupedOrders.recoge_bodega_credito.push(order);
        } else {
          groupedOrders.recoge_bodega.push(order);
        }
      } else if (normalizedCarrier.includes('inter') && normalizedCarrier.includes('rapidisimo')) {
        groupedOrders.interrapidisimo.push(order);
      } else if (normalizedCarrier.includes('transprensa')) {
        groupedOrders.transprensa.push(order);
      } else if (normalizedCarrier.includes('envia')) {
        groupedOrders.envia.push(order);
      } else if (normalizedCarrier.includes('camion') && normalizedCarrier.includes('externo')) {
        groupedOrders.camion_externo.push(order);
      } else if (normalizedMethod === 'mensajeria_local' || normalizedMethod === 'mensajero' ||
        normalizedCarrier.includes('mensajeria') || normalizedCarrier === 'mensajeria local' ||
        normalizedCarrier.includes('mensajero')) {
        groupedOrders.mensajeria_local.push(order);
      } else if (!normalizedMethod && !normalizedCarrier) {
        groupedOrders.mensajeria_local.push(order);
      } else {
        groupedOrders.otros.push(order);
      }
    });

    // Marcar clasificación del monitor (si aplica)
    if (debugMonitor) {
      try {
        const buckets = [
          'recoge_bodega',
          'recoge_bodega_credito',
          'interrapidisimo',
          'transprensa',
          'envia',
          'camion_externo',
          'mensajeria_local',
          'mensajero_julian',
          'mensajero_juan',
          'otros'
        ];
        for (const b of buckets) {
          const list = groupedOrders[b] || [];
          const hit = list.find(o =>
            (debugMonitor.monitorId && Number(o.id) === Number(debugMonitor.monitorId)) ||
            (debugMonitor.monitorNumber && String(o.order_number).trim() === String(debugMonitor.monitorNumber).trim())
          );
          if (hit) {
            debugMonitor.foundInReady = true;
            debugMonitor.classification = b;
            break;
          }
        }
      } catch (e) {
        console.log('⚠️ Monitor classify error:', e?.message);
      }
    }

    // Calcular estadísticas
    const stats = {
      total: readyOrders.length,
      recoge_bodega: groupedOrders.recoge_bodega.length,
      recoge_bodega_credito: groupedOrders.recoge_bodega_credito.length,
      interrapidisimo: groupedOrders.interrapidisimo.length,
      transprensa: groupedOrders.transprensa.length,
      envia: groupedOrders.envia.length,
      camion_externo: groupedOrders.camion_externo.length,
      mensajeria_local: groupedOrders.mensajeria_local.length,
      mensajero_julian: groupedOrders.mensajero_julian.length,
      mensajero_juan: groupedOrders.mensajero_juan.length,
      otros: groupedOrders.otros.length
    };

    res.json({
      success: true,
      data: {
        groupedOrders,
        stats,
        totalReady: readyOrders.length,
        monitor: debugMonitor
      }
    });

  } catch (error) {
    console.error('Error obteniendo pedidos listos para entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Asignar mensajero a pedido
const assignMessenger = async (req, res) => {
  try {
    const { orderId, messengerId } = req.body;

    console.log(`📦 Asignando mensajero ${messengerId} al pedido ${orderId}`);

    // Verificar que el pedido existe
    const order = await query(
      'SELECT id, status, order_number, delivery_method, assigned_messenger_id, messenger_status FROM orders WHERE id = ?',
      [orderId]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Verificar que el mensajero existe en la tabla users
    const messenger = await query(
      'SELECT id, username, full_name FROM users WHERE id = ? AND role = "mensajero" AND active = TRUE',
      [messengerId]
    );

    if (!messenger.length) {
      return res.status(400).json({
        success: false,
        message: 'Mensajero no válido'
      });
    }

    const messengerName = messenger[0].full_name || messenger[0].username;
    console.log(`✅ Mensajero válido: ${messengerName}`);

    // Reglas de reasignación: no permitir si el mensajero ya aceptó o inició la entrega
    const currentStatus = String(order[0].messenger_status || '').toLowerCase();
    if (['accepted', 'in_delivery', 'delivered'].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'No se puede reasignar: el mensajero ya aceptó o inició la entrega'
      });
    }

    // Idempotencia: si ya está asignado al mismo mensajero y aún no ha aceptado, responder OK
    if (
      Number(order[0].assigned_messenger_id || 0) === Number(messengerId) &&
      (!currentStatus || currentStatus === 'assigned')
    ) {
      await query(
        `UPDATE orders 
         SET 
           status = CASE 
             WHEN status IN ('en_logistica','en_empaque','empacado','listo') THEN 'listo_para_entrega'
             ELSE status
           END,
           updated_at = NOW()
         WHERE id = ?`,
        [orderId]
      );
      return res.json({
        success: true,
        message: `Pedido asignado a ${messengerName} exitosamente`
      });
    }

    // Actualizar pedido con asignación consistente para el flujo de mensajero:
    // - assigned_messenger_id (FK)
    // - assigned_messenger (compatibilidad legado)
    // - messenger_status = 'assigned' (para que pueda aceptar)
    // - status: mover a 'listo_para_entrega' solo si está en estados previos del flujo
    await query(
      `UPDATE orders 
       SET 
         assigned_messenger_id = ?, 
         assigned_messenger = ?, 
         messenger_status = 'assigned',
         status = CASE 
           WHEN status IN ('en_logistica','en_empaque','empacado','listo') THEN 'listo_para_entrega'
           ELSE status
         END,
         updated_at = NOW()
       WHERE id = ?`,
      [messengerId, String(messengerId), orderId]
    );

    // Crear/actualizar tracking de entrega con assigned_at
    const existingTracking = await query(
      'SELECT id FROM delivery_tracking WHERE order_id = ? AND messenger_id = ?',
      [orderId, messengerId]
    );

    if (existingTracking.length) {
      await query(
        'UPDATE delivery_tracking SET assigned_at = NOW() WHERE id = ?',
        [existingTracking[0].id]
      );
    } else {
      await query(
        `INSERT INTO delivery_tracking (order_id, messenger_id, assigned_at) 
         VALUES (?, ?, NOW())`,
        [orderId, messengerId]
      );
    }

    console.log(`✅ Pedido ${order[0].order_number} asignado exitosamente`);

    res.json({
      success: true,
      message: `Pedido asignado a ${messengerName} exitosamente`
    });

  } catch (error) {
    console.error('Error asignando mensajero:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Marcar pedido como entregado a transportadora
const markDeliveredToCarrier = async (req, res) => {
  try {
    const { orderId, status, delivery_notes } = req.body;

    // Verificar que el pedido existe (incluir delivery_method para validaciones)
    const order = await query(
      'SELECT id, status, order_number, delivery_method FROM orders WHERE id = ?',
      [orderId]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Actualizar estado del pedido
    await query(
      `UPDATE orders 
       SET status = ?, delivery_notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [status || 'entregado_transportadora', delivery_notes, orderId]
    );

    {
      const __toStatus = status || 'entregado_transportadora';
      emitStatusChange(orderId, order[0].order_number, order[0].status, __toStatus);
    }
    res.json({
      success: true,
      message: 'Pedido marcado como entregado a transportadora'
    });

  } catch (error) {
    console.error('Error marcando como entregado a transportadora:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Marcar pedido como listo para recoger
const markReadyForPickup = async (req, res) => {
  try {
    const { orderId, status, delivery_notes } = req.body;
    console.log('📦 markReadyForPickup -> body:', { orderId, status, delivery_notes });

    // Verificar que el pedido existe
    const order = await query(
      'SELECT id, status, order_number, delivery_method FROM orders WHERE id = ?',
      [orderId]
    );
    console.log('📦 markReadyForPickup -> order found:', order && order[0] ? { id: order[0].id, status: order[0].status, delivery_method: order[0].delivery_method } : 'not_found');

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Determinar método de entrega (normalizado)
    const methodRaw = String(order[0].delivery_method || '');
    const method = methodRaw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\-]+/g, '_')
      .trim();
    const isPickupMethod =
      method === 'recoge_bodega' ||
      method === 'recogida_tienda' ||
      (method.includes('recoge') && (method.includes('bodega') || method.includes('tienda')));

    console.log('📦 markReadyForPickup -> method:', { methodRaw, methodNormalized: method });

    // Determinar si es cliente a crédito o no requiere cobro
    const requiresPaymentFlag = order[0].requires_payment === 1 || order[0].requires_payment === true || order[0].requires_payment === '1';
    const pmNorm = String(order[0].payment_method || '').toLowerCase();
    const isCreditMethod = ['cliente_credito', 'cliente a credito', 'credito', 'crédito', 'credit'].some(k => pmNorm.includes(k));
    const isCashMethod = ['efectivo', 'contraentrega', 'contado', 'cash'].some(k => pmNorm.includes(k));
    // Permitir si es crédito, no requiere pago, O es método efectivo/contraentrega (pago contra entrega)
    const isCreditOrNoPayment = isCreditMethod || !requiresPaymentFlag || isCashMethod;

    // Si ya está listo para entrega:
    // - Para 'Recoge en Bodega/Tienda' con pago registrado, entregar de una vez
    // - Si no, responder idempotente sin cambios
    if (order[0].status === 'listo_para_entrega') {
      if (isPickupMethod) {
        if (isCreditOrNoPayment) {
          console.log('📦 markReadyForPickup -> ya estaba listo, recoge_bodega crédito/sin cobro/efectivo: entregando ahora');
          await query(
            `UPDATE orders 
             SET status = 'entregado_cliente', delivered_at = NOW(), delivery_notes = ?, updated_at = NOW()
             WHERE id = ?`,
            [delivery_notes || null, orderId]
          );
          emitStatusChange(orderId, order[0].order_number, order[0].status, 'entregado_cliente');
          return res.json({ success: true, message: 'Pedido entregado en bodega' });
        } else {
          const wv = await query('SELECT id FROM wallet_validations WHERE order_id = ? AND validation_status = "approved" LIMIT 1', [orderId]);
          if (wv.length) {
            console.log('📦 markReadyForPickup -> ya estaba listo, recoge_bodega con pago validado por Cartera: entregando ahora');
            await query(
              `UPDATE orders 
               SET status = 'entregado_cliente', delivered_at = NOW(), delivery_notes = ?, updated_at = NOW()
               WHERE id = ?`,
              [delivery_notes || null, orderId]
            );
            emitStatusChange(orderId, order[0].order_number, order[0].status, 'entregado_cliente');
            return res.json({ success: true, message: 'Pedido entregado en bodega' });
          } else {
            return res.status(400).json({
              success: false,
              message: 'El pago debe ser validado por Cartera antes de marcar como LISTO.'
            });
          }
        }
      }
      console.log('📦 markReadyForPickup -> ya estaba listo_para_entrega');
      return res.json({ success: true, message: 'Pedido ya estaba listo para entrega' });
    }

    // Validación adicional: para 'Recoge en Bodega' no permitir marcar como listo
    // si no se ha validado previamente el pago por Cartera.
    if (isPickupMethod && !isCreditOrNoPayment) {
      const wv = await query('SELECT id FROM wallet_validations WHERE order_id = ? AND validation_status = "approved" LIMIT 1', [orderId]);
      if (!wv.length) {
        return res.status(400).json({
          success: false,
          message: 'El pago debe ser validado por Cartera antes de marcar como LISTO.'
        });
      }
    }

    // Actualizar estado del pedido
    const requestedStatus = status || 'listo_para_recoger';
    // Mapeo a enum válido en BD: 'listo_para_recoger' -> 'listo_para_entrega'
    const dbStatus = requestedStatus === 'listo_para_recoger' ? 'listo_para_entrega' : requestedStatus;

    // Si es recoge en bodega/tienda, entregar solo si no requiere cobro o si Cartera validó el pago
    if (['recoge_bodega', 'recogida_tienda'].includes(method)) {
      if (!isCreditOrNoPayment) {
        const wv = await query('SELECT id FROM wallet_validations WHERE order_id = ? AND validation_status = "approved" LIMIT 1', [orderId]);
        if (!wv.length) {
          return res.status(400).json({ success: false, message: 'El pago debe ser validado por Cartera antes de ENTREGAR en bodega' });
        }
      }
      console.log('📦 markReadyForPickup -> recoge_bodega: marcando como entregado_cliente');
      await query(
        `UPDATE orders 
         SET status = 'entregado_cliente', delivered_at = NOW(), delivery_notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [delivery_notes || null, orderId]
      );
      return res.json({
        success: true,
        message: 'Pedido entregado en bodega'
      });
    }

    console.log('📦 markReadyForPickup -> updating status', { orderId, dbStatus });
    await query(
      `UPDATE orders 
       SET status = ?, delivery_notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [dbStatus, delivery_notes, orderId]
    );

    emitStatusChange(orderId, order[0].order_number, order[0].status, dbStatus);

    res.json({
      success: true,
      message: 'Pedido marcado como listo para recoger'
    });

  } catch (error) {
    console.error('Error marcando como listo para recoger:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error?.message
    });
  }
};

// Marcar pedido como en reparto
const markInDelivery = async (req, res) => {
  try {
    const { orderId, messengerId, status, delivery_notes } = req.body;

    // Verificar que el pedido existe
    const order = await query(
      'SELECT id, status, order_number, requires_payment, payment_method, validation_status FROM orders WHERE id = ?',
      [orderId]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Política: antes de poner en reparto, el producto debe estar pagado/validado por Cartera
    const requiresPayment = order[0].requires_payment === 1 || order[0].requires_payment === true || order[0].requires_payment === '1';
    const pm = String(order[0].payment_method || '').toLowerCase();
    const isCredit = ['cliente_credito', 'credito', 'crédito', 'cliente a credito'].some(k => pm.includes(k));
    const isCashMethod = ['efectivo', 'contraentrega', 'contado', 'cash'].some(k => pm.includes(k));
    const validated = String(order[0].validation_status || '').toLowerCase() === 'approved';

    // Permitir si es crédito, validado, O es efectivo/contraentrega (se cobra en entrega)
    if (requiresPayment && !isCredit && !validated && !isCashMethod) {
      return res.status(400).json({
        success: false,
        message: 'No se puede pasar a reparto: Cartera debe validar el pago primero.'
      });
    }

    if (messengerId) {
      await query(
        `UPDATE orders 
         SET 
           status = ?, 
           assigned_messenger_id = ?, 
           assigned_messenger = ?, 
           messenger_status = 'in_delivery',
           delivery_notes = ?, 
           updated_at = NOW()
         WHERE id = ?`,
        [status || 'en_reparto', messengerId, String(messengerId), delivery_notes, orderId]
      );
    } else {
      await query(
        `UPDATE orders 
         SET 
           status = ?, 
           delivery_notes = ?, 
           updated_at = NOW()
         WHERE id = ?`,
        [status || 'en_reparto', delivery_notes, orderId]
      );
    }

    {
      const __toStatus = status || 'en_reparto';
      emitStatusChange(orderId, order[0].order_number, order[0].status, __toStatus);
    }
    res.json({
      success: true,
      message: 'Pedido marcado como en reparto'
    });

  } catch (error) {
    console.error('Error marcando como en reparto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Recibir pago en bodega (efectivo o transferencia) con evidencia fotográfica
const receivePickupPayment = async (req, res) => {
  try {
    console.log('[DEBUG receivePickupPayment] Headers:', req.headers['content-type']);
    console.log('[DEBUG receivePickupPayment] Body:', req.body);
    console.log('[DEBUG receivePickupPayment] File:', req.file);

    // Política: requiere rol Cartera (o Admin). Soporta sistema de roles avanzado.
    const baseRole = String(req.user?.role || '').toLowerCase();
    const roles = Array.isArray(req.user?.roles) ? req.user.roles.map(r => String(r.role_name || '').toLowerCase()) : [];
    const isCartera = baseRole === 'cartera' || roles.includes('cartera');
    const isAdmin = req.user?.isSuperAdmin || baseRole === 'admin' || roles.includes('admin');
    const isLogistica = baseRole === 'logistica' || roles.includes('logistica');
    // Permitir a Cartera/Admin registrar y aceptar en el acto; Logística puede registrar como pendiente
    if (!isCartera && !isAdmin && !isLogistica) {
      console.log('[DEBUG] Acceso denegado - rol:', baseRole, 'roles:', roles);
      return res.status(403).json({ success: false, message: 'Acceso denegado: se requiere rol Cartera, Logística o Admin para registrar pagos en bodega.' });
    }
    const { orderId, payment_method, amount, notes } = req.body || {};
    const userId = req.user?.id;

    if (!orderId) {
      console.log('[DEBUG] orderId faltante');
      return res.status(400).json({ success: false, message: 'orderId es requerido' });
    }

    const rows = await query(
      'SELECT id, order_number, status, delivery_method, total_amount, payment_method AS order_payment_method FROM orders WHERE id = ?',
      [orderId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const order = rows[0];
    const deliveryMethod = (order.delivery_method || '').toLowerCase();
    if (!['recoge_bodega', 'recogida_tienda'].includes(deliveryMethod)) {
      return res.status(400).json({ success: false, message: 'El pedido no es de tipo Recoge en Bodega' });
    }

    const method = (payment_method || order.order_payment_method || 'efectivo').toLowerCase();
    const amt = Number(amount) > 0 ? Number(amount) : Number(order.total_amount || 0);

    // Solo requiere foto para trasferencias. Efectivo/contraentrega puede ser sin foto.
    const isTransfer = method === 'transferencia' || method.includes('transfer');
    if (isTransfer && !req.file) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar foto del comprobante de transferencia' });
    }
    const evidence = req.file ? `Evidencia: ${req.file.filename} (${req.file.path})` : 'Sin evidencia fotográfica (efectivo)';

    // Evitar pagos duplicados para el mismo pedido
    const existingPayment = await query('SELECT id, status FROM cash_register WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);

    // Decidir si se acepta inmediatamente
    // IMPORTANTE: Solo Cartera puede aceptar pagos en efectivo (para control de caja)
    // Logística solo REGISTRA el pago como pendiente
    const cashLike = ['efectivo', 'contado', 'contraentrega', 'cash'].some(k => method.includes(k));

    // CAMBIO: Nadie puede auto-aceptar desde Logística.
    // Todos los pagos deben pasar por el flujo de aceptación de Cartera.
    const acceptNow = false;

    // Si ya hay registro y podemos aceptar ahora, actualizar a collected en lugar de duplicar
    if (existingPayment.length) {
      const row = existingPayment[0];
      if (acceptNow && String(row.status) !== 'collected') {
        await query(
          `UPDATE cash_register
             SET status = 'collected', accepted_by = ?, accepted_at = NOW(), accepted_amount = ?
           WHERE id = ?`,
          [userId || null, amt, row.id]
        );
        await query('UPDATE orders SET updated_at = NOW() WHERE id = ?', [orderId]);
        return res.json({ success: true, message: 'Pago aceptado (Cartera)', data: { id: row.id, accepted: true } });
      }
      // Idempotente: si ya estaba aceptado, responder 200 y no 409
      if (String(row.status) === 'collected') {
        return res.json({ success: true, message: 'Pago ya estaba aceptado', data: { id: row.id, accepted: true } });
      }
      return res.status(409).json({ success: false, message: 'El pago ya fue registrado previamente para este pedido' });
    }

    // Insertar nuevo registro: aceptado (solo Cartera/Admin) o pendiente (Logística)
    if (acceptNow) {
      // Solo Cartera/Admin llegan aquí
      await query(
        `INSERT INTO cash_register (
           order_id, amount, payment_method, delivery_method, registered_by, notes, status, accepted_by, accepted_at, accepted_amount, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'collected', ?, NOW(), ?, NOW())`,
        [
          orderId,
          amt,
          method,
          deliveryMethod || 'recoge_bodega',
          userId || null,
          `${evidence}${notes ? ' - ' + notes : ''}`,
          userId || null,
          amt
        ]
      );
      await query('UPDATE orders SET updated_at = NOW() WHERE id = ?', [orderId]);
      return res.json({ success: true, message: 'Pago registrado y aceptado (Cartera)', data: { accepted: true } });
    } else {
      // Logística registra como pendiente; Cartera lo acepta luego desde su panel
      await query(
        `INSERT INTO cash_register (
           order_id, amount, payment_method, delivery_method, registered_by, notes, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [
          orderId,
          amt,
          method,
          deliveryMethod || 'recoge_bodega',
          userId || null,
          `${evidence}${notes ? ' - ' + notes : ''}`
        ]
      );
      await query('UPDATE orders SET updated_at = NOW() WHERE id = ?', [orderId]);
      return res.json({ success: true, message: 'Pago registrado. Pendiente de aceptación por Cartera.', data: { accepted: false, pending: true } });
    }
  } catch (error) {
    console.error('Error en receivePickupPayment:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Entregar pedido en bodega (Recoge en Bodega)

// Marcar entrega en bodega (para Recoge en Bodega)
const markPickupDelivered = async (req, res) => {
  try {
    const { orderId, delivery_notes } = req.body;
    console.log('📦 markPickupDelivered -> body:', { orderId, delivery_notes });

    // Verificar que el pedido existe
    const orderRows = await query(
      'SELECT id, status, order_number, delivery_method, requires_payment, payment_method, validation_status, approved_by FROM orders WHERE id = ?',
      [orderId]
    );

    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const order = orderRows[0];
    const methodRaw = String(order.delivery_method || '');
    const method = methodRaw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\-]+/g, '_')
      .trim();
    const isPickupMethod =
      method === 'recoge_bodega' ||
      method === 'recogida_tienda' ||
      (method.includes('recoge') && (method.includes('bodega') || method.includes('tienda')));

    // Determinar si es cliente a crédito o no requiere cobro (alineado con getReadyForDeliveryOrders)
    const normalize = (s) => String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const requiresPaymentFlag = order.requires_payment === 1 || order.requires_payment === true || order.requires_payment === '1';
    const pmNorm = normalize(order.payment_method || '');
    const isCreditMethod = ['cliente_credito', 'cliente a credito', 'credito', 'credito_cliente', 'credit'].some(k => pmNorm.includes(k));
    const cashLike = ['efectivo', 'contraentrega', 'contado', 'cash', 'transferencia'].some(k => pmNorm.includes(k));
    const methodNoCharge = method.includes('sin_cobro') || method.includes('sincobro');
    const isReposicion = pmNorm.includes('reposicion');
    // Autoritativo: si requires_payment = 0 (no requiere cobro), permitir entregar aunque el método sea 'efectivo'
    const isCreditOrNoPayment = isCreditMethod || methodNoCharge || !requiresPaymentFlag || isReposicion;
    if (!isPickupMethod) {
      return res.status(400).json({ success: false, message: 'Esta acción solo aplica para Recoge en Bodega/Tienda' });
    }

    // Validación para Bodega:
    // - Si el método de pago del pedido es efectivo/contado/contraentrega -> SIEMPRE exigir aceptación de caja (collected),
    //   incluso si requires_payment=0 por un error de datos.
    // - Si no es cash-like y no es crédito/no cobro -> exigir validación aprobada (wallet_validations.approved)
    if (isPickupMethod) {
      const cashLikeStrong = ['efectivo', 'contado', 'contraentrega', 'cash'].some(k => pmNorm.includes(k));
      if (cashLikeStrong) {
        const collected = await query('SELECT COUNT(*) AS cnt FROM cash_register WHERE order_id = ? AND status = "collected"', [orderId]);
        const hasCollected = Number(collected?.[0]?.cnt || 0) > 0;
        if (!hasCollected) {
          return res.status(400).json({ success: false, message: 'Cartera/Logística debe aceptar el pago en caja antes de ENTREGAR' });
        }
      } else if (!isCreditOrNoPayment) {
        // Aceptar si tiene validación en wallet_validations O si ya fue aprobado directamente en la orden (flujo POS)
        const wv = await query('SELECT id FROM wallet_validations WHERE order_id = ? AND validation_status = "approved" LIMIT 1', [orderId]);
        const isDirectlyApproved = order.approved_by != null || (order.validation_status === 'approved');

        if (!wv.length && !isDirectlyApproved) {
          return res.status(400).json({ success: false, message: 'Cartera debe aprobar el pago antes de ENTREGAR en bodega' });
        }
      }
    }

    // Actualizar estado a entregado_cliente (enum existente). En UI se mostrará "Entregado en Bodega" para recoge_bodega.
    await query(
      `UPDATE orders 
       SET status = 'entregado_cliente', delivered_at = NOW(), delivery_notes = ?, updated_at = NOW()
       WHERE id = ? `,
      [delivery_notes || null, orderId]
    );

    return res.json({ success: true, message: 'Pedido entregado en bodega (estado: entregado_cliente)' });
  } catch (error) {
    console.error('Error marcando entrega en bodega:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error?.message });
  }
};

/**
 * Generar planilla de entrega por transportadora (PDF con firmas)
 * Query params:
 *  - carrierId (requerido)
 *  - from (YYYY-MM-DD) opcional
 *  - to (YYYY-MM-DD) opcional
 */
const generateCarrierManifest = async (req, res) => {
  try {
    const { carrierId, from, to } = req.query;

    if (!carrierId) {
      return res.status(400).json({ success: false, message: 'carrierId es requerido' });
    }

    // Intentar obtener datos de carrier (si no existe, continuar sin 404)
    const carriers = await query(
      'SELECT id, name, code, active FROM carriers WHERE id = ?',
      [carrierId]
    );
    const carrierName = carriers.length ? (carriers[0].name || `Carrier ${carrierId} `) : `Carrier ${carrierId} `;
    const carrierCode = carriers.length ? (carriers[0].code || 'carrier') : 'carrier';

    const allowedStatuses = ['listo_para_entrega', 'empacado', 'listo'];

    let where = `WHERE o.carrier_id = ? AND o.status IN(?, ?, ?)`;
    const params = [carrierId, ...allowedStatuses];

    if (from) {
      where += ' AND DATE(o.created_at) >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND DATE(o.created_at) <= ?';
      params.push(to);
    }

    const orders = await query(
      `SELECT
    o.id, o.order_number, o.customer_name, o.customer_phone AS phone
       FROM orders o
       ${where}
       ORDER BY o.created_at ASC`,
      params
    );

    const pdfBuffer = await pdfService.generateCarrierManifest(orders, {
      carrierName,
      date: new Date()
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const code = carrierCode;

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename = "planilla-${code}-${dateStr}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generando planilla de transportadora:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando planilla de transportadora'
    });
  }
};

// Generar planilla para Mensajería Local (opcional por mensajero)
const generateLocalManifest = async (req, res) => {
  try {
    const { messengerId, from, to } = req.query;

    // Si viene messengerId, intentar obtener su nombre (no hacer 404 si no existe)
    let messengerName = null;
    if (messengerId) {
      const users = await query(
        'SELECT id, username, full_name FROM users WHERE id = ?',
        [messengerId]
      );
      if (users.length) {
        messengerName = users[0].full_name || users[0].username || null;
      }
    }

    const allowedStatuses = ['listo_para_entrega', 'empacado', 'listo', 'en_reparto'];

    let where = `WHERE o.status IN(?, ?, ?, ?)`;
    const params = [...allowedStatuses];

    if (messengerId) {
      // Filtrar por mensajero asignado (compatibilidad con assigned_messenger y assigned_messenger_id)
      where += ' AND (o.assigned_messenger_id = ? OR o.assigned_messenger = ?)';
      params.push(Number(messengerId) || 0, String(messengerId));
    } else {
      // Sin mensajero específico: pedidos que van por mensajería local
      // Cubrimos: método de entrega local o con mensajero asignado
      where += ` AND(
      o.assigned_messenger_id IS NOT NULL
        OR(o.assigned_messenger IS NOT NULL AND o.assigned_messenger <> '')
        OR o.delivery_method IN('mensajeria_urbana', 'domicilio')
    )`;
    }

    if (from) {
      where += ' AND DATE(o.created_at) >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND DATE(o.created_at) <= ?';
      params.push(to);
    }

    const orders = await query(
      `SELECT
    o.id, o.order_number, o.customer_name, o.customer_phone AS phone
       FROM orders o
       ${where}
       ORDER BY o.created_at ASC`,
      params
    );

    // Usar el generador de tabla existente
    const pdfBuffer = await pdfService.generateCarrierManifest(orders, {
      carrierName: messengerId ? (messengerName ? `Mensajería Local - ${messengerName} ` : 'Mensajería Local') : 'Mensajería Local',
      date: new Date()
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const code = messengerId ? 'mensajeria_local_mensajero' : 'mensajeria_local';

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename = "planilla-${code}-${dateStr}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generando planilla de mensajería local:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando planilla de mensajería local'
    });
  }
};

/**
 * Devolver pedido a Empaque desde Logística/Listos para Entrega.
 * Limpia asignación de mensajero, transportadora/guía y tracking.
 * También resetea el lock de empaque y deja el pedido en 'en_empaque'.
 * Body: { orderId: number, reason?: string }
 */
const returnToPackaging = async (req, res) => {
  try {
    const { orderId, reason } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId es requerido' });
    }

    const rows = await query(
      'SELECT id, order_number, status FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const before = rows[0];
    const blocked = ['entregado_transportadora', 'entregado_cliente', 'cancelado', 'enviado'];
    if (blocked.includes(String(before.status || '').toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `No se puede devolver a Empaque un pedido con estado "${before.status}"`
      });
    }

    // Limpiar tracking (best-effort, tolerante si la tabla no existe)
    try {
      await query('DELETE FROM delivery_tracking WHERE order_id = ?', [orderId]);
    } catch (e) {
      console.warn('⚠️ No se pudo limpiar delivery_tracking:', e?.sqlMessage || e?.message || e);
    }

    // Resetear asignaciones/envío/lock y mover a en_empaque
    const lockReason = reason ? String(reason).slice(0, 255) : 'return_to_packaging';
    try {
      await query(
        `UPDATE orders
    SET
    status = 'en_empaque',
      assigned_messenger_id = NULL,
      assigned_messenger = NULL,
      messenger_status = NULL,
      carrier_id = NULL,
      tracking_number = NULL,
      shipping_guide_generated = FALSE,
      shipping_guide_path = NULL,
      packaging_lock_user_id = NULL,
      packaging_lock_heartbeat_at = NULL,
      packaging_lock_expires_at = NULL,
      packaging_lock_reason = ?,
      packaging_status = 'in_progress',
      updated_at = NOW()
         WHERE id = ? `,
        [lockReason, orderId]
      );
    } catch (e) {
      // Tolerar entornos sin columnas shipping_guide_*
      const msg = e?.sqlMessage || e?.message || '';
      if ((e?.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(msg)) && /(shipping_guide_generated|shipping_guide_path)/i.test(msg)) {
        await query(
          `UPDATE orders
    SET
    status = 'en_empaque',
      assigned_messenger_id = NULL,
      assigned_messenger = NULL,
      messenger_status = NULL,
      carrier_id = NULL,
      tracking_number = NULL,
      packaging_lock_user_id = NULL,
      packaging_lock_heartbeat_at = NULL,
      packaging_lock_expires_at = NULL,
      packaging_lock_reason = ?,
      packaging_status = 'in_progress',
      updated_at = NOW()
           WHERE id = ? `,
          [lockReason, orderId]
        );
      } else {
        throw e;
      }
    }

    emitStatusChange(orderId, before.order_number, before.status, 'en_empaque');
    return res.json({ success: true, message: 'Pedido devuelto a Empaque', data: { orderId } });
  } catch (error) {
    console.error('Error devolviendo a empaque:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Subir evidencia de pago (Cartera)
const uploadPaymentEvidence = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha subido ninguna imagen'
      });
    }

    // Verificar que el pedido existe
    const orderResult = await query(
      'SELECT id, order_number, status, total_amount FROM orders WHERE id = ?',
      [id]
    );

    if (!orderResult.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const order = orderResult[0];
    const relativePath = '/uploads/delivery_evidence/' + req.file.filename;

    // Extraer datos de pago mixto del request
    const paymentType = req.body.paymentType || 'full';
    const transferAmount = parseFloat(req.body.transferAmount || 0);
    const cashAmount = parseFloat(req.body.cashAmount || 0);

    // Si es pago mixto, actualizar campos adicionales
    if (paymentType === 'mixed' && transferAmount > 0 && cashAmount > 0) {
      console.log('[uploadPaymentEvidence] Pago mixto detectado:', {
        orderId: id,
        transferAmount,
        cashAmount,
        total: order.total_amount
      });

      await query(
        `UPDATE orders 
         SET payment_evidence_path = ?,
      is_pending_payment_evidence = FALSE,
      payment_method = 'transferencia',
      requires_payment = 1,
      payment_amount = ?,
      paid_amount = ?,
      updated_at = NOW()
         WHERE id = ? `,
        [relativePath, cashAmount, transferAmount, id]
      );

      await query(
        `INSERT INTO order_history(order_id, action, description, created_at)
    VALUES(?, 'payment_evidence_uploaded', ?, NOW())`,
        [id, `Pago mixto registrado - Transferencia: $${transferAmount.toLocaleString()} / Efectivo pendiente: $${cashAmount.toLocaleString()}`]
      );
    } else {
      // Pago completo por transferencia
      await query(
        `UPDATE orders 
         SET payment_evidence_path = ?, 
             is_pending_payment_evidence = FALSE,
             payment_method = 'transferencia',
             requires_payment = 0,
             payment_amount = 0,
             paid_amount = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [relativePath, order.total_amount, id]
      );

      await query(
        `INSERT INTO order_history (order_id, action, description, created_at) 
         VALUES (?, 'payment_evidence_uploaded', 'Evidencia de pago subida - Transferencia completa', NOW())`,
        [id]
      );
    }

    // Emitir evento de actualización
    emitStatusChange(id, order.order_number, order.status, order.status);

    res.json({
      success: true,
      message: paymentType === 'mixed'
        ? `Comprobante subido - Mensajero cobrará $${cashAmount.toLocaleString()} en efectivo`
        : 'Comprobante subido - Pago completo',
      data: {
        payment_evidence_path: relativePath,
        paymentType,
        ...(paymentType === 'mixed' && {
          transferAmount,
          cashAmount,
          requires_payment: true
        })
      }
    });

  } catch (error) {
    console.error('Error subiendo comprobante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener conductores externos
const getExternalDrivers = async (req, res) => {
  try {
    const drivers = await query(
      'SELECT * FROM external_drivers ORDER BY name ASC',
      []
    );
    res.json({ success: true, data: drivers });
  } catch (error) {
    console.error('Error obteniendo conductores externos:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Crear conductor externo
const createExternalDriver = async (req, res) => {
  try {
    const { name, plate, phone, city } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    }
    const result = await query(
      'INSERT INTO external_drivers (name, plate, phone, city) VALUES (?, ?, ?, ?)',
      [name, plate || null, phone || null, city || null]
    );
    res.json({
      success: true,
      message: 'Conductor creado exitosamente',
      data: { id: result.insertId, name, plate, phone, city }
    });
  } catch (error) {
    console.error('Error creando conductor externo:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  getCarriers,
  changeOrderCarrier,
  updateDeliveryMethod,
  generateShippingGuide,
  getLogisticsOrders,
  markOrderReady,
  getLogisticsStats,
  processOrder,
  generateGuide,
  getReadyForDeliveryOrders,
  assignMessenger,
  markDeliveredToCarrier,
  markReadyForPickup,
  receivePickupPayment,
  markInDelivery,
  markPickupDelivered,
  returnToPackaging,
  generateCarrierManifest,
  generateLocalManifest,
  uploadPaymentEvidence,
  getExternalDrivers,
  createExternalDriver
};
