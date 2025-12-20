const { query, transaction } = require('../config/database');

/**
 * GET /api/cartera/pending?messengerId=&from=&to=
 * Lista facturas entregadas en efectivo (producto y/o flete) que aún no han sido aceptadas por cartera.
 * - Incluye órdenes entregadas con algún cobro (>0) y sin detalle aceptado en cash_closing_details.
 * - Además incluye pagos registrados en bodega (cash_register) pendientes de aceptación.
 */
const getPendingCashOrders = async (req, res) => {
  try {
    const { messengerId, from, to } = req.query;

    // Bloque 1: entregas por mensajero (flujo actual)
    const whereMessenger = [
      'dt.delivered_at IS NOT NULL',
      '(COALESCE(dt.payment_collected,0) > 0 OR COALESCE(dt.delivery_fee_collected,0) > 0)',
      '(ccd.id IS NULL OR ccd.collection_status <> "collected")',
      "LOWER(COALESCE(o.payment_method,'')) <> 'reposicion'"
    ];
    const paramsMessenger = [];

    if (messengerId) {
      whereMessenger.push('o.assigned_messenger_id = ?');
      paramsMessenger.push(messengerId);
    }
    if (from) {
      whereMessenger.push('dt.delivered_at >= ?');
      paramsMessenger.push(new Date(from).toISOString().slice(0, 19).replace('T', ' '));
    }
    if (to) {
      whereMessenger.push('dt.delivered_at <= ?');
      paramsMessenger.push(new Date(to).toISOString().slice(0, 19).replace('T', ' '));
    }

    const sqlMessenger = `
      SELECT
        o.id AS order_id,
        o.order_number COLLATE utf8mb4_unicode_ci AS order_number,
        o.customer_name COLLATE utf8mb4_unicode_ci AS customer_name,
        o.customer_phone COLLATE utf8mb4_unicode_ci AS customer_phone,
        o.customer_address COLLATE utf8mb4_unicode_ci AS customer_address,
        o.total_amount,
        o.payment_method COLLATE utf8mb4_unicode_ci AS payment_method,
        o.shipping_payment_method COLLATE utf8mb4_unicode_ci AS shipping_payment_method,
        o.assigned_messenger_id AS messenger_id,
        u.full_name COLLATE utf8mb4_unicode_ci AS messenger_name,
        dt.delivered_at,
        o.siigo_invoice_created_at AS invoice_date,
        -- Solo contabilizar efectivo para Cartera
        CASE WHEN LOWER(COALESCE(dt.payment_method,'')) = 'efectivo' THEN COALESCE(dt.payment_collected,0) ELSE 0 END AS product_collected,
        CASE WHEN LOWER(COALESCE(dt.delivery_fee_payment_method,'')) = 'efectivo' THEN COALESCE(dt.delivery_fee_collected,0) ELSE 0 END AS delivery_fee_collected,
        (
          CASE WHEN LOWER(COALESCE(dt.payment_method,'')) = 'efectivo' THEN COALESCE(dt.payment_collected,0) ELSE 0 END
          +
          CASE WHEN LOWER(COALESCE(dt.delivery_fee_payment_method,'')) = 'efectivo' THEN COALESCE(dt.delivery_fee_collected,0) ELSE 0 END
        ) AS expected_amount,
        ccd.id AS detail_id,
        ccd.collected_amount AS declared_amount,
        ccd.collection_status COLLATE utf8mb4_unicode_ci AS collection_status,
        mcc.id AS closing_id,
        mcc.closing_date,
        NULL AS cash_register_id,
        'messenger' COLLATE utf8mb4_unicode_ci AS source
      FROM orders o
      -- Usar SIEMPRE el último registro de tracking por pedido para evitar filas antiguas
      JOIN delivery_tracking dt ON dt.id = (
        SELECT MAX(id) FROM delivery_tracking WHERE order_id = o.id
      )
      LEFT JOIN cash_closing_details ccd ON ccd.order_id = o.id
      LEFT JOIN messenger_cash_closings mcc ON mcc.id = ccd.closing_id
      LEFT JOIN users u ON u.id = o.assigned_messenger_id
      WHERE ${whereMessenger.join(' AND ')}
        AND (
          (LOWER(COALESCE(dt.payment_method,'')) = 'efectivo' AND COALESCE(dt.payment_collected,0) > 0)
          OR
          (LOWER(COALESCE(dt.delivery_fee_payment_method,'')) = 'efectivo' AND COALESCE(dt.delivery_fee_collected,0) > 0)
        )
      ORDER BY dt.delivered_at DESC
      LIMIT 500
    `;

    // Bloque 2: pagos registrados en bodega (cash_register) pendientes de aceptación
    const whereBodega = [
      `(cr.status IS NULL OR cr.status <> 'collected')`,
      "LOWER(COALESCE(o.payment_method,'')) <> 'reposicion'"
    ];
    const paramsBodega = [];

    if (from) {
      whereBodega.push('cr.created_at >= ?');
      paramsBodega.push(new Date(from).toISOString().slice(0, 19).replace('T', ' '));
    }
    if (to) {
      whereBodega.push('cr.created_at <= ?');
      paramsBodega.push(new Date(to).toISOString().slice(0, 19).replace('T', ' '));
    }

    const sqlBodega = `
      SELECT
        o.id AS order_id,
        o.order_number COLLATE utf8mb4_unicode_ci AS order_number,
        o.customer_name COLLATE utf8mb4_unicode_ci AS customer_name,
        o.customer_phone COLLATE utf8mb4_unicode_ci AS customer_phone,
        o.customer_address COLLATE utf8mb4_unicode_ci AS customer_address,
        o.total_amount,
        o.payment_method COLLATE utf8mb4_unicode_ci AS payment_method,
        o.shipping_payment_method COLLATE utf8mb4_unicode_ci AS shipping_payment_method,
        NULL AS messenger_id,
        'Bodega' COLLATE utf8mb4_unicode_ci AS messenger_name,
        cr.created_at AS delivered_at,
        o.siigo_invoice_created_at AS invoice_date,
        0 AS product_collected,
        0 AS delivery_fee_collected,
        COALESCE(cr.amount,0) AS expected_amount,
        NULL AS detail_id,
        COALESCE(cr.accepted_amount,0) AS declared_amount,
        COALESCE(cr.status,'pending') COLLATE utf8mb4_unicode_ci AS collection_status,
        NULL AS closing_id,
        NULL AS closing_date,
        cr.id AS cash_register_id,
        'bodega' COLLATE utf8mb4_unicode_ci AS source
      FROM cash_register cr
      LEFT JOIN orders o ON o.id = cr.order_id
      WHERE ${whereBodega.join(' AND ')}
    `;

    // Bloque 3: Pedidos POS (Entregados en caja, pago efectivo, sin delivery_tracking ni cash_register aún)
    const wherePOS = [
      "o.status = 'entregado'",
      "o.payment_method = 'efectivo'",
      "o.delivery_method = 'recoge_bodega'",
      "(ccd.id IS NULL OR ccd.collection_status <> 'collected')",
      "cr.id IS NULL"
    ];
    const paramsPOS = [];

    if (from) {
      wherePOS.push('o.delivered_at >= ?');
      paramsPOS.push(new Date(from).toISOString().slice(0, 19).replace('T', ' '));
    }
    if (to) {
      wherePOS.push('o.delivered_at <= ?');
      paramsPOS.push(new Date(to).toISOString().slice(0, 19).replace('T', ' '));
    }

    const sqlPOS = `
      SELECT
        o.id AS order_id,
        o.order_number COLLATE utf8mb4_unicode_ci AS order_number,
        o.customer_name COLLATE utf8mb4_unicode_ci AS customer_name,
        o.customer_phone COLLATE utf8mb4_unicode_ci AS customer_phone,
        o.customer_address COLLATE utf8mb4_unicode_ci AS customer_address,
        o.total_amount,
        o.payment_method COLLATE utf8mb4_unicode_ci AS payment_method,
        o.shipping_payment_method COLLATE utf8mb4_unicode_ci AS shipping_payment_method,
        NULL AS messenger_id,
        'Caja POS' COLLATE utf8mb4_unicode_ci AS messenger_name,
        o.delivered_at,
        o.siigo_invoice_created_at AS invoice_date,
        o.total_amount AS product_collected,
        0 AS delivery_fee_collected,
        o.total_amount AS expected_amount,
        ccd.id AS detail_id,
        ccd.collected_amount AS declared_amount,
        ccd.collection_status COLLATE utf8mb4_unicode_ci AS collection_status,
        NULL AS closing_id,
        NULL AS closing_date,
        NULL AS cash_register_id,
        'bodega_eligible' COLLATE utf8mb4_unicode_ci AS source
      FROM orders o
      LEFT JOIN cash_closing_details ccd ON ccd.order_id = o.id
      LEFT JOIN cash_register cr ON cr.order_id = o.id
      WHERE ${wherePOS.join(' AND ')}
    `;

    // Bloque 4: Pagos Adhoc (recibos manuales de mensajero)
    const whereAdhoc = ["status = 'pending'"];
    const paramsAdhoc = [];
    if (messengerId) {
      whereAdhoc.push('messenger_id = ?');
      paramsAdhoc.push(messengerId);
    }
    if (from) {
      whereAdhoc.push('created_at >= ?');
      paramsAdhoc.push(new Date(from).toISOString().slice(0, 19).replace('T', ' '));
    }
    if (to) {
      whereAdhoc.push('created_at <= ?');
      paramsAdhoc.push(new Date(to).toISOString().slice(0, 19).replace('T', ' '));
    }

    const sqlAdhoc = `
      SELECT
        CONCAT('adhoc-', map.id) AS order_id,
        CONCAT('Recaudo #', map.id) COLLATE utf8mb4_unicode_ci AS order_number,
        map.description COLLATE utf8mb4_unicode_ci AS customer_name,
        NULL AS customer_phone,
        NULL AS customer_address,
        map.amount AS total_amount,
        'efectivo' COLLATE utf8mb4_unicode_ci AS payment_method,
        NULL AS shipping_payment_method,
        map.messenger_id,
        u.full_name COLLATE utf8mb4_unicode_ci AS messenger_name,
        map.created_at AS delivered_at,
        NULL AS invoice_date,
        map.amount AS product_collected,
        0 AS delivery_fee_collected,
        map.amount AS expected_amount,
        NULL AS detail_id,
        0 AS declared_amount,
        'pending' COLLATE utf8mb4_unicode_ci AS collection_status,
        NULL AS closing_id,
        NULL AS closing_date,
        NULL AS cash_register_id,
        'messenger_adhoc' COLLATE utf8mb4_unicode_ci AS source
      FROM messenger_adhoc_payments map
      JOIN users u ON u.id = map.messenger_id
      WHERE ${whereAdhoc.join(' AND ')}
    `;

    let finalSql, finalParams;

    if (messengerId) {
      // Si hay filtro de mensajero, SOLO ejecutamos sqlMessenger y sqlAdhoc
      finalSql = `(${sqlMessenger}) UNION ALL (${sqlAdhoc}) ORDER BY delivered_at DESC LIMIT 500`;
      finalParams = [...paramsMessenger, ...paramsAdhoc];
    } else {
      // Si no hay filtro de mensajero, traemos TODO (Mensajeros + Bodega + POS + Adhoc)
      finalSql = `(${sqlMessenger}) UNION ALL (${sqlBodega}) UNION ALL (${sqlPOS}) UNION ALL (${sqlAdhoc}) ORDER BY delivered_at DESC LIMIT 500`;
      finalParams = [...paramsMessenger, ...paramsBodega, ...paramsPOS, ...paramsAdhoc];
    }

    const rows = await query(finalSql, finalParams);
    res.json(rows);

  } catch (error) {
    console.error('Error obteniendo pendientes de cartera:', error);
    res.status(500).json({ message: 'Error al obtener pendientes' });
  }
};

