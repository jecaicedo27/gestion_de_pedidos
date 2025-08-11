const { query, transaction } = require('../config/database');
const pdfService = require('../services/pdfService');

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
        o.id, o.order_number, o.customer_name, o.phone, o.address, o.email,
        o.city, o.department, o.delivery_method, o.tracking_number,
        o.payment_method, o.total_amount, o.notes, o.shipping_date, o.status,
        c.name as carrier_name, c.code as carrier_code, 
        c.contact_phone as carrier_phone, c.contact_email as carrier_email
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
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

    // Generar PDF
    const pdfBuffer = await pdfService.generateShippingGuide(order, carrierData);

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
        o.id, o.order_number, o.customer_name, o.phone, o.address, o.email,
        o.city, o.department, o.delivery_method, o.carrier_id, o.tracking_number,
        o.payment_method, o.shipping_payment_method, o.total_amount, o.shipping_date, o.shipping_guide_generated,
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
       WHERE shipping_guide_generated = TRUE AND DATE(updated_at) = CURDATE()`,
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
      'SELECT id, status, order_number FROM orders WHERE id = ?',
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

    console.log(`✅ Pedido ${order[0].order_number} enviado correctamente a empaque`);

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

// Función para extraer datos del destinatario desde las notas de SIIGO
const extractRecipientDataFromNotes = (notes) => {
  if (!notes) return null;

  const data = {};
  const lines = notes.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.includes('FORMA DE PAGO DE ENVIO:')) {
      data.shippingPaymentMethod = trimmedLine.split(':')[1]?.trim();
    } else if (trimmedLine.includes('MEDIO DE PAGO:')) {
      data.paymentMethod = trimmedLine.split(':')[1]?.trim();
    } else if (trimmedLine.includes('NOMBRE:')) {
      data.name = trimmedLine.split(':')[1]?.trim();
    } else if (trimmedLine.includes('NIT:')) {
      data.nit = trimmedLine.split(':')[1]?.trim();
    } else if (trimmedLine.includes('TELÉFONO:')) {
      data.phone = trimmedLine.split(':')[1]?.trim();
    } else if (trimmedLine.includes('DEPARTAMENTO:')) {
      data.department = trimmedLine.split(':')[1]?.trim();
    } else if (trimmedLine.includes('CIUDAD:')) {
      data.city = trimmedLine.split(':')[1]?.trim();
    } else if (trimmedLine.includes('DIRECCIÓN:')) {
      data.address = trimmedLine.split(':')[1]?.trim();
    }
  }

  // Solo retornar si tenemos datos mínimos
  if (data.name && data.phone && data.city) {
    return data;
  }

  return null;
};

// Generar guía simplificada (para el modal)
const generateGuide = async (req, res) => {
  try {
    const { 
      orderId, 
      shippingMethod, 
      transportCompany,
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerDepartment,
      notes
    } = req.body;

    // Obtener información del pedido
    const orderInfo = await query(
      'SELECT order_number, total_amount, notes, customer_name, phone, address, city, department, email FROM orders WHERE id = ?',
      [orderId]
    );

    if (!orderInfo.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const order = orderInfo[0];

    // Intentar extraer datos del destinatario desde las notas de SIIGO
    const extractedData = extractRecipientDataFromNotes(order.notes);
    
    // Datos del destinatario - usar datos extraídos si están disponibles, sino usar datos del pedido
    let recipientData;
    if (extractedData) {
      console.log('📦 Usando datos extraídos de SIIGO para destinatario:', extractedData);
      recipientData = {
        name: extractedData.name,
        phone: extractedData.phone,
        address: extractedData.address || customerAddress,
        city: extractedData.city,
        department: extractedData.department || customerDepartment,
        nit: extractedData.nit || '',
        paymentMethod: extractedData.paymentMethod || 'CONTRA ENTREGA'
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
        paymentMethod: 'CONTRA ENTREGA'
      };
    }

    // Generar PDF usando el servicio existente
    const guideData = {
      order_number: order.order_number,
      delivery_method: shippingMethod,
      transport_company: transportCompany || 'Recogida en Bodega',
      total_amount: order.total_amount,
      notes: notes || '',
      created_at: new Date(),
      // Agregar datos del destinatario extraídos
      customer_name: recipientData.name,
      phone: recipientData.phone,
      address: recipientData.address,
      city: recipientData.city,
      department: recipientData.department,
      customer_nit: recipientData.nit,
      payment_method: recipientData.paymentMethod,
      email: order.email || ''
    };

    const carrierData = {
      name: transportCompany || 'Recogida en Bodega',
      code: transportCompany ? transportCompany.toUpperCase().replace(/\s+/g, '_') : 'BODEGA',
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

    // Enviar PDF como buffer
    res.end(pdfBuffer, 'binary');

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
          totalReady: 0
        }
      });
    }

    // Obtener pedidos listos para entrega con información de transportadora
    const readyOrders = await query(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.status, o.delivery_method,
        o.total_amount, o.created_at, o.updated_at, o.carrier_id,
        c.name as carrier_name
       FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
       ORDER BY o.created_at ASC`,
      []
    );
    
    console.log('📦 Pedidos completos encontrados:', readyOrders.length);

    // Agrupar por tipo de entrega
    const groupedOrders = {
      recoge_bodega: [],
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
      const { delivery_method, carrier_name, assigned_messenger } = order;
      
      // Normalizar texto para comparación (quitar acentos y convertir a minúsculas)
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
      
      const normalizedCarrier = normalizeText(carrier_name);
      const normalizedMethod = normalizeText(delivery_method);
      
      if (normalizedMethod === 'recoge_bodega' || normalizedMethod === 'recogida_tienda') {
        groupedOrders.recoge_bodega.push(order);
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
        // Si es mensajería local, agregar a la categoría correspondiente
        groupedOrders.mensajeria_local.push(order);
      } else if (!normalizedMethod && !normalizedCarrier) {
        // Si no tiene método ni transportadora, también va a mensajería local
        groupedOrders.mensajeria_local.push(order);
      } else {
        groupedOrders.otros.push(order);
      }
    });

    // Calcular estadísticas
    const stats = {
      total: readyOrders.length,
      recoge_bodega: groupedOrders.recoge_bodega.length,
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
        totalReady: readyOrders.length
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
      'SELECT id, status, order_number FROM orders WHERE id = ?',
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

    console.log(`✅ Mensajero válido: ${messenger[0].full_name || messenger[0].username}`);

    // CORREGIDO: Usar el campo assigned_messenger (sin foreign key constraint) en lugar de assigned_messenger_id
    await query(
      `UPDATE orders 
       SET assigned_messenger = ?, status = 'en_reparto', updated_at = NOW()
       WHERE id = ?`,
      [messengerId, orderId]
    );

    console.log(`✅ Pedido ${order[0].order_number} asignado exitosamente`);

    res.json({
      success: true,
      message: `Pedido asignado a ${messenger[0].full_name || messenger[0].username} exitosamente`
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

    // Verificar que el pedido existe
    const order = await query(
      'SELECT id, status, order_number FROM orders WHERE id = ?',
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

    // Verificar que el pedido existe
    const order = await query(
      'SELECT id, status, order_number FROM orders WHERE id = ?',
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
      [status || 'listo_para_recoger', delivery_notes, orderId]
    );

    res.json({
      success: true,
      message: 'Pedido marcado como listo para recoger'
    });

  } catch (error) {
    console.error('Error marcando como listo para recoger:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Marcar pedido como en reparto
const markInDelivery = async (req, res) => {
  try {
    const { orderId, messengerId, status, delivery_notes } = req.body;

    // Verificar que el pedido existe
    const order = await query(
      'SELECT id, status, order_number FROM orders WHERE id = ?',
      [orderId]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // CORREGIDO: Usar assigned_messenger en lugar de assigned_messenger_id
    if (messengerId) {
      await query(
        `UPDATE orders 
         SET status = ?, assigned_messenger = ?, delivery_notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [status || 'en_reparto', messengerId, delivery_notes, orderId]
      );
    } else {
      await query(
        `UPDATE orders 
         SET status = ?, delivery_notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [status || 'en_reparto', delivery_notes, orderId]
      );
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

module.exports = {
  getCarriers,
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
  markInDelivery
};
