
const { query } = require('../config/database');
const path = require('path');
const PackagingLock = require('../services/packagingLockService');

// Helper: emitir evento de cambio de estado para notificaciones en tiempo real
const emitStatusChange = (orderId, orderNumber, fromStatus, toStatus) => {
  try {
    const payload = {
      orderId,
      order_number: orderNumber || null,
      from_status: fromStatus || null,
      to_status: toStatus,
      timestamp: new Date().toISOString()
    };
    if (global.io) {
      global.io.to('orders-updates').emit('order-status-changed', payload);
    }
    console.log('📡 (empaque) Emitido order-status-changed:', payload);
  } catch (e) {
    console.error('⚠️  Error emitiendo order-status-changed (empaque):', e?.message || e);
  }
};

// Normaliza códigos escaneados y almacenados para evitar problemas por decimales o espacios
// Normaliza códigos escaneados y almacenados para evitar problemas por decimales o espacios
function normalizeBarcode(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  // Unificar separador decimal y eliminar espacios
  s = s.replace(/,/g, '.').replace(/\s+/g, '');
  // Si es numérico con posible parte decimal, remover la parte decimal (p. ej. 7709...00)
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    return s.split('.')[0];
  }
  return s;
}

// Snapshot de progreso de empaque por pedido (items verificados, totales, bloqueo, etc.)
async function getPackagingProgressSnapshot(orderId) {
  try {
    const rows = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.packaging_status,
        o.packaging_lock_user_id,
        o.packaging_lock_expires_at,
        COALESCE(u.full_name, u.username) AS packaging_locked_by,
        SUM(CASE WHEN oi.status <> 'replaced' THEN 1 ELSE 0 END) AS total_items,
        COALESCE(SUM(CASE WHEN oi.status <> 'replaced' AND piv.is_verified = 1 THEN 1 ELSE 0 END), 0) AS verified_items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = o.id
      LEFT JOIN users u ON u.id = o.packaging_lock_user_id
      WHERE o.id = ?
      GROUP BY o.id
      LIMIT 1
    `, [orderId]);

    if (!rows.length) return null;

    const r = rows[0];
    const pending_items = (r.total_items || 0) - (r.verified_items || 0);
    const progress_pct = r.total_items ? Math.round((r.verified_items / r.total_items) * 100) : 0;

    return {
      orderId: r.id,
      order_number: r.order_number,
      status: r.status,
      packaging_status: r.packaging_status,
      packaging_lock_user_id: r.packaging_lock_user_id,
      packaging_lock_expires_at: r.packaging_lock_expires_at,
      packaging_locked_by: r.packaging_locked_by,
      total_items: r.total_items,
      verified_items: r.verified_items,
      pending_items,
      progress_pct
    };
  } catch (e) {
    console.error('⚠️ Error calculando snapshot de empaque:', e?.message || e);
    return null;
  }
}

// Emitir evento de progreso a canal de empaque
async function emitPackagingProgress(orderId) {
  try {
    if (!global.io) return;
    const snapshot = await getPackagingProgressSnapshot(orderId);
    if (snapshot) {
      global.io.to('packaging-updates').emit('packaging-progress', { ...snapshot, timestamp: new Date().toISOString() });
    }
  } catch (e) {
    console.error('⚠️ Error emitiendo packaging-progress:', e?.message || e);
  }
}

// Verificar si existe al menos una evidencia fotográfica de empaque
async function hasPackagingEvidence(orderId) {
  try {
    // Validar que la tabla exista para evitar errores en instalaciones nuevas
    const t = await query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packaging_evidence'
    `);
    const tableExists = (t[0]?.cnt || 0) > 0;
    if (!tableExists) return false;

    const rows = await query(`SELECT COUNT(*) AS cnt FROM packaging_evidence WHERE order_id = ?`, [orderId]);
    return (rows[0]?.cnt || 0) > 0;
  } catch (e) {
    console.warn('⚠️ Error verificando evidencias de empaque:', e?.message || e);
    return false;
  }
}

/**
 * Verifica que el usuario tenga lock activo sobre el pedido.
 * Responde 423/409 si no es dueño o si expiró.
 * Retorna true si OK, false si ya respondió error.
 */