/**
 * GET /api/cartera/handovers?status=&messengerId=&from=&to=
 * Lista actas de entrega (cierres de caja) por mensajero y consolidados diarios de bodega.
 */
const getHandovers = async (req, res) => {
  try {
    const { status, messengerId, from, to } = req.query;

    // Actas por mensajero (sistema existente)
    const where = ['1=1'];
    const params = [];

    if (status) {
      where.push('mcc.status = ?');
      params.push(status);
    }
    if (messengerId) {
      where.push('mcc.messenger_id = ?');
      params.push(messengerId);
    }
    if (from) {
      where.push('mcc.closing_date >= ?');
      params.push(from.slice(0, 10));
    }
    if (to) {
      where.push('mcc.closing_date <= ?');
      params.push(to.slice(0, 10));
    }

    const messengerRows = await query(
      `
      SELECT 
        mcc.id,
        mcc.messenger_id,
        u.full_name AS messenger_name,
        mcc.closing_date,
        mcc.expected_amount,
        mcc.declared_amount,
        mcc.difference_amount,
        mcc.status,
        mcc.approved_by,
        ua.full_name AS approved_by_name,
        mcc.approved_at,
        mcc.created_at,
        mcc.updated_at,
        (SELECT COUNT(*) FROM cash_closing_details d WHERE d.closing_id = mcc.id) AS items_count,
        (SELECT SUM(CASE WHEN d.collection_status = 'collected' THEN 1 ELSE 0 END) FROM cash_closing_details d WHERE d.closing_id = mcc.id) AS items_collected,
        'messenger' AS source
      FROM messenger_cash_closings mcc
      JOIN users u ON u.id = mcc.messenger_id
      LEFT JOIN users ua ON ua.id = mcc.approved_by
      WHERE ${where.join(' AND ')}
      ORDER BY mcc.closing_date DESC, mcc.id DESC
      LIMIT 500
      `,
      params
    );

    // "Actas" diarias de bodega (agregación de registros aceptados en cash_register)
    const whereBodega = ['cr.status = "collected"'];
    const paramsBodega = [];
    if (from) {
      whereBodega.push('DATE(cr.accepted_at) >= ?');
      paramsBodega.push(from.slice(0, 10));
    }
    if (to) {
      whereBodega.push('DATE(cr.accepted_at) <= ?');
      paramsBodega.push(to.slice(0, 10));
    }

    const bodegaRows = await query(
      `
      SELECT
        -- Identificador único por día y origen
        -(UNIX_TIMESTAMP(DATE(cr.accepted_at)) + CASE WHEN LOWER(COALESCE(ua.role,''))='logistica' THEN 1 ELSE 2 END) AS id,
        NULL AS messenger_id,
        CASE WHEN LOWER(COALESCE(ua.role,''))='logistica' THEN 'Bodega - Logística' ELSE 'Bodega - Cartera' END AS messenger_name,
        DATE(cr.accepted_at) AS closing_date,
        SUM(COALESCE(cr.accepted_amount, cr.amount)) AS expected_amount,
        SUM(COALESCE(cr.accepted_amount, cr.amount)) AS declared_amount,
        0 AS difference_amount,
        'completed' AS status,
        NULL AS approved_by,
        NULL AS approved_by_name,
        MAX(cr.accepted_at) AS approved_at,
        MIN(cr.created_at) AS created_at,
        MAX(cr.accepted_at) AS updated_at,
        COUNT(*) AS items_count,
        COUNT(*) AS items_collected,
        CASE WHEN LOWER(COALESCE(ua.role,''))='logistica' THEN 'bodega_logistica' ELSE 'bodega_cartera' END AS source
      FROM cash_register cr
      LEFT JOIN users ur ON ur.id = cr.registered_by
      LEFT JOIN users ua ON ua.id = cr.accepted_by
      WHERE ${whereBodega.join(' AND ')}
      GROUP BY DATE(cr.accepted_at), CASE WHEN LOWER(COALESCE(ua.role,''))='logistica' THEN 'logistica' ELSE 'cartera' END
      ORDER BY DATE(cr.accepted_at) DESC
      LIMIT 500
      `,
      paramsBodega
    );

    // Unir resultados priorizando fechas más recientes
    const all = [...messengerRows, ...bodegaRows].sort((a, b) => {
      const da = a.closing_date ? new Date(a.closing_date).getTime() : 0;
      const db = b.closing_date ? new Date(b.closing_date).getTime() : 0;
      return db - da;
    });

    return res.json({ success: true, data: all });
  } catch (error) {
    console.error('Error listando actas de entrega:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * GET /api/cartera/handovers/:id
 * Detalle de un acta de entrega (cierres con ítems por factura)
 */
const getHandoverDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const headerRows = await query(
      `
      SELECT 
        mcc.id,
        mcc.messenger_id,
        u.full_name AS messenger_name,
        mcc.closing_date,
        mcc.expected_amount,
        mcc.declared_amount,
        mcc.difference_amount,
        mcc.status,
        mcc.approved_by,
        ua.full_name AS approved_by_name,
        mcc.approved_at,
        mcc.created_at,
        mcc.updated_at
      FROM messenger_cash_closings mcc
      JOIN users u ON u.id = mcc.messenger_id
      LEFT JOIN users ua ON ua.id = mcc.approved_by
      WHERE mcc.id = ?
      `,
      [id]
    );

    if (!headerRows.length) {
      return res.status(404).json({ success: false, message: 'Acta no encontrada' });
    }

    const items = await query(
      `
      SELECT
        d.id AS detail_id,
        d.order_id,
        o.order_number,
        o.customer_name,
        o.siigo_invoice_created_at AS invoice_date,
        o.total_amount,
        d.payment_method,
        d.order_amount AS expected_amount,
        d.collected_amount AS declared_amount,
        d.collection_status,
        d.collected_at,
        d.collection_notes,
        mcc.approved_by AS accepted_by,
        ua.full_name AS accepted_by_name
      FROM cash_closing_details d
      JOIN orders o ON o.id = d.order_id
      LEFT JOIN messenger_cash_closings mcc ON mcc.id = d.closing_id
      LEFT JOIN users ua ON ua.id = mcc.approved_by
      WHERE d.closing_id = ?
      ORDER BY d.id ASC
      `,
      [id]
    );

    return res.json({
      success: true,
      data: {
        handover: headerRows[0],
        items
      }
    });
  } catch (error) {
    console.error('Error obteniendo detalle de acta:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * POST /api/cartera/handovers/:id/close
 * Cierra el acta: calcula agregados y marca status = 'completed' si todo aceptado, de lo contrario 'discrepancy'
 */
const closeHandover = async (req, res) => {
  try {
    const { id } = req.params;
    const approverId = req.user.id;

    const [agg] = await query(
      `
      SELECT 
        SUM(order_amount) AS expected_amount,
        SUM(collected_amount) AS declared_amount,
        SUM(CASE WHEN collection_status = 'collected' THEN 1 ELSE 0 END) AS accepted_count,
        COUNT(*) AS total_count
      FROM cash_closing_details
      WHERE closing_id = ?
      `,
      [id]
    );

    if (!agg || agg.total_count === 0) {
      return res.status(400).json({ success: false, message: 'El acta no tiene ítems registrados' });
    }

    const expected = Number(agg.expected_amount || 0);
    const declared = Number(agg.declared_amount || 0);
    const allAccepted = Number(agg.accepted_count || 0) === Number(agg.total_count || 0);

    const newStatus = allAccepted ? 'completed' : 'discrepancy';

    await query(
      `
      UPDATE messenger_cash_closings
      SET status = ?, approved_by = ?, approved_at = NOW(),
          expected_amount = ?, declared_amount = ?
      WHERE id = ?
      `,
      [newStatus, approverId, expected, declared, id]
    );

    return res.json({
      success: true,
      message: `Acta cerrada con estado "${newStatus}"`,
      data: { id, status: newStatus, expected_amount: expected, declared_amount: declared }
    });
  } catch (error) {
    console.error('Error cerrando acta de entrega:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * GET /api/cartera/handovers/:id/receipt
 * Genera un HTML imprimible como comprobante del acta.
 */
const getHandoverReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const headerRows = await query(
      `
      SELECT 
        mcc.id,
        mcc.messenger_id,
        u.full_name AS messenger_name,
        mcc.closing_date,
        mcc.expected_amount,
        mcc.declared_amount,
        mcc.difference_amount,
        mcc.status,
        mcc.approved_by,
        ua.full_name AS approved_by_name,
        mcc.approved_at,
        mcc.created_at
      FROM messenger_cash_closings mcc
      JOIN users u ON u.id = mcc.messenger_id
      LEFT JOIN users ua ON ua.id = mcc.approved_by
      WHERE mcc.id = ?
      `,
      [id]
    );

    if (!headerRows.length) {
      return res.status(404).send('Acta no encontrada');
    }
    const h = headerRows[0];

    const items = await query(
      `
      SELECT
        d.order_id,
        o.order_number,
        o.customer_name,
        d.order_amount AS expected_amount,
        d.collected_amount AS declared_amount,
        d.collection_status,
        d.collected_at
      FROM cash_closing_details d
      JOIN orders o ON o.id = d.order_id
      WHERE d.closing_id = ?
      ORDER BY d.id ASC
      `,
      [id]
    );

    const fmt = (n) => (Number(n || 0)).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    const dateStr = (d) => d ? new Date(d).toLocaleString('es-CO') : '-';

    const rowsHtml = items.map(it => `
      <tr>
        <td>${it.order_number}</td>
        <td>${it.customer_name}</td>
        <td class="num">${fmt(it.expected_amount)}</td>
        <td class="num">${fmt(it.declared_amount)}</td>
        <td>${it.collection_status || '-'}</td>
        <td>${dateStr(it.collected_at)}</td>
      </tr>
    `).join('');

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8"/>
        <title>Recibo Acta #${h.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
          h1 { font-size: 18px; margin: 0 0 6px; }
          .meta { font-size: 12px; color: #374151; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
          th { background: #f9fafb; text-align: left; }
          .num { text-align: right; }
          .summary { margin-top: 12px; font-size: 14px; }
          .footer { margin-top: 24px; display: flex; gap: 40px; }
          .sign { width: 45%; border-top: 1px solid #111827; padding-top: 8px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Recibo de Entrega de Efectivo - Acta #${h.id}</h1>
        <div class="meta">
          Mensajero: <strong>${h.messenger_name} (ID ${h.messenger_id})</strong><br/>
          Fecha de cierre: <strong>${h.closing_date}</strong><br/>
          Estado: <strong>${h.status}</strong><br/>
          Aprobado por: <strong>${h.approved_by_name || '-'}</strong> el ${h.approved_at ? dateStr(h.approved_at) : '-'}
        </div>

        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Cliente</th>
              <th class="num">Esperado</th>
              <th class="num">Declarado/Aceptado</th>
              <th>Estado</th>
              <th>Fecha aceptación</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="summary">
          Total esperado: <strong>${fmt(h.expected_amount)}</strong><br/>
          Total declarado: <strong>${fmt(h.declared_amount)}</strong><br/>
          Diferencia: <strong>${fmt(h.difference_amount)}</strong>
        </div>

        <div class="footer">
          <div class="sign">Firma Mensajero</div>
          <div class="sign">Firma Cartera</div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Error generando recibo de acta:', error);
    return res.status(500).send('Error interno del servidor');
  }
};

/**
 * POST /api/cartera/cash-register/:id/accept
 * Acepta una entrada de caja de bodega (marca como collected).
 */
const acceptCashRegister = async (req, res) => {
  try {
    const { id } = req.params;
    const approverId = req.user?.id;

    const rows = await query('SELECT id, order_id, amount, status FROM cash_register WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Registro de caja no encontrado' });
    }
    const cr = rows[0];
    if (cr.status === 'collected') {
      return res.json({ success: true, message: 'Registro ya aceptado previamente' });
    }

    await query(
      `UPDATE cash_register
         SET status = 'collected',
             accepted_by = ?,
             accepted_at = NOW(),
             accepted_amount = COALESCE(accepted_amount, amount)
       WHERE id = ?`,
      [approverId || null, id]
    );

    return res.json({ success: true, message: 'Pago en bodega aceptado', data: { id } });
  } catch (error) {
    console.error('Error aceptando registro de caja:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * GET /api/cartera/cash-register/:id/receipt
 * Recibo HTML imprimible de la aceptación de bodega.
 */
const getCashRegisterReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT 
         cr.id, cr.order_id, cr.amount, cr.payment_method, cr.delivery_method, cr.created_at,
         cr.accepted_by, cr.accepted_at, cr.accepted_amount, cr.status, cr.notes,
         o.order_number, o.customer_name, o.total_amount
       FROM cash_register cr
       JOIN orders o ON o.id = cr.order_id
       WHERE cr.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).send('Registro no encontrado');
    const r = rows[0];

    const cashierRows = r.accepted_by ? await query('SELECT full_name, username FROM users WHERE id = ?', [r.accepted_by]) : [];
    const cashier = cashierRows.length ? (cashierRows[0].full_name || cashierRows[0].username) : '-';

    const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    const dateStr = (d) => (d ? new Date(d).toLocaleString('es-CO') : '-');

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8"/>
        <title>Recibo Pago en Bodega #\${r.id} - \${r.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
          h1 { font-size: 18px; margin: 0 0 6px; }
          .meta { font-size: 12px; color: #374151; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
          th { background: #f9fafb; text-align: left; }
          .num { text-align: right; }
          .footer { margin-top: 24px; display: flex; gap: 40px; }
          .sign { width: 45%; border-top: 1px solid #111827; padding-top: 8px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Recibo de Pago en Bodega</h1>
        <div class="meta">
          Factura: <strong>\${r.order_number}</strong><br/>
          Cliente: <strong>\${r.customer_name}</strong><br/>
          Fecha de registro: <strong>\${dateStr(r.created_at)}</strong><br/>
          Estado: <strong>\${r.status}</strong><br/>
          Aceptado por: <strong>\${cashier}</strong> el \${dateStr(r.accepted_at)}
        </div>
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th class="num">Monto</th>
              <th>Método</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pago recibido en bodega</td>
              <td class="num">\${fmt(r.accepted_amount || r.amount)}</td>
              <td>\${(r.payment_method || 'efectivo').toUpperCase()}</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          <div class="sign">Firma Cliente</div>
          <div class="sign">Firma Cartera</div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Error generando recibo de bodega:', error);
    return res.status(500).send('Error interno del servidor');
  }
};

/**
 * GET /api/cartera/handovers/bodega/:date
 * Detalle por día de registros aceptados en bodega (YYYY-MM-DD)
 */
const getBodegaHandoverDetails = async (req, res) => {
  try {
    const { date } = req.params; // 'YYYY-MM-DD'
    const origin = String(req.query.origin || '').toLowerCase(); // 'logistica' | 'cartera' | ''
    const originFilter = origin === 'logistica' ? " AND LOWER(COALESCE(ua.role,''))='logistica'" : (origin === 'cartera' ? " AND LOWER(COALESCE(ua.role,''))<>'logistica'" : '');
    // Items del día (con filtro por origen si aplica)
    const items = await query(
      `
      SELECT
        cr.id AS detail_id,
        cr.order_id,
        o.order_number,
        o.customer_name,
        o.siigo_invoice_created_at AS invoice_date,
        o.total_amount,
        cr.payment_method,
        COALESCE(cr.amount,0) AS expected_amount,
        COALESCE(cr.accepted_amount, cr.amount) AS declared_amount,
        COALESCE(cr.status,'pending') AS collection_status,
        cr.accepted_at AS collected_at,
        cr.accepted_by,
        COALESCE(ua.full_name, ua.username) AS accepted_by_name,
        ua.role AS accepted_by_role,
        COALESCE(ur.role,'') AS registered_by_role,
        COALESCE(ur.full_name, ur.username) AS registered_by_name
      FROM cash_register cr
      JOIN orders o ON o.id = cr.order_id
      LEFT JOIN users ua ON ua.id = cr.accepted_by
      LEFT JOIN users ur ON ur.id = cr.registered_by
      WHERE DATE(cr.accepted_at) = ? AND cr.status = 'collected'${originFilter}
      ORDER BY cr.accepted_at ASC
      `,
      [date]
    );

    const expected = items.reduce((sum, it) => sum + Number(it.expected_amount || 0), 0);
    const declared = items.reduce((sum, it) => sum + Number(it.declared_amount || 0), 0);

    const header = {
      id: -Math.floor(new Date(`${date} 00:00:00`).getTime() / 1000) + (origin === 'logistica' ? 1 : origin === 'cartera' ? 2 : 0),
      messenger_id: null,
      messenger_name: origin === 'logistica' ? 'Bodega - Logística' : (origin === 'cartera' ? 'Bodega - Cartera' : 'Bodega'),
      closing_date: date,
      expected_amount: expected,
      declared_amount: declared,
      difference_amount: declared - expected,
      status: 'completed',
      approved_by: null,
      approved_by_name: null,
      approved_at: null,
      created_at: null,
      updated_at: null,
      origin
    };

    return res.json({ success: true, data: { handover: header, items } });
  } catch (error) {
    console.error('Error obteniendo detalle de bodega por día:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * GET /api/cartera/handovers/bodega/:date/receipt
 * Recibo imprimible del consolidado de bodega por día.
 */
const getBodegaHandoverReceipt = async (req, res) => {
  try {
    const { date } = req.params;
    const origin = String(req.query.origin || '').toLowerCase();
    const originFilter = origin === 'logistica' ? " AND LOWER(COALESCE(ua.role,''))='logistica'" : (origin === 'cartera' ? " AND LOWER(COALESCE(ua.role,''))<>'logistica'" : '');
    const rows = await query(
      `
      SELECT
        cr.id,
        cr.order_id,
        o.order_number,
        o.customer_name,
        COALESCE(cr.amount,0) AS expected_amount,
        COALESCE(cr.accepted_amount, cr.amount) AS declared_amount,
        COALESCE(cr.status,'pending') AS collection_status,
        cr.accepted_at
      FROM cash_register cr
      JOIN orders o ON o.id = cr.order_id
      LEFT JOIN users ur ON ur.id = cr.registered_by
      LEFT JOIN users ua ON ua.id = cr.accepted_by
      WHERE DATE(cr.accepted_at) = ? AND cr.status = 'collected'${originFilter}
      ORDER BY cr.accepted_at ASC
      `,
      [date]
    );

    const expected = rows.reduce((s, r) => s + Number(r.expected_amount || 0), 0);
    const declared = rows.reduce((s, r) => s + Number(r.declared_amount || 0), 0);
    const fmt = (n) => (Number(n || 0)).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    const dateStr = (d) => d ? new Date(d).toLocaleString('es-CO') : '-';

    const rowsHtml = rows.map(it => `
      <tr>
        <td>${it.order_number}</td>
        <td>${it.customer_name}</td>
        <td class="num">${fmt(it.expected_amount)}</td>
        <td class="num">${fmt(it.declared_amount)}</td>
        <td>${it.collection_status || '-'}</td>
        <td>${dateStr(it.accepted_at)}</td>
      </tr>
    `).join('');

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8"/>
        <title>Recibo Bodega - ${date}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
          h1 { font-size: 18px; margin: 0 0 6px; }
          .meta { font-size: 12px; color: #374151; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
          th { background: #f9fafb; text-align: left; }
          .num { text-align: right; }
          .summary { margin-top: 12px; font-size: 14px; }
          .footer { margin-top: 24px; display: flex; gap: 40px; }
          .sign { width: 45%; border-top: 1px solid #111827; padding-top: 8px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Recibo Consolidado - Bodega</h1>
        <div class="meta">
          Fecha: <strong>${date}</strong><br/>
          Origen: <strong>Bodega</strong>
        </div>

        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Cliente</th>
              <th class="num">Esperado</th>
              <th class="num">Declarado/Aceptado</th>
              <th>Estado</th>
              <th>Fecha aceptación</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6">Sin items</td></tr>'}
          </tbody>
        </table>

        <div class="summary">
          Total esperado: <strong>${fmt(expected)}</strong><br/>
          Total declarado: <strong>${fmt(declared)}</strong><br/>
          Diferencia: <strong>${fmt(declared - expected)}</strong>
        </div>

        <div class="footer">
          <div class="sign">Firma Bodega</div>
          <div class="sign">Firma Cartera</div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Error generando recibo de bodega por día:', error);
    return res.status(500).send('Error interno del servidor');
  }
};

/**
 * POST /api/cartera/orders/:id/return-to-billing
 * Devuelve un pedido a Facturación para corrección de forma de pago/envío.
 * Reglas:
 *  - Solo roles: cartera, admin
 *  - Solo si el pedido está en 'revision_cartera'
 *  - No debe tener cobros aceptados (cash_register.status = 'collected' o cash_closing_details.collection_status = 'collected')
 *  - No debe estar entregado (delivery_tracking.delivered_at)
 * Auditoría:
 *  - Inserta en orders_audit con action = 'RETURN_TO_BILLING' y motivo en customer_name
 */
const returnToBilling = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, cleanFlags } = req.body || {};
    const userId = req.user?.id || null;

    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Debes especificar un motivo (mínimo 3 caracteres)' });
    }

    // 1) Cargar pedido y validar estado
    const rows = await query(
      `SELECT id, order_number, status, siigo_invoice_number, validation_status, validation_notes
       FROM orders WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const order = rows[0];

    if (order.status !== 'revision_cartera') {
      return res.status(400).json({
        success: false,
        message: `Solo se pueden devolver pedidos en 'revision_cartera'. Estado actual: '${order.status}'`
      });
    }

    // 2) Validaciones de bloqueo
    const [hasCollectedCR] = await query(
      `SELECT 1 AS ok FROM cash_register WHERE order_id = ? AND status = 'collected' LIMIT 1`,
      [id]
    );
    if (hasCollectedCR && hasCollectedCR.ok === 1) {
      return res.status(400).json({
        success: false,
        message: 'No se puede devolver: el pedido tiene pago aceptado en bodega'
      });
    }

    const [hasCollectedCCD] = await query(
      `SELECT 1 AS ok FROM cash_closing_details WHERE order_id = ? AND collection_status = 'collected' LIMIT 1`,
      [id]
    );
    if (hasCollectedCCD && hasCollectedCCD.ok === 1) {
      return res.status(400).json({
        success: false,
        message: 'No se puede devolver: el pedido tiene cobro aceptado en cierre de mensajero'
      });
    }

    const [trk] = await query(
      `SELECT delivered_at FROM delivery_tracking WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [id]
    );
    if (trk && trk.delivered_at) {
      return res.status(400).json({
        success: false,
        message: 'No se puede devolver: el pedido ya fue entregado'
      });
    }

    // 3) Transacción: auditoría + actualización
    await transaction(async (connection) => {
      // Auditoría: usar patrón similar a SPECIAL_MANAGED
      try {
        await connection.execute(
          `INSERT INTO orders_audit (order_id, action, siigo_invoice_number, customer_name, user_id, created_at)
           VALUES (?, 'RETURN_TO_BILLING', ?, ?, ?, NOW())`,
          [id, order.siigo_invoice_number || null, String(reason).trim(), userId]
        );
      } catch (e) {
        console.warn('orders_audit insert error (RETURN_TO_BILLING):', e.message);
      }

      // Limpieza mínima de banderas de Cartera. No tocar payment_method/delivery_method.
      const setParts = [
        `status = 'pendiente_por_facturacion'`,
        `validation_status = NULL`,
        `validation_notes = NULL`,
        `updated_at = NOW()`
      ];

      // Limpieza opcional (si se solicita explícitamente)
      if (cleanFlags === true) {
        setParts.push(`requires_payment = NULL`);
        setParts.push(`paid_amount = NULL`);
        setParts.push(`siigo_payment_info = NULL`);
      }

      await connection.execute(
        `UPDATE orders SET ${setParts.join(', ')} WHERE id = ?`,
        [id]
      );
    });

    // Emitir evento tiempo real si está disponible
    try {
      if (global.io) {
        const payload = {
          orderId: Number(id),
          order_number: order.order_number,
          from_status: 'revision_cartera',
          to_status: 'pendiente_por_facturacion',
          changed_by_role: req.user?.role || null,
          timestamp: new Date().toISOString()
        };
        global.io.to('orders-updates').emit('order-status-changed', payload);
        console.log('📡 Emitido order-status-changed (return-to-billing):', payload);
      }
    } catch (emitErr) {
      console.error('⚠️  Error emitiendo evento order-status-changed:', emitErr.message);
    }

    return res.json({
      success: true,
      message: 'Pedido devuelto a Facturación para corrección',
      data: { id: Number(id), from_status: 'revision_cartera', to_status: 'pendiente_por_facturacion' }
    });
  } catch (error) {
    console.error('Error devolviendo pedido a facturación:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * POST /api/cartera/orders/:id/close-siigo
 * Marca el pedido como CERRADO EN SIIGO (marcado interno por ahora).
 * Reglas:
 *  - Solo roles: cartera, admin
 *  - Requiere body.method en {'efectivo','transferencia'} (obligatorio)
 *  - Si ya está cerrado, responde 409 sin cambios
 * Auditoría:
 *  - Inserta en orders_audit con action = 'SIIGO_CLOSED' y motivo (note) en customer_name
 */
const closeOrderInSiigo = async (req, res) => {
  try {
    const { id } = req.params;
    const { method, note, tags } = req.body || {};
    const userId = req.user?.id || null;

    // Guardar nuevos tags en la tabla global
    if (Array.isArray(tags) && tags.length > 0) {
      for (const tagName of tags) {
        if (tagName && typeof tagName === 'string' && tagName.trim()) {
          try {
            await query('INSERT IGNORE INTO tags (name) VALUES (?)', [tagName.trim()]);
          } catch (e) {
            // Ignorar errores de duplicados u otros
            console.warn('Error guardando tag:', tagName, e.message);
          }
        }
      }
    }

    const allowed = new Set(['efectivo', 'transferencia', 'mercadopago', 'credito', 'reposicion', 'otros', 'pago_electronico', 'contraentrega', 'publicidad']);
    const normalizedMethod = String(method || '').toLowerCase().trim();

    if (!allowed.has(normalizedMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Método de cierre en Siigo inválido. Opciones: efectivo, transferencia, credito, reposicion, otros.'
      });
    }

    // Verificar existencia de pedido y estado de cierre
    const rows = await query(
      'SELECT id, order_number, siigo_closed, siigo_invoice_number FROM orders WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const order = rows[0];

    if (Number(order.siigo_closed || 0) === 1) {
      return res.status(409).json({
        success: false,
        message: 'El pedido ya está marcado como cerrado en Siigo'
      });
    }

    // Marcar cierre interno
    await transaction(async (connection) => {
      await connection.execute(
        `UPDATE orders
           SET siigo_closed = 1,
               siigo_closed_at = NOW(),
               siigo_closed_by = ?,
               siigo_closure_method = ?,
               siigo_closure_note = ?,
               tags = ?,
               updated_at = NOW()
         WHERE id = ?`,
        [userId || null, normalizedMethod, note || null, tags ? JSON.stringify(tags) : null, id]
      );

      // Auditoría
      try {
        await connection.execute(
          `INSERT INTO orders_audit (order_id, action, siigo_invoice_number, customer_name, user_id, created_at)
           VALUES (?, 'SIIGO_CLOSED', ?, ?, ?, NOW())`,
          [id, order.siigo_invoice_number || null, String(note || `Cierre en Siigo (${normalizedMethod})`).trim(), userId]
        );
      } catch (e) {
        console.warn('orders_audit insert error (SIIGO_CLOSED):', e.message);
      }
    });

    // Integración futura opcional con API de Siigo (flag via env)
    try {
      if (String(process.env.SIIGO_CLOSE_WITH_API || '').toLowerCase() === 'true') {
        // TODO: implementar llamada real a la API de Siigo (stub)
        console.log('ℹ️ SIIGO_CLOSE_WITH_API=true -> ejecutar integración real aquí (stub)');
      }
    } catch (e) {
      console.warn('⚠️ Error en stub de integración SIIGO_CLOSE_WITH_API:', e.message);
    }

    // Emitir evento en tiempo real para clientes suscritos (indicador visual)
    try {
      if (global.io) {
        const payload = {
          orderId: Number(id),
          order_number: order.order_number,
          event: 'siigo_closed',
          method: normalizedMethod,
          closed_by: userId || null,
          closed_at: new Date().toISOString()
        };
        global.io.to('orders-updates').emit('order-siigo-closed', payload);
        console.log('📡 Emitido order-siigo-closed:', payload);
      }
    } catch (emitErr) {
      console.error('⚠️  Error emitiendo evento order-siigo-closed:', emitErr.message);
    }

    return res.json({
      success: true,
      message: 'Pedido marcado como cerrado en Siigo',
      data: { id: Number(id), method: normalizedMethod }
    });
  } catch (error) {
    console.error('Error cerrando en Siigo:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Listado de pedidos que ya fueron enviados a logística (o posteriores) y aún NO están cerrados en Siigo
// GET /api/cartera/pending-siigo-close?search=&from=&to=&limit=
const getPendingSiigoClose = async (req, res) => {
  try {
    const { search, from, to, limit = 200 } = req.query;

    const where = [
      'o.deleted_at IS NULL',
      '(o.siigo_closed IS NULL OR o.siigo_closed = 0)'
    ];
    const params = [];

    // Estados posteriores a Cartera (excluir 'revision_cartera')
    const eligible = [
      'en_logistica', 'pendiente_empaque', 'en_preparacion', 'en_empaque',
      'empacado', 'listo', 'listo_para_entrega', 'en_reparto',
      'entregado_transportadora', 'entregado_cliente', 'entregado_bodega', 'entregado',
      'gestion_especial', 'cancelado'
    ];
    where.push(`o.status IN (${eligible.map(() => '?').join(',')})`);
    params.push(...eligible);

    if (from) {
      where.push('DATE(COALESCE(o.siigo_invoice_created_at, o.created_at)) >= ?');
      params.push(from);
    }
    if (to) {
      where.push('DATE(COALESCE(o.siigo_invoice_created_at, o.created_at)) <= ?');
      params.push(to);
    }
    if (search) {
      where.push('(o.order_number LIKE ? OR o.customer_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s);
    }

    const rows = await query(
      `
      SELECT 
        o.id, o.order_number, o.customer_name, o.status,
        -- Datos de entrega para mostrar canal en Cartera
        o.delivery_method,
        o.assigned_messenger_id,
        messenger.full_name AS messenger_name,
        o.carrier_id,
        c.name AS carrier_name,
        -- Pago
        o.payment_method,
        -- Canal de entrega legible
        CASE 
          WHEN LOWER(COALESCE(o.delivery_method,'')) IN ('recoge_bodega','recogida_tienda') THEN 'Bodega'
          WHEN o.carrier_id IS NOT NULL THEN COALESCE(c.name,'Transportadora')
          WHEN o.assigned_messenger_id IS NOT NULL THEN CONCAT('Mensajero: ', COALESCE(messenger.full_name, CONCAT('ID ', o.assigned_messenger_id)))
          ELSE NULL
        END AS delivery_channel,
        -- Datos SIIGO
        o.siigo_invoice_id, o.siigo_invoice_number, o.siigo_invoice_created_at,
        o.siigo_closed, o.siigo_closed_at, o.siigo_closure_method,
        o.siigo_closed, o.siigo_closed_at, o.siigo_closure_method,
        o.payment_evidence_path, 
        (SELECT JSON_ARRAYAGG(pe.file_path) FROM payment_evidences pe WHERE pe.order_id = o.id) as additional_evidences,
        (SELECT JSON_ARRAYAGG(wv.payment_proof_image) FROM wallet_validations wv WHERE wv.order_id = o.id AND wv.payment_proof_image IS NOT NULL) as wallet_evidences,
        o.tags, o.electronic_payment_type, o.is_service
      FROM orders o
      LEFT JOIN carriers c ON o.carrier_id = c.id
      LEFT JOIN users messenger ON o.assigned_messenger_id = messenger.id
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(o.siigo_invoice_created_at, o.created_at) DESC, o.id DESC
      LIMIT ${Number(limit) || 200}
      `,
      params
    );

    // Procesar filas para combinar evidencias
    const processedRows = rows.map(row => {
      let evidences = [];

      // 1. Evidencia legacy (columna orders.payment_evidence_path)
      if (row.payment_evidence_path) {
        try {
          const parsed = JSON.parse(row.payment_evidence_path);
          if (Array.isArray(parsed)) evidences.push(...parsed);
          else evidences.push(row.payment_evidence_path);
        } catch {
          if (row.payment_evidence_path.includes(',')) {
            evidences.push(...row.payment_evidence_path.split(',').map(s => s.trim()));
          } else {
            evidences.push(row.payment_evidence_path);
          }
        }
      }

      // 2. Evidencias adicionales (tabla payment_evidences)
      if (row.additional_evidences) {
        let additional = row.additional_evidences;
        if (typeof additional === 'string') {
          try { additional = JSON.parse(additional); } catch { }
        }
        if (Array.isArray(additional)) {
          evidences.push(...additional);
        }
      }

      // 3. Evidencias de wallet_validations (payment_proof_image)
      if (row.wallet_evidences) {
        let walletEvs = row.wallet_evidences;
        if (typeof walletEvs === 'string') {
          try { walletEvs = JSON.parse(walletEvs); } catch { }
        }
        if (Array.isArray(walletEvs)) {
          // Agregar prefijo /uploads/payment-proofs/ a cada evidencia de wallet
          const fullPaths = walletEvs.map(filename => {
            if (filename.startsWith('http') || filename.startsWith('/')) {
              return filename; // Ya es una URL completa o path absoluto
            }
            return `/uploads/payment-proofs/${filename}`;
          });
          evidences.push(...fullPaths);
        }
      }

      // Eliminar duplicados y nulos
      evidences = [...new Set(evidences.filter(e => e))];

      return {
        ...row,
        // Enviar como JSON string para compatibilidad con frontend existente
        payment_evidence_path: evidences.length > 0 ? JSON.stringify(evidences) : null
      };
    });

    return res.json({ success: true, data: processedRows });
  } catch (e) {
    console.error('Error listando pendientes de cierre SIIGO:', e);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * GET /api/cartera/reposicion-orders
 * Lista pedidos con forma de pago "reposición" para revisión de Cartera y Facturación
 */
const getReposicionOrders = async (req, res) => {
  try {
    const { search, from, to, limit = 200 } = req.query;

    const where = [
      'o.deleted_at IS NULL',
      "LOWER(COALESCE(o.payment_method,'')) = 'reposicion'",
      '(o.manufacturer_reposition_completed IS NULL OR o.manufacturer_reposition_completed = 0)'
    ];
    const params = [];

    if (from) {
      where.push('DATE(COALESCE(o.siigo_invoice_created_at, o.created_at)) >= ?');
      params.push(from);
    }
    if (to) {
      where.push('DATE(COALESCE(o.siigo_invoice_created_at, o.created_at)) <= ?');
      params.push(to);
    }
    if (search) {
      where.push('(o.order_number LIKE ? OR o.customer_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s);
    }

    const rows = await query(
      `
      SELECT 
        o.id, o.order_number, o.customer_name, o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        messenger.full_name AS messenger_name,
        o.carrier_id,
        c.name AS carrier_name,
        o.payment_method,
        CASE 
          WHEN LOWER(COALESCE(o.delivery_method,'')) IN ('recoge_bodega','recogida_tienda') THEN 'Bodega'
          WHEN o.carrier_id IS NOT NULL THEN COALESCE(c.name,'Transportadora')
          WHEN o.assigned_messenger_id IS NOT NULL THEN CONCAT('Mensajero: ', COALESCE(messenger.full_name, CONCAT('ID ', o.assigned_messenger_id)))
          ELSE NULL
        END AS delivery_channel,
        o.siigo_invoice_id, o.siigo_invoice_number, o.siigo_invoice_created_at,
        o.total_amount,
        o.tags, o.electronic_payment_type, o.is_service
      FROM orders o
      LEFT JOIN carriers c ON o.carrier_id = c.id
      LEFT JOIN users messenger ON o.assigned_messenger_id = messenger.id
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(o.siigo_invoice_created_at, o.created_at) DESC, o.id DESC
      LIMIT ${Number(limit) || 200}
      `,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error('Error listando pedidos de reposición:', e);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * POST /api/cartera/orders/:id/complete-manufacturer-reposition
 * Marca un pedido de reposición como "Fabricante completó reposición"
 * Sube evidencias (imágenes de chats con cliente)
 */
const completeManufacturerReposition = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;
    const files = req.files || []; // Array de archivos subidos por multer

    // Verificar que el pedido existe y es de reposición
    const [order] = await query(
      "SELECT id, order_number, payment_method FROM orders WHERE id = ? AND LOWER(COALESCE(payment_method,'')) = 'reposicion'",
      [id]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado o no es de tipo reposición' });
    }

    // Actualizar el pedido
    await query(
      `UPDATE orders 
       SET manufacturer_reposition_completed = 1,
           manufacturer_reposition_completed_at = NOW(),
           manufacturer_reposition_completed_by = ?,
           manufacturer_reposition_notes = ?
       WHERE id = ?`,
      [userId, notes || null, id]
    );

    // Guardar evidencias si hay archivos
    if (files && files.length > 0) {
      for (const file of files) {
        const filePath = `/uploads/reposition-evidences/${file.filename}`;
        await query(
          `INSERT INTO manufacturer_reposition_evidences (order_id, file_path, uploaded_by)
           VALUES (?, ?, ?)`,
          [id, filePath, userId]
        );
      }
    }

    console.log(`✅ Reposición completada para pedido ${order.order_number} por usuario ${userId}`);

    return res.json({
      success: true,
      message: 'Reposición de fabricante marcada como completada',
      data: {
        orderId: id,
        filesUploaded: files.length
      }
    });
  } catch (error) {
    console.error('Error completando reposición de fabricante:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * POST /api/cartera/adhoc-payments/:id/accept
 * Aceptar pago adhoc
 */
const acceptAdhocPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const approverId = req.user.id;

    await query(
      `UPDATE messenger_adhoc_payments
       SET status = 'collected', accepted_by = ?, accepted_at = NOW()
       WHERE id = ?`,
      [approverId, id]
    );

    return res.json({ success: true, message: 'Pago aceptado correctamente' });
  } catch (error) {
    console.error('Error aceptando pago adhoc:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  getPendingCashOrders,
  getHandovers,
  getHandoverDetails,
  closeHandover,
  getHandoverReceipt,
  acceptCashRegister,
  getCashRegisterReceipt,
  getBodegaHandoverDetails,
  getBodegaHandoverReceipt,
  returnToBilling,
  closeOrderInSiigo,
  getPendingSiigoClose,
  getReposicionOrders,
  completeManufacturerReposition,
  acceptAdhocPayment,
  getTags: async (req, res) => {
    try {
      const rows = await query('SELECT name FROM tags ORDER BY name ASC');
      return res.json({ success: true, data: rows.map(r => r.name) });
    } catch (e) {
      console.error('Error listando tags:', e);
      return res.status(500).json({ success: false, message: 'Error interno' });
    }
  }
};
