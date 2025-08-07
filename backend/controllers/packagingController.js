
const { query } = require('../config/database');

// Obtener pedidos pendientes de empaque
const getPendingOrders = async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.total_amount,
        o.created_at,
        COUNT(oi.id) as total_items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status IN ('en_empaque', 'en_preparacion')
      GROUP BY o.id
      ORDER BY o.created_at ASC
    `;

    const orders = await query(sqlQuery);

    res.json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error('❌ Error obteniendo pedidos pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Iniciar proceso de empaque
const startPackaging = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const sqlQuery = `
      UPDATE orders 
      SET status = 'en_preparacion', updated_at = NOW()
      WHERE id = ?
    `;

    await query(sqlQuery, [orderId]);

    res.json({
      success: true,
      message: 'Proceso de empaque iniciado'
    });

  } catch (error) {
    console.error('❌ Error iniciando empaque:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener checklist de empaque
const getPackagingChecklist = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Obtener información del pedido
    const orderQuery = `
      SELECT * FROM orders WHERE id = ?
    `;
    
    const orderResult = await query(orderQuery, [orderId]);
    
    if (orderResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }
    
    // Obtener items del pedido con su estado de verificación
    const itemsQuery = `
      SELECT 
        oi.id,
        oi.name,
        oi.quantity,
        oi.price,
        oi.description,
        piv.is_verified,
        piv.packed_quantity,
        piv.packed_weight,
        piv.packed_flavor,
        piv.packed_size,
        piv.verification_notes
      FROM order_items oi
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = ?
      WHERE oi.order_id = ?
    `;

    const items = await query(itemsQuery, [orderId, orderId]);

    // Formatear checklist según lo que espera el frontend
    const checklist = items.map(item => ({
      id: item.id,
      item_name: item.name,
      required_quantity: item.quantity,
      required_unit: 'unidad',
      required_weight: null,
      required_flavor: null,
      required_size: null,
      packaging_instructions: `Verificar cantidad: ${item.quantity} unidades de ${item.name}`,
      quality_checks: JSON.stringify(['Verificar estado del producto', 'Confirmar cantidad', 'Revisar empaque']),
      common_errors: JSON.stringify(['Cantidad incorrecta', 'Producto dañado', 'Empaque defectuoso']),
      available_flavors: null,
      product_code: null,
      barcode: null,
      is_verified: Boolean(item.is_verified),
      packed_quantity: item.packed_quantity,
      packed_weight: item.packed_weight,
      packed_flavor: item.packed_flavor,
      packed_size: item.packed_size,
      verification_notes: item.verification_notes
    }));

    res.json({
      success: true,
      data: {
        order: orderResult[0],
        checklist: checklist
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo checklist:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Completar empaque
const completePackaging = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Verificar que todos los items estén verificados
    const verificationQuery = `
      SELECT 
        COUNT(oi.id) as total_items,
        COUNT(piv.id) as verified_items,
        SUM(CASE WHEN piv.is_verified = 1 THEN 1 ELSE 0 END) as completed_items
      FROM order_items oi
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = ?
      WHERE oi.order_id = ?
    `;
    
    const verificationResult = await query(verificationQuery, [orderId, orderId]);
    const { total_items, verified_items, completed_items } = verificationResult[0];
    
    // Verificar que todos los items estén verificados y marcados como completados
    if (completed_items < total_items) {
      return res.status(400).json({
        success: false,
        message: `Faltan items por verificar: ${completed_items}/${total_items} completados`,
        data: {
          total_items,
          completed_items,
          pending_items: total_items - completed_items
        }
      });
    }

    // Todos los items están verificados, cambiar estado a listo para entrega
    const sqlQuery = `
      UPDATE orders 
      SET status = 'listo_para_entrega', updated_at = NOW()
      WHERE id = ?
    `;

    console.log(`🔧 Ejecutando UPDATE para pedido ${orderId}: status = 'listo_para_entrega'`);
    const updateResult = await query(sqlQuery, [orderId]);
    
    console.log(`📊 Resultado del UPDATE:`, {
      affectedRows: updateResult.affectedRows,
      changedRows: updateResult.changedRows,
      orderId
    });
    
    // Verificar que la actualización fue exitosa
    if (updateResult.affectedRows === 0) {
      console.error(`❌ UPDATE falló: affectedRows = 0 para pedido ${orderId}`);
      return res.status(400).json({
        success: false,
        message: `No se pudo actualizar el estado del pedido ${orderId}`,
        data: { orderId, affectedRows: updateResult.affectedRows }
      });
    }

    // Verificar el estado después de la actualización
    const verifyQuery = `SELECT id, status, updated_at FROM orders WHERE id = ?`;
    const verifyResult = await query(verifyQuery, [orderId]);
    
    if (verifyResult.length > 0) {
      console.log(`✅ Estado verificado después del UPDATE:`, {
        id: verifyResult[0].id,
        status: verifyResult[0].status,
        updated_at: verifyResult[0].updated_at
      });
    }

    console.log(`📦➡️🚛 Pedido ${orderId} completado y listo para logística (${total_items} items verificados)`);

    res.json({
      success: true,
      message: `Empaque completado - Pedido listo para entrega (${total_items} items verificados)`,
      data: {
        orderId,
        status: 'listo_para_entrega',
        total_items,
        all_items_verified: true
      }
    });

  } catch (error) {
    console.error('❌ Error completando empaque:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Verificar si todos los items están completados y auto-pasar a listo para entrega
const checkAndAutoCompleteOrder = async (orderId) => {
  try {
    // Verificar que todos los items estén verificados
    const verificationQuery = `
      SELECT 
        COUNT(oi.id) as total_items,
        SUM(CASE WHEN piv.is_verified = 1 THEN 1 ELSE 0 END) as completed_items
      FROM order_items oi
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = ?
      WHERE oi.order_id = ?
    `;
    
    const verificationResult = await query(verificationQuery, [orderId, orderId]);
    const { total_items, completed_items } = verificationResult[0];
    
    // Si todos los items están verificados, auto-completar
    if (completed_items >= total_items && total_items > 0) {
      const updateQuery = `
        UPDATE orders 
        SET status = 'listo_para_entrega', updated_at = NOW()
        WHERE id = ? AND status IN ('en_empaque', 'en_preparacion')
      `;

      const result = await query(updateQuery, [orderId]);
      
      if (result.affectedRows > 0) {
        console.log(`🎉 EMPAQUE COMPLETADO AUTOMÁTICAMENTE: Pedido ${orderId} → listo_para_entrega (${total_items}/${total_items} items verificados)`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error en verificación automática:', error);
    return false;
  }
};

// Verificar item
const verifyItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { 
      packed_quantity, 
      packed_weight, 
      packed_flavor, 
      packed_size, 
      verification_notes, 
      is_verified 
    } = req.body;

    // Obtener el order_id del item
    const itemQuery = `SELECT order_id FROM order_items WHERE id = ?`;
    const itemResult = await query(itemQuery, [itemId]);
    
    if (itemResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    const orderId = itemResult[0].order_id;

    // Insertar o actualizar verificación
    const upsertQuery = `
      INSERT INTO packaging_item_verifications 
      (order_id, item_id, packed_quantity, packed_weight, packed_flavor, packed_size, verification_notes, is_verified, verified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'usuario_empaque')
      ON DUPLICATE KEY UPDATE
        packed_quantity = VALUES(packed_quantity),
        packed_weight = VALUES(packed_weight),
        packed_flavor = VALUES(packed_flavor),
        packed_size = VALUES(packed_size),
        verification_notes = VALUES(verification_notes),
        is_verified = VALUES(is_verified),
        verified_by = VALUES(verified_by),
        verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(upsertQuery, [
      orderId, 
      itemId, 
      packed_quantity || null, 
      packed_weight || null, 
      packed_flavor || null, 
      packed_size || null, 
      verification_notes || 'Item verificado correctamente', 
      is_verified !== undefined ? is_verified : true
    ]);

    console.log(`✅ Item ${itemId} verificado en BD:`, {
      packed_quantity,
      verification_notes,
      is_verified
    });

    // Verificar si el pedido se puede auto-completar
    const autoCompleted = await checkAndAutoCompleteOrder(orderId);

    res.json({ 
      success: true, 
      message: 'Item verificado exitosamente',
      data: {
        itemId,
        is_verified: true,
        verification_notes: verification_notes || 'Item verificado correctamente',
        auto_completed: autoCompleted
      }
    });

  } catch (error) {
    console.error('❌ Error verificando item:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Verificar todos los items
const verifyAllItems = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Obtener todos los items del pedido
    const itemsQuery = `
      SELECT id FROM order_items WHERE order_id = ?
    `;
    
    const items = await query(itemsQuery, [orderId]);
    
    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron items para este pedido'
      });
    }

    // Verificar todos los items en batch
    for (const item of items) {
      const upsertQuery = `
        INSERT INTO packaging_item_verifications 
        (order_id, item_id, packed_quantity, verification_notes, is_verified, verified_by)
        VALUES (?, ?, 1, 'Verificado - Todo correcto', TRUE, 'usuario_empaque')
        ON DUPLICATE KEY UPDATE
          packed_quantity = 1,
          verification_notes = 'Verificado - Todo correcto',
          is_verified = TRUE,
          verified_by = 'usuario_empaque',
          verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;

      await query(upsertQuery, [orderId, item.id]);
    }

    console.log(`✅ Todos los items del pedido ${orderId} verificados (${items.length} items)`);

    res.json({ 
      success: true, 
      message: `Todos los items verificados (${items.length} items)`,
      data: {
        orderId,
        itemsVerified: items.length
      }
    });

  } catch (error) {
    console.error('❌ Error verificando todos los items:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Verificar por código de barras (placeholder para compatibilidad)
const verifyItemByBarcode = async (req, res) => {
  res.json({ success: true, message: 'Item verificado por código de barras' });
};

// Obtener plantillas (placeholder para compatibilidad)
const getPackagingTemplates = async (req, res) => {
  res.json({ success: true, data: [] });
};

// Obtener estadísticas
const getPackagingStats = async (req, res) => {
  try {
    // Contar pedidos por estado
    const statsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM orders 
      WHERE status IN ('en_empaque', 'en_preparacion', 'empacado', 'listo_para_entrega')
      GROUP BY status
    `;
    
    const results = await query(statsQuery);
    
    // Inicializar contadores
    const stats = {
      pending_packaging: 0,
      in_packaging: 0,
      ready_shipping: 0,
      requires_review: 0
    };
    
    // Mapear resultados
    results.forEach(row => {
      switch(row.status) {
        case 'en_empaque':
        case 'en_preparacion':
          stats.pending_packaging += row.count;
          break;
        case 'empacado':
          stats.ready_shipping += row.count;
          break;
        case 'listo_para_entrega':
          stats.ready_shipping += row.count;
          break;
      }
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Finalizar empaque de un pedido (método original)
const finalizarEmpaque = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { approvalStatus, notes } = req.body;

    let newStatus = approvalStatus === 'approved' ? 'listo_para_entrega' : 'en_preparacion';
    
    const updateQuery = `
      UPDATE orders 
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `;

    await query(updateQuery, [newStatus, orderId]);

    res.json({
      success: true,
      message: 'Empaque finalizado correctamente',
      data: {
        orderId: orderId,
        newStatus: newStatus,
        approvalStatus: approvalStatus,
        notes: notes
      }
    });

  } catch (error) {
    console.error('❌ Error finalizando empaque:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener pedidos empacados
const getPedidosEmpacados = async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.total_amount,
        o.created_at,
        COUNT(oi.id) as total_items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = 'empacado'
      GROUP BY o.id
      ORDER BY o.updated_at DESC
    `;

    const orders = await query(sqlQuery);

    res.json({
      success: true,
      message: 'Pedidos empacados obtenidos correctamente',
      data: orders
    });

  } catch (error) {
    console.error('❌ Error obteniendo pedidos empacados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener pedidos listos para entrega
const getPedidosListosParaEntrega = async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.delivery_method,
        o.status,
        o.total_amount,
        o.created_at,
        o.updated_at,
        COUNT(oi.id) as total_items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = 'listo_para_entrega'
      GROUP BY o.id
      ORDER BY o.updated_at ASC
    `;

    const orders = await query(sqlQuery);

    res.json({
      success: true,
      message: 'Pedidos listos para entrega obtenidos correctamente',
      data: orders,
      meta: {
        total: orders.length,
        description: 'Sala de espera para transportadoras, mensajeros y recogida en tienda'
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo pedidos listos para entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getPendingOrders,
  startPackaging,
  getPackagingChecklist,
  verifyItem,
  verifyAllItems,
  verifyItemByBarcode,
  completePackaging,
  getPackagingTemplates,
  getPackagingStats,
  finalizarEmpaque,
  getPedidosEmpacados,
  getPedidosListosParaEntrega
};
