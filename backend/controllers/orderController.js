const { query, transaction } = require('../config/database');

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
      sortOrder = 'DESC'
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
      // Logística puede ver pedidos en TODAS las fases que supervisan: desde logística hasta entrega
      whereClause += ' AND o.status IN ("en_logistica", "en_preparacion", "listo", "en_empaque", "empacado", "listo_para_entrega", "en_reparto", "entregado_transportadora")';
    } else if (userRole === 'empaque') {
      // Rol específico de empaque (si existiera) - pero empaque usa rol logistica
      whereClause += ' AND o.status IN ("en_empaque", "empacado")';
    } else if (userRole === 'cartera') {
      whereClause += ' AND o.status = "revision_cartera"';
    } else if (userRole === 'facturador') {
      whereClause += ' AND o.status = "pendiente_por_facturacion"';
    } else if (userRole === 'admin') {
      // Admin puede ver todos los pedidos solo para informes, sin filtros restrictivos
      // No se agrega filtro adicional - puede ver todo para generar reportes
      
      // Solo para admin: aplicar filtro de estado adicional si se proporciona
      if (status) {
        whereClause += ' AND o.status = ?';
        params.push(status);
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

    // Validar campos de ordenamiento
    const validSortFields = ['created_at', 'order_number', 'customer_name', 'status', 'total_amount'];
    const validSortOrders = ['ASC', 'DESC'];
    
    const orderBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Obtener pedidos con información del usuario creador Y MENSAJEROS
    const orders = await query(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_address, 
        o.customer_email, o.customer_city, o.customer_department, o.customer_country,
        o.status, o.total_amount, o.notes, o.delivery_date, o.shipping_date,
        o.payment_method, o.delivery_method, o.shipping_payment_method, o.carrier_id, o.created_at, o.updated_at,
        o.siigo_invoice_id, o.siigo_invoice_number, o.siigo_public_url, o.siigo_customer_id,
        o.siigo_observations, o.siigo_payment_info, o.siigo_seller_id, o.siigo_balance,
        o.siigo_document_type, o.siigo_stamp_status, o.siigo_mail_status, o.siigo_invoice_created_at,
        o.delivery_fee,
        o.assigned_messenger_id, o.messenger_status,
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name,
        messenger.username as assigned_messenger_name,
        messenger.full_name as messenger_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
       LEFT JOIN users messenger ON o.assigned_messenger_id = messenger.id
       ${whereClause}
       ORDER BY o.${orderBy} ${order}
       ${limitOffset}`,
      params
    );

    // Obtener items de cada pedido
    for (let order of orders) {
      const items = await query(
        'SELECT id, name, quantity, price, description FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
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
      'SELECT id, name, quantity, price, description FROM order_items WHERE order_id = ?',
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
    if (deliveryMethod === 'recogida_tienda' && paymentMethod !== 'efectivo') {
      initialStatus = 'revision_cartera'; // Requiere verificación de pago
    } else if (deliveryMethod === 'domicilio_ciudad' && paymentMethod === 'efectivo') {
      initialStatus = 'en_logistica'; // Pasa directo a logística
    }

    const result = await transaction(async (connection) => {
      // Crear pedido
      const [orderResult] = await connection.execute(
        `INSERT INTO orders (
          order_number, invoice_code, customer_name, customer_phone, customer_address, 
          customer_email, customer_department, customer_city, delivery_method, payment_method,
          status, total_amount, notes, shipping_date, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          orderNumber, 
          invoiceCode || null,
          customerName, 
          customerPhone, 
          customerAddress, 
          customerEmail || null,
          customerDepartment,
          customerCity,
          deliveryMethod || 'domicilio_ciudad',
          paymentMethod || 'efectivo',
          initialStatus,
          calculatedTotal, 
          notes || null, 
          deliveryDate || null, 
          userId
        ]
      );

      const orderId = orderResult.insertId;

      // Crear items del pedido
      for (const item of items) {
        if (item.name && item.quantity > 0 && item.price >= 0) {
          await connection.execute(
            'INSERT INTO order_items (order_id, name, quantity, price, description) VALUES (?, ?, ?, ?, ?)',
            [orderId, item.name, item.quantity, item.price, item.description || null]
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
      'SELECT id, name, quantity, price, description FROM order_items WHERE order_id = ?',
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
    const userRole = req.user.role;

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
          
          // Logging especial para shipping_date
          if (key === 'shipping_date' || key === 'shippingDate') {
            console.log('📅 SHIPPING_DATE UPDATE:');
            console.log('   Allowed:', isFromBilling || !order.shipping_date);
            console.log('   New value:', updateData[key]);
            console.log('   Will update:', isFromBilling || !order.shipping_date);
          }
          
          updateFields.push(`${dbField} = ?`);
          updateValues.push(updateData[key]);
        }
      });

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(id);
        
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

        // Crear nuevos items
        let totalAmount = 0;
        for (const item of updateData.items) {
          await connection.execute(
            'INSERT INTO order_items (order_id, name, quantity, price, description) VALUES (?, ?, ?, ?, ?)',
            [id, item.name, item.quantity, item.price, item.description || null]
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
      'SELECT id, name, quantity, price, description FROM order_items WHERE order_id = ?',
      [id]
    );

    updatedOrder[0].items = items;

    
    // 🔍 FINAL VERIFICATION LOGGING
    console.log('🔍 FINAL ORDER VERIFICATION:');
    const verificationResult = await query(
      'SELECT id, order_number, shipping_date, payment_method, status, updated_at FROM orders WHERE id = ?',
      [id]
    );
    
    if (verificationResult.length > 0) {
      const finalOrder = verificationResult[0];
      console.log('   Order:', finalOrder.order_number);
      console.log('   Status:', finalOrder.status);
      console.log('   Payment Method:', finalOrder.payment_method);
      console.log('   🚨 Shipping Date:', finalOrder.shipping_date || 'NULL');
      console.log('   Updated At:', finalOrder.updated_at);
      
      if (finalOrder.shipping_date) {
        console.log('✅ SUCCESS: Shipping date was saved successfully!');
      } else {
        console.log('🚨 PROBLEM: Shipping date is still NULL after update!');
      }
    }
    
    console.log('='.repeat(80));
    console.log('🔍 ORDER UPDATE LOGGING COMPLETE');
    console.log('='.repeat(80) + '\n');
    
      
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
      
      // 1. Eliminar items del pedido (tabla requerida)
      console.log('  1. Eliminando items del pedido...');
      const [itemsResult] = await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
      console.log(`   ✅ ${itemsResult.affectedRows} items eliminados`);
      
      // 2. Eliminar registros relacionados opcionales
      console.log('  2. Eliminando registros relacionados...');
      await safeDelete(connection, 'cash_register', 'order_id = ?', [id]);
      await safeDelete(connection, 'packaging_records', 'order_id = ?', [id]);
      await safeDelete(connection, 'shipping_guides', 'order_id = ?', [id]);
      await safeDelete(connection, 'wallet_validations', 'order_id = ?', [id]);
      await safeDelete(connection, 'logistics_records', 'order_id = ?', [id]);
      
      // 3. Eliminar de la tabla de sincronización de SIIGO si existe para permitir reimportación
      console.log('  3. Eliminando sincronización SIIGO...');
      await safeDelete(connection, 'siigo_sync_log', 'invoice_id = ?', [order.siigo_invoice_id]);
      
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
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('en_logistica', 'en_preparacion')`,
        params
      );

      const pendingPackaging = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('pendiente_empaque', 'en_empaque')`,
        params
      );

      const pendingDelivery = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('en_reparto', 'entregado_transportadora')`,
        params
      );

      const readyForDelivery = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'listo_para_entrega'`,
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
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM orders ${whereClause} AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at) 
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
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('en_logistica', 'en_preparacion')`,
        params
      );

      const pendingPackaging = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('pendiente_empaque', 'en_empaque')`,
        params
      );

      const pendingDelivery = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('en_reparto', 'entregado_transportadora')`,
        params
      );

      const readyForDelivery = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'listo_para_entrega'`,
        params
      );

      const delivered = await query(
        `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'entregado_cliente'`,
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
          delivered: delivered[0].count,

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
       FROM orders ${whereClause} AND DATE(created_at) = CURDATE()`,
      params
    );

    const moneyInTransit = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as amount 
       FROM orders ${whereClause} AND status = 'enviado'`,
      params
    );

    const averageOrderValue = await query(
      `SELECT COALESCE(AVG(total_amount), 0) as amount 
       FROM orders ${whereClause} AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      params
    );

    // Evolución de pedidos por días (últimos 14 días)
    const dailyEvolution = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(total_amount) as revenue
       FROM orders ${whereClause} AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       GROUP BY DATE(created_at) 
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
        YEARWEEK(created_at) as week,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
       FROM orders ${whereClause} AND created_at >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
       GROUP BY YEARWEEK(created_at) 
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
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('en_logistica', 'en_preparacion')`,
      params
    );

    const pendingPackaging = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('pendiente_empaque', 'en_empaque')`,
      params
    );

    const pendingDelivery = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status IN ('en_reparto', 'entregado_transportadora')`,
      params
    );

    const readyForDelivery = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'listo_para_entrega'`,
      params
    );

    const delivered = await query(
      `SELECT COUNT(*) as count FROM orders ${whereClause} AND status = 'entregado_cliente'`,
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
        delivered: delivered[0].count,
        
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

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  deleteSiigoOrder,
  assignOrder,
  getOrderStats,
  getDashboardStats
};
