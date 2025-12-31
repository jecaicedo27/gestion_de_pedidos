const { query, transaction } = require('../config/database');
const { logOrderUpdateEvent } = require('../utils/auditLogger');
const siigoService = require('../services/siigoService');

// Helpers globales de normalización para evitar errores de ENUM en BD
function normalizePaymentMethod(pm) {
  if (!pm) return pm;
  const v = String(pm).toLowerCase();
  // Canonizar CRÉDITO al valor permitido por la BD: 'cliente_credito'
  if (v === 'cliente_credito' || v === 'credito_cliente' || v === 'cliente-credito' || v === 'credito' || v === 'crédito') {
    return 'cliente_credito';
  }
  if (v === 'pago_electronico' || v === 'electronico') return 'pago_electronico';
  if (v === 'tarjeta' || v === 'tarjeta_de_credito' || v === 'tarjeta_credito') return 'tarjeta_credito';
  if (v === 'transferencia' || v === 'transferencia_bancaria') return 'transferencia';
  if (v === 'contraentrega') return 'contraentrega';
  if (v === 'publicidad') return 'publicidad';
  if (v === 'reposicion' || v === 'reposición') return 'reposicion';
  if (v === 'efectivo') return 'efectivo';
  if (v === 'cheque') return 'cheque';
  if (v === 'cortesia') return 'cortesia';
  if (v === 'datafono') return 'datafono';
  if (v === 'auto') return 'auto';
  return pm;
}

function normalizeDeliveryMethod(dm) {
  if (!dm) return dm;
  const v = String(dm).toLowerCase();
  if (['recoge_bodega', 'recogida_tienda', 'recoger_en_bodega', 'bodega', 'tienda'].includes(v)) return 'recoge_bodega';
  if (v.includes('domicilio')) return 'domicilio';
  if (['mensajeria_urbana', 'mensajeria', 'mensajería', 'mensajeria_local', 'domicilio_local', 'domicilio_ciudad'].includes(v)) return 'mensajeria_urbana';
  if (['envio_nacional', 'nacional', 'transportadora', 'envio'].includes(v)) return 'nacional';
  return dm;
}

