const { query } = require('../config/database');

class PackagingController {
  // Obtener pedidos pendientes de empaque
  static async getPendingOrders(req, res) {
    try {
      const orders = await query(`
        SELECT 
          o.id,
          o.order_number,
          o.customer_name,
          o.total_amount,
          o.created_at,
          o.delivery_method,
          o.shipping_date,
          ops.packaging_status,
          ops.total_items,
          ops.verified_items,
          COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_packaging_status ops ON o.id = ops.order_id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status IN ('pendiente_empaque', 'en_empaque')
        GROUP BY o.id
        ORDER BY o.created_at ASC
      `);

      res.json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error('Error obteniendo pedidos pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Iniciar proceso de empaque para un pedido
  static async startPackaging(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      // Verificar que el pedido está pendiente de empaque o ya en empaque
      const order = await query(
        'SELECT * FROM orders WHERE id = ? AND status IN (?, ?)',
        [orderId, 'pendiente_empaque', 'en_empaque']
      );

      if (!order || order.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no está disponible para empaque'
        });
      }

      // Obtener items del pedido
      const orderItems = await query(`
        SELECT 
          oi.*,
          pt.standard_weight,
          pt.available_flavors,
          pt.available_sizes,
          pt.packaging_instructions,
          pt.quality_checks,
          pt.common_errors
        FROM order_items oi
        LEFT JOIN packaging_templates pt ON oi.name COLLATE utf8mb4_general_ci = pt.product_name
        WHERE oi.order_id = ?
      `, [orderId]);

      // Validar que el pedido tenga items
      if (!orderItems || orderItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El pedido no tiene items para empacar. Verifica que el pedido tenga productos agregados.'
        });
      }

      // Crear registro de estado de empaque
      await query(`
        INSERT INTO order_packaging_status (order_id, packaging_status, total_items, started_by, started_at)
        VALUES (?, 'in_progress', ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        packaging_status = 'in_progress',
        started_by = VALUES(started_by),
        started_at = NOW()
      `, [orderId, orderItems.length, userId]);

      // Verificar si ya existe un checklist para este pedido
      const existingChecklist = await query(`
        SELECT COUNT(*) as count FROM packaging_checklists WHERE order_id = ?
      `, [orderId]);