async function assertHasActiveLock(orderId, userId, res) {
  try {
    const status = await PackagingLock.getLockStatus(orderId);
    const isOwner = await PackagingLock.isOwner(orderId, userId);
    if (!status) {
      res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      return false;
    }
    if (!isOwner) {
      return res.status(423).json({
        success: false,
        message: 'El pedido está siendo empacado por otro usuario',
        data: {
          packaging_lock_user_id: status.packaging_lock_user_id,
          packaging_lock_expires_at: status.packaging_lock_expires_at,
          packaging_status: status.packaging_status
        }
      });
    }
    if (status.isExpired) {
      return res.status(423).json({
        success: false,
        message: 'El bloqueo de empaque expiró. Vuelve a tomar el pedido.'
      });
    }
    // Permitir operaciones idempotentes cuando ya está 'completed' para evitar 409 en UI
    const ps = String(status.packaging_status);
    if (ps !== 'in_progress' && ps !== 'completed') {
      return res.status(409).json({
        success: false,
        message: `El pedido no está en estado de empaque activo (actual: ${status.packaging_status})`
      });
    }
    return true;
  } catch (e) {
    console.error('Error validando lock de empaque:', e?.message || e);
    res.status(500).json({ success: false, message: 'Error validando exclusividad de empaque' });
    return false;
  }
}

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
        o.packaging_status,
        o.packaging_lock_user_id,
        o.packaging_lock_expires_at,
        COALESCE(u.full_name, u.username) AS packaging_locked_by,
        u.role AS packaging_locked_by_role,
        SUM(CASE WHEN oi.status <> 'replaced' THEN 1 ELSE 0 END) AS item_count,
        COALESCE(SUM(CASE WHEN oi.status <> 'replaced' AND piv.is_verified = 1 THEN 1 ELSE 0 END), 0) AS verified_items,
        SUM(CASE WHEN oi.status <> 'replaced' THEN 1 ELSE 0 END) - COALESCE(SUM(CASE WHEN oi.status <> 'replaced' AND piv.is_verified = 1 THEN 1 ELSE 0 END), 0) AS pending_items,
        CASE 
          WHEN MAX(CASE WHEN oi.status <> 'replaced' AND (piv.is_verified = 1 OR COALESCE(piv.scanned_count, 0) > 0) THEN 1 ELSE 0 END) = 1 THEN 1
          ELSE 0
        END AS started
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = o.id
      LEFT JOIN users u ON u.id = o.packaging_lock_user_id
      WHERE o.status IN ('en_empaque', 'en_preparacion')
      GROUP BY o.id
      ORDER BY 
        o.updated_at ASC,
        o.created_at ASC,
        o.id ASC
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

    const orderRows = await query('SELECT id, order_number, status FROM orders WHERE id = ? LIMIT 1', [orderId]);

    const sqlQuery = `
      UPDATE orders 
      SET status = 'en_preparacion', updated_at = NOW()
      WHERE id = ?
    `;

    await query(sqlQuery, [orderId]);

    // Emitir snapshot de progreso para vistas de solo lectura
    try { await emitPackagingProgress(orderId); } catch (_) { }

    // Notificar cambio de estado (deshabilitado para evitar alertas al iniciar empaque desde UI)
    // emitStatusChange(Number(orderId), orderRows[0]?.order_number || null, orderRows[0]?.status || null, 'en_preparacion');

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

    // Obtener items del pedido con su estado de verificación y códigos de barras
    // Compatibilidad: en algunos entornos la columna invoice_line no existe en order_items.
    const invoiceLineExistsRows = await query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'order_items'
        AND COLUMN_NAME = 'invoice_line'
    `);
    const hasInvoiceLine = (invoiceLineExistsRows[0]?.cnt || 0) > 0;

    const selectInvoiceLine = hasInvoiceLine ? 'oi.invoice_line,' : '';
    const orderClause = hasInvoiceLine
      ? `ORDER BY 
        CASE WHEN oi.invoice_line IS NULL THEN 1 ELSE 0 END,
        oi.invoice_line ASC,
        oi.id ASC`
      : 'ORDER BY oi.id ASC';

    const itemsQuery = `
      SELECT 
        oi.id,
        oi.name,
        oi.quantity,
        oi.price,
        oi.description,
        ${selectInvoiceLine}
        oi.product_code,
        oi.status,
        piv.is_verified,
        piv.packed_quantity,
        piv.packed_weight,
        piv.packed_flavor,
        piv.packed_size,
        piv.verification_notes,
        piv.scanned_count,
        piv.required_scans,
        p.barcode,
        p.internal_code,
        p.siigo_product_id
      FROM order_items oi
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = ?
      LEFT JOIN products p ON p.id = (
        SELECT id FROM products p2 
        WHERE LOWER(TRIM(p2.product_name)) = LOWER(TRIM(oi.name)) 
        ORDER BY CASE WHEN p2.barcode LIKE '%TEMP-DUP%' THEN 2 ELSE 1 END, p2.id DESC 
        LIMIT 1
      )
      WHERE oi.order_id = ?
        AND oi.status <> 'replaced'
      ${orderClause}
    `;

    const items = await query(itemsQuery, [orderId, orderId]);

    // Formatear checklist según lo que espera el frontend
    const checklist = items.map(item => {
      const scannedCount = item.scanned_count || 0;
      const requiredScans = item.required_scans || item.quantity;
      const scanProgress = `${scannedCount}/${requiredScans}`;

      return {
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
        product_code: item.product_code || item.internal_code || null,
        item_status: item.status || 'active',
        barcode: normalizeBarcode(item.barcode) || null,
        is_verified: Boolean(item.is_verified),
        packed_quantity: item.packed_quantity,
        packed_weight: item.packed_weight,
        packed_flavor: item.packed_flavor,
        packed_size: item.packed_size,
        verification_notes: item.verification_notes,
        scanned_count: scannedCount,
        required_scans: requiredScans,
        scan_progress: scanProgress,
        needs_multiple_scans: requiredScans > 1
      };
    });

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
        AND (oi.status IS NULL OR oi.status <> 'replaced')
    `;

    const verificationResult = await query(verificationQuery, [orderId, orderId]);
    const { total_items, verified_items, completed_items } = verificationResult[0];

    // Política: si el pedido está en 'requires_review', exigir verificación total (solo items activos)
    try {
      const s = await query('SELECT packaging_status FROM orders WHERE id = ? LIMIT 1', [orderId]);
      const pkgStatus = String(s[0]?.packaging_status || '').toLowerCase();
      if (pkgStatus === 'requires_review' && completed_items < total_items) {
        return res.status(422).json({
          success: false,
          message: `Debes verificar todos los items activos antes de finalizar (${completed_items}/${total_items}).`,
          data: {
            total_items,
            completed_items,
            pending_items: total_items - completed_items
          }
        });
      }
    } catch (_) { }

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

    // Validar evidencia fotográfica obligatoria antes de finalizar
    try {
      const hasEv = await hasPackagingEvidence(orderId);
      if (!hasEv) {
        return res.status(422).json({
          success: false,
          message: 'Debe subir al menos una foto de evidencia de empaque antes de finalizar.'
        });
      }
    } catch (_) { }

    // Todos los items están verificados, cambiar estado a listo para entrega
    const orderInfo = await query('SELECT id, order_number, status FROM orders WHERE id = ? LIMIT 1', [orderId]);

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

    // Notificar cambio de estado a listo_para_entrega
    try {
      emitStatusChange(Number(orderId), orderInfo[0]?.order_number || null, orderInfo[0]?.status || null, 'listo_para_entrega');
    } catch (_) { }

    // Liberar lock al completar (best-effort)
    try { await PackagingLock.completeAndRelease(orderId, req.user?.id || null); } catch (_) { }

    console.log(`📦➡️🚛 Pedido ${orderId} completado y listo para logística (${total_items} items verificados)`);

    // Emitir snapshot de progreso (probablemente 100% y fuera de empaque)
    try { await emitPackagingProgress(orderId); } catch (_) { }

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

/**
 * Verificar si todos los items están completados.
 * Nueva política: NO cambia orders.status automáticamente.
 * Solo marca packaging_status='completed' para referencia y devuelve false.
 */
