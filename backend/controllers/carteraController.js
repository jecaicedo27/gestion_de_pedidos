const { query } = require('../config/database');

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
      '(ccd.id IS NULL OR ccd.collection_status <> "collected")'
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
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.total_amount,
        o.payment_method,
        o.shipping_payment_method,
        o.assigned_messenger_id AS messenger_id,
        u.full_name AS messenger_name,
        dt.delivered_at,
        o.siigo_invoice_created_at AS invoice_date,
        COALESCE(dt.payment_collected,0) AS product_collected,
        COALESCE(dt.delivery_fee_collected,0) AS delivery_fee_collected,
        (COALESCE(dt.payment_collected,0) + COALESCE(dt.delivery_fee_collected,0)) AS expected_amount,
        ccd.id AS detail_id,
        ccd.collected_amount AS declared_amount,
        ccd.collection_status,
        mcc.id AS closing_id,
        mcc.closing_date,
        NULL AS cash_register_id,
        'messenger' AS source
      FROM orders o
      JOIN delivery_tracking dt ON dt.order_id = o.id
      LEFT JOIN cash_closing_details ccd ON ccd.order_id = o.id
      LEFT JOIN messenger_cash_closings mcc ON mcc.id = ccd.closing_id
      LEFT JOIN users u ON u.id = o.assigned_messenger_id
      WHERE ${whereMessenger.join(' AND ')}
      ORDER BY dt.delivered_at DESC
      LIMIT 500
    `;

    // Bloque 2: pagos registrados en bodega (cash_register) pendientes de aceptación
    const whereBodega = [
      `(cr.status IS NULL OR cr.status <> 'collected')`
    ];
    const paramsBodega = [];

    // Filtros de fecha aplicados sobre la fecha de registro en caja
    if (from) {
      whereBodega.push('cr.created_at >= ?');
      paramsBodega.push(new Date(from).toISOString().slice(0, 19).replace('T', ' '));
    }
    if (to) {
      whereBodega.push('cr.created_at <= ?');
      paramsBodega.push(new Date(to).toISOString().slice(0, 19).replace('T', ' '));
    }

    // Importante: el filtro por mensajero NO aplica para bodega (no hay mensajero)
    const sqlBodega = `
      SELECT
        o.id AS order_id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.total_amount,
        o.payment_method,
        o.shipping_payment_method,
        NULL AS messenger_id,
        'Bodega' AS messenger_name,
        cr.created_at AS delivered_at,
        o.siigo_invoice_created_at AS invoice_date,
        0 AS product_collected,
        0 AS delivery_fee_collected,
        COALESCE(cr.amount,0) AS expected_amount,
        NULL AS detail_id,
        COALESCE(cr.accepted_amount,0) AS declared_amount,
        COALESCE(cr.status,'pending') AS collection_status,
        NULL AS closing_id,
        NULL AS closing_date,
        cr.id AS cash_register_id,
        'bodega' AS source
      FROM cash_register cr
      JOIN orders o ON o.id = cr.order_id
      WHERE ${whereBodega.join(' AND ')}
      ORDER BY cr.created_at DESC
      LIMIT 500
    `;

    // Ejecutar ambas y concatenar resultados (priorizando las más recientes al inicio)
    const rowsMessenger = await query(sqlMessenger, paramsMessenger);
    const rowsBodega = await query(sqlBodega, paramsBodega);

    // Unir y ordenar por fecha descendente
    const rows = [...rowsMessenger, ...rowsBodega].sort((a, b) => {
      const da = a.delivered_at ? new Date(a.delivered_at).getTime() : 0;
      const db = b.delivered_at ? new Date(b.delivered_at).getTime() : 0;
      return db - da;
    }).slice(0, 500);

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listando pendientes de cartera:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
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
        -UNIX_TIMESTAMP(DATE(cr.accepted_at)) AS id,
        NULL AS messenger_id,
        'Bodega' AS messenger_name,
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
        'bodega' AS source
      FROM cash_register cr
      WHERE ${whereBodega.join(' AND ')}
      GROUP BY DATE(cr.accepted_at)
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
        d.collection_notes
      FROM cash_closing_details d
      JOIN orders o ON o.id = d.order_id
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
    // Items del día
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
        cr.accepted_at AS collected_at
      FROM cash_register cr
      JOIN orders o ON o.id = cr.order_id
      WHERE DATE(cr.accepted_at) = ? AND cr.status = 'collected'
      ORDER BY cr.accepted_at ASC
      `,
      [date]
    );

    const expected = items.reduce((sum, it) => sum + Number(it.expected_amount || 0), 0);
    const declared = items.reduce((sum, it) => sum + Number(it.declared_amount || 0), 0);

    const header = {
      id: -Math.floor(new Date(`${date} 00:00:00`).getTime() / 1000),
      messenger_id: null,
      messenger_name: 'Bodega',
      closing_date: date,
      expected_amount: expected,
      declared_amount: declared,
      difference_amount: declared - expected,
      status: 'completed',
      approved_by: null,
      approved_by_name: null,
      approved_at: null,
      created_at: null,
      updated_at: null
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
      WHERE DATE(cr.accepted_at) = ? AND cr.status = 'collected'
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

module.exports = {
  getPendingCashOrders,
  getHandovers,
  getHandoverDetails,
  closeHandover,
  getHandoverReceipt,
  acceptCashRegister,
  getCashRegisterReceipt,
  getBodegaHandoverDetails,
  getBodegaHandoverReceipt
};