      if (existingChecklist[0].count === 0) {
        // Solo crear checklist si no existe
        for (const item of orderItems) {
          // Parsear información adicional del producto
          let productInfo = {};
          try {
            if (item.description) {
              const description = item.description.toLowerCase();
              
              // Extraer sabor de la descripción si es posible
              const flavorKeywords = ['maracuya', 'mango', 'cereza', 'fresa', 'limón', 'naranja'];
              const foundFlavor = flavorKeywords.find(flavor => 
                description.includes(flavor.toLowerCase())
              );
              
              // Extraer peso si está especificado
              const weightMatch = description.match(/(\d+\.?\d*)\s*(kg|g|gramos?)/i);
              let weight = null;
              if (weightMatch) {
                weight = parseFloat(weightMatch[1]);
                if (weightMatch[2].toLowerCase().startsWith('g')) {
                  weight = weight / 1000; // Convertir gramos a kg
                }
              }

              productInfo = {
                flavor: foundFlavor || null,
                weight: weight,
                size: null
              };
            }
          } catch (e) {
            console.error('Error parsing product info:', e);
          }

          await query(`
            INSERT INTO packaging_checklists (
              order_id, item_id, item_name, required_quantity, required_unit,
              required_weight, required_flavor, required_size
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            orderId,
            item.id,
            item.name,
            item.quantity,
            'unidad',
            productInfo.weight || null,
            productInfo.flavor || null,
            productInfo.size || null
          ]);
        }
      } else {
        // Si ya existe checklist, solo resetear los items no verificados
        await query(`
          UPDATE packaging_checklists 
          SET 
            is_verified = 0,
            packed_quantity = NULL,
            packed_weight = NULL,
            packed_flavor = NULL,
            packed_size = NULL,
            verification_notes = NULL,
            packed_by = NULL,
            packed_at = NULL,
            verified_by = NULL,
            verified_at = NULL
          WHERE order_id = ? AND is_verified = 0
        `, [orderId]);
      }

      // Actualizar estado del pedido
      await query(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['en_empaque', orderId]
      );

      res.json({
        success: true,
        message: 'Proceso de empaque iniciado exitosamente'
      });

    } catch (error) {
      console.error('Error iniciando empaque:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener checklist de empaque para un pedido
  static async getPackagingChecklist(req, res) {
    try {
      const { orderId } = req.params;

      // Obtener información del pedido
      const order = await query(`
        SELECT o.*, ops.packaging_status, ops.total_items, ops.verified_items
        FROM orders o
        LEFT JOIN order_packaging_status ops ON o.id = ops.order_id
        WHERE o.id = ?
      `, [orderId]);

      if (!order || order.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      // Obtener checklist
      const checklist = await query(`
        SELECT 
          pc.*,
          pt.packaging_instructions,
          pt.quality_checks,
          pt.common_errors,
          u1.full_name as packed_by_name,
          u2.full_name as verified_by_name
        FROM packaging_checklists pc
        LEFT JOIN packaging_templates pt ON pc.item_name COLLATE utf8mb4_general_ci = pt.product_name
        LEFT JOIN users u1 ON pc.packed_by = u1.id
        LEFT JOIN users u2 ON pc.verified_by = u2.id
        WHERE pc.order_id = ?
        ORDER BY pc.id
      `, [orderId]);

      res.json({
        success: true,
        data: {
          order: order[0],
          checklist: checklist
        }
      });

    } catch (error) {
      console.error('Error obteniendo checklist:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Verificar un item del checklist
  static async verifyItem(req, res) {
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
      const userId = req.user.id;

      // Actualizar item en checklist
      await query(`
        UPDATE packaging_checklists 
        SET 
          packed_quantity = ?,
          packed_weight = ?,
          packed_flavor = ?,
          packed_size = ?,
          verification_notes = ?,
          is_verified = ?,
          packed_by = ?,
          packed_at = NOW(),
          verified_by = ?,
          verified_at = NOW()
        WHERE id = ?
      `, [
        packed_quantity,
        packed_weight,
        packed_flavor,
        packed_size,
        verification_notes,
        is_verified ? 1 : 0,
        userId,
        userId,
        itemId
      ]);

      // Obtener información del pedido para actualizar contadores
      const item = await query(
        'SELECT order_id FROM packaging_checklists WHERE id = ?',
        [itemId]
      );

      if (item && item.length > 0) {
        const orderId = item[0].order_id;
        
        // Actualizar contadores
        const stats = await query(`
          SELECT 
            COUNT(*) as total_items,
            SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_items
          FROM packaging_checklists 
          WHERE order_id = ?
        `, [orderId]);

        const { total_items, verified_items } = stats[0];
        
        await query(`
          UPDATE order_packaging_status 
          SET verified_items = ?, updated_at = NOW()
          WHERE order_id = ?
        `, [verified_items, orderId]);

        // Si todos los items están verificados, marcar como completado
        if (verified_items === total_items) {
          await query(`
            UPDATE order_packaging_status 
            SET 
              packaging_status = 'completed',
              completed_by = ?,
              completed_at = NOW()
            WHERE order_id = ?
          `, [userId, orderId]);

          // Actualizar estado del pedido a listo para reparto
          await query(
            'UPDATE orders SET status = ? WHERE id = ?',
            ['listo_reparto', orderId]
          );
        }
      }

      res.json({
        success: true,
        message: 'Item verificado exitosamente'
      });

    } catch (error) {
      console.error('Error verificando item:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Finalizar empaque con control de calidad
  static async completePackaging(req, res) {
    try {
      const { orderId } = req.params;
      const { packaging_notes, quality_check_passed } = req.body;
      const userId = req.user.id;

      // Verificar que todos los items están verificados
      const pendingItems = await query(`
        SELECT COUNT(*) as pending_count
        FROM packaging_checklists 
        WHERE order_id = ? AND is_verified = 0
      `, [orderId]);

      if (pendingItems[0].pending_count > 0) {
        return res.status(400).json({
          success: false,
          message: `Quedan ${pendingItems[0].pending_count} items sin verificar`
        });
      }

      // Finalizar empaque
      await query(`
        UPDATE order_packaging_status 
        SET 
          packaging_status = 'completed',
          packaging_notes = ?,
          quality_check_passed = ?,
          completed_by = ?,
          completed_at = NOW()
        WHERE order_id = ?
      `, [packaging_notes, quality_check_passed ? 1 : 0, userId, orderId]);

      // Actualizar estado del pedido
      const newStatus = quality_check_passed ? 'listo_reparto' : 'requires_review';
      if (quality_check_passed) {
        await query(
          'UPDATE orders SET status = ? WHERE id = ?',
          ['listo_reparto', orderId]
        );
      }

      res.json({
        success: true,
        message: quality_check_passed 
          ? 'Empaque completado y enviado a reparto'
          : 'Empaque completado pero requiere revisión'
      });

    } catch (error) {
      console.error('Error completando empaque:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener plantillas de empaque
  static async getPackagingTemplates(req, res) {
    try {
      const templates = await query(`
        SELECT * FROM packaging_templates 
        WHERE is_active = 1 
        ORDER BY product_name
      `);

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error obteniendo plantillas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Verificar todos los items de un pedido de una vez
  static async verifyAllItems(req, res) {
    try {
      const { orderId } = req.params;
      const { verification_notes } = req.body;
      const userId = req.user.id;

      // Obtener todos los items no verificados del pedido
      const unverifiedItems = await query(`
        SELECT id, required_quantity, required_weight, required_flavor, required_size
        FROM packaging_checklists 
        WHERE order_id = ? AND is_verified = 0
      `, [orderId]);

      if (unverifiedItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Todos los items ya están verificados'
        });
      }

      // Verificar todos los items pendientes
      for (const item of unverifiedItems) {
        await query(`
          UPDATE packaging_checklists 
          SET 
            packed_quantity = ?,
            packed_weight = ?,
            packed_flavor = ?,
            packed_size = ?,
            verification_notes = ?,
            is_verified = 1,
            packed_by = ?,
            packed_at = NOW(),
            verified_by = ?,
            verified_at = NOW()
          WHERE id = ?
        `, [
          item.required_quantity,
          item.required_weight || null,
          item.required_flavor || null,
          item.required_size || null,
          verification_notes || 'Verificación rápida - Todo correcto',
          userId,
          userId,
          item.id
        ]);
      }

      // Actualizar contadores
      const stats = await query(`
        SELECT 
          COUNT(*) as total_items,
          SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_items
        FROM packaging_checklists 
        WHERE order_id = ?
      `, [orderId]);

      const { total_items, verified_items } = stats[0];
      
      await query(`
        UPDATE order_packaging_status 
        SET 
          verified_items = ?,
          packaging_status = 'completed',
          completed_by = ?,
          completed_at = NOW(),
          updated_at = NOW()
        WHERE order_id = ?
      `, [verified_items, userId, orderId]);

      // Actualizar estado del pedido a listo para reparto
      await query(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['listo_reparto', orderId]
      );

      res.json({
        success: true,
        message: `${unverifiedItems.length} items verificados exitosamente`
      });

    } catch (error) {
      console.error('Error verificando todos los items:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Verificar item por código de barras
  static async verifyItemByBarcode(req, res) {
    try {
      const { orderId } = req.params;
      const { barcode } = req.body;
      const userId = req.user.id;

      if (!barcode || !barcode.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Código de barras es requerido'
        });
      }

      // Log del escaneo
      await query(`
        INSERT INTO barcode_scan_logs (order_id, barcode, user_id, scan_result)
        VALUES (?, ?, ?, 'attempt')
      `, [orderId, barcode, userId]);

      // Buscar el producto por código de barras en el sistema de códigos
      const barcodeProduct = await query(`
        SELECT 
          pb.id as barcode_id,
          pb.product_name,
          pb.barcode,
          pb.internal_code,
          pb.description,
          pv.variant_name,
          pv.variant_value,
          sbm.confidence_score,
          sbm.mapping_type
        FROM product_barcodes pb
        LEFT JOIN product_variants pv ON pb.id = pv.product_barcode_id AND pv.barcode = ?
        LEFT JOIN siigo_barcode_mapping sbm ON pb.id = sbm.barcode_id
        WHERE pb.barcode = ? OR pv.barcode = ?
        ORDER BY sbm.confidence_score DESC
        LIMIT 1
      `, [barcode, barcode, barcode]);

      if (barcodeProduct.length === 0) {
        // Actualizar log
        await query(`
          UPDATE barcode_scan_logs 
          SET scan_result = 'not_found' 
          WHERE order_id = ? AND barcode = ? AND user_id = ? 
          ORDER BY scan_timestamp DESC LIMIT 1
        `, [orderId, barcode, userId]);

        return res.status(404).json({
          success: false,
          message: `❌ Código de barras "${barcode}" no registrado en el sistema`
        });
      }

      const product = barcodeProduct[0];

      // Buscar el item correspondiente en el checklist del pedido usando mapeo inteligente
      const matchedItems = await query(`
        SELECT 
          pc.*,
          oi.product_code,
          oi.name as item_name,
          CASE 
            WHEN pc.item_name = ? THEN 100
            WHEN pc.item_name LIKE ? THEN 90
            WHEN oi.product_code = ? THEN 95
            WHEN pc.item_name LIKE ? THEN 80
            WHEN pc.item_name LIKE ? THEN 70
            ELSE 0
          END as match_score
        FROM packaging_checklists pc
        JOIN order_items oi ON pc.item_id = oi.id
        WHERE pc.order_id = ? 
        AND pc.is_verified = 0
        AND (
          pc.item_name = ? OR
          pc.item_name LIKE ? OR
          oi.product_code = ? OR
          pc.item_name LIKE ? OR
          pc.item_name LIKE ?
        )
        ORDER BY match_score DESC
        LIMIT 1
      `, [
        product.product_name, `%${product.product_name}%`, product.internal_code,
        `%${product.product_name.split(' ')[0]}%`, `%${product.product_name.split(' ')[1] || ''}%`,
        orderId,
        product.product_name, `%${product.product_name}%`, product.internal_code,
        `%${product.product_name.split(' ')[0]}%`, `%${product.product_name.split(' ')[1] || ''}%`
      ]);

      if (matchedItems.length === 0) {
        // Actualizar log
        await query(`
          UPDATE barcode_scan_logs 
          SET scan_result = 'not_found', product_barcode_id = ?
          WHERE order_id = ? AND barcode = ? AND user_id = ? 
          ORDER BY scan_timestamp DESC LIMIT 1
        `, [product.barcode_id, orderId, barcode, userId]);

        return res.status(404).json({
          success: false,
          message: `❌ Producto "${product.product_name}" no está en este pedido`
        });
      }

      const item = matchedItems[0];

      // Verificar si ya está verificado
      if (item.is_verified) {
        // Actualizar log
        await query(`
          UPDATE barcode_scan_logs 
          SET scan_result = 'already_verified', product_barcode_id = ?, product_found = 1
          WHERE order_id = ? AND barcode = ? AND user_id = ? 
          ORDER BY scan_timestamp DESC LIMIT 1
        `, [product.barcode_id, orderId, barcode, userId]);

        return res.status(400).json({
          success: false,
          message: `⚠️ ${item.item_name} ya está verificado`
        });
      }

      // Verificar el item encontrado
      await query(`
        UPDATE packaging_checklists 
        SET 
          packed_quantity = ?,
          packed_weight = ?,
          packed_flavor = ?,
          packed_size = ?,
          verification_notes = ?,
          is_verified = 1,
          packed_by = ?,
          packed_at = NOW(),
          verified_by = ?,
          verified_at = NOW()
        WHERE id = ?
      `, [
        item.required_quantity,
        item.required_weight || null,
        product.variant_value || item.required_flavor || null,
        item.required_size || null,
        `Verificado por código de barras: ${barcode} (${product.match_score || 0}% coincidencia)`,
        userId,
        userId,
        item.id
      ]);

      // Actualizar log como exitoso
      await query(`
        UPDATE barcode_scan_logs 
        SET scan_result = 'success', product_barcode_id = ?, product_found = 1
        WHERE order_id = ? AND barcode = ? AND user_id = ? 
        ORDER BY scan_timestamp DESC LIMIT 1
      `, [product.barcode_id, orderId, barcode, userId]);

      // Actualizar contadores
      const stats = await query(`
        SELECT 
          COUNT(*) as total_items,
          SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_items
        FROM packaging_checklists 
        WHERE order_id = ?
      `, [orderId]);

      const { total_items, verified_items } = stats[0];
      
      await query(`
        UPDATE order_packaging_status 
        SET verified_items = ?, updated_at = NOW()
        WHERE order_id = ?
      `, [verified_items, orderId]);

      // Si todos los items están verificados, marcar como completado
      if (verified_items === total_items) {
        await query(`
          UPDATE order_packaging_status 
          SET 
            packaging_status = 'completed',
            completed_by = ?,
            completed_at = NOW()
          WHERE order_id = ?
        `, [userId, orderId]);

        await query(
          'UPDATE orders SET status = ? WHERE id = ?',
          ['listo_reparto', orderId]
        );
      }

      res.json({
        success: true,
        message: `✅ ${item.item_name} verificado por código de barras`,
        data: {
          item_name: item.item_name,
          product_name: product.product_name,
          barcode: barcode,
          match_score: item.match_score,
          verified_items,
          total_items,
          variant_info: product.variant_name ? `${product.variant_name}: ${product.variant_value}` : null
        }
      });

    } catch (error) {
      console.error('Error verificando por código de barras:', error);
      
      // Log del error
      try {
        await query(`
          UPDATE barcode_scan_logs 
          SET scan_result = 'error'
          WHERE order_id = ? AND barcode = ? AND user_id = ? 
          ORDER BY scan_timestamp DESC LIMIT 1
        `, [req.params.orderId, req.body.barcode, req.user.id]);
      } catch (logError) {
        console.error('Error logging barcode scan error:', logError);
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Estadísticas de empaque
  static async getPackagingStats(req, res) {
    try {
      const stats = await query(`
        SELECT 
          COUNT(CASE WHEN o.status = 'pendiente_empaque' THEN 1 END) as pending_packaging,
          COUNT(CASE WHEN o.status = 'en_empaque' THEN 1 END) as in_packaging,
          COUNT(CASE WHEN o.status = 'listo_reparto' THEN 1 END) as ready_shipping,
          COUNT(CASE WHEN ops.packaging_status = 'requires_review' THEN 1 END) as requires_review
        FROM orders o
        LEFT JOIN order_packaging_status ops ON o.id = ops.order_id
        WHERE o.created_at >= CURDATE()
      `);

      const errorStats = await query(`
        SELECT 
          COUNT(CASE WHEN verification_notes IS NOT NULL AND verification_notes != '' THEN 1 END) as items_with_notes,
          COUNT(CASE WHEN is_verified = 0 THEN 1 END) as unverified_items
        FROM packaging_checklists pc
        JOIN orders o ON pc.order_id = o.id
        WHERE o.created_at >= CURDATE()
      `);

      res.json({
        success: true,
        data: {
          ...stats[0],
          ...errorStats[0]
        }
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = PackagingController;