// Obtener todos los pedidos con filtros
const getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      dateFrom,
      dateTo,
      search,
      sortBy = 'created_at',
      sortOrder = 'ASC',
      view,
      paymentMethod,
      tags
    } = req.query;

    const offset = (page - 1) * limit;
    const limitOffset = `LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
    const userRole = req.user.role;

    const userId = req.user.id;

    // Construir query base con filtros según el rol - INCLUIR SOFT DELETE
    let whereClause = 'WHERE o.deleted_at IS NULL';
    const params = [];

    // Filtros por rol - Admin solo puede ver para informes, no gestionar
    if (userRole === 'mensajero') {
      whereClause += ' AND (o.status IN ("en_reparto", "entregado_transportadora") OR o.assigned_to = ?)';
      params.push(userId);
    } else if (userRole === 'logistica') {
      // Vista histórica completa para Logística: no restringir por estado por defecto.
      // Si el frontend envía un estado específico, aplicar el filtro.
      if (status) {
        if (status === 'money_in_transit') {
          whereClause += ` AND o.id IN (
            SELECT dt.order_id 
            FROM delivery_tracking dt 
            WHERE dt.payment_method = 'efectivo' 
            AND dt.payment_collected > 0
            AND dt.delivered_at IS NOT NULL 
            AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = dt.order_id)
            AND NOT EXISTS (SELECT 1 FROM cash_closing_details ccd WHERE ccd.order_id = dt.order_id AND ccd.collection_status = 'collected')
            UNION
            SELECT o2.id
            FROM orders o2
            WHERE o2.payment_method = 'efectivo'
            AND o2.status != 'anulado'
            AND (o2.assigned_messenger_id IS NOT NULL OR o2.delivery_method = 'recoge_bodega')
            AND o2.status NOT IN ('entregado', 'entregado_cliente', 'entregado_bodega', 'finalizado', 'completado', 'anulado')
          )`;
        } else {
          whereClause += ' AND o.status = ?';
          params.push(status);
        }
      }
    } else if (userRole === 'empaque') {
      // Rol específico de empaque (si existiera) - pero empaque usa rol logistica
      whereClause += ' AND o.status IN ("en_empaque", "empacado")';
    } else if (userRole === 'cartera') {
      // Cartera: en la vista "Todos los Pedidos" (view=todos) debe ver todo el histórico como Admin/Logística.
      // En otras vistas (p. ej., view=cartera) mantener la restricción por defecto a "revision_cartera".
      if (view === 'todos') {
        // Sin filtro adicional por estado
      } else {
        whereClause += ' AND o.status = "revision_cartera"';
      }
    } else if (userRole === 'facturador') {
      // Facturador: por defecto ver solo pendientes de facturación.
      // Si se envía un estado específico desde el frontend, aplicarlo.
      // EXCEPCIÓN: Si la vista es "todos", permitir ver todo el histórico.
      if (view === 'todos') {
        // Sin filtro adicional por estado
        if (status) {
          whereClause += ' AND o.status = ?';
          params.push(status);
        }
      } else if (status) {
        whereClause += ' AND o.status = ?';
        params.push(status);
      } else {
        // Default: solo mostrar pendientes de facturación
        whereClause += ' AND o.status = "pendiente_por_facturacion"';
      }
    } else if (userRole === 'admin') {
      // Admin puede ver todos los pedidos solo para informes, sin filtros restrictivos
      // No se agrega filtro adicional - puede ver todo para generar reportes

      // Solo para admin: aplicar filtro de estado adicional si se proporciona
      if (status) {
        if (status === 'money_in_transit') {
          whereClause += ` AND o.id IN (
            SELECT dt.order_id 
            FROM delivery_tracking dt 
            WHERE dt.payment_method = 'efectivo' 
            AND dt.payment_collected > 0
            AND dt.delivered_at IS NOT NULL 
            AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = dt.order_id)
            AND NOT EXISTS (SELECT 1 FROM cash_closing_details ccd WHERE ccd.order_id = dt.order_id AND ccd.collection_status = 'collected')
            UNION
            SELECT o2.id
            FROM orders o2
            WHERE o2.payment_method = 'efectivo'
            AND o2.status != 'anulado'
            AND (o2.assigned_messenger_id IS NOT NULL OR o2.delivery_method = 'recoge_bodega')
            AND o2.status NOT IN ('entregado', 'entregado_cliente', 'entregado_bodega', 'finalizado', 'completado', 'anulado')
          )`;
        } else {
          whereClause += ' AND o.status = ?';
          params.push(status);
        }
      }
    }

    // Para roles específicos, ignorar el filtro de estado adicional ya que tienen su propio filtro por rol
    // Solo el admin puede filtrar por estado libremente

    if (dateFrom) {
      whereClause += ' AND DATE(o.created_at) >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND DATE(o.created_at) <= ?';
      params.push(dateTo);
    }

    if (search) {
      whereClause += ' AND (o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.order_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (paymentMethod) {
      if (paymentMethod === 'mercadopago') {
        whereClause += ' AND (o.electronic_payment_type = ? OR o.payment_method = ?)';
        params.push('mercadopago', 'mercadopago');
      } else if (paymentMethod === 'credito') {
        whereClause += ' AND (o.payment_method = ? OR o.payment_method = ?)';
        params.push('cliente_credito', 'credito');
      } else {
        whereClause += ' AND o.payment_method = ?';
        params.push(paymentMethod);
      }
    }

    // Filtrar por etiquetas (tags) - concordancia amplia
    if (tags && tags.trim()) {
      // Buscar pedidos cuyo campo tags contenga el texto especificado (búsqueda parcial)
      whereClause += ' AND o.tags LIKE ?';
      params.push(`%${tags.trim()}%`);
    }

    // Validar campos de ordenamiento
    const validSortFields = ['created_at', 'siigo_invoice_created_at', 'order_number', 'order_number_numeric', 'customer_name', 'status', 'total_amount'];
    const validSortOrders = ['ASC', 'DESC'];

    let orderBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    let order = validSortOrders.includes(String(sortOrder || '').toUpperCase()) ? String(sortOrder).toUpperCase() : 'ASC';
    const explicitSort = (orderBy === 'order_number_numeric');
    let orderByExpr = explicitSort ? 'CAST(TRIM(SUBSTRING_INDEX(o.order_number, "-", -1)) AS UNSIGNED)' : `o.${orderBy}`;
    let orderSecondary = '';

    // Ordenamiento por vista/escenario
    if (view === 'todos' && !explicitSort) {
      // Vista "Todos": por número de pedido DESC (sufijo), luego por fecha de factura/creación DESC e id DESC
      orderByExpr = 'CAST(TRIM(SUBSTRING_INDEX(o.order_number, "-", -1)) AS UNSIGNED)';
      order = 'DESC';
      orderSecondary = ', COALESCE(o.siigo_invoice_created_at, o.created_at) DESC, o.id DESC';
    } else if ((view === 'facturacion' || userRole === 'facturador') && !explicitSort) {
      // Vista de Facturación (exclusiva) o rol facturador:
      // ordenar ASC por sufijo numérico de order_number con desempate por fecha (factura/creación) ASC e id ASC
      orderByExpr = 'CAST(TRIM(SUBSTRING_INDEX(o.order_number, "-", -1)) AS UNSIGNED)';
      order = 'ASC';
      orderSecondary = ', COALESCE(o.siigo_invoice_created_at, o.created_at) ASC, o.id ASC';
    } else if (!status && !explicitSort) {
      // Sin estado específico: mismo comportamiento de "Todos"
      orderByExpr = 'CAST(TRIM(SUBSTRING_INDEX(o.order_number, "-", -1)) AS UNSIGNED)';
      order = 'DESC';
      orderSecondary = ', COALESCE(o.siigo_invoice_created_at, o.created_at) DESC, o.id DESC';
    } else {
      // En otras vistas, mantener sort solicitado y agregar desempate por id cuando sea fecha
      if (orderBy === 'created_at' || orderBy === 'siigo_invoice_created_at') {
        orderSecondary = `, o.id ${order}`;
      }
    }

    // Debug del ORDER BY efectivo para diagnóstico en producción
    try {
      console.log('[getOrders] view:', view, 'status:', status, 'sortBy:', sortBy, 'sortOrder:', sortOrder);
      console.log('[getOrders] ORDER BY =>', `${orderByExpr} ${order} ${orderSecondary}`);
      console.log('[getOrders] whereClause:', whereClause);
    } catch (_) { }
    // Obtener pedidos con información del usuario creador Y MENSAJEROS
    const orders = await query(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_address, 
        o.customer_email, o.customer_city, o.customer_department, o.customer_country,
        o.status, o.total_amount, o.notes, o.special_management_note, o.validation_status, o.validation_notes, o.delivery_date, o.shipping_date,
        o.payment_method, o.electronic_payment_type, o.electronic_payment_notes, o.delivery_method, o.shipping_payment_method, o.carrier_id, o.created_at, o.updated_at,
        o.payment_evidence_path, o.payment_evidence_photo, o.is_pending_payment_evidence,
        o.siigo_invoice_id, o.siigo_invoice_number, o.siigo_public_url, o.siigo_customer_id,
        o.siigo_observations, o.siigo_payment_info, o.siigo_seller_id, o.siigo_balance,
        o.sale_channel,
        o.siigo_document_type, o.siigo_stamp_status, o.siigo_mail_status, o.siigo_invoice_created_at,
        o.siigo_closed, o.siigo_closed_at, o.siigo_closed_by, o.siigo_closure_method, o.siigo_closure_note,
        o.is_service,
        o.tags,
        o.delivery_fee,
        o.delivered_at,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
        (SELECT COUNT(*) FROM cash_register cr WHERE cr.order_id = o.id) AS cash_register_count,
        CASE WHEN (SELECT COUNT(*) FROM cash_register cr2 WHERE cr2.order_id = o.id) > 0 THEN 1 ELSE 0 END AS has_payment,
        (SELECT COUNT(*) FROM cash_register crc WHERE crc.order_id = o.id AND crc.status = 'collected') AS cash_register_collected_count,
        CASE WHEN (SELECT COUNT(*) FROM cash_register crc2 WHERE crc2.order_id = o.id AND crc2.status = 'collected') > 0 THEN 1 ELSE 0 END AS has_cash_collected,
        o.assigned_messenger_id, o.messenger_status,
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name,
        c.name as carrier_name,
        messenger.username as assigned_messenger_name,
        messenger.full_name as messenger_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
       LEFT JOIN carriers c ON o.carrier_id = c.id
       LEFT JOIN users messenger ON o.assigned_messenger_id = messenger.id
       ${whereClause}
       ORDER BY ${orderByExpr} ${order} ${orderSecondary}
       ${limitOffset}`,
      params
    );

    // Obtener items de cada pedido
    for (let order of orders) {
      const items = await query(
        `SELECT 
         id, 
         name, 
         quantity, 
         COALESCE(unit_price, price, 0) AS unit_price,
         COALESCE(subtotal, quantity * COALESCE(unit_price, price, 0)) AS subtotal,
         price,
         description,
         product_code
       FROM order_items 
       WHERE order_id = ?`,
        [order.id]
      );
      order.items = items;

      // Fallback defensivo: asegurar que electronic_payment_type se incluya correctamente en el listado
      // Detectamos casos donde en detalles viene con valor pero en el listado llegaba null/undefined.
      try {
        const pm = (order.payment_method || '').toLowerCase();
        if ((pm.includes('pago') || pm.includes('electron')) && (order.electronic_payment_type === undefined || order.electronic_payment_type === null)) {
          const ep = await query('SELECT electronic_payment_type FROM orders WHERE id = ?', [order.id]);
          if (ep && ep.length) {
            order.electronic_payment_type = ep[0].electronic_payment_type ?? null;
          } else {
            // Garantizar presencia de la propiedad para el frontend
            order.electronic_payment_type = null;
          }
        } else if (order.electronic_payment_type === undefined) {
          // Si no existe la propiedad, exponerla explícitamente aunque no aplique
          order.electronic_payment_type = null;
        }
      } catch (e) {
        // No bloquear flujo por fallback
        if (order.electronic_payment_type === undefined) {
          order.electronic_payment_type = null;
        }
      }
    }

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
    console.error('Error obteniendo pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener pedido por ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener pedido
    const orders = await query(
      `SELECT 
        o.*, 
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
       WHERE o.id = ?`,
      [id]
    );

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const order = orders[0];

    // Obtener items del pedido
    const items = await query(
      `SELECT 
         id, 
         name, 
         quantity, 
         COALESCE(unit_price, price, 0) AS unit_price,
         COALESCE(subtotal, quantity * COALESCE(unit_price, price, 0)) AS subtotal,
         price,
         description,
         product_code
       FROM order_items 
       WHERE order_id = ?`,
      [id]
    );

    order.items = items;

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error obteniendo pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear nuevo pedido
const createOrder = async (req, res) => {
  try {
    console.log('Datos recibidos en createOrder:', JSON.stringify(req.body, null, 2));

    const {
      invoiceCode,
      customerName,
      customerPhone,
      customerAddress,
      customerEmail,
      customerDepartment,
      customerCity,
      deliveryMethod,
      paymentMethod,
      items,
      notes,
      deliveryDate,
      totalAmount
    } = req.body;

    const userId = req.user.id;

    // Validaciones básicas con logs detallados
    const missingFields = [];
    if (!customerName) missingFields.push('customerName');
    if (!customerPhone) missingFields.push('customerPhone');
    if (!customerAddress) missingFields.push('customerAddress');
    if (!customerDepartment) missingFields.push('customerDepartment');
    if (!customerCity) missingFields.push('customerCity');

    if (missingFields.length > 0) {
      console.log('Campos faltantes:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Faltan campos obligatorios: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe incluir al menos un item'
      });
    }

    // Generar número de pedido único
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Calcular total si no se proporciona
    const calculatedTotal = totalAmount || items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Determinar estado inicial según reglas de negocio
    let initialStatus = 'pendiente_facturacion';
    if (['publicidad', 'reposicion'].includes(paymentMethod)) {
      initialStatus = 'en_logistica';
    } else if (deliveryMethod === 'recogida_tienda' && paymentMethod !== 'efectivo') {
      initialStatus = 'revision_cartera'; // Requiere verificación de pago
    } else if (deliveryMethod === 'domicilio_ciudad' && paymentMethod === 'efectivo') {
      initialStatus = 'en_logistica'; // Pasa directo a logística
    }

    // Normalizar valores persistidos de pago y envío (asegura 'cliente_credito' -> 'credito')
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod || 'efectivo');
    const normalizedDeliveryMethod = normalizeDeliveryMethod(deliveryMethod || 'domicilio_ciudad');

    const result = await transaction(async (connection) => {
      // Crear pedido
      const requiresPayment = (normalizedPaymentMethod === 'cliente_credito' || normalizedPaymentMethod === 'credito' || normalizedPaymentMethod === 'publicidad' || normalizedPaymentMethod === 'reposicion') ? 0 : 1;
      const [orderResult] = await connection.execute(
        `INSERT INTO orders (
          order_number, invoice_code, customer_name, customer_phone, customer_address, 
          customer_email, customer_department, customer_city, delivery_method, payment_method,
          status, total_amount, notes, shipping_date, requires_payment, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          orderNumber,
          invoiceCode || null,
          customerName,
          customerPhone,
          customerAddress,
          customerEmail || null,
          customerDepartment,
          customerCity,
          normalizedDeliveryMethod,
          normalizedPaymentMethod,
          initialStatus,
          calculatedTotal,
          notes || null,
          deliveryDate || null,
          requiresPayment,
          userId
        ]
      );

      const orderId = orderResult.insertId;

      // 1. Obtener costos de compra actuales para snapshot histórico
      const productNames = items.filter(i => i.name).map(i => i.name);
      let costMap = {};

      if (productNames.length > 0) {
        const [products] = await connection.query(
          'SELECT product_name, purchasing_price FROM products WHERE product_name IN (?)',
          [productNames]
        );
        products.forEach(p => {
          costMap[p.product_name] = p.purchasing_price;
        });
      }

      // Crear items del pedido
      for (const item of items) {
        if (item.name && item.quantity > 0 && item.price >= 0) {
          // Obtener costo histórico (snapshot)
          const historicalCost = costMap[item.name] || 0; // Si no hay costo, guarda 0 (se usará fallback en queries)

          await connection.execute(
            'INSERT INTO order_items (order_id, name, quantity, price, description, purchase_cost) VALUES (?, ?, ?, ?, ?, ?)',
            [orderId, item.name, item.quantity, item.price, item.description || null, historicalCost]
          );
        }
      }

      return orderId;
    });

    // Obtener el pedido creado completo
    const newOrder = await query(
      `SELECT 
        o.*, 
        u.full_name as created_by_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.id = ?`,
      [result]
    );

    const orderItems = await query(
      `SELECT 
         id, 
         name, 
         quantity, 
         COALESCE(unit_price, price, 0) AS unit_price,
         COALESCE(subtotal, quantity * COALESCE(unit_price, price, 0)) AS subtotal,
         price,
         description,
         product_code
       FROM order_items 
       WHERE order_id = ?`,
      [result]
    );

    newOrder[0].items = orderItems;

    // Emitir evento en tiempo real para actualizar dashboards/mapas (p.ej., Mapa de Calor)
    try {
      if (global.io) {
        const payload = {
          orderId: newOrder[0].id,
          order_number: newOrder[0].order_number,
          customer_city: newOrder[0].customer_city,
          total_amount: newOrder[0].total_amount,
          created_at: newOrder[0].created_at
        };
        // Notificar a los clientes suscritos al canal de pedidos
        global.io.to('orders-updates').emit('order-created', payload);
      }
    } catch (emitError) {
      console.error('⚠️  Error emitiendo evento order-created:', emitError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      data: newOrder[0]
    });

  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};


// Actualizar pedido
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.validatedData || req.body;
    try {
      console.log('📝 [updateOrder] Incoming payload:', JSON.stringify(updateData));
    } catch (e) {
      console.log('📝 [updateOrder] Incoming payload (non-serializable).');
    }
    try {
      logOrderUpdateEvent({
        orderId: Number(id),
        event: 'incoming',
        userId: req.user?.id || null,
        userRole: req.user?.role || null,
        data: { payload: updateData }
      });
    } catch (e) { }
    const userRole = req.user.role;

    // Unificar alias de frontend para proveedor/nota de pago electrónico
    // Acepta: electronic_payment_type | electronicPaymentType | payment_provider | paymentProvider
    //         electronic_payment_notes | electronicPaymentNotes | payment_notes | paymentNotes
    if (updateData && typeof updateData === 'object') {
      if (updateData.electronic_payment_type === undefined) {
        const aliasProvider = updateData.electronicPaymentType ?? updateData.payment_provider ?? updateData.paymentProvider;
        if (aliasProvider !== undefined) {
          updateData.electronic_payment_type = aliasProvider;
        }
      }
      if (updateData.electronic_payment_notes === undefined) {
        const aliasNotes = updateData.electronicPaymentNotes ?? updateData.payment_notes ?? updateData.paymentNotes;
        if (aliasNotes !== undefined) {
          updateData.electronic_payment_notes = aliasNotes;
        }
      }
      // Eliminar alias para evitar columnas duplicadas en el SET
      delete updateData.electronicPaymentType;
      delete updateData.payment_provider;
      delete updateData.paymentProvider;
      delete updateData.electronicPaymentNotes;
      delete updateData.payment_notes;
      delete updateData.paymentNotes;
    }

    // Normalización explícita del tipo de pago electrónico (garantiza valores canónicos)
    if (Object.prototype.hasOwnProperty.call(updateData, 'electronic_payment_type')) {
      const t = String(updateData.electronic_payment_type ?? '').toLowerCase().trim();
      if (['mercadopago', 'mercado_pago', 'mercado pago', 'mercado-pago'].includes(t)) {
        updateData.electronic_payment_type = 'mercadopago';
      } else if (t === 'bold') {
        updateData.electronic_payment_type = 'bold';
      } else if (t === '' || t === 'null' || t === 'undefined') {
        updateData.electronic_payment_type = null;
      } else if (t !== 'otro') {
        // Si llega un valor no reconocido, normalizarlo a 'otro' para cumplir validación Joi
        updateData.electronic_payment_type = 'otro';
      }
    }

    // Debug: log normalized electronic_payment_type
    console.log('[updateOrder] incoming electronic_payment_type:', updateData.electronic_payment_type, 'payment_method:', updateData.payment_method);

    // Verificar que el pedido existe
    const existingOrder = await query('SELECT * FROM orders WHERE id = ?', [id]);

    if (!existingOrder.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const order = existingOrder[0];

    // Validar permisos específicos para mensajeros
    if (userRole === 'mensajero') {
      // Los mensajeros solo pueden cambiar pedidos a estados de entrega
      if (!['entregado_cliente', 'entregado_transportadora'].includes(updateData.status)) {
        return res.status(403).json({
          success: false,
          message: 'Los mensajeros solo pueden marcar pedidos como entregados'
        });
      }

      // Los mensajeros solo pueden actualizar pedidos que estén en reparto
      if (!['en_reparto'].includes(order.status)) {
        return res.status(403).json({
          success: false,
          message: 'Los mensajeros solo pueden actualizar pedidos que estén en reparto'
        });
      }
    }

    if (userRole === 'logistica' && order.status === 'entregado') {
      return res.status(403).json({
        success: false,
        message: 'No se pueden modificar pedidos ya entregados'
      });
    }

    await transaction(async (connection) => {
      // 🔒 PROTECCIÓN DE SHIPPING_DATE - Solo se puede actualizar en facturación
      const isFromBilling = req.body.auto_processed !== true && userRole === 'facturador';
      const isManualUpdate = !req.body.auto_processed;

      // Log de protección
      console.log('🔒 SHIPPING_DATE PROTECTION:');
      console.log('   User Role:', userRole);
      console.log('   Auto Processed:', req.body.auto_processed);
      console.log('   Is From Billing:', isFromBilling);
      console.log('   Is Manual Update:', isManualUpdate);
      console.log('   Original shipping_date:', order.shipping_date);

      // Si no es desde facturación Y ya existe una fecha, preservarla
      if (!isFromBilling && order.shipping_date && updateData.shipping_date) {
        console.log('🛡️ PRESERVING existing shipping_date - removing from update');
        delete updateData.shipping_date;
      }

      // 🚚 LÓGICA ESPECIAL PARA DOMICILIO LOCAL
      // Si el método de envío es domicilio, domicilio_local o similar, asignar automáticamente carrier_id = 32 (Mensajería Local)
      let shouldUpdateCarrier = false;
      let carrierIdToSet = null;

      const deliveryMethod = updateData.delivery_method || updateData.deliveryMethod;

      if (deliveryMethod === 'domicilio' ||
        deliveryMethod === 'domicilio_local' ||
        deliveryMethod === 'domicilio_ciudad' ||
        (deliveryMethod && deliveryMethod.toLowerCase().includes('domicilio'))) {
        carrierIdToSet = 32; // ID de Mensajería Local
        shouldUpdateCarrier = true;
        console.log(`🚚 Método de envío "${deliveryMethod}" detectado - Asignando carrier_id = 32 (Mensajería Local)`);
      }

      // Actualizar pedido
      const updateFields = [];
      const updateValues = [];

      // Si necesitamos actualizar el carrier_id
      if (shouldUpdateCarrier) {
        updateFields.push('carrier_id = ?');
        updateValues.push(carrierIdToSet);
        console.log(`✅ Configurando carrier_id = ${carrierIdToSet} para domicilio local`);
      }

      Object.keys(updateData).forEach(key => {
        if (!['items', 'auto_processed'].includes(key)) {
          const dbField = key === 'customerName' ? 'customer_name' :
            key === 'customerPhone' ? 'customer_phone' :
              key === 'customerAddress' ? 'customer_address' :
                key === 'customerEmail' ? 'customer_email' :
                  key === 'deliveryMethod' ? 'delivery_method' :
                    key === 'delivery_method' ? 'delivery_method' :
                      key === 'paymentMethod' ? 'payment_method' :
                        key === 'payment_method' ? 'payment_method' :
                          key === 'deliveryDate' ? 'delivery_date' :
                            key === 'shippingDate' ? 'shipping_date' :
                              key === 'shipping_date' ? 'shipping_date' : key;

          // Normalización de ENUMS
          let value = updateData[key];
          if (dbField === 'payment_method') {
            value = normalizePaymentMethod(value);
            // Publicidad/Reposición no requieren validación ni cobro de producto
            const pmv = String(value || '').toLowerCase();
            if (pmv === 'publicidad' || pmv === 'reposicion' || pmv === 'reposición') {
              updateFields.push('requires_payment = 0');
            }
          }
          if (dbField === 'delivery_method') {
            value = normalizeDeliveryMethod(value);
          }

          // Logging especial para shipping_date
          if (dbField === 'shipping_date') {
            console.log('📅 SHIPPING_DATE UPDATE:');
            console.log('   Allowed:', isFromBilling || !order.shipping_date);
            console.log('   New value:', value);
            console.log('   Will update:', isFromBilling || !order.shipping_date);
          }
          // Debug específico para campos electrónicos
          if (dbField === 'electronic_payment_type') {
            console.log('💾 Will set electronic_payment_type =', value);
          }
          if (dbField === 'electronic_payment_notes') {
            console.log('💾 Will set electronic_payment_notes =', value);
          }

          updateFields.push(`${dbField} = ?`);
          updateValues.push(value);
        }
      });

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(id);

        // Previsualización de la sentencia y valores (sin incluir ID)
        try {
          const valuesPreview = updateValues.slice(0, -1);
          console.log('🧱 SQL SET CLAUSE:', updateFields.join(', '));
          console.log('🧱 SQL VALUES (excluding id):', valuesPreview);
          try {
            logOrderUpdateEvent({
              orderId: Number(id),
              event: 'sql_preview',
              userId: req.user?.id || null,
              userRole: req.user?.role || null,
              data: { setClause: updateFields, values: valuesPreview }
            });
          } catch (e2) { }
        } catch (e) { }

        const updateResult = await connection.execute(
          `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );

        console.log('📊 UPDATE RESULT:', {
          affectedRows: updateResult.affectedRows,
          changedRows: updateResult.changedRows
        });
      }

      // NUEVO FLUJO OBLIGATORIO: Logística -> Empaque -> Reparto
      if (updateData.status === 'listo' && userRole === 'logistica') {
        // Cuando logística marca como "listo", debe ir obligatoriamente a empaque
        updateData.status = 'pendiente_empaque';
        console.log('🔄 Pedido enviado automáticamente a empaque para verificación');
      }

      // Registrar en caja si es recogida en tienda + efectivo + va a logística
      if (updateData.delivery_method === 'recogida_tienda' &&
        updateData.payment_method === 'efectivo' &&
        updateData.status === 'en_logistica') {

        console.log('💰 Registrando dinero en efectivo para cierre de caja...');

        // Verificar si ya existe un registro para este pedido
        const existingCashRegister = await connection.execute(
          'SELECT id FROM cash_register WHERE order_id = ?',
          [id]
        );

        if (existingCashRegister[0].length === 0) {
          // Registrar el dinero en efectivo
          await connection.execute(
            `INSERT INTO cash_register (
              order_id, amount, payment_method, delivery_method, 
              registered_by, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
              id,
              order.total_amount,
              updateData.payment_method,
              updateData.delivery_method,
              req.user.id,
              `Recogida en bodega - Registrado automáticamente por ${req.user.full_name || req.user.username}`
            ]
          );

          console.log(`✅ Dinero registrado en caja: $${order.total_amount} - Pedido ${order.order_number}`);
        }
      }

      // Actualizar items si se proporcionan
      if (updateData.items) {
        // Eliminar items existentes
        await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);

        // Obtener costos actuales de los productos para snapshot
        let costMap = {};
        const productNames = updateData.items.map(i => i.name).filter(n => n);

        if (productNames.length > 0) {
          const [products] = await connection.query(
            'SELECT product_name, purchasing_price FROM products WHERE product_name IN (?)',
            [productNames]
          );
          products.forEach(p => {
            costMap[p.product_name] = p.purchasing_price;
          });
        }

        // Crear nuevos items con costo snapshot
        let totalAmount = 0;
        for (const item of updateData.items) {
          const historicalCost = costMap[item.name] || 0;
          await connection.execute(
            'INSERT INTO order_items (order_id, name, quantity, price, description, purchase_cost) VALUES (?, ?, ?, ?, ?, ?)',
            [id, item.name, item.quantity, item.price, item.description || null, historicalCost]
          );
          totalAmount += item.quantity * item.price;
        }

        // Actualizar total
        await connection.execute(
          'UPDATE orders SET total_amount = ? WHERE id = ?',
          [totalAmount, id]
        );
      }

      // Si se asigna a mensajero, actualizar assigned_to
      if (updateData.status === 'enviado' && userRole === 'logistica') {
        // Aquí podrías implementar lógica para asignar automáticamente a un mensajero
        // Por ahora lo dejamos como null para asignación manual posterior
      }
    });

    // Obtener pedido actualizado
    const updatedOrder = await query(
      `SELECT 
        o.*, 
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
       WHERE o.id = ?`,
      [id]
    );

    const items = await query(
      `SELECT 
         id, 
         name, 
         quantity, 
         COALESCE(unit_price, price, 0) AS unit_price,
         COALESCE(subtotal, quantity * COALESCE(unit_price, price, 0)) AS subtotal,
         price,
         description,
         product_code
       FROM order_items 
       WHERE order_id = ?`,
      [id]
    );

    updatedOrder[0].items = items;


    // 🔍 FINAL VERIFICATION LOGGING
    console.log('🔍 FINAL ORDER VERIFICATION:');
    const verificationResult = await query(
      'SELECT id, order_number, shipping_date, payment_method, status, electronic_payment_type, electronic_payment_notes, updated_at FROM orders WHERE id = ?',
      [id]
    );

    if (verificationResult.length > 0) {
      const finalOrder = verificationResult[0];
      console.log('   Order:', finalOrder.order_number);
      console.log('   Status:', finalOrder.status);
      console.log('   Payment Method:', finalOrder.payment_method);
      console.log('   Electronic Type:', finalOrder.electronic_payment_type || 'NULL');
      console.log('   Electronic Notes:', finalOrder.electronic_payment_notes || 'NULL');
      console.log('   🚨 Shipping Date:', finalOrder.shipping_date || 'NULL');
      console.log('   Updated At:', finalOrder.updated_at);

      if (finalOrder.shipping_date) {
        console.log('✅ SUCCESS: Shipping date was saved successfully!');
      } else {
        console.log('🚨 PROBLEM: Shipping date is still NULL after update!');
      }
      try {
        logOrderUpdateEvent({
          orderId: Number(id),
          event: 'final_verification',
          userId: req.user?.id || null,
          userRole: req.user?.role || null,
          data: finalOrder
        });
      } catch (e) { }
    }

    console.log('='.repeat(80));
    console.log('🔍 ORDER UPDATE LOGGING COMPLETE');
    console.log('='.repeat(80) + '\n');


    // Emitir evento de cambio de estado en tiempo real (si aplica)
    try {
      if (global.io && order && updatedOrder[0] && order.status !== updatedOrder[0].status) {
        const payload = {
          orderId: Number(id),
          order_number: updatedOrder[0].order_number,
          from_status: order.status,
          to_status: updatedOrder[0].status,
          changed_by_role: req.user?.role || null,
          timestamp: new Date().toISOString()
        };
        // Notificar a todos los suscritos al canal de actualizaciones de pedidos
        global.io.to('orders-updates').emit('order-status-changed', payload);
        console.log('📡 Emitido order-status-changed:', payload);
      }
    } catch (emitErr) {
      console.error('⚠️  Error emitiendo evento order-status-changed:', emitErr.message);
    }

    res.json({
      success: true,
      message: 'Pedido actualizado exitosamente',
      data: updatedOrder[0]
    });

  } catch (error) {
    console.error('Error actualizando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Marcar pedido como GESTIÓN ESPECIAL (sale del flujo normal).
 * Requiere role: admin o facturador.
 * Body: { reason: string (obligatorio) }
 */
const markSpecialManaged = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const userId = req.user?.id || null;

    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Motivo de gestión especial es obligatorio (mínimo 3 caracteres)'
      });
    }

    // Verificar que el pedido existe
    const existing = await query(
      'SELECT id, order_number, status, notes, siigo_invoice_number, customer_name FROM orders WHERE id = ?',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const order = existing[0];

    await transaction(async (connection) => {
      // Anexar motivo a "notes" para visibilidad inmediata en listados
      const specialNote = String(reason).trim();

      // Actualizar estado y motivo (special_management_note)
      await connection.execute(
        'UPDATE orders SET status = ?, special_management_note = ?, updated_at = NOW() WHERE id = ?',
        ['gestion_especial', specialNote, id]
      );

      // Registrar en auditoría (usamos customer_name para almacenar el motivo)
      try {
        await connection.execute(
          `INSERT INTO orders_audit (order_id, action, siigo_invoice_number, customer_name, user_id, created_at)
           VALUES (?, 'SPECIAL_MANAGED', ?, ?, ?, NOW())`,
          [id, order.siigo_invoice_number || null, String(reason).trim(), userId]
        );
      } catch (e) {
        console.error('orders_audit insert error:', e.message);
      }
    });

    // Cargar pedido actualizado
    const updated = await query('SELECT * FROM orders WHERE id = ?', [id]);

    // Emitir evento de cambio de estado en tiempo real
    try {
      if (global.io) {
        const payload = {
          orderId: Number(id),
          order_number: order.order_number,
          from_status: order.status,
          to_status: 'gestion_especial',
          changed_by_role: req.user?.role || null,
          timestamp: new Date().toISOString()
        };
        global.io.to('orders-updates').emit('order-status-changed', payload);
        console.log('📡 Emitido order-status-changed (gestion_especial):', payload);
      }
    } catch (emitErr) {
      console.error('⚠️  Error emitiendo evento order-status-changed:', emitErr.message);
    }

    return res.json({
      success: true,
      message: 'Pedido marcado como gestión especial',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error marcando gestión especial:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Eliminar pedido (solo admin) - SOFT DELETE
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que el pedido existe y no está ya eliminado
    const existingOrder = await query(
      'SELECT id, order_number, status, customer_name, siigo_invoice_number, deleted_at FROM orders WHERE id = ?',
      [id]
    );

    if (!existingOrder.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const order = existingOrder[0];

    // Verificar si ya está eliminado
    if (order.deleted_at) {
      return res.status(400).json({
        success: false,
        message: 'El pedido ya ha sido eliminado'
      });
    }

    // No permitir eliminar pedidos entregados
    if (['entregado_cliente', 'entregado_transportadora'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'No se pueden eliminar pedidos ya entregados'
      });
    }

    await transaction(async (connection) => {
      // SOFT DELETE: Marcar como eliminado
      await connection.execute(
        'UPDATE orders SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
        [id]
      );

      // Registrar en auditoría
      await connection.execute(
        `INSERT INTO orders_audit (
          order_id, action, siigo_invoice_number, customer_name, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, 'DELETE', order.siigo_invoice_number, order.customer_name, userId]
      );

      console.log(`🗑️ Pedido ${order.order_number} marcado como eliminado (soft delete) por usuario ${userId}`);
    });

    res.json({
      success: true,
      message: 'Pedido eliminado exitosamente (puede ser restaurado si es necesario)'
    });

  } catch (error) {
    console.error('Error eliminando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Recargar datos del pedido desde SIIGO (items, totales y datos de cliente)
const reloadFromSiigo = async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Cargar pedido y validar que tenga siigo_invoice_id
    const rows = await query('SELECT id, siigo_invoice_id, status FROM orders WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const order = rows[0];
    if (!order.siigo_invoice_id) {
      return res.status(400).json({ success: false, message: 'El pedido no tiene siigo_invoice_id asociado' });
    }

    // 2) Obtener detalles de factura y, si es posible, datos de cliente
    const invoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);
    let customerInfo = {};
    try {
      const custId = invoice?.customer?.id;
      if (custId) customerInfo = await siigoService.getCustomer(custId);
    } catch (_) { }

    // 3) Helpers locales (ligeros) para extraer campos relevantes
    const safe = (s) => (typeof s === 'string' ? s.trim() : s);
    const getText = (...vals) => {
      for (const v of vals) { if (v != null && String(v).trim() !== '') return String(v).trim(); }
      return null;
    };
    const buildNotes = () => {
      const parts = [];
      if (invoice?.observations) parts.push(`OBSERVACIONES: ${invoice.observations}`);
      if (invoice?.notes) parts.push(`NOTAS: ${invoice.notes}`);
      if (invoice?.comments) parts.push(`COMENTARIOS: ${invoice.comments}`);
      return parts.length ? parts.join('\n\n') : null;
    };
    const parseShippingPayMethod = () => {
      const sources = [invoice?.observations, invoice?.notes, invoice?.comments];
      for (const t of sources) {
        if (!t) continue;
        const txt = String(t).toLowerCase();
        if (txt.includes('contraentrega') || txt.includes('contra entrega')) return 'contraentrega';
        if (txt.includes('contado')) return 'contado';
      }
      return null;
    };

    const totalAmount = Number(invoice?.total || invoice?.total_amount || 0);

    const customer_name = getText(
      customerInfo?.commercial_name !== 'No aplica' ? customerInfo?.commercial_name : null,
      invoice?.customer?.commercial_name !== 'No aplica' ? invoice?.customer?.commercial_name : null,
      Array.isArray(customerInfo?.name) ? customerInfo.name.join(' ') : null,
      customerInfo?.company?.name,
      invoice?.customer?.name
    );
    const customer_phone = getText(customerInfo?.phones?.[0]?.number, invoice?.customer?.phones?.[0]?.number);
    const customer_address = getText(customerInfo?.address?.address, invoice?.customer?.address?.address);
    const customer_email = getText(
      customerInfo?.contacts?.[0]?.email,
      customerInfo?.email
    );
    const customer_department = getText(customerInfo?.address?.city?.state_name);
    const customer_city = getText(customerInfo?.address?.city?.city_name, typeof customerInfo?.address?.city === 'string' ? customerInfo.address.city : null);
    const customer_identification = getText(customerInfo?.identification, invoice?.customer?.identification);
    const customer_id_type = getText(customerInfo?.id_type?.name, customerInfo?.id_type?.code);
    const siigo_public_url = invoice?.public_url || null;
    const siigo_observations = buildNotes();
    const shipping_payment_method = parseShippingPayMethod();

    // 4) Extraer items desde la factura
    const items = (invoice?.items || []).map((it, idx) => ({
      name: getText(it?.description, it?.name, 'Producto SIIGO'),
      quantity: Number(it?.quantity || 1),
      price: Number(it?.price || it?.unit_price || 0),
      description: getText(it?.description, it?.name),
      product_code: getText(it?.code, it?.product?.code),
      invoice_line: Number(idx + 1)
    }));

    // 5) Aplicar cambios en una transacción con MERGE no destructivo (proteger empaque)
    await transaction(async (connection) => {
      let anyPackagingChange = false;
      // Determinar si el pedido está en etapa de empaque: evitar cambios destructivos
      const packagingStatuses = new Set(['pendiente_empaque', 'en_preparacion', 'en_empaque', 'empacado']);
      let inPackaging = packagingStatuses.has(order.status);
      // Salvaguarda adicional: si existe progreso de empaque, forzar preservación
      try {
        const [pv] = await connection.execute(
          'SELECT COUNT(*) AS c FROM packaging_item_verifications WHERE order_id = ? AND (scanned_count > 0 OR COALESCE(packed_quantity,0) > 0 OR is_verified = 1)',
          [id]
        );
        if ((pv && pv[0] && Number(pv[0].c) > 0)) {
          inPackaging = true;
        }
      } catch (_) { }

      // Cargar items existentes
      const [existing] = await connection.execute(
        'SELECT id, name, product_code, invoice_line, quantity, price, description FROM order_items WHERE order_id = ? ORDER BY invoice_line ASC, id ASC',
        [id]
      );

      // Backfill invoice_line if missing (assume insertion order = line order for legacy items)
      // Esto es CRÍTICO para evitar duplicados cuando se actualizan pedidos antiguos que no tenían invoice_line guardado
      existing.forEach((row, idx) => {
        if (!row.invoice_line) {
          row.invoice_line = idx + 1;
        }
      });

      if (!inPackaging) {
        // Preparar lista de items entrantes (copia para ir consumiendo)
        const availableItems = [...items];

        // Actualizar existentes si hay match; marcar para eliminar si ya no existen
        const toDeleteIds = [];
        for (const row of existing) {
          // Intentar encontrar match en availableItems
          // Prioridad: 1. Invoice Line, 2. Product Code, 3. Name
          let matchIndex = -1;

          // 1. Por línea de factura
          if (row.invoice_line) {
            matchIndex = availableItems.findIndex(it => it.invoice_line === row.invoice_line);
          }

          // 2. Por código de producto (si no hubo match por línea)
          if (matchIndex === -1 && row.product_code) {
            matchIndex = availableItems.findIndex(it => it.product_code === row.product_code);
          }

          // 3. Por nombre (si no hubo match anterior)
          if (matchIndex === -1) {
            matchIndex = availableItems.findIndex(it => it.name === row.name);
          }

          if (matchIndex !== -1) {
            const matched = availableItems[matchIndex];
            // Consumir el item para que no se vuelva a usar
            availableItems.splice(matchIndex, 1);

            await connection.execute(
              `UPDATE order_items
               SET name = ?, product_code = ?, invoice_line = ?, quantity = ?, price = ?, description = ?
               WHERE id = ?`,
              [
                matched.name,
                matched.product_code || null,
                matched.invoice_line || null,
                matched.quantity,
                matched.price,
                matched.description || null,
                row.id
              ]
            );
          } else {
            // Fuera de empaque es seguro eliminar obsoletos
            toDeleteIds.push(row.id);
          }
        }

        // Eliminar obsoletos si hay
        if (toDeleteIds.length > 0) {
          await connection.execute(
            `DELETE FROM order_items WHERE id IN (${toDeleteIds.map(() => '?').join(',')})`,
            toDeleteIds
          );
        }

        // Insertar nuevos restantes
        for (const it of availableItems) {
          await connection.execute(
            `INSERT INTO order_items (order_id, name, product_code, invoice_line, quantity, price, description, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [id, it.name, it.product_code || null, it.invoice_line || null, it.quantity, it.price, it.description || null]
          );
        }
      } else {
        // En empaque: Reconciliación no destructiva por línea para reflejar cambios sin perder escaneos

        // Cargar mapa de verificaciones para saber qué items tienen escaneos
        const verificationMap = new Map();
        try {
          const [pivRows] = await connection.execute(
            'SELECT item_id, scanned_count FROM packaging_item_verifications WHERE order_id = ?',
            [id]
          );
          for (const p of pivRows) {
            verificationMap.set(p.item_id, Number(p.scanned_count || 0));
          }
        } catch (_) { }

        // Preparar lista de items entrantes
        const availableItems = [...items];

        // Rastreo de productos ya emparejados para detectar duplicados
        // Map<ProductKey, ItemId>
        const matchedProducts = new Map();
        const getProductKey = (code, name) => code ? `code:${code}` : `name:${name}`;

        // Recorrer items existentes y reconciliar contra el estado actual de SIIGO
        const toDeleteIds = [];
        const unmatchedRows = [];

        for (const row of existing) {
          // Intentar encontrar match en availableItems
          // Prioridad: 1. Invoice Line, 2. Product Code, 3. Name
          let matchIndex = -1;

          // 1. Por línea de factura
          if (row.invoice_line) {
            matchIndex = availableItems.findIndex(it => it.invoice_line === row.invoice_line);
          }

          // 2. Por código de producto (si no hubo match por línea)
          if (matchIndex === -1 && row.product_code) {
            matchIndex = availableItems.findIndex(it => it.product_code === row.product_code);
          }

          // 3. Por nombre (si no hubo match anterior)
          if (matchIndex === -1) {
            matchIndex = availableItems.findIndex(it => it.name === row.name);
          }

          if (matchIndex === -1) {
            // NO MATCH: Guardar para procesar después (posible duplicado o fantasma)
            unmatchedRows.push(row);
            continue;
          }

          // MATCH ENCONTRADO
          const matched = availableItems[matchIndex];
          // Consumir item
          availableItems.splice(matchIndex, 1);

          // Registrar como emparejado
          const pKey = getProductKey(matched.product_code || row.product_code, matched.name || row.name);
          matchedProducts.set(pKey, row.id);

          // Leer progreso de escaneo actual del ítem
          const scanned_count = verificationMap.get(row.id) || 0;

          const productChanged =
            (matched.name !== row.name) ||
            ((matched.product_code || null) !== (row.product_code || null));

          if (productChanged) {
            if (scanned_count > 0) {
              // Parte ya escaneada queda como evidencia y se marca como reemplazada
              const pending = Math.max((matched.quantity || row.quantity) - scanned_count, 0);

              // Marcar ítem original como reemplazado y ajustar su cantidad a lo ya escaneado
              await connection.execute(
                `UPDATE order_items 
                   SET status = 'replaced', quantity = ?, updated_at = NOW()
                 WHERE id = ?`,
                [scanned_count, row.id]
              );

              // Asegurar que la verificación refleje "completo" para lo escaneado
              await connection.execute(
                `INSERT INTO packaging_item_verifications 
                   (order_id, item_id, scanned_count, required_scans, is_verified, verified_at, verified_by)
                 VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 'reconciliacion_siigo')
                 ON DUPLICATE KEY UPDATE
                   scanned_count = VALUES(scanned_count),
                   required_scans = VALUES(required_scans),
                   is_verified = 1,
                   verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
                   updated_at = CURRENT_TIMESTAMP`,
                [id, row.id, scanned_count, scanned_count]
              );

              // Crear ítem nuevo con el producto actualizado por la cantidad total de la línea (re-escaneo completo)
              const [insNew] = await connection.execute(
                `INSERT INTO order_items 
                   (order_id, name, product_code, invoice_line, quantity, price, description, status, replaced_from_item_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
                [
                  id,
                  matched.name,
                  matched.product_code || null,
                  matched.invoice_line || null,
                  matched.quantity,
                  matched.price,
                  matched.description || null,
                  row.id
                ]
              );
              // Registrar PIV del nuevo ítem como pendiente de escaneo (0 / matched.quantity)
              const newItemId = insNew?.insertId;
              if (newItemId) {
                matchedProducts.set(pKey, newItemId); // Apuntar al nuevo ítem activo
                await connection.execute(
                  `INSERT INTO packaging_item_verifications 
                     (order_id, item_id, scanned_count, required_scans, is_verified, verified_by)
                   VALUES (?, ?, 0, ?, 0, 'reconciliacion_siigo_new')
                   ON DUPLICATE KEY UPDATE
                     scanned_count = 0,
                     required_scans = VALUES(required_scans),
                     is_verified = 0,
                     updated_at = CURRENT_TIMESTAMP`,
                  [id, newItemId, matched.quantity]
                );
                anyPackagingChange = true;
              }
            } else {
              // Sin escaneos: actualizar in-place al nuevo producto/variante
              await connection.execute(
                `UPDATE order_items
                   SET name = ?, product_code = ?, invoice_line = ?, quantity = ?, price = ?, description = ?, status = 'active'
                 WHERE id = ?`,
                [
                  matched.name,
                  matched.product_code || null,
                  matched.invoice_line || null,
                  matched.quantity,
                  matched.price,
                  matched.description || null,
                  row.id
                ]
              );
            }
          } else {
            // Producto no cambió: aplicar cambios seguros de cantidad/precio
            if (scanned_count === 0) {
              await connection.execute(
                `UPDATE order_items
                   SET quantity = ?, price = ?, description = ?, invoice_line = ?
                 WHERE id = ?`,
                [
                  matched.quantity,
                  matched.price,
                  matched.description || null,
                  matched.invoice_line || null,
                  row.id
                ]
              );
            } else {
              // Si la nueva cantidad es mayor que lo ya escaneado, dividir: original queda "replaced" con lo escaneado y crear nuevo por la diferencia
              const pending = Math.max((matched.quantity || row.quantity) - scanned_count, 0);
              if (pending > 0 && matched.quantity !== row.quantity) {
                await connection.execute(
                  `UPDATE order_items 
                     SET status = 'replaced', quantity = ?, updated_at = NOW()
                   WHERE id = ?`,
                  [scanned_count, row.id]
                );
                await connection.execute(
                  `INSERT INTO packaging_item_verifications 
                     (order_id, item_id, scanned_count, required_scans, is_verified, verified_at, verified_by)
                   VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 'reconciliacion_siigo')
                   ON DUPLICATE KEY UPDATE
                     scanned_count = VALUES(scanned_count),
                     required_scans = VALUES(required_scans),
                     is_verified = 1,
                     verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
                     updated_at = CURRENT_TIMESTAMP`,
                  [id, row.id, scanned_count, scanned_count]
                );
                const [insSplit] = await connection.execute(
                  `INSERT INTO order_items 
                   (order_id, name, product_code, invoice_line, quantity, price, description, status, replaced_from_item_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
                  [
                    id,
                    matched.name,
                    matched.product_code || row.product_code || null,
                    matched.invoice_line || row.invoice_line || null,
                    pending,
                    matched.price || row.price,
                    matched.description || row.description || null,
                    row.id
                  ]
                );
                // PIV pendiente para la porción no escaneada (pending)
                const newSplitId = insSplit?.insertId;
                if (newSplitId) {
                  matchedProducts.set(pKey, newSplitId); // Apuntar al nuevo ítem activo
                  await connection.execute(
                    `INSERT INTO packaging_item_verifications 
                     (order_id, item_id, scanned_count, required_scans, is_verified, verified_by)
                   VALUES (?, ?, 0, ?, 0, 'reconciliacion_siigo_split')
                   ON DUPLICATE KEY UPDATE
                     scanned_count = 0,
                     required_scans = VALUES(required_scans),
                     is_verified = 0,
                     updated_at = CURRENT_TIMESTAMP`,
                    [id, newSplitId, pending]
                  );
                  anyPackagingChange = true;
                }
              }
            }
          }
        }

        // Procesar items no emparejados (fantasmas o duplicados)
        for (const row of unmatchedRows) {
          const scannedCount = verificationMap.get(row.id) || 0;
          const pKey = getProductKey(row.product_code, row.name);
          const matchedSiblingId = matchedProducts.get(pKey);

          if (matchedSiblingId) {
            // ES UN DUPLICADO DE UN ITEM ACTIVO
            if (scannedCount > 0) {
              // Fusionar escaneos: Mover escaneos del fantasma al ítem activo
              await connection.execute(
                `UPDATE packaging_item_verifications 
                 SET scanned_count = scanned_count + ? 
                 WHERE order_id = ? AND item_id = ?`,
                [scannedCount, id, matchedSiblingId]
              );
              // Eliminar el fantasma
              toDeleteIds.push(row.id);
            } else {
              // Sin escaneos, eliminar directamente
              toDeleteIds.push(row.id);
            }
          } else {
            // NO ES DUPLICADO (Es un item que se eliminó de Siigo)
            if (scannedCount === 0) {
              // Si no tiene escaneos, eliminar
              toDeleteIds.push(row.id);
            }
            // Si tiene escaneos, conservar como 'replaced' o similar (comportamiento actual)
          }
        }

        // Eliminar items obsoletos (fantasmas sin escaneos o fusionados)
        if (toDeleteIds.length > 0) {
          await connection.execute(
            `DELETE FROM order_items WHERE id IN (${toDeleteIds.map(() => '?').join(',')})`,
            toDeleteIds
          );
        }

        // Insertar cualquier línea nueva de SIIGO que no tenga correspondencia previa (nunca borrar en empaque)
        for (const it of availableItems) {
          const [insNewLine] = await connection.execute(
            `INSERT INTO order_items 
               (order_id, name, product_code, invoice_line, quantity, price, description, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
            [id, it.name, it.product_code || null, it.invoice_line || null, it.quantity, it.price, it.description || null]
          );
          const newLineId = insNewLine?.insertId;
          if (newLineId) {
            await connection.execute(
              `INSERT INTO packaging_item_verifications 
                 (order_id, item_id, scanned_count, required_scans, is_verified, verified_by)
               VALUES (?, ?, 0, ?, 0, 'reconciliacion_siigo_newline')
               ON DUPLICATE KEY UPDATE
                 scanned_count = 0,
                 required_scans = VALUES(required_scans),
                 is_verified = 0,
                 updated_at = CURRENT_TIMESTAMP`,
              [id, newLineId, it.quantity]
            );
            anyPackagingChange = true;
          }
        }
      }

      // Si hubo cambios que afectan empaque, forzar revisión visual en UI
      if (anyPackagingChange) {
        await connection.execute(
          `UPDATE orders SET packaging_status = 'requires_review', updated_at = NOW() WHERE id = ?`,
          [id]
        );
      }

      // Actualizar order (NO tocamos shipping_date, status, asignaciones)
      const setParts = [
        'customer_name = ?', 'customer_phone = ?', 'customer_address = ?', 'customer_email = ?',
        'customer_department = ?', 'customer_city = ?', 'customer_identification = ?', 'customer_id_type = ?',
        'siigo_public_url = ?', 'siigo_observations = ?', 'shipping_payment_method = ?', 'total_amount = ?', 'updated_at = NOW()'
      ];
      const values = [
        customer_name, customer_phone, customer_address, customer_email,
        customer_department, customer_city, customer_identification, customer_id_type,
        siigo_public_url, siigo_observations, shipping_payment_method, totalAmount
      ];
      await connection.execute(`UPDATE orders SET ${setParts.join(', ')} WHERE id = ?`, [...values, id]);

      // Registrar en tabla de sync (si existe)
      try {
        await connection.execute(
          `INSERT INTO siigo_sync_log (siigo_invoice_id, order_id, sync_type, sync_status, processed_at) VALUES (?, ?, 'update', 'success', NOW())`,
          [order.siigo_invoice_id, id]
        );
      } catch (_) { }
    });

    return res.json({ success: true, message: 'Pedido recargado desde SIIGO', data: { id, items: items.length, total: totalAmount } });
  } catch (error) {
    console.error('Error recargando desde SIIGO:', error.message);
    return res.status(500).json({ success: false, message: 'No se pudo recargar la factura desde SIIGO' });
  }
};

// Eliminar pedido de SIIGO (devuelve el pedido a SIIGO para reimportación)
const deleteSiigoOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el pedido existe y tiene información de SIIGO
    const existingOrder = await query(
      'SELECT id, status, siigo_invoice_id, siigo_invoice_number, order_number FROM orders WHERE id = ?',
      [id]
    );

    if (!existingOrder.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const order = existingOrder[0];

    // Verificar que el pedido proviene de SIIGO
    if (!order.siigo_invoice_id) {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar pedidos que provengan de SIIGO'
      });
    }

    // No permitir eliminar pedidos entregados
    if (['entregado_cliente', 'entregado_transportadora'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'No se pueden eliminar pedidos ya entregados'
      });
    }

    // Helper para verificar si una tabla existe
    const tableExists = async (connection, tableName) => {
      try {
        const [result] = await connection.execute(
          `SELECT 1 FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = ?`,
          [tableName]
        );
        return result.length > 0;
      } catch (error) {
        return false;
      }
    };

    // Helper seguro para eliminar de una tabla si existe
    const safeDelete = async (connection, tableName, whereClause, params) => {
      try {
        if (await tableExists(connection, tableName)) {
          const [result] = await connection.execute(`DELETE FROM ${tableName} WHERE ${whereClause}`, params);
          console.log(`   ✅ ${result.affectedRows} registros eliminados de ${tableName}`);
          return result.affectedRows;
        } else {
          console.log(`   ⚠️ Tabla ${tableName} no existe, saltando...`);
          return 0;
        }
      } catch (error) {
        console.log(`   ❌ Error eliminando de ${tableName}:`, error.message);
        return 0;
      }
    };

    await transaction(async (connection) => {
      console.log(`🗑️ Eliminando pedido SIIGO: ${order.order_number} (ID: ${order.siigo_invoice_id})`);

      // 1. Eliminar registros relacionados (orden seguro por dependencias)
      console.log('  1. Eliminando registros relacionados...');
      // Empaque: primero verificaciones (referencian order_items), luego evidencias, registros y estado
      await safeDelete(connection, 'packaging_item_verifications', 'order_id = ?', [id]);
      await safeDelete(connection, 'packaging_evidence', 'order_id = ?', [id]);
      await safeDelete(connection, 'packaging_records', 'order_id = ?', [id]);
      await safeDelete(connection, 'order_packaging_status', 'order_id = ?', [id]);
      // Mensajería: primero evidencias (referencian tracking), luego tracking
      await safeDelete(connection, 'delivery_evidence', 'order_id = ?', [id]);
      await safeDelete(connection, 'delivery_tracking', 'order_id = ?', [id]);
      // Escaneos
      await safeDelete(connection, 'barcode_scan_logs', 'order_id = ?', [id]);
      await safeDelete(connection, 'simple_barcode_scans', 'order_id = ?', [id]);
      // Pagos
      await safeDelete(connection, 'wallet_validations', 'order_id = ?', [id]);
      await safeDelete(connection, 'cash_register', 'order_id = ?', [id]);
      // Envíos
      await safeDelete(connection, 'shipping_guides', 'order_id = ?', [id]);
      await safeDelete(connection, 'manual_shipping_guides', 'order_id = ?', [id]);
      // Logística y notificaciones
      await safeDelete(connection, 'logistics_records', 'order_id = ?', [id]);
      await safeDelete(connection, 'whatsapp_notifications', 'order_id = ?', [id]);
      // Cierres de caja y auditoría
      await safeDelete(connection, 'cash_closing_details', 'order_id = ?', [id]);
      await safeDelete(connection, 'orders_audit', 'order_id = ?', [id]);

      // 2. Eliminar items del pedido (después de eliminar dependencias que referencian items)
      console.log('  2. Eliminando items del pedido...');
      const [itemsResult] = await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
      console.log(`   ✅ ${itemsResult.affectedRows} items eliminados`);

      // 3. Eliminar de la tabla de sincronización de SIIGO si existe para permitir reimportación
      console.log('  3. Eliminando sincronización SIIGO...');
      await safeDelete(connection, 'siigo_sync_log', 'siigo_invoice_id = ?', [order.siigo_invoice_id]);
      await safeDelete(connection, 'siigo_sync_log', 'order_id = ?', [id]);

      // 4. Eliminar el pedido principal
      console.log('  4. Eliminando pedido principal...');
      const [orderResult] = await connection.execute('DELETE FROM orders WHERE id = ?', [id]);
      console.log(`   ✅ ${orderResult.affectedRows} pedido eliminado`);

      console.log(`✅ Pedido ${order.order_number} eliminado exitosamente y disponible para reimportación desde SIIGO`);
    });

    res.json({
      success: true,
      message: `Pedido eliminado exitosamente. La factura ${order.siigo_invoice_number || order.siigo_invoice_id} volverá a estar disponible para importar desde SIIGO.`
    });

  } catch (error) {
    console.error('Error eliminando pedido SIIGO:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Asignar pedido a mensajero
const assignOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { messengerId } = req.body;

    // Verificar que el pedido existe y está listo para envío
    const order = await query('SELECT id, status FROM orders WHERE id = ?', [id]);

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    if (order[0].status !== 'listo') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden asignar pedidos que estén listos'
      });
    }

    // Verificar que el mensajero existe
    const messenger = await query(
      'SELECT id FROM users WHERE id = ? AND role = "mensajero" AND active = true',
      [messengerId]
    );

    if (!messenger.length) {
      return res.status(400).json({
        success: false,
        message: 'Mensajero no válido'
      });
    }

    // Asignar pedido y cambiar estado
    await query(
      'UPDATE orders SET assigned_to = ?, status = "enviado", updated_at = NOW() WHERE id = ?',
      [messengerId, id]
    );

    res.json({
      success: true,
      message: 'Pedido asignado exitosamente'
    });

  } catch (error) {
    console.error('Error asignando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de pedidos
const getOrderStats = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Filtros por rol
    if (userRole === 'mensajero') {
      whereClause += ' AND assigned_to = ?';
      params.push(userId);

      // Para mensajero: devolver SOLO contadores básicos y estadísticas por estado de SUS pedidos.
      // No exponer métricas financieras ni gráficos globales.
      const statusStats = await query(
        `SELECT 
          status,
          COUNT(*) as count,
          SUM(total_amount) as total_amount
         FROM orders ${whereClause} 
         GROUP BY status
         ORDER BY 
           CASE status
             WHEN 'pendiente_facturacion' THEN 1
             WHEN 'revision_cartera' THEN 2
             WHEN 'en_logistica' THEN 3
             WHEN 'en_reparto' THEN 4
             WHEN 'entregado_transportadora' THEN 5
             WHEN 'entregado_cliente' THEN 6
             WHEN 'cancelado' THEN 7
           END`,
        params
      );

      // Contadores principales
      const totalOrders = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause}`,
        params
      );

      const pendingBilling = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'pendiente_por_facturacion'`,
        params
      );

      const pendingPayment = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'revision_cartera'`,
        params
      );

      const pendingLogistics = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'en_logistica'`,
        params
      );

      const pendingPackaging = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('pendiente_empaque', 'en_preparacion', 'en_empaque')`,
        params
      );

      const pendingDelivery = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND (status = 'en_reparto' OR messenger_status IN ('accepted','in_delivery'))`,
        params
      );
      const sentToCarrier = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'entregado_transportadora'`,
        params
      );

      const readyForDelivery = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'listo_para_entrega' AND (messenger_status IS NULL OR messenger_status NOT IN ('accepted','in_delivery'))`,
        params
      );

      const delivered = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'entregado_cliente'`,
        params
      );

      return res.json({
        success: true,
        data: {
          totalOrders: totalOrders[0].count,
          pendingBilling: pendingBilling[0].count,
          pendingPayment: pendingPayment[0].count,
          pendingLogistics: pendingLogistics[0].count,
          pendingPackaging: pendingPackaging[0].count,
          readyForDelivery: readyForDelivery[0].count,
          pendingDelivery: pendingDelivery[0].count,
          sentToCarrier: sentToCarrier[0].count,
          delivered: delivered[0].count,
          statusStats,
          // No exponer datos sensibles a mensajero
          financialMetrics: null,
          charts: {},
          performance: {},
          alerts: []
        }
      });
    }

    if (dateFrom) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(dateTo);
    }

    // Estadísticas por estado
    const statusStats = await query(
      `SELECT status, COUNT(*) as count, SUM(total_amount) as total_amount 
       FROM orders ${whereClause} 
       GROUP BY status`,
      params
    );

    // Total general
    const totalStats = await query(
      `SELECT COUNT(*) as total_orders, SUM(total_amount) as total_revenue 
       FROM orders ${whereClause}`,
      params
    );

    // Pedidos por día (últimos 7 días)
    const dailyStats = await query(
      `SELECT DATE(CONVERT_TZ(created_at,'UTC','America/Bogota')) as date, COUNT(*) as count 
       FROM orders ${whereClause} 
       AND CONVERT_TZ(created_at,'UTC','America/Bogota') >= DATE_SUB(DATE(CONVERT_TZ(NOW(),'UTC','America/Bogota')), INTERVAL 7 DAY)
       GROUP BY DATE(CONVERT_TZ(created_at,'UTC','America/Bogota')) 
       ORDER BY date DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        statusStats,
        totalStats: totalStats[0],
        dailyStats
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas avanzadas del dashboard
const getDashboardStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Filtros por rol
    if (userRole === 'mensajero') {
      whereClause += ' AND assigned_to = ?';
      params.push(userId);

      // Para mensajero: devolver SOLO contadores básicos y estadísticas por estado de SUS pedidos.
      // No exponer métricas financieras ni gráficos globales del negocio.
      const statusStats = await query(
        `SELECT 
          status,
          COUNT(*) as count,
          SUM(total_amount) as total_amount
         FROM orders ${whereClause} 
         GROUP BY status
         ORDER BY 
           CASE status
             WHEN 'pendiente_facturacion' THEN 1
             WHEN 'revision_cartera' THEN 2
             WHEN 'en_logistica' THEN 3
             WHEN 'en_reparto' THEN 4
             WHEN 'entregado_transportadora' THEN 5
             WHEN 'entregado_cliente' THEN 6
             WHEN 'cancelado' THEN 7
           END`,
        params
      );

      // Contadores principales
      const totalOrders = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause}`,
        params
      );

      const pendingBilling = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'pendiente_por_facturacion'`,
        params
      );

      const pendingPayment = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'revision_cartera'`,
        params
      );

      const pendingLogistics = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'en_logistica'`,
        params
      );

      const pendingPackaging = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('pendiente_empaque', 'en_preparacion', 'en_empaque')`,
        params
      );

      const pendingDelivery = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND (status = 'en_reparto' OR messenger_status IN ('accepted','in_delivery'))`,
        params
      );
      const sentToCarrier = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'entregado_transportadora'`,
        params
      );

      const readyForDelivery = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'listo_para_entrega' AND (messenger_status IS NULL OR messenger_status NOT IN ('accepted','in_delivery'))`,
        params
      );

      const delivered = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'entregado_cliente'`,
        params
      );

      // Desglose por método de entrega (para tarjeta Entregados)
      const deliveredByMethod = await query(
        `SELECT 
           COALESCE(delivery_method, 'domicilio') as method,
           COUNT(*) as count
         FROM orders ${whereClause} 
         AND status IN ('entregado_cliente', 'entregado')
         GROUP BY delivery_method`,
        params
      );

      // Desglose por mensajero (para tarjeta Entregados)
      const deliveredByMessenger = await query(
        `SELECT 
           u.full_name,
           COUNT(*) as count
         FROM orders o
         LEFT JOIN users u ON o.assigned_messenger_id = u.id
         ${whereClause} 
         AND o.status IN ('entregado_cliente', 'entregado')
         AND o.assigned_messenger_id IS NOT NULL
         GROUP BY o.assigned_messenger_id, u.full_name
         ORDER BY count DESC`,
        params
      );

      return res.json({
        success: true,
        data: {
          // Tarjetas principales
          totalOrders: totalOrders[0].count,
          pendingBilling: pendingBilling[0].count,
          pendingPayment: pendingPayment[0].count,
          pendingLogistics: pendingLogistics[0].count,
          pendingPackaging: pendingPackaging[0].count,
          readyForDelivery: readyForDelivery[0].count,
          pendingDelivery: pendingDelivery[0].count,
          sentToCarrier: sentToCarrier[0].count,
          delivered: delivered[0].count,

          // Desgloses nuevos
          deliveredByMethod,
          deliveredByMessenger,

          // Estadísticas mínimas
          statusStats,

          // Datos sensibles no visibles para mensajero
          financialMetrics: null,
          charts: {},
          performance: {},
          alerts: []
        }
      });
    }

    // Estadísticas por estado con iconos y colores
    const statusStats = await query(
      `SELECT 
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_amount,
        CASE 
          WHEN status = 'pendiente_facturacion' THEN 'file-text'
          WHEN status = 'revision_cartera' THEN 'credit-card'
          WHEN status = 'en_logistica' THEN 'package'
          WHEN status = 'en_reparto' THEN 'truck'
          WHEN status = 'entregado_transportadora' THEN 'send'
          WHEN status = 'entregado_cliente' THEN 'check'
          WHEN status = 'cancelado' THEN 'x-circle'
          ELSE 'circle'
        END as icon,
        CASE 
          WHEN status = 'pendiente_facturacion' THEN 'warning'
          WHEN status = 'revision_cartera' THEN 'info'
          WHEN status = 'en_logistica' THEN 'primary'
          WHEN status = 'en_reparto' THEN 'primary'
          WHEN status = 'entregado_transportadora' THEN 'success'
          WHEN status = 'entregado_cliente' THEN 'success'
          WHEN status = 'cancelado' THEN 'danger'
          ELSE 'secondary'
        END as color
       FROM orders ${whereClause} 
       GROUP BY status
       ORDER BY 
         CASE status
           WHEN 'pendiente_facturacion' THEN 1
           WHEN 'revision_cartera' THEN 2
           WHEN 'en_logistica' THEN 3
           WHEN 'en_reparto' THEN 4
           WHEN 'entregado_transportadora' THEN 5
           WHEN 'entregado_cliente' THEN 6
           WHEN 'cancelado' THEN 7
         END`,
      params
    );

    // Métricas financieras
    const todayRevenue = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as amount 
       FROM orders ${whereClause} 
       AND DATE(COALESCE(CONVERT_TZ(created_at,'UTC','America/Bogota'), CONVERT_TZ(created_at,'+00:00','-05:00'), DATE_ADD(created_at, INTERVAL -5 HOUR), created_at)) = 
           DATE(COALESCE(CONVERT_TZ(NOW(),'UTC','America/Bogota'), CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','-05:00'), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -5 HOUR), NOW()))`,
      params
    );

    // Dinero en tránsito: efectivo recaudado por mensajeros (delivery_tracking) que aún no ha sido legalizado (cash_register)
    // + Pedidos asignados a mensajero o bodega que aún no han sido entregados (se asume total_amount)
    const moneyInTransit = await query(
      `SELECT COALESCE(SUM(
         CASE 
           WHEN dt.delivered_at IS NOT NULL THEN dt.payment_collected 
           ELSE o.total_amount 
         END
       ), 0) as amount 
       FROM orders o
       LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
       WHERE o.payment_method = 'efectivo'
       AND o.status != 'anulado'
       AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
       AND NOT EXISTS (SELECT 1 FROM cash_closing_details ccd WHERE ccd.order_id = o.id AND ccd.collection_status = 'collected')
       AND (
         (dt.delivered_at IS NOT NULL AND dt.payment_collected > 0)
         OR
         (dt.delivered_at IS NULL AND (o.assigned_messenger_id IS NOT NULL OR o.delivery_method = 'recoge_bodega') 
          AND o.status NOT IN ('entregado', 'entregado_cliente', 'entregado_bodega', 'finalizado', 'completado', 'anulado'))
       )`,
      []
    );

    const averageOrderValue = await query(
      `SELECT COALESCE(AVG(total_amount), 0) as amount 
       FROM orders ${whereClause} 
       AND COALESCE(CONVERT_TZ(created_at,'UTC','America/Bogota'), CONVERT_TZ(created_at,'+00:00','-05:00'), DATE_ADD(created_at, INTERVAL -5 HOUR), created_at) >= 
           DATE_SUB(DATE(COALESCE(CONVERT_TZ(NOW(),'UTC','America/Bogota'), CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','-05:00'), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -5 HOUR), NOW())), INTERVAL 30 DAY)`,
      params
    );

    // Evolución de pedidos por días (últimos 14 días)
    const dailyEvolution = await query(
      `SELECT 
        DATE(COALESCE(CONVERT_TZ(created_at,'UTC','America/Bogota'), CONVERT_TZ(created_at,'+00:00','-05:00'), DATE_ADD(created_at, INTERVAL -5 HOUR), created_at)) as date,
        COUNT(*) as count,
        SUM(total_amount) as revenue
       FROM orders ${whereClause} 
       AND COALESCE(CONVERT_TZ(created_at,'UTC','America/Bogota'), CONVERT_TZ(created_at,'+00:00','-05:00'), DATE_ADD(created_at, INTERVAL -5 HOUR), created_at) >= 
           DATE_SUB(DATE(COALESCE(CONVERT_TZ(NOW(),'UTC','America/Bogota'), CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','-05:00'), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -5 HOUR), NOW())), INTERVAL 13 DAY)
       GROUP BY DATE(COALESCE(CONVERT_TZ(created_at,'UTC','America/Bogota'), CONVERT_TZ(created_at,'+00:00','-05:00'), DATE_ADD(created_at, INTERVAL -5 HOUR), created_at))
       ORDER BY date ASC`,
      params
    );

    // Pedidos por método de entrega
    const deliveryMethodStats = await query(
      `SELECT 
        COALESCE(delivery_method, 'domicilio') as method,
        COUNT(*) as count,
        SUM(total_amount) as total_amount
       FROM orders ${whereClause}
       GROUP BY delivery_method`,
      params
    );

    // Ingresos acumulados por semana (últimas 8 semanas)
    const weeklyRevenue = await query(
      `SELECT 
        YEARWEEK(COALESCE(CONVERT_TZ(created_at,'UTC','America/Bogota'), CONVERT_TZ(created_at,'+00:00','-05:00'), DATE_ADD(created_at, INTERVAL -5 HOUR), created_at), 1) as week,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
       FROM orders ${whereClause} 
       AND COALESCE(CONVERT_TZ(created_at,'UTC','America/Bogota'), CONVERT_TZ(created_at,'+00:00','-05:00'), DATE_ADD(created_at, INTERVAL -5 HOUR), created_at) >= 
           DATE_SUB(DATE(COALESCE(CONVERT_TZ(NOW(),'UTC','America/Bogota'), CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','-05:00'), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -5 HOUR), NOW())), INTERVAL 8 WEEK)
       GROUP BY YEARWEEK(COALESCE(CONVERT_TZ(created_at,'UTC','America/Bogota'), CONVERT_TZ(created_at,'+00:00','-05:00'), DATE_ADD(created_at, INTERVAL -5 HOUR), created_at), 1) 
       ORDER BY week ASC`,
      params
    );

    // Rendimiento por mensajero (solo para admin y logística)
    let messengerPerformance = [];
    if (['admin', 'logistica'].includes(userRole)) {
      messengerPerformance = await query(
        `SELECT 
          u.full_name,
          COUNT(o.id) as assigned_orders,
          SUM(CASE WHEN o.status = 'entregado' THEN 1 ELSE 0 END) as delivered_orders,
          ROUND((SUM(CASE WHEN o.status = 'entregado' THEN 1 ELSE 0 END) / COUNT(o.id)) * 100, 2) as efficiency
         FROM users u
         LEFT JOIN orders o ON u.id = o.assigned_to AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         WHERE u.role = 'mensajero' AND u.active = true
         GROUP BY u.id, u.full_name
         HAVING assigned_orders > 0
         ORDER BY efficiency DESC`,
        []
      );
    }

    // Alertas inteligentes
    const alerts = [];

    // Pedidos retrasados (más de 2 días en el mismo estado)
    const delayedOrders = await query(
      `SELECT COUNT(*) as count 
       FROM orders ${whereClause} 
       AND status NOT IN ('entregado', 'cancelado') 
       AND updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY)`,
      params
    );

    if (delayedOrders[0].count > 0) {
      alerts.push({
        type: 'warning',
        title: 'Pedidos Retrasados',
        message: `${delayedOrders[0].count} pedidos llevan más de 2 días sin actualizar`,
        action: 'Ver Pedidos',
        actionUrl: '/orders?filter=delayed'
      });
    }

    // Dinero pendiente con mensajeros
    if (moneyInTransit[0].amount > 0) {
      alerts.push({
        type: 'info',
        title: 'Dinero en Tránsito',
        message: `$${moneyInTransit[0].amount.toLocaleString()} pendiente con mensajeros`,
        action: 'Ver Detalles',
        actionUrl: '/orders?status=enviado'
      });
    }

    // Capacidad alta (más de 20 pedidos pendientes)
    const pendingCount = statusStats.find(s => s.status === 'pendiente')?.count || 0;
    if (pendingCount > 20) {
      alerts.push({
        type: 'danger',
        title: 'Alta Demanda',
        message: `${pendingCount} pedidos pendientes requieren atención`,
        action: 'Procesar',
        actionUrl: '/orders?status=pendiente'
      });
    }

    // Estadísticas específicas para las tarjetas principales
    const totalOrders = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause}`,
      params
    );

    const pendingBilling = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'pendiente_por_facturacion'`,
      params
    );

    const pendingPayment = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'revision_cartera'`,
      params
    );

    const pendingLogistics = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'en_logistica'`,
      params
    );

    const pendingPackaging = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('pendiente_empaque', 'en_preparacion', 'en_empaque')`,
      params
    );

    const pendingDelivery = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND (status = 'en_reparto' OR messenger_status IN ('accepted','in_delivery'))`,
      params
    );
    const sentToCarrier = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'entregado_transportadora'`,
      params
    );

    const readyForDelivery = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'listo_para_entrega' AND (messenger_status IS NULL OR messenger_status NOT IN ('accepted','in_delivery'))`,
      params
    );

    const delivered = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'entregado_cliente'`,
      params
    );

    // Desglose por método de entrega (para tarjeta Entregados)
    const deliveredByMethod = await query(
      `SELECT 
         COALESCE(delivery_method, 'domicilio') as method,
         COUNT(*) as count
       FROM orders ${whereClause} 
       AND status IN ('entregado_cliente', 'entregado')
       GROUP BY delivery_method`,
      params
    );

    // Desglose por mensajero (para tarjeta Entregados)
    const deliveredByMessenger = await query(
      `SELECT 
         u.full_name,
         COUNT(*) as count
       FROM orders o
       LEFT JOIN users u ON o.assigned_messenger_id = u.id
       ${whereClause} 
       AND o.status IN ('entregado_cliente', 'entregado')
       AND o.assigned_messenger_id IS NOT NULL
       GROUP BY o.assigned_messenger_id, u.full_name
       ORDER BY count DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        // Estadísticas principales para las tarjetas
        totalOrders: totalOrders[0].count,
        pendingBilling: pendingBilling[0].count,
        pendingPayment: pendingPayment[0].count,
        pendingLogistics: pendingLogistics[0].count,
        pendingPackaging: pendingPackaging[0].count,
        readyForDelivery: readyForDelivery[0].count,
        pendingDelivery: pendingDelivery[0].count,
        sentToCarrier: sentToCarrier[0].count,
        delivered: delivered[0].count,

        // Desgloses nuevos
        deliveredByMethod,
        deliveredByMessenger,

        // Estadísticas existentes
        statusStats,
        financialMetrics: {
          todayRevenue: todayRevenue[0].amount,
          moneyInTransit: moneyInTransit[0].amount,
          averageOrderValue: averageOrderValue[0].amount
        },
        charts: {
          dailyEvolution,
          deliveryMethodStats,
          weeklyRevenue
        },
        performance: {
          messengerPerformance
        },
        alerts
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Construir línea de tiempo del pedido
const getOrderTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    // Pedido base
    const [orders] = await Promise.all([
      query('SELECT o.*, c.name as carrier_name FROM orders o LEFT JOIN carriers c ON o.carrier_id = c.id WHERE o.id = ?', [id])
    ]);

    if (!orders.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const o = orders[0];

    // Consultas paralelas de fuentes relacionadas (incluye adjuntos)
    const [cash, validations, pkgStatus, scans, tracking, evidences, pkgEvidences, history, paymentEvidences] = await Promise.all([
      query('SELECT amount, payment_method, status, created_at, accepted_at, accepted_by FROM cash_register WHERE order_id = ? ORDER BY created_at ASC', [id]),
      // Incluir nombres e imágenes de cartera
      query(`SELECT 
               validation_type, validation_status, validated_by, validated_at, created_at,
               payment_proof_image, cash_proof_image,
               (SELECT full_name FROM users WHERE id = validated_by) AS validated_by_name
             FROM wallet_validations 
             WHERE order_id = ? 
             ORDER BY created_at ASC`, [id]),
      query('SELECT packaging_status, started_by, started_at, completed_by, completed_at FROM order_packaging_status WHERE order_id = ? LIMIT 1', [id]),
      query('SELECT COUNT(*) as scans, MIN(scan_timestamp) as first_scan, MAX(scan_timestamp) as last_scan FROM barcode_scan_logs WHERE order_id = ?', [id]),
      query('SELECT dt.*, u.full_name as messenger_name FROM delivery_tracking dt LEFT JOIN users u ON dt.messenger_id = u.id WHERE order_id = ? LIMIT 1', [id]),
      // Evidencias fotográficas de mensajero
      query('SELECT id, photo_filename, photo_path, description, taken_at, created_at FROM delivery_evidence WHERE order_id = ? ORDER BY created_at ASC', [id]),
      // Evidencias fotográficas de empaque
      query('SELECT id, photo_filename, photo_path, description, taken_at, created_at FROM packaging_evidence WHERE order_id = ? ORDER BY created_at ASC', [id]),
      // Historial de órdenes (para evidencia de pago y otros eventos futuros)
      query('SELECT action, description, created_at FROM order_history WHERE order_id = ? AND action = "payment_evidence_uploaded" ORDER BY created_at ASC', [id]),
      // Evidencias de pago (tabla nueva)
      query('SELECT id, file_path, uploaded_at, uploaded_by FROM payment_evidences WHERE order_id = ? ORDER BY uploaded_at ASC', [id])
    ]);

    // Eventos manuales (auditoría) - Gestión especial / Devolución / Cancelación
    const special = await query(
      'SELECT created_at, customer_name FROM orders_audit WHERE order_id = ? AND action = "SPECIAL_MANAGED" ORDER BY created_at ASC',
      [id]
    );
    const returns = await query(
      'SELECT created_at, customer_name FROM orders_audit WHERE order_id = ? AND action = "RETURN_TO_BILLING" ORDER BY created_at ASC',
      [id]
    );
    const cancellations = await query(
      'SELECT created_at, customer_name FROM orders_audit WHERE order_id = ? AND action = "CANCEL_BY_CUSTOMER" ORDER BY created_at ASC',
      [id]
    );

    const events = [];
    const attachments = [];

    // Creación
    if (o.created_at) {
      events.push({ at: o.created_at, type: 'created', title: 'Pedido ingresó al sistema', details: `Creado por usuario ID ${o.created_by || '-'} · Origen: ${o.order_source || 'manual'}` });
    }

    // SIIGO
    if (o.siigo_invoice_created_at) {
      events.push({ at: o.siigo_invoice_created_at, type: 'invoice_created', title: 'Factura SIIGO creada', details: `Factura: ${o.siigo_invoice_number || o.siigo_invoice_id || ''}` });
    }

    // Evidencias POS (almacenadas en tabla orders)
    if (o.product_evidence_photo) {
      attachments.push({
        url: `/${o.product_evidence_photo}`,
        label: 'Foto del Producto (POS)',
        source: 'POS',
        at: o.delivered_at || o.updated_at
      });
    }
    if (o.payment_evidence_photo) {
      attachments.push({
        url: `/${o.payment_evidence_photo}`,
        label: 'Comprobante de Pago (POS)',
        source: 'POS',
        at: o.delivered_at || o.updated_at
      });
    }
    if (o.cash_evidence_photo) {
      attachments.push({
        url: `/${o.cash_evidence_photo}`,
        label: 'Foto del Efectivo (POS)',
        source: 'POS',
        at: o.delivered_at || o.updated_at
      });
    }

    // Evidencias de pago (agrupar por fecha cercana o mostrar individualmente)
    if (paymentEvidences && paymentEvidences.length > 0) {
      // Agrupar evidencias subidas en el mismo minuto para no saturar el timeline
      const grouped = {};
      paymentEvidences.forEach(ev => {
        const key = new Date(ev.uploaded_at).toISOString().substring(0, 16); // YYYY-MM-DDTHH:mm
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(ev);
      });

      Object.keys(grouped).forEach(key => {
        const group = grouped[key];
        const first = group[0];
        const evAttachments = group.map(g => ({
          url: `/${g.file_path}`,
          label: 'Comprobante de Pago',
          source: 'cartera'
        }));

        // Agregar a adjuntos globales
        evAttachments.forEach(att => attachments.push({ ...att, at: first.uploaded_at }));

        events.push({
          at: first.uploaded_at,
          type: 'payment_evidence',
          title: 'Comprobante(s) de Pago subido(s)',
          details: `Se subieron ${group.length} archivo(s) de soporte.`,
          attachments: evAttachments
        });
      });
    }

    // Cartera (validaciones)
    validations.forEach(v => {
      const when = v.validated_at || v.created_at;
      const status = v.validation_type || v.validation_status;
      const ev = {
        at: when,
        type: 'wallet_validation',
        title: 'Validación de Cartera',
        details: `Resultado: ${status}${v.validated_by_name ? ` · Por: ${v.validated_by_name}` : ''}`
      };
      const evAttachments = [];
      // Mantener compatibilidad con imágenes antiguas en wallet_validations si existen
      if (v.payment_proof_image) {
        const url = `/uploads/payment-proofs/${v.payment_proof_image}`;
        evAttachments.push({ url, label: 'Comprobante de Transferencia (Legacy)', source: 'cartera' });
        attachments.push({ url, label: 'Comprobante de Transferencia (Legacy)', source: 'cartera', at: when });
      }
      if (v.cash_proof_image) {
        const url = `/uploads/payment-proofs/${v.cash_proof_image}`;
        evAttachments.push({ url, label: 'Comprobante de Efectivo (Legacy)', source: 'cartera' });
        attachments.push({ url, label: 'Comprobante de Efectivo (Legacy)', source: 'cartera', at: when });
      }
      if (evAttachments.length) {
        ev.attachments = (ev.attachments || []).concat(evAttachments);
      }
      events.push(ev);
    });

    // Pago recibido en bodega / caja
    cash.forEach(c => {
      events.push({ at: c.created_at, type: 'payment', title: 'Pago registrado', details: `Método: ${c.payment_method} · Monto: $${Number(c.amount || 0).toLocaleString('es-CO')}` });
      if (c.accepted_at) {
        events.push({ at: c.accepted_at, type: 'payment_accepted', title: 'Pago aceptado', details: c.status ? `Estado: ${c.status}` : undefined });
      }
    });

    // Envío a empaque / logística
    if (o.shipping_date) {
      events.push({ at: o.shipping_date, type: 'send_to_packaging', title: 'Enviado a Empaque', details: o.logistics_notes ? `Notas: ${o.logistics_notes}` : undefined });
    }

    // Empaque
    if (pkgStatus.length) {
      const p = pkgStatus[0];
      if (p.started_at) events.push({ at: p.started_at, type: 'packaging_started', title: 'Empaque iniciado' });
      if (p.completed_at) events.push({ at: p.completed_at, type: 'packaging_completed', title: 'Empaque finalizado' });
    }

    // Escaneos de empaque
    if (scans.length && (scans[0].scans || 0) > 0) {
      const s = scans[0];
      events.push({ at: s.first_scan, type: 'scan_first', title: 'Primer escaneo de empaque', details: undefined });
      if (s.last_scan && s.last_scan !== s.first_scan) {
        events.push({ at: s.last_scan, type: 'scan_last', title: `Último escaneo de empaque (${s.scans} lecturas)`, details: undefined });
      }
    }

    // Mensajería / entrega
    if (tracking.length) {
      const t = tracking[0];
      if (t.assigned_at) events.push({ at: t.assigned_at, type: 'messenger_assigned', title: 'Mensajero asignado', details: t.messenger_name ? `Mensajero: ${t.messenger_name}` : undefined });
      if (t.accepted_at) events.push({ at: t.accepted_at, type: 'messenger_accepted', title: 'Mensajero aceptó el pedido' });
      if (t.started_delivery_at) events.push({ at: t.started_delivery_at, type: 'delivery_started', title: 'Entrega iniciada' });
      if (t.failed_at) events.push({ at: t.failed_at, type: 'delivery_failed', title: 'Entrega fallida', details: t.failure_reason || undefined });
      if (t.delivered_at) events.push({ at: t.delivered_at, type: 'delivered', title: 'Pedido entregado por mensajero', details: t.delivery_notes || undefined });
    }

    // Evidencia fotográfica del mensajero
    evidences.forEach(e => {
      const when = e.taken_at || e.created_at;
      const url = e.photo_filename ? `/uploads/delivery_evidence/${e.photo_filename}` : null;
      const ev = { at: when, type: 'delivery_evidence', title: 'Evidencia de entrega', details: e.description || undefined };
      if (url) {
        ev.attachments = [{ url, label: 'Evidencia Mensajero', source: 'mensajero' }];
        attachments.push({ url, label: 'Evidencia Mensajero', source: 'mensajero', at: when });
      }
      events.push(ev);
    });

    // Evidencia fotográfica de empaque
    if (pkgEvidences && pkgEvidences.length) {
      pkgEvidences.forEach(e => {
        const when = e.taken_at || e.created_at;
        const url = e.photo_path || (e.photo_filename ? `/uploads/delivery_evidence/${e.photo_filename}` : null);
        const ev = { at: when, type: 'packaging_evidence', title: 'Evidencia de empaque', details: e.description || undefined };
        if (url) {
          ev.attachments = [{ url, label: 'Evidencia Empaque', source: 'empaque' }];
          attachments.push({ url, label: 'Evidencia Empaque', source: 'empaque', at: when });
        }
        events.push(ev);
      });
    }

    // Evidencia de pago (Logística/Cartera) desde historial
    let paymentEvidenceAdded = false;
    if (history && history.length) {
      history.forEach(h => {
        if (h.action === 'payment_evidence_uploaded') {
          const ev = {
            at: h.created_at,
            type: 'payment_evidence_uploaded',
            title: 'Evidencia de pago subida',
            details: h.description || 'Subida por Cartera/Logística'
          };
          if (o.payment_evidence_path) {
            const url = o.payment_evidence_path;
            ev.attachments = [{ url, label: 'Evidencia de Pago', source: 'logística' }];
            attachments.push({ url, label: 'Evidencia de Pago', source: 'logística', at: h.created_at });
          }
          events.push(ev);
          paymentEvidenceAdded = true;
        }
      });
    }

    // Fallback: Si hay path pero no hubo evento en historial (migración o subida previa al fix)
    if (!paymentEvidenceAdded && o.payment_evidence_path) {
      const when = o.updated_at || o.created_at; // Mejor aproximación
      const ev = {
        at: when,
        type: 'payment_evidence_uploaded',
        title: 'Evidencia de pago subida',
        details: 'Evidencia existente (sin registro de fecha exacto)'
      };
      const url = o.payment_evidence_path;
      ev.attachments = [{ url, label: 'Evidencia de Pago', source: 'logística' }];
      attachments.push({ url, label: 'Evidencia de Pago', source: 'logística', at: when });
      events.push(ev);
    }

    // Guía de transporte (nueva funcionalidad)
    if (o.transport_guide_url) {
      const when = o.updated_at || o.created_at; // Aproximación si no hay timestamp específico de subida
      const ev = {
        at: when,
        type: 'transport_guide_uploaded',
        title: 'Guía de transporte subida',
        details: 'Guía de la transportadora'
      };

      let urls = [];
      try {
        const parsed = JSON.parse(o.transport_guide_url);
        if (Array.isArray(parsed)) {
          urls = parsed;
        } else {
          urls = [o.transport_guide_url];
        }
      } catch (e) {
        urls = [o.transport_guide_url];
      }

      const guideAttachments = urls.map((url, idx) => ({
        url,
        label: urls.length > 1 ? `Guía de Transporte (${idx + 1})` : 'Guía de Transporte',
        source: 'logística'
      }));

      ev.attachments = guideAttachments;
      guideAttachments.forEach(att => {
        attachments.push({ ...att, at: when });
      });

      events.push(ev);
    }

    // Gestión especial (auditoría)
    if (special && special.length) {
      special.forEach(s => {
        events.push({
          at: s.created_at,
          type: 'special_managed',
          title: 'Gestión especial aplicada',
          details: s.customer_name ? `Motivo: ${s.customer_name}` : undefined
        });
      });
    }
    // Devolución a Facturación (auditoría)
    if (returns && returns.length) {
      returns.forEach(r => {
        events.push({
          at: r.created_at,
          type: 'return_to_billing',
          title: 'Devuelto a Facturación',
          details: r.customer_name ? `Motivo: ${r.customer_name}` : undefined
        });
      });
    }
    // Cancelación por cliente (auditoría)
    if (cancellations && cancellations.length) {
      cancellations.forEach(c => {
        events.push({
          at: c.created_at,
          type: 'cancelled',
          title: 'Cancelado por cliente',
          details: c.customer_name ? `Motivo: ${c.customer_name}` : undefined
        });
      });
    } else if (o.cancelled_at) {
      // Fallback si no hay auditoría: usar columnas dedicadas o tracking
      const reasonCandidates = [
        (tracking && tracking[0] && tracking[0].cancelled_reason) || null,
        o.cancellation_reason || null
      ].filter(Boolean);
      const detail = reasonCandidates.length ? `Motivo: ${reasonCandidates[0]}` : undefined;
      events.push({
        at: o.cancelled_at,
        type: 'cancelled',
        title: 'Cancelado por cliente',
        details: detail
      });
    }
    // Enterado de cancelación por Logística (si existe)
    if (o.cancellation_logistics_ack_at) {
      events.push({
        at: o.cancellation_logistics_ack_at,
        type: 'logistics_ack_cancel',
        title: 'Enterado de cancelación (Logística)'
      });
    }

    // Entregado (bodega/transportadora/cliente)
    if (o.delivered_at) {
      const label = o.delivery_method === 'recoge_bodega' ? 'Entregado en Bodega' : (o.status === 'entregado_transportadora' ? 'Entregado a Transportadora' : 'Entregado a Cliente');
      const detailsParts = [];
      if (o.status === 'entregado_transportadora') {
        if (o.carrier_name) detailsParts.push(`Transportadora: ${o.carrier_name}`);
      }
      if (o.delivery_notes) detailsParts.push(o.delivery_notes);
      const details = detailsParts.length ? detailsParts.join(' · ') : undefined;
      events.push({ at: o.delivered_at, type: 'delivered_final', title: label, details });
    }

    // Cerrado en Siigo (Administrativo)
    if (o.siigo_closed === 1) {
      const detailsParts = [];
      if (o.siigo_closure_method) detailsParts.push(`Método: ${o.siigo_closure_method}`);
      if (o.siigo_closure_note) detailsParts.push(`Nota: ${o.siigo_closure_note}`);

      events.push({
        at: o.siigo_closed_at || o.updated_at, // Fallback si no hay fecha específica
        type: 'siigo_closed',
        title: 'Cerrado en Siigo',
        details: detailsParts.join(' · ') || 'Cierre administrativo completado'
      });
    }

    // Estado actual al final
    const statusDetails = (() => {
      if (o.status === 'entregado_transportadora') {
        const parts = ['entregado_transportadora'];
        if (o.carrier_name) parts.push(`Transportadora: ${o.carrier_name}`);
        return parts.join(' · ');
      }
      return o.status;
    })();
    events.push({ at: o.updated_at || o.created_at, type: 'status', title: 'Estado actual', details: statusDetails });

    // Ordenar por fecha
    events.sort((a, b) => new Date(a.at) - new Date(b.at));

    // Contexto útil
    const context = {
      order_number: o.order_number,
      customer_name: o.customer_name,
      delivery_method: o.delivery_method,
      payment_method: o.payment_method,
      total_amount: o.total_amount,
      carrier_id: o.carrier_id || null,
      carrier_name: o.carrier_name || null,
      is_service: o.is_service // Importante para el frontend
    };

    console.log('🔍 Timeline Attachments:', JSON.stringify(attachments, null, 2));
    return res.json({ success: true, data: { context, events, attachments } });
  } catch (error) {
    console.error('Error construyendo timeline del pedido:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Eliminar TODOS los pedidos y datos relacionados (solo admin)
const deleteAllOrders = async (req, res) => {
  try {
    // Seguridad adicional además del middleware de rutas
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo administradores pueden ejecutar este reinicio' });
    }

    const { confirm } = req.body || {};
    if (confirm !== 'RESET_ALL_ORDERS') {
      return res.status(400).json({ success: false, message: "Confirma escribiendo 'RESET_ALL_ORDERS'" });
    }

    const tablesToClear = [
      // Dependientes directos por order_id
      'order_items',
      'delivery_tracking',
      'cash_register',
      'wallet_validations',
      'order_packaging_status',
      'packaging_item_verifications',
      'packaging_records',
      'barcode_scan_logs',
      'simple_barcode_scans',
      'shipping_guides',
      'logistics_records',
      'siigo_sync_log',
      'whatsapp_notifications',
      'cash_closing_details'
    ];

    await transaction(async (connection) => {
      // Helpers locales
      const tableExists = async (name) => {
        try {
          const [r] = await connection.execute(
            `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
            [name]
          );
          return r.length > 0;
        } catch {
          return false;
        }
      };

      // 1) Vaciar tablas dependientes si existen
      for (const t of tablesToClear) {
        try {
          if (await tableExists(t)) {
            const [del] = await connection.execute(`DELETE FROM ${t}`);
            try { await connection.execute(`ALTER TABLE ${t} AUTO_INCREMENT = 1`); } catch (_) { }
            console.log(`🧹 Tabla ${t}: ${del.affectedRows ?? 0} filas eliminadas`);
          } else {
            console.log(`ℹ️ Tabla ${t} no existe, omitida`);
          }
        } catch (e) {
          console.log(`⚠️ Error limpiando ${t}:`, e.message);
        }
      }

      // 2) Eliminar pedidos
      const [delOrders] = await connection.execute('DELETE FROM orders');
      try { await connection.execute('ALTER TABLE orders AUTO_INCREMENT = 1'); } catch (_) { }
      console.log(`🗑️ Pedidos eliminados: ${delOrders.affectedRows ?? 0}`);
    });

    res.json({ success: true, message: 'Todos los pedidos y sus registros relacionados fueron eliminados correctamente' });
  } catch (error) {
    console.error('Error eliminando todos los pedidos:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Cancelación por cliente (solo Admin/Facturación).
 * Efectos:
 *  - orders.status -> 'cancelado'
 *  - orders.messenger_status -> 'cancelled' si aplica
 *  - Registra cancelled_at/by, reason, prev_status
 *  - delivery_tracking: marca cancelación si existe fila
 *  - Emite evento 'order-status-changed'
 */
const cancelByCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const userId = req.user?.id || null;

    const rows = await query(
      `SELECT id, order_number, status, assigned_messenger_id, messenger_status, siigo_invoice_number 
       FROM orders WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const o = rows[0];
    const status = String(o.status || '').toLowerCase();

    // Bloqueos
    if (['entregado_cliente', 'entregado_transportadora', 'entregado', 'cancelado'].includes(status)) {
      return res.status(400).json({ success: false, message: 'No se puede cancelar: el pedido ya fue entregado o está cancelado' });
    }

    // Transiciones permitidas
    const allowed = new Set([
      'en_preparacion', 'en_empaque', 'empacado', 'listo', 'listo_para_entrega', 'listo_para_recoger', 'en_logistica', 'en_reparto'
    ]);
    if (!allowed.has(status)) {
      return res.status(400).json({ success: false, message: `Estado actual (${status}) no permite cancelación por cliente` });
    }

    await transaction(async (connection) => {
      // Actualizar tracking (si existe)
      try {
        await connection.execute(
          `UPDATE delivery_tracking 
             SET cancelled_at = COALESCE(cancelled_at, NOW()),
                 cancelled_by_user_id = COALESCE(cancelled_by_user_id, ?),
                 cancelled_reason = COALESCE(cancelled_reason, ?),
                 status_cancelled = 1
           WHERE order_id = ?`,
          [userId, String(reason || '').trim() || null, id]
        );
      } catch (_) { }

      // Construir SET dinámico para messenger_status
      const setParts = [
        'cancellation_prev_status = ?',
        'cancelled_at = NOW()',
        'cancelled_by_user_id = ?',
        'cancellation_reason = ?',
        "status = 'cancelado'",
        'updated_at = NOW()'
      ];
      const values = [status, userId, String(reason || '').trim() || null];

      // Si hay flujo de mensajero, cortar con 'cancelled'
      const hasMessengerFlow = o.assigned_messenger_id != null || (o.messenger_status != null && String(o.messenger_status).trim() !== '');
      if (hasMessengerFlow) {
        setParts.push("messenger_status = 'cancelled'");
      }

      await connection.execute(
        `UPDATE orders SET ${setParts.join(', ')} WHERE id = ?`,
        [...values, id]
      );

      // Auditoría (opcional/defensivo)
      try {
        await connection.execute(
          `INSERT INTO orders_audit (order_id, action, siigo_invoice_number, customer_name, user_id, created_at)
           VALUES (?, 'CANCEL_BY_CUSTOMER', ?, ?, ?, NOW())`,
          [id, o.siigo_invoice_number || null, String(reason || '').trim() || null, userId]
        );
      } catch (e) {
        // no bloquear
      }
    });

    // Emitir evento en tiempo real
    try {
      if (global.io) {
        const payload = {
          orderId: Number(id),
          order_number: o.order_number,
          from_status: status,
          to_status: 'cancelado',
          changed_by_role: req.user?.role || null,
          timestamp: new Date().toISOString()
        };
        global.io.to('orders-updates').emit('order-status-changed', payload);
        console.log('📡 Emitido order-status-changed (cancelado):', payload);
      }
    } catch (emitErr) {
      console.error('⚠️  Error emitiendo evento order-status-changed (cancelado):', emitErr.message);
    }

    return res.json({ success: true, message: 'Pedido cancelado por cliente', data: { id: Number(id), status: 'cancelado' } });
  } catch (error) {
    console.error('Error en cancelByCustomer:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Enterado de cancelación (Logística).
 * Marca cancellation_logistics_ack_at/by para retirar de vistas internas si aplica.
 */
const logisticsAckCancel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const rows = await query(
      `SELECT id, order_number, status, cancellation_logistics_ack_at 
       FROM orders WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const o = rows[0];
    const status = String(o.status || '').toLowerCase();

    if (status !== 'cancelado') {
      return res.status(400).json({ success: false, message: 'Solo se puede dar enterado a pedidos cancelados' });
    }

    if (o.cancellation_logistics_ack_at) {
      // Idempotente
      return res.json({ success: true, message: 'Cancelación ya estaba enterada', data: { id: Number(id) } });
    }

    await query(
      `UPDATE orders 
         SET cancellation_logistics_ack_at = NOW(),
             cancellation_logistics_ack_by = ?,
             updated_at = NOW()
       WHERE id = ?`,
      [userId, id]
    );

    return res.json({ success: true, message: 'Enterado registrado', data: { id: Number(id) } });
  } catch (error) {
    console.error('Error en logisticsAckCancel:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Sincronizar pedido desde SIIGO preservando verificaciones de empaque
const syncOrderFromSiigo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔄 Iniciando sincronización inteligente para pedido ${id} desde SIIGO...`);
    if (global.io) global.io.emit('sync-progress', { orderId: id, progress: 10, message: 'Iniciando sincronización...' });

    // 1. Obtener pedido y su ID de factura SIIGO (incluyendo datos actuales de cliente para fallback)
    const orderRows = await query('SELECT id, siigo_invoice_id, order_number, customer_phone, customer_address, customer_email FROM orders WHERE id = ?', [id]);
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const order = orderRows[0];

    if (!order.siigo_invoice_id) {
      return res.status(400).json({ success: false, message: 'El pedido no está vinculado a una factura de SIIGO' });
    }

    // 2. Obtener detalles frescos desde SIIGO
    if (global.io) global.io.emit('sync-progress', { orderId: id, progress: 30, message: 'Consultando factura en SIIGO...' });
    let siigoInvoice;
    try {
      siigoInvoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);
    } catch (e) {
      console.error('❌ Error obteniendo factura de SIIGO:', e.message);
      return res.status(502).json({ success: false, message: 'No se pudo obtener la factura desde SIIGO', error: e.message });
    }

    if (!siigoInvoice || !siigoInvoice.items || !siigoInvoice.items.length) {
      return res.status(400).json({ success: false, message: 'La factura en SIIGO no tiene items' });
    }

    // 2.1 Actualizar información del cliente (Nombre, Teléfono, etc.)
    if (global.io) global.io.emit('sync-progress', { orderId: id, progress: 50, message: 'Actualizando datos del cliente...' });
    if (siigoInvoice.customer?.id) {
      try {
        console.log(`👤 Actualizando información del cliente ${siigoInvoice.customer.id} (skipping cache)...`);
        // Forzar carga fresca del cliente
        const customerInfo = await siigoService.getCustomer(siigoInvoice.customer.id, true);

        // Usar la misma lógica de extracción que en siigoService
        const extractCommercialName = (customer, info) => {
          if (info.commercial_name && info.commercial_name !== 'No aplica') return info.commercial_name;
          if (info.company?.name) return info.company.name;
          if (info.name && Array.isArray(info.name) && info.name.length > 0) return info.name[0];
          if (customer.commercial_name && customer.commercial_name !== 'No aplica') return customer.commercial_name;
          return 'Cliente SIIGO';
        };

        const newName = extractCommercialName(siigoInvoice.customer, customerInfo);
        const newPhone = customerInfo.phones?.[0]?.number || siigoInvoice.customer.phones?.[0]?.number || order.customer_phone || null;
        const newAddress = customerInfo.address?.address || siigoInvoice.customer.address?.address || order.customer_address || null;
        const newEmail = customerInfo.contacts?.[0]?.email || customerInfo.email || order.customer_email || null;

        if (newName && newName !== 'Cliente SIIGO') {
          await query(
            `UPDATE orders SET 
                customer_name = ?, 
                customer_phone = ?, 
                customer_address = ?, 
                customer_email = ? 
              WHERE id = ?`,
            [newName, newPhone, newAddress, newEmail, id]
          );
          console.log(`✅ Cliente actualizado en BD: ${newName}`);
        }

        // 2.2 Actualizar observaciones/notas
        const newObservations = siigoInvoice.observations || '';
        if (newObservations) {
          await query(
            `UPDATE orders SET 
                siigo_observations = ?,
                notes = ?
              WHERE id = ?`,
            [newObservations, newObservations, id]
          );
          console.log(`✅ Notas actualizadas desde SIIGO`);
        }
      } catch (err) {
        console.error('⚠️ Error actualizando cliente en sync:', err);
        console.error(err.stack);
      }
    }

    // 3. Obtener items locales actuales
    if (global.io) global.io.emit('sync-progress', { orderId: id, progress: 60, message: 'Analizando items...' });
    const localItems = await query('SELECT * FROM order_items WHERE order_id = ?', [id]);

    console.log(`📊 Items locales encontrados: ${localItems.length}`);
    localItems.forEach(i => console.log(`   - [${i.id}] Code: ${i.product_code}, Name: "${i.name}", Qty: ${i.quantity}`));

    // Mapa de items locales para búsqueda rápida
    // Clave primaria: product_code (si existe). Secundaria: nombre normalizado.
    const localMap = new Map();
    localItems.forEach(item => {
      // Preferir código de producto si existe, sino nombre
      const key = item.product_code
        ? `CODE:${item.product_code}`
        : `NAME:${String(item.name).trim().toLowerCase()}`;

      // Manejar duplicados locales (no debería pasar, pero por seguridad usamos array)
      if (!localMap.has(key)) localMap.set(key, []);
      localMap.get(key).push(item);
    });

    // 3.1 Cargar Mapa de Costos de Productos (Solo los necesarios)
    const neededCodes = new Set();
    const neededNames = new Set();

    if (siigoInvoice && siigoInvoice.items) {
      siigoInvoice.items.forEach(item => {
        const c = item.code || item.product?.code;
        const n = item.description || item.product?.name;
        if (c) neededCodes.add(String(c).trim());
        if (n) neededNames.add(String(n).trim().toLowerCase());
      });
    }

    // Agregar items locales a la busqueda para asegurar consistencia
    localItems.forEach(item => {
      if (item.product_code) neededCodes.add(String(item.product_code).trim());
      if (item.name) neededNames.add(String(item.name).trim().toLowerCase());
    });

    const costMap = new Map();

    if (neededCodes.size > 0 || neededNames.size > 0) {
      let conditions = [];
      let params = [];

      if (neededCodes.size > 0) {
        // "IN (?)" no funciona automaticamente para arrays en mysql2 raw execute, necesitamos generar los placeholders
        conditions.push(`internal_code IN (${Array.from(neededCodes).map(() => '?').join(',')})`);
        params.push(...Array.from(neededCodes));
      }

      // Optimización: buscar por nombre
      if (neededNames.size > 0) {
        // LOWER(product_name) IN (...)
        conditions.push(`LOWER(product_name) IN (${Array.from(neededNames).map(() => '?').join(',')})`);
        params.push(...Array.from(neededNames));
      }

      if (conditions.length > 0) {
        const querySql = `SELECT product_name, internal_code, purchasing_price, standard_price FROM products WHERE ${conditions.join(' OR ')}`;
        const products = await query(querySql, params); // FIX: Removed destructuring [products]

        products.forEach(p => {
          // Costo Histórico: Precio Compra o (Precio Estándar / 1.19)
          const cost = p.purchasing_price
            ? parseFloat(p.purchasing_price)
            : (p.standard_price ? parseFloat(p.standard_price) / 1.19 : 0);

          if (p.internal_code) costMap.set(`CODE:${p.internal_code}`, cost);
          if (p.product_name) costMap.set(`NAME:${String(p.product_name).trim().toLowerCase()}`, cost);
        });
        console.log(`💰 Costos cargados para ${products.length} productos relevantes`);
      }
    }

    let updatedCount = 0;
    let insertedCount = 0;
    let replacedCount = 0;
    let deletedCount = 0;

    await transaction(async (connection) => {
      const processedLocalIds = new Set();

      // 4. Procesar items de SIIGO (Upsert)
      if (global.io) global.io.emit('sync-progress', { orderId: id, progress: 75, message: 'Sincronizando productos y costos...' });
      for (const siigoItem of siigoInvoice.items) {
        const siigoCode = siigoItem.code || siigoItem.product?.code;
        const siigoName = siigoItem.description || siigoItem.product?.name || 'Item sin nombre';
        const siigoQty = parseFloat(siigoItem.quantity || 0);
        const siigoPrice = parseFloat(siigoItem.unit_price || siigoItem.price || 0);

        console.log(`🔎 Procesando item SIIGO: Code="${siigoCode}", Name="${siigoName}", Qty=${siigoQty}`);

        // Intentar match
        let matchKey = siigoCode ? `CODE:${siigoCode}` : `NAME:${String(siigoName).trim().toLowerCase()}`;
        const nameKey = `NAME:${String(siigoName).trim().toLowerCase()}`;
        let matches = localMap.get(matchKey);

        // Fallback: si buscamos por código y no hay, intentar por nombre
        if ((!matches || !matches.length) && siigoCode) {
          console.log(`   ⚠️ No match por código (${matchKey}), intentando por nombre: "${nameKey}"`);
          matches = localMap.get(nameKey);
        }

        if (matches && matches.length > 0) {
          // MATCH ENCONTRADO: Actualizar el primero disponible que no haya sido procesado
          const localItem = matches.find(m => !processedLocalIds.has(m.id));

          if (localItem) {
            console.log(`   ✅ Match encontrado con local ID ${localItem.id}`);
            processedLocalIds.add(localItem.id);

            // Obtener Costo (Preferir el costo ya existente en el item si es > 0, sino buscar en mapa)
            const currentCost = parseFloat(localItem.purchase_cost || 0);
            const productCost = costMap.get(matchKey) || costMap.get(nameKey) || 0;
            const finalCost = currentCost > 0 ? currentCost : productCost;

            // Detectar cambios
            const qtyChanged = Math.abs(parseFloat(localItem.quantity) - siigoQty) > 0.001;
            const priceChanged = Math.abs(parseFloat(localItem.price) - siigoPrice) > 0.01;
            const costNeedsUpdate = currentCost === 0 && finalCost > 0; // Solo actualizar costo si era 0 y ahora tenemos dato

            // Recalcular utilidad (Total Profit for the line)
            // Discount is handled in total amount usually, but for item row profit: (Price - Cost) * Qty
            // Assuming price is unit price after discount or list price? 
            // Siigo price usually is unit price. 
            // Let's use: (siigoPrice - finalCost) * siigoQty
            const profitAmount = (siigoPrice - finalCost) * siigoQty;

            if (qtyChanged || priceChanged || costNeedsUpdate) {
              await connection.execute(
                `UPDATE order_items 
                 SET quantity = ?, price = ?, description = ?, purchase_cost = ?, profit_amount = ?, updated_at = NOW()
                 WHERE id = ?`,
                [siigoQty, siigoPrice, siigoName, finalCost, profitAmount, localItem.id]
              );
              updatedCount++;
              console.log(`   🔄 Item actualizado (ID ${localItem.id}): Qty ${localItem.quantity}->${siigoQty}, Cost: ${finalCost}, Profit: ${profitAmount}`);
            } else {
              console.log(`   ⏹️ Sin cambios en cantidad/precio.`);
            }
          } else {
            console.log(`   ⚠️ Match existe pero ya fue procesado (duplicado en SIIGO?), insertando nuevo.`);

            const productCost = costMap.get(matchKey) || costMap.get(nameKey) || 0;
            const profitAmount = (siigoPrice - productCost) * siigoQty;

            // Match existe pero ya fue usado (caso raro de duplicados en siigo vs local), insertar nuevo
            await connection.execute(
              `INSERT INTO order_items (order_id, name, quantity, price, description, product_code, purchase_cost, profit_amount, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [id, siigoName, siigoQty, siigoPrice, siigoName, siigoCode || null, productCost, profitAmount]
            );
            insertedCount++;
          }
        } else {
          console.log(`   ❌ NO MATCH encontrado. Insertando nuevo.`);

          const productCost = costMap.get(matchKey) || costMap.get(nameKey) || 0;
          const profitAmount = (siigoPrice - productCost) * siigoQty;

          // NO MATCH: Insertar nuevo
          await connection.execute(
            `INSERT INTO order_items (order_id, name, quantity, price, description, product_code, purchase_cost, profit_amount, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [id, siigoName, siigoQty, siigoPrice, siigoName, siigoCode || null, productCost, profitAmount]
          );
          insertedCount++;
        }
      }

      // 5. Procesar items locales NO matcheados (Eliminar o Marcar Replaced)
      if (global.io) global.io.emit('sync-progress', { orderId: id, progress: 85, message: 'Limpiando items obsoletos...' });
      for (const item of localItems) {
        if (!processedLocalIds.has(item.id)) {
          // Verificar si tiene actividad de empaque
          const [verifRows] = await connection.execute(
            'SELECT id, scanned_count, is_verified FROM packaging_item_verifications WHERE item_id = ?',
            [item.id]
          );

          const hasActivity = verifRows.length > 0 && (verifRows[0].scanned_count > 0 || verifRows[0].is_verified);

          if (hasActivity) {
            // Soft delete (marcar como replaced) para preservar evidencia
            await connection.execute(
              "UPDATE order_items SET status = 'replaced', updated_at = NOW() WHERE id = ?",
              [item.id]
            );
            replacedCount++;
            console.log(`⚠️ Item marcado como 'replaced' (tenía actividad): ${item.name} (ID ${item.id})`);
          } else {
            // Hard delete
            await connection.execute('DELETE FROM order_items WHERE id = ?', [item.id]);
            deletedCount++;
            console.log(`🗑️ Item eliminado (sin actividad): ${item.name} (ID ${item.id})`);
          }
        }
      }

      // 6. Actualizar total y net_value desde la factura de SIIGO
      // Priorizar valores de SIIGO sobre recálculo local
      const siigoTotal = parseFloat(siigoInvoice.total ?? siigoInvoice.total_amount ?? 0);
      const siigoNetValue = (siigoInvoice.balance !== undefined && !isNaN(parseFloat(siigoInvoice.balance)))
        ? parseFloat(siigoInvoice.balance)
        : null;

      // Si el total de SIIGO es 0 (raro), intentar recálculo local como fallback
      let finalTotal = siigoTotal;
      if (finalTotal === 0) {
        const [rows] = await connection.execute(`
          SELECT COALESCE(SUM(quantity * price), 0) as total
          FROM order_items
          WHERE order_id = ? AND (status IS NULL OR status != 'replaced')
        `, [id]);
        finalTotal = rows[0].total;
      }

      await connection.execute(`
        UPDATE orders o
        SET 
          total_amount = ?,
          net_value = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [finalTotal, siigoNetValue, id]);

      // 7. Sincronizar required_scans en packaging_item_verifications con la nueva cantidad
      if (global.io) global.io.emit('sync-progress', { orderId: id, progress: 95, message: 'Finalizando...' });
      const [updateResult] = await connection.execute(`
        UPDATE packaging_item_verifications piv, order_items oi
        SET piv.required_scans = oi.quantity
        WHERE piv.item_id = oi.id AND oi.order_id = ?
      `, [id]);
      console.log(`   🔄 Sincronizados required_scans: ${updateResult.affectedRows} filas actualizadas`);

      // 8. Auto-verificar items que ya cumplen con la cantidad (Fix para items rojos con conteo completo)
      await connection.execute(`
        UPDATE packaging_item_verifications piv
        JOIN order_items oi ON piv.item_id = oi.id
        SET piv.is_verified = 1, piv.updated_at = NOW()
        WHERE oi.order_id = ? 
          AND piv.scanned_count >= oi.quantity
          AND piv.is_verified = 0
      `, [id]);

      console.log(`✅ Sincronización completada para pedido ${id}. Updated: ${updatedCount}, Inserted: ${insertedCount}, Replaced: ${replacedCount}, Deleted: ${deletedCount}`);
      if (global.io) global.io.emit('sync-progress', { orderId: id, progress: 100, message: '✅ Sincronización completada' });
    });

    res.json({
      success: true,
      message: 'Pedido sincronizado con SIIGO correctamente',
      data: {
        orderId: id,
        changes: { updatedCount, insertedCount, replacedCount, deletedCount }
      }
    });

  } catch (error) {
    console.error('❌ Error en syncOrderFromSiigo:', error);
    res.status(500).json({ success: false, message: 'Error sincronizando pedido', error: error.message });
  }
};

// Obtener todas las etiquetas únicas
const getTags = async (req, res) => {
  try {
    const rows = await query('SELECT tags FROM orders WHERE tags IS NOT NULL AND tags != "[]"');

    const allTags = new Set();
    rows.forEach(row => {
      try {
        let tags = row.tags;
        if (typeof tags === 'string') {
          tags = JSON.parse(tags);
        }
        if (Array.isArray(tags)) {
          tags.forEach(tag => {
            if (tag && typeof tag === 'string') {
              allTags.add(tag.trim());
            }
          });
        }
      } catch (e) {
        // Ignorar errores de parseo
      }
    });

    res.json(Array.from(allTags).sort());
  } catch (error) {
    console.error('Error al obtener etiquetas:', error);
    res.status(500).json({ message: 'Error al obtener etiquetas', error: error.message });
  }
};

// Obtener pedidos pendientes de guía de transporte
const getPendingTransportGuides = async (req, res) => {
  try {
    const queryStr = `
      SELECT o.*, c.name as carrier_name 
      FROM orders o
      LEFT JOIN carriers c ON o.carrier_id = c.id
      WHERE (o.status = 'entregado_transportadora' OR o.status = 'enviado')
      AND o.delivery_method NOT IN ('domicilio', 'domicilio_local', 'domicilio_ciudad', 'mensajeria_urbana', 'recoge_bodega', 'recogida_tienda')
      AND (o.transport_guide_url IS NULL OR o.transport_guide_url = '')
      AND o.deleted_at IS NULL
      ORDER BY o.updated_at DESC
    `;

    const orders = await query(queryStr);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error obteniendo pedidos pendientes de guía:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Subir guía de transporte
const uploadTransportGuide = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado ningún archivo'
      });
    }

    // Construir URLs de los archivos
    const newFileUrls = req.files.map(file => `/uploads/guides/${file.filename}`);

    // Obtener URLs existentes
    const currentOrder = await query('SELECT transport_guide_url FROM orders WHERE id = ?', [id]);
    let existingUrls = [];

    if (currentOrder.length > 0 && currentOrder[0].transport_guide_url) {
      try {
        // Intentar parsear como JSON
        const parsed = JSON.parse(currentOrder[0].transport_guide_url);
        if (Array.isArray(parsed)) {
          existingUrls = parsed;
        } else {
          // Si es un string simple pero válido JSON (raro pero posible) o simplemente un string
          existingUrls = [currentOrder[0].transport_guide_url];
        }
      } catch (e) {
        // Si falla el parseo, asumir que es una URL antigua (string simple)
        existingUrls = [currentOrder[0].transport_guide_url];
      }
    }

    // Combinar URLs
    const allUrls = [...existingUrls, ...newFileUrls];
    const jsonUrls = JSON.stringify(allUrls);

    // Actualizar base de datos
    await query(
      'UPDATE orders SET transport_guide_url = ?, transport_guide_notes = ? WHERE id = ?',
      [jsonUrls, notes || null, id]
    );

    res.json({
      success: true,
      message: 'Guías de transporte subidas exitosamente',
      data: {
        transport_guide_url: jsonUrls, // Enviar el array serializado o el array directo según prefiera el frontend, pero la DB guarda string
        transport_guide_urls: allUrls, // Enviar array explícito para facilidad del frontend
        transport_guide_notes: notes
      }
    });

  } catch (error) {
    console.error('Error subiendo guía de transporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al subir la guía'
    });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  deleteSiigoOrder,
  assignOrder,
  getOrderStats,
  getDashboardStats,
  getOrderTimeline,
  reloadFromSiigo,
  deleteAllOrders,
  markSpecialManaged,
  cancelByCustomer,
  logisticsAckCancel,
  syncOrderFromSiigo,
  getTags,
  uploadTransportGuide,
  getPendingTransportGuides
};