const checkAndAutoCompleteOrder = async (orderId) => {
  try {
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

    if (completed_items >= total_items && total_items > 0) {
      try {
        await query(
          `UPDATE orders 
             SET packaging_status = 'completed', updated_at = NOW()
           WHERE id = ?`,
          [orderId]
        );
        console.log(`📦 Empaque completado (todos los items verificados) pedido ${orderId}. Espera confirmación manual "Finalizar Empaque".`);
      } catch (e) {
        console.warn('⚠️ No se pudo actualizar packaging_status a completed:', e?.sqlMessage || e?.message || e);
      }
    }
    // Nunca auto-mover a listo_para_entrega
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

    // Requiere lock de empaque activo del usuario
    if (!(await assertHasActiveLock(orderId, req.user?.id, res))) {
      return;
    }

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

    // Emitir snapshot de progreso
    try { await emitPackagingProgress(orderId); } catch (_) { }

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

    // Requiere lock de empaque activo del usuario
    if (!(await assertHasActiveLock(orderId, req.user?.id, res))) {
      return;
    }

    // Política: en 'requires_review' se deshabilita "verificar todo"
    try {
      const s = await query('SELECT packaging_status FROM orders WHERE id = ? LIMIT 1', [orderId]);
      const pkgStatus = String(s[0]?.packaging_status || '').toLowerCase();
      if (pkgStatus === 'requires_review') {
        return res.status(403).json({
          success: false,
          message: 'Acción deshabilitada: pedido en revisión por cambios de SIIGO. Debe escanear/verificar cada ítem.'
        });
      }
    } catch (_) { }

    // Obtener todos los items del pedido
    const itemsQuery = `
      SELECT id FROM order_items WHERE order_id = ? AND status <> 'replaced'
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

    // Emitir snapshot de progreso
    try { await emitPackagingProgress(orderId); } catch (_) { }

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

// Verificar por código de barras
const verifyItemByBarcode = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { barcode } = req.body;

    // Requiere lock de empaque activo del usuario
    if (!(await assertHasActiveLock(orderId, req.user?.id, res))) {
      return;
    }

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: 'Código de barras requerido'
      });
    }

    const scannedRaw = barcode;
    const scanned = normalizeBarcode(barcode);
    console.log(`🔍 Verificando código de barras: raw=${scannedRaw} | normalizado=${scanned} para pedido ${orderId}`);

    // Buscar el producto por código de barras
    const productQuery = `
      SELECT 
        p.id as product_id,
        p.product_name,
        p.barcode,
        p.internal_code
      FROM products p
      WHERE REPLACE(REPLACE(REPLACE(SUBSTRING_INDEX(p.barcode, '.', 1), ' ', ''), ',', ''), '.', '') = ? OR p.barcode = ? OR p.internal_code = ?
      LIMIT 1
    `;

    const productResult = await query(productQuery, [scanned.replace(/\./g, ''), scanned, scanned]);

    if (productResult.length === 0) {
      console.log(`❌ Producto no encontrado con código: ${barcode}`);
      return res.status(404).json({
        success: false,
        message: `Producto no encontrado con código: ${barcode}`
      });
    }

    const product = productResult[0];
    console.log(`✅ Producto encontrado:`, product);

    // Buscar el item del pedido con información de escaneo
    const itemQuery = `
      SELECT 
        oi.id,
        oi.name,
        oi.quantity,
        piv.is_verified,
        piv.scanned_count,
        piv.required_scans
      FROM order_items oi
      LEFT JOIN packaging_item_verifications piv ON oi.id = piv.item_id AND piv.order_id = ?
      WHERE oi.order_id = ? 
        AND LOWER(TRIM(oi.name)) = LOWER(TRIM(?))
        AND oi.status <> 'replaced'
      LIMIT 1
    `;

    const itemResult = await query(itemQuery, [orderId, orderId, product.product_name]);

    if (itemResult.length === 0) {
      console.log(`⚠️ Producto ${product.product_name} no está en el pedido ${orderId}`);
      return res.status(400).json({
        success: false,
        message: `El producto "${product.product_name}" no está en este pedido`,
        data: {
          scanned_product: product.product_name,
          barcode: barcode
        }
      });
    }

    const item = itemResult[0];

    // Inicializar o obtener valores actuales de escaneo
    let currentScannedCount = item.scanned_count || 0;
    let requiredScans = item.required_scans || item.quantity;

    // Verificar si ya fue verificado completamente
    if (item.is_verified && currentScannedCount >= requiredScans) {
      console.log(`⚠️ Item ${item.id} ya fue verificado completamente (${currentScannedCount}/${requiredScans})`);
      return res.json({
        success: true,
        message: `Producto "${item.name}" ya fue verificado completamente`,
        data: {
          itemId: item.id,
          product_name: item.name,
          already_verified: true,
          quantity: item.quantity,
          scanned_count: currentScannedCount,
          required_scans: requiredScans
        }
      });
    }

    // Crear o actualizar registro de verificación si no existe
    const initializeQuery = `
      INSERT INTO packaging_item_verifications 
      (order_id, item_id, scanned_count, required_scans, packed_quantity, verification_notes, is_verified, verified_by)
      VALUES (?, ?, ?, ?, ?, ?, FALSE, 'escaneo_barcode')
      ON DUPLICATE KEY UPDATE
        required_scans = VALUES(required_scans),
        scanned_count = COALESCE(scanned_count, 0),
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(initializeQuery, [
      orderId,
      item.id,
      0,
      item.quantity,
      item.quantity,
      `Escaneo múltiple requerido: ${item.quantity} unidades`
    ]);

    // Obtener valores actualizados después de la inicialización
    const updatedItemQuery = `
      SELECT scanned_count, required_scans 
      FROM packaging_item_verifications 
      WHERE order_id = ? AND item_id = ?
    `;

    const updatedItemResult = await query(updatedItemQuery, [orderId, item.id]);
    currentScannedCount = updatedItemResult[0].scanned_count || 0;
    requiredScans = updatedItemResult[0].required_scans || item.quantity;

    // Registrar el escaneo individual
    const scanQuery = `
      INSERT INTO simple_barcode_scans 
      (order_id, item_id, barcode, scanned_at, scan_number)
      VALUES (?, ?, ?, NOW(), ?)
    `;

    const newScanNumber = currentScannedCount + 1;
    await query(scanQuery, [orderId, item.id, scanned, newScanNumber]);

    // Incrementar contador de escaneos
    const newScannedCount = currentScannedCount + 1;
    const isNowVerified = newScannedCount >= requiredScans;

    const updateQuery = `
      UPDATE packaging_item_verifications 
      SET 
        scanned_count = ?,
        is_verified = ?,
        verified_by = 'escaneo_barcode',
        verified_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE verified_at END,
        verification_notes = CONCAT(COALESCE(verification_notes, ''), ' | Escaneo ', ?, '/', ?, ' - ', NOW()),
        updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND item_id = ?
    `;

    await query(updateQuery, [
      newScannedCount,
      isNowVerified,
      isNowVerified,
      newScannedCount,
      requiredScans,
      orderId,
      item.id
    ]);

    console.log(`📱 Escaneo registrado: Item ${item.id} - ${newScannedCount}/${requiredScans} ${isNowVerified ? '(COMPLETO)' : ''}`);

    // Verificar si el pedido se puede auto-completar
    let autoCompleted = false;
    if (isNowVerified) {
      autoCompleted = await checkAndAutoCompleteOrder(orderId);
    }

    // Determinar mensaje y estado
    let message;
    if (isNowVerified) {
      message = `✅ Producto "${item.name}" verificado completamente (${newScannedCount}/${requiredScans})`;
    } else {
      message = `📱 Escaneo registrado: ${newScannedCount}/${requiredScans} unidades de "${item.name}"`;
    }

    // Emitir snapshot de progreso
    try { await emitPackagingProgress(orderId); } catch (_) { }

    res.json({
      success: true,
      message: message,
      data: {
        itemId: item.id,
        product_name: item.name,
        quantity: item.quantity,
        barcode: scanned,
        scanned_count: newScannedCount,
        required_scans: requiredScans,
        is_verified: isNowVerified,
        scan_progress: `${newScannedCount}/${requiredScans}`,
        auto_completed: autoCompleted,
        scan_number: newScanNumber
      }
    });

  } catch (error) {
    console.error('❌ Error verificando por código de barras:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Guardar progreso parcial de escaneo/conteo manual sin completar verificación
const savePartialProgress = async (req, res) => {
  try {
    const { itemId } = req.params;
    let { scanned_count, required_scans } = req.body;

    scanned_count = Number(scanned_count);
    if (!Number.isFinite(scanned_count) || scanned_count < 0) {
      return res.status(400).json({ success: false, message: 'scanned_count inválido' });
    }

    // Obtener datos del item
    const itemRow = await query(`SELECT order_id, quantity FROM order_items WHERE id = ? LIMIT 1`, [itemId]);
    if (!itemRow.length) {
      return res.status(404).json({ success: false, message: 'Item no encontrado' });
    }
    const orderId = itemRow[0].order_id;

    // Requiere lock de empaque activo del usuario
    if (!(await assertHasActiveLock(orderId, req.user?.id, res))) {
      return;
    }
    const qty = itemRow[0].quantity;

    if (required_scans === undefined || required_scans === null) {
      required_scans = qty;
    }
    required_scans = Number(required_scans);
    if (!Number.isFinite(required_scans) || required_scans <= 0) {
      required_scans = qty;
    }

    const initialIsVerified = scanned_count >= required_scans;

    // Log de diagnóstico para progreso parcial
    console.log(`📥 savePartialProgress → itemId=${itemId}, orderId=${orderId}, scanned_count=${scanned_count}, required_scans=${required_scans}, isNowVerified=${initialIsVerified}`);

    const upsert = `
      INSERT INTO packaging_item_verifications 
      (order_id, item_id, scanned_count, required_scans, packed_quantity, verification_notes, is_verified, verified_by)
      VALUES (?, ?, ?, ?, ?, ?, FALSE, 'parcial_manual')
      ON DUPLICATE KEY UPDATE
        required_scans = GREATEST(1, VALUES(required_scans)),
        scanned_count = LEAST(
          GREATEST(VALUES(scanned_count), COALESCE(packaging_item_verifications.scanned_count, 0)),
          GREATEST(1, VALUES(required_scans))
        ),
        packed_quantity = COALESCE(
          packaging_item_verifications.packed_quantity,
          LEAST(
            GREATEST(VALUES(scanned_count), COALESCE(packaging_item_verifications.scanned_count, 0)),
            GREATEST(1, VALUES(required_scans))
          )
        ),
        verification_notes = VALUES(verification_notes),
        is_verified = CASE 
          WHEN LEAST(
            GREATEST(VALUES(scanned_count), COALESCE(packaging_item_verifications.scanned_count, 0)),
            GREATEST(1, VALUES(required_scans))
          ) >= GREATEST(1, VALUES(required_scans)) 
          THEN TRUE 
          ELSE FALSE 
        END,
        verified_by = 'parcial_manual',
        verified_at = CASE 
          WHEN LEAST(
            GREATEST(VALUES(scanned_count), COALESCE(packaging_item_verifications.scanned_count, 0)),
            GREATEST(1, VALUES(required_scans))
          ) >= GREATEST(1, VALUES(required_scans))
          THEN COALESCE(packaging_item_verifications.verified_at, CURRENT_TIMESTAMP)
          ELSE packaging_item_verifications.verified_at
        END,
        updated_at = CURRENT_TIMESTAMP
    `;
    const upsertRes = await query(upsert, [
      orderId,
      itemId,
      scanned_count,
      required_scans,
      scanned_count,
      `Progreso parcial: ${scanned_count}/${required_scans}`
    ]);
    console.log(`✅ savePartialProgress upsert OK → affectedRows=${upsertRes.affectedRows || '-'} | changedRows=${upsertRes.changedRows || '-'}`);

    // Leer valores efectivos tras el upsert para coherencia en respuesta y autocompletado
    const pivRow = await query(
      `SELECT scanned_count, required_scans, is_verified 
       FROM packaging_item_verifications 
       WHERE order_id = ? AND item_id = ? 
       LIMIT 1`,
      [orderId, itemId]
    );
    const finalScanned = pivRow[0]?.scanned_count || 0;
    const finalRequired = pivRow[0]?.required_scans || required_scans;
    const finalIsVerified = !!pivRow[0]?.is_verified;

    // Autocompletar si corresponde
    let autoCompleted = false;
    if (finalIsVerified) {
      autoCompleted = await checkAndAutoCompleteOrder(orderId);
    }

    // Emitir snapshot de progreso
    try { await emitPackagingProgress(orderId); } catch (_) { }

    return res.json({
      success: true,
      message: finalIsVerified ? 'Item completado por progreso parcial' : 'Progreso parcial guardado',
      data: {
        orderId,
        itemId,
        scanned_count: finalScanned,
        required_scans: finalRequired,
        is_verified: finalIsVerified,
        auto_completed: autoCompleted
      }
    });
  } catch (error) {
    console.error('❌ Error guardando progreso parcial:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
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
      switch (row.status) {
        case 'en_empaque':
          stats.pending_packaging += row.count;
          break;
        case 'en_preparacion':
          stats.in_packaging += row.count;
          break;
        case 'empacado':
        case 'listo_para_entrega':
          stats.ready_shipping += row.count;
          break;
      }
    });

    try {
      const rr = await query(`SELECT COUNT(*) AS cnt FROM orders WHERE packaging_status = 'requires_review'`);
      stats.requires_review = rr && rr[0] ? (rr[0].cnt || 0) : 0;
    } catch (_) { }

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

    // Requiere lock de empaque activo del usuario
    if (!(await assertHasActiveLock(orderId, req.user?.id, res))) {
      return;
    }
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

// Subir evidencia de empaque (múltiples fotos)
const uploadPackagingEvidence = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id || null;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No se recibieron fotos' });
    }

    // Asegurar que el pedido exista
    const exists = await query('SELECT id FROM orders WHERE id = ? LIMIT 1', [orderId]);
    if (!exists.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    // Crear tabla si no existe (ligera, sólo para evidencias de empaque)
    await query(`
      CREATE TABLE IF NOT EXISTS packaging_evidence (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NULL,
        photo_filename VARCHAR(255) NOT NULL,
        photo_path VARCHAR(500) NOT NULL,
        photo_size INT NULL,
        photo_type VARCHAR(100) NULL,
        description VARCHAR(255) NULL,
        taken_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX(order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const saved = [];
    for (const f of req.files) {
      const relPath = `/uploads/delivery_evidence/${f.filename}`; // usamos storage reutilizado
      await query(
        `INSERT INTO packaging_evidence (order_id, user_id, photo_filename, photo_path, photo_size, photo_type, description, taken_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [orderId, userId, f.filename, relPath, f.size || null, f.mimetype || null, req.body?.description || null]
      );
      saved.push({ filename: f.filename, url: relPath, size: f.size, type: f.mimetype });
    }

    return res.json({ success: true, message: `${saved.length} foto(s) registradas`, data: { files: saved } });
  } catch (error) {
    console.error('❌ Error subiendo evidencia de empaque:', error);
    return res.status(500).json({ success: false, message: 'Error al subir evidencias' });
  }
};

// Listar evidencias de empaque para un pedido
const listPackagingEvidence = async (req, res) => {
  try {
    const { orderId } = req.params;
    // Si la tabla no existe, devolver lista vacía
    const t = await query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packaging_evidence'
    `);
    const exists = (t[0]?.cnt || 0) > 0;
    if (!exists) {
      return res.json({ success: true, data: { files: [] } });
    }
    const rows = await query(
      `SELECT id, photo_filename, photo_path AS url, description, taken_at, created_at, photo_size AS size, photo_type AS type
       FROM packaging_evidence
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [orderId]
    );
    return res.json({ success: true, data: { files: rows } });
  } catch (e) {
    console.error('❌ Error listando evidencias de empaque:', e);
    return res.status(500).json({ success: false, message: 'Error listando evidencias' });
  }
};

/**
 * Endpoints de lock de empaque
 */
const acquirePackagingLock = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;
    const ttl = Number(req.body?.ttl_minutes) || 10;
    const result = await PackagingLock.acquireLock(orderId, userId, ttl);
    if (result.ok) {
      try { await emitPackagingProgress(orderId); } catch (_) { }
      return res.json({ success: true, data: result.row });
    }
    return res.status(423).json({
      success: false,
      message: 'El pedido está siendo empacado por otro usuario',
      data: result.row
    });
  } catch (e) {
    console.error('❌ Error adquiriendo lock de empaque:', e);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const heartbeatPackagingLock = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;
    const ttl = Number(req.body?.ttl_minutes) || 10;
    const result = await PackagingLock.heartbeat(orderId, userId, ttl);
    if (result.ok) { try { await emitPackagingProgress(orderId); } catch (_) { } return res.json({ success: true }); }
    return res.status(403).json({ success: false, message: 'No posees el lock de este pedido' });
  } catch (e) {
    console.error('❌ Error en heartbeat de empaque:', e);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const pausePackagingLock = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;
    const reason = req.body?.reason || null;

    // Política: permitir pausar sin exigir evidencia para liberar el lock (se validará evidencia al finalizar).
    // Si en el futuro se requiere forzar evidencia para pausar, se puede reintroducir esta validación vía feature flag de configuración.
    // try {
    //   const hasEv = await hasPackagingEvidence(orderId);
    //   if (!hasEv) {
    //     return res.status(422).json({ success: false, message: 'Debe subir al menos una foto de evidencia de empaque antes de pausar.' });
    //   }
    // } catch (_) {}

    const result = await PackagingLock.releaseWithStatus(orderId, userId, 'paused', reason);
    if (result.ok) { try { await emitPackagingProgress(orderId); } catch (_) { } return res.json({ success: true, message: 'Empaque pausado' }); }
    return res.status(403).json({ success: false, message: 'No posees el lock de este pedido' });
  } catch (e) {
    console.error('❌ Error pausando empaque:', e);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const blockPackagingLock = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;
    const type = String(req.body?.type || '').toLowerCase();
    const reason = req.body?.reason || null;
    const state = type === 'faltante' || type === 'blocked_faltante'
      ? 'blocked_faltante'
      : type === 'novedad' || type === 'blocked_novedad'
        ? 'blocked_novedad'
        : null;
    if (!state) {
      return res.status(400).json({ success: false, message: 'Tipo de bloqueo inválido (faltante|novedad)' });
    }
    const result = await PackagingLock.releaseWithStatus(orderId, userId, state, reason);
    if (result.ok) { try { await emitPackagingProgress(orderId); } catch (_) { } return res.json({ success: true, message: 'Pedido bloqueado', data: { state } }); }
    return res.status(403).json({ success: false, message: 'No posees el lock de este pedido' });
  } catch (e) {
    console.error('❌ Error bloqueando pedido por novedad/faltante:', e);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const unlockPackagingAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;
    // Permitir solo admin (mejor mover a middleware si existe)
    const role = String(req.user?.role || '').toLowerCase();
    const hasAdminRole =
      role === 'admin' ||
      (Array.isArray(req.user?.roles) && req.user.roles.some(r => String(r.role_name || '').toLowerCase() === 'admin'));
    if (!hasAdminRole) {
      return res.status(403).json({ success: false, message: 'Solo admin puede desbloquear manualmente' });
    }
    const reason = req.body?.reason || 'admin_unlock';
    const result = await PackagingLock.adminUnlock(orderId, req.user?.id || null, reason);
    if (result.ok) { try { await emitPackagingProgress(orderId); } catch (_) { } return res.json({ success: true, message: 'Pedido desbloqueado por admin' }); }
    return res.status(400).json({ success: false, message: 'No se pudo desbloquear el pedido' });
  } catch (e) {
    console.error('❌ Error adminUnlock de empaque:', e);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getPackagingLockStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const row = await PackagingLock.getLockStatus(orderId);
    return res.json({ success: true, data: row });
  } catch (e) {
    console.error('❌ Error consultando lock de empaque:', e);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Endpoint: Snapshot de empaque (solo lectura)
 */
const getPackagingSnapshot = async (req, res) => {
  try {
    const { orderId } = req.params;
    const snap = await getPackagingProgressSnapshot(orderId);
    if (!snap) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    return res.json({ success: true, data: snap });
  } catch (e) {
    console.error('❌ Error obteniendo snapshot de empaque:', e?.message || e);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * Galería global de evidencias de empaque con filtros y paginación
 * GET /api/packaging/evidence-gallery
 * Query:
 *  - product_name?: string
 *  - barcode?: string
 *  - product_id?: number
 *  - order_number?: string
 *  - status?: string
 *  - from?: ISO date
 *  - to?: ISO date
 *  - page?: number (default 1)
 *  - pageSize?: number (default 20, max 50)
 */
const listEvidenceGallery = async (req, res) => {
  try {
    // Validar existencia tabla de evidencias
    const t = await query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packaging_evidence'
    `);
    const tableExists = (t[0]?.cnt || 0) > 0;
    if (!tableExists) {
      return res.json({
        success: true,
        data: [],
        meta: { page: 1, pageSize: 20, totalOrders: 0, totalPhotos: 0 }
      });
    }

    // Parámetros
    let {
      product_name,
      barcode,
      product_id,
      order_number,
      status,
      from,
      to,
      page = 1,
      pageSize = 20
    } = req.query;

    page = Math.max(1, parseInt(page, 10) || 1);
    pageSize = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const filters = [];
    const params = [];

    // Rango de fechas por día (sin horas) sobre taken_at/created_at, evitando problemas de zona horaria
    // Si llega 'YYYY-MM-DD' tomamos ese día; si llega con hora, igual comparamos por DATE(...)
    if (from) {
      // Comparar por día en zona horaria local (Bogotá -05:00) para evitar arrastres por UTC
      filters.push(`DATE(CONVERT_TZ(COALESCE(pe.taken_at, pe.created_at), '+00:00', '-05:00')) >= ?`);
      params.push(String(from).slice(0, 10));
    }
    if (to) {
      filters.push(`DATE(CONVERT_TZ(COALESCE(pe.taken_at, pe.created_at), '+00:00', '-05:00')) <= ?`);
      params.push(String(to).slice(0, 10));
    }

    // Filtros por pedido
    if (order_number) {
      const onum = String(order_number).trim();
      // Permitir buscar por número corto (ej: "15209") o por códigos completos (pedido o factura SIIGO)
      if (/^\d+$/.test(onum)) {
        // Numérico: coincidir sufijo numérico del order_number, o que el order_number/siigo_invoice_number termine/contenga ese número
        filters.push(`(CAST(SUBSTRING_INDEX(o.order_number, '-', -1) AS UNSIGNED) = ? OR o.order_number LIKE CONCAT('%', ?) OR o.siigo_invoice_number LIKE CONCAT('%', ?))`);
        params.push(Number(onum), onum, onum);
      } else {
        // Texto: permitir match exacto por pedido o factura, o LIKE por factura (por prefijos tipo "PEC 15279")
        filters.push(`(o.order_number = ? OR o.siigo_invoice_number = ? OR o.siigo_invoice_number LIKE CONCAT('%', ?))`);
        params.push(onum, onum, onum);
      }
    }
    if (status) {
      filters.push(`o.status = ?`);
      params.push(String(status).trim());
    }

    // Filtro de producto (por id / barcode / nombre)
    const hasProductFilters = !!(product_id || barcode || product_name);
    // Incluir pedidos SIN fotos también cuando hay filtro de producto o cuando se filtra por número de pedido
    const includeNoPhoto = hasProductFilters || !!order_number;
    let productFilterSQL = '';
    if (includeNoPhoto) {
      // Normalización local para código de barras
      const scanned = barcode ? normalizeBarcode(barcode) : null;
      const scannedNoDots = scanned ? scanned.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '') : null;
      productFilterSQL = `
        AND EXISTS (
          SELECT 1
          FROM order_items oi
          LEFT JOIN products p ON LOWER(TRIM(p.product_name)) = LOWER(TRIM(oi.name))
          WHERE oi.order_id = o.id
            ${product_id ? ' AND p.id = ? ' : ''}
            ${scanned ? `
              AND (
                p.barcode = ? OR
                REPLACE(REPLACE(REPLACE(SUBSTRING_INDEX(p.barcode, '.', 1), ' ', ''), ',', ''), '.', '') = ? OR
                oi.product_code = ? OR
                p.internal_code = ?
              )
            ` : ''}
            ${product_name ? ' AND LOWER(TRIM(oi.name)) LIKE CONCAT(\'%\', LOWER(TRIM(?)), \'%\') ' : ''}
        )
      `;
    }

    // Consulta total de pedidos (distinct)
    const whereSQL = filters.length ? `WHERE ${filters.join(' AND ')}` : 'WHERE 1=1';

    // Cuando hay filtro de producto, incluir también pedidos SIN fotos que contengan el producto
    let countSQL;
    let countParams;
    if (includeNoPhoto) {
      // Filtros para la parte SIN fotos (basado en fecha del pedido/factura, no en fotos)
      const ordersFilters = [];
      const ordersParams = [];

      if (from) {
        ordersFilters.push(`DATE(CONVERT_TZ(COALESCE(o.siigo_invoice_created_at, o.created_at), '+00:00', '-05:00')) >= ?`);
        ordersParams.push(String(from).slice(0, 10));
      }
      if (to) {
        ordersFilters.push(`DATE(CONVERT_TZ(COALESCE(o.siigo_invoice_created_at, o.created_at), '+00:00', '-05:00')) <= ?`);
        ordersParams.push(String(to).slice(0, 10));
      }
      if (order_number) {
        const onum = String(order_number).trim();
        if (/^\d+$/.test(onum)) {
          ordersFilters.push(`(CAST(SUBSTRING_INDEX(o.order_number, '-', -1) AS UNSIGNED) = ? OR o.order_number LIKE CONCAT('%', ?) OR o.siigo_invoice_number LIKE CONCAT('%', ?))`);
          ordersParams.push(Number(onum), onum, onum);
        } else {
          ordersFilters.push(`(o.order_number = ? OR o.siigo_invoice_number = ? OR o.siigo_invoice_number LIKE CONCAT('%', ?))`);
          ordersParams.push(onum, onum, onum);
        }
      }
      if (status) {
        ordersFilters.push(`o.status = ?`);
        ordersParams.push(String(status).trim());
      }
      const ordersWhereSQL = ordersFilters.length ? ordersFilters.join(' AND ') : '1=1';

      // Subconsulta: pedidos con fotos (usa filtros de fotos existentes + producto)
      const subPhoto = `
        SELECT pe.order_id AS order_id, MAX(COALESCE(pe.taken_at, pe.created_at)) AS last_ts
        FROM packaging_evidence pe
        JOIN orders o ON o.id = pe.order_id
        ${whereSQL}
        ${productFilterSQL}
        GROUP BY pe.order_id
      `;

      // Subconsulta: pedidos SIN fotos que contienen el producto (usa fecha del pedido/factura)
      const subNoPhoto = `
        SELECT o.id AS order_id, COALESCE(o.siigo_invoice_created_at, o.created_at) AS last_ts
        FROM orders o
        WHERE ${ordersWhereSQL}
        ${productFilterSQL}
          AND NOT EXISTS (SELECT 1 FROM packaging_evidence pe2 WHERE pe2.order_id = o.id)
      `;

      countSQL = `
        SELECT COUNT(*) AS totalOrders
        FROM (
          ${subPhoto}
          UNION
          ${subNoPhoto}
        ) u
      `;

      // Params para subPhoto (mismos que count de fotos original)
      const countParamsPhoto = [...params];
      if (product_id) countParamsPhoto.push(Number(product_id));
      if (barcode) {
        const scanned = normalizeBarcode(barcode);
        const scannedNoDots = scanned.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '');
        countParamsPhoto.push(scanned, scannedNoDots, scanned, scanned);
      }
      if (product_name) countParamsPhoto.push(String(product_name).trim());

      // Params para subNoPhoto (filtros por fecha/estado/numero + producto)
      const countParamsNoPhoto = [...ordersParams];
      if (product_id) countParamsNoPhoto.push(Number(product_id));
      if (barcode) {
        const scanned = normalizeBarcode(barcode);
        const scannedNoDots = scanned.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '');
        countParamsNoPhoto.push(scanned, scannedNoDots, scanned, scanned);
      }
      if (product_name) countParamsNoPhoto.push(String(product_name).trim());

      countParams = [...countParamsPhoto, ...countParamsNoPhoto];
    } else {
      // Comportamiento actual (solo pedidos con fotos)
      countSQL = `
        SELECT COUNT(DISTINCT pe.order_id) AS totalOrders
        FROM packaging_evidence pe
        JOIN orders o ON o.id = pe.order_id
        ${whereSQL}
        ${productFilterSQL}
      `;
      countParams = [...params];
      if (includeNoPhoto) {
        if (product_id) countParams.push(Number(product_id));
        if (barcode) {
          const scanned = normalizeBarcode(barcode);
          const scannedNoDots = scanned.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '');
          countParams.push(scanned, scannedNoDots, scanned, scanned);
        }
        if (product_name) countParams.push(String(product_name).trim());
      }
    }

    const countRow = await query(countSQL, countParams);
    const totalOrders = countRow[0]?.totalOrders || 0;

    if (totalOrders === 0) {
      return res.json({
        success: true,
        data: [],
        meta: { page, pageSize, totalOrders: 0, totalPhotos: 0 }
      });
    }

    // Obtener order_ids paginados
    let idsSQL;
    let idsParams;

    if (includeNoPhoto) {
      // Filtros para la parte SIN fotos (por fecha del pedido/factura)
      const ordersFilters = [];
      const ordersParams = [];

      if (from) {
        ordersFilters.push(`DATE(CONVERT_TZ(COALESCE(o.siigo_invoice_created_at, o.created_at), '+00:00', '-05:00')) >= ?`);
        ordersParams.push(String(from).slice(0, 10));
      }
      if (to) {
        ordersFilters.push(`DATE(CONVERT_TZ(COALESCE(o.siigo_invoice_created_at, o.created_at), '+00:00', '-05:00')) <= ?`);
        ordersParams.push(String(to).slice(0, 10));
      }
      if (order_number) {
        const onum = String(order_number).trim();
        if (/^\d+$/.test(onum)) {
          ordersFilters.push(`(CAST(SUBSTRING_INDEX(o.order_number, '-', -1) AS UNSIGNED) = ? OR o.order_number LIKE CONCAT('%', ?) OR o.siigo_invoice_number LIKE CONCAT('%', ?))`);
          ordersParams.push(Number(onum), onum, onum);
        } else {
          ordersFilters.push(`(o.order_number = ? OR o.siigo_invoice_number = ? OR o.siigo_invoice_number LIKE CONCAT('%', ?))`);
          ordersParams.push(onum, onum, onum);
        }
      }
      if (status) {
        ordersFilters.push(`o.status = ?`);
        ordersParams.push(String(status).trim());
      }
      const ordersWhereSQL = ordersFilters.length ? ordersFilters.join(' AND ') : '1=1';

      const subPhoto = `
        SELECT pe.order_id AS order_id, MAX(COALESCE(pe.taken_at, pe.created_at)) AS last_ts
        FROM packaging_evidence pe
        JOIN orders o ON o.id = pe.order_id
        ${whereSQL}
        ${productFilterSQL}
        GROUP BY pe.order_id
      `;

      const subNoPhoto = `
        SELECT o.id AS order_id, COALESCE(o.siigo_invoice_created_at, o.created_at) AS last_ts
        FROM orders o
        WHERE ${ordersWhereSQL}
        ${productFilterSQL}
          AND NOT EXISTS (SELECT 1 FROM packaging_evidence pe2 WHERE pe2.order_id = o.id)
      `;

      idsSQL = `
        SELECT order_id
        FROM (
          ${subPhoto}
          UNION
          ${subNoPhoto}
        ) u
        ORDER BY u.last_ts DESC
        LIMIT ? OFFSET ?
      `;

      const idsParamsPhoto = [...params];
      if (product_id) idsParamsPhoto.push(Number(product_id));
      if (barcode) {
        const scanned = normalizeBarcode(barcode);
        const scannedNoDots = scanned.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '');
        idsParamsPhoto.push(scanned, scannedNoDots, scanned, scanned);
      }
      if (product_name) idsParamsPhoto.push(String(product_name).trim());

      const idsParamsNoPhoto = [...ordersParams];
      if (product_id) idsParamsNoPhoto.push(Number(product_id));
      if (barcode) {
        const scanned = normalizeBarcode(barcode);
        const scannedNoDots = scanned.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '');
        idsParamsNoPhoto.push(scanned, scannedNoDots, scanned, scanned);
      }
      if (product_name) idsParamsNoPhoto.push(String(product_name).trim());

      idsParams = [...idsParamsPhoto, ...idsParamsNoPhoto, pageSize, offset];
    } else {
      idsSQL = `
        SELECT DISTINCT pe.order_id AS order_id
        FROM packaging_evidence pe
        JOIN orders o ON o.id = pe.order_id
        ${whereSQL}
        ${productFilterSQL}
        ORDER BY COALESCE(pe.taken_at, pe.created_at) DESC
        LIMIT ? OFFSET ?
      `;
      idsParams = [...params];
      if (hasProductFilters) {
        if (product_id) idsParams.push(Number(product_id));
        if (barcode) {
          const scanned = normalizeBarcode(barcode);
          const scannedNoDots = scanned.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '');
          idsParams.push(scanned, scannedNoDots, scanned, scanned);
        }
        if (product_name) idsParams.push(String(product_name).trim());
      }
      idsParams.push(pageSize, offset);
    }

    const idRows = await query(idsSQL, idsParams);
    const orderIds = idRows.map(r => r.order_id);
    if (orderIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        meta: { page, pageSize, totalOrders: 0, totalPhotos: 0 }
      });
    }

    // Traer info de pedidos
    const ordersSQL = `
      SELECT id, order_number, siigo_invoice_number, status, customer_name, siigo_invoice_created_at, created_at, updated_at
      FROM orders
      WHERE id IN (${orderIds.map(() => '?').join(',')})
    `;
    const ordersRows = await query(ordersSQL, orderIds);

    // Traer fotos
    const photosSQL = `
      SELECT id, order_id, photo_path AS url, description, taken_at, created_at, photo_size AS size, photo_type AS type
      FROM packaging_evidence
      WHERE order_id IN (${orderIds.map(() => '?').join(',')})
      ORDER BY COALESCE(taken_at, created_at) DESC, id DESC
    `;
    const photosRows = await query(photosSQL, orderIds);

    // Traer items
    const itemsSQL = `
      SELECT 
        oi.id, oi.order_id, oi.name, oi.quantity,
        p.id AS product_id, p.barcode, p.internal_code
      FROM order_items oi
      LEFT JOIN products p ON LOWER(TRIM(p.product_name)) = LOWER(TRIM(oi.name))
      WHERE oi.order_id IN (${orderIds.map(() => '?').join(',')})
    `;
    const itemsRows = await query(itemsSQL, orderIds);

    // Agrupar por pedido
    const ordersMap = new Map();
    ordersRows.forEach(o => {
      ordersMap.set(o.id, { order: o, photos: [], items: [] });
    });
    photosRows.forEach(ph => {
      const entry = ordersMap.get(ph.order_id);
      if (entry) entry.photos.push(ph);
    });
    itemsRows.forEach(it => {
      const entry = ordersMap.get(it.order_id);
      if (entry) entry.items.push(it);
    });

    // Calcular flags de coincidencia por producto
    const normName = product_name ? String(product_name).trim().toLowerCase() : null;
    const normBarcode = barcode ? normalizeBarcode(barcode) : null;
    const normBarcodeNoDots = normBarcode ? normBarcode.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '') : null;
    const pid = product_id ? Number(product_id) : null;

    const data = [];
    let totalPhotos = 0;

    for (const oid of orderIds) {
      const entry = ordersMap.get(oid);
      if (!entry) continue;
      totalPhotos += entry.photos.length;

      const items = entry.items.map(it => {
        let match = false;
        if (pid && it.product_id && it.product_id === pid) match = true;
        if (normBarcode) {
          const pbc = it.barcode ? String(it.barcode) : null;
          const pic = it.internal_code ? String(it.internal_code) : null;
          const eq = (a, b) => a && b && String(a) === String(b);
          const norm = (v) => v ? String(v).replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '') : v;
          if (eq(pbc, normBarcode) || eq(pic, normBarcode) || (norm(pbc) && norm(pbc) === normBarcodeNoDots)) match = true;
        }
        if (normName) {
          const iname = (it.name || '').toString().trim().toLowerCase();
          if (iname.includes(normName)) match = true;
        }
        return {
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          product_id: it.product_id || null,
          barcode: it.barcode || null,
          matches_filter: match
        };
      });

      const has_product_match = hasProductFilters ? items.some(i => i.matches_filter) : false;

      data.push({
        order: entry.order,
        items,
        photos: entry.photos,
        has_product_match,
        photos_count: entry.photos.length
      });
    }

    return res.json({
      success: true,
      data,
      meta: { page, pageSize, totalOrders, totalPhotos }
    });
  } catch (e) {
    console.error('❌ Error listEvidenceGallery:', e?.message || e);
    return res.status(500).json({ success: false, message: 'Error listando galería de evidencias' });
  }
};

module.exports = {
  getPendingOrders,
  startPackaging,
  getPackagingChecklist,
  verifyItem,
  savePartialProgress,
  verifyAllItems,
  verifyItemByBarcode,
  completePackaging,
  getPackagingTemplates,
  getPackagingStats,
  finalizarEmpaque,
  getPedidosEmpacados,
  getPedidosListosParaEntrega,
  uploadPackagingEvidence,
  listPackagingEvidence,
  listEvidenceGallery,
  // Lock endpoints
  acquirePackagingLock,
  heartbeatPackagingLock,
  pausePackagingLock,
  blockPackagingLock,
  unlockPackagingAdmin,
  getPackagingLockStatus,
  // Solo lectura
  getPackagingSnapshot
};
