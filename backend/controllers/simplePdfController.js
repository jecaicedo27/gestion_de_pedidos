const { query } = require('../config/database');
const shippingService = require('../services/shippingService');

const formatText = (v) => (v === null || v === undefined ? '' : String(v));
const formatMoney = (v) =>
(typeof v === 'number'
  ? v.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
  : (v ? String(v) : '0'));

// Función para generar HTML de la guía de envío (media carta apaisado, maquetación profesional)
const generateGuideHTML = (guideData) => {
  const {
    order_id,
    order_number,
    delivery_method,
    transport_company,
    customer_name,
    phone,
    address,
    city,
    department,
    customer_nit,
    payment_method,
    shipping_payment_method,
    notes,
    sender_name,
    sender_nit,
    sender_phone,
    sender_address,
    sender_city,
    sender_department,
    sender_email,
    total_amount
  } = guideData;

  const shippingMethodLabels = {
    recoge_bodega: 'Recoge en Bodega',
    recogida_tienda: 'Recogida en Tienda',
    domicilio: 'Domicilio',
    domicilio_ciudad: 'Domicilio Ciudad',
    domicilio_local: 'Envío Domicilio Local',
    mensajeria_local: 'Mensajería Local',
    mensajeria_urbana: 'Mensajería Urbana',
    nacional: 'Envío Nacional',
    envio_nacional: 'Envío Nacional',
    envio_terminal: 'Envío por Terminal',
    envio_aereo: 'Envío Aéreo'
  };

  const today = new Date();
  const options = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('es-CO', options);
  const parts = formatter.formatToParts(today);
  const day = parts.find(p => p.type === 'day').value;
  const month = parts.find(p => p.type === 'month').value;
  const year = parts.find(p => p.type === 'year').value;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Guía de Envío - ${order_number}</title>
  <style>
    @page {
      size: portrait;
      margin: 0;
    }
    html, body {
      height: 100%;
    }
    body {
      margin: 0;
      color: #000;
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 8.5in;
      height: 5.5in;
      margin: 0 auto;
      box-sizing: border-box;
      padding: 10mm 5mm;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border: 1px solid #000;
    }
    .small { font-size: 9pt; }
    .base { font-size: 10pt; }
    .label { font-weight: bold; }
    .muted { color: #333; }
    .t-center { text-align: center; }
    .t-right { text-align: right; }
    .t-left  { text-align: left;  }
    .mt-4 { margin-top: 4px; }
    .mt-6 { margin-top: 6px; }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #000;
      padding: 3px 5px;
      vertical-align: top;
      word-wrap: break-word;
    }
    .no-border { border: none !important; }
    .block-title {
      background: #f2f2f2;
      font-weight: bold;
      padding: 4px 6px;
      border-bottom: 1px solid #000;
    }

    /* Cabecera principal */
    .header-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr 1.2fr;
      gap: 6px;
      align-items: stretch;
    }
    .header-cell {
      border: 1px solid #000;
      padding: 6px;
      min-height: 48px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .header-cell.header-right {
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
    }
    .qr-box {
      width: 110px;
      height: 110px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #000;
    }
    .header-guia {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
    }
    .header-title {
      font-size: 12pt;
      font-weight: bold;
    }
    .header-transport {
      font-size: 14pt;
      font-weight: bold;
      line-height: 1.1;
    }
    .shipping-payment {
      font-size: 11pt;
      font-weight: bold;
    }
    .header-guia-number {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      border: 2px solid #000;
      padding: 2px 6px;
    }

    /* Cuerpo con 3 columnas: Remitente, Destinatario, Valores */
    .body-grid {
      display: grid;
      grid-template-columns: 1.5fr 1.5fr;
      gap: 6px;
    }
    .panel {
      border: 1px solid #000;
    }
    .panel .content { padding: 4px 6px; }
    .kv { display: grid; grid-template-columns: 1fr 2fr; gap: 2px 6px; }
    .kv .k { font-weight: bold; }
    .kv .v { }

    /* Fila de fechas/pesos */
    .row-table th, .row-table td { text-align: center; }
    .obs { min-height: 38px; }

    /* Pie */
    .foot-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      align-items: stretch;
    }
    .foot-cell { border: 1px solid #000; padding: 4px 6px; min-height: 42px; }
    .legal { font-size: 8pt; line-height: 1.2; }

    @media print {
      body { margin: 0; }
      .sheet { border: 1px solid #000; }
    }
  </style>
</head>
<body>
  <div class="sheet base">
    <!-- CABECERA -->
    <div class="header-grid">
      <div class="header-cell">
        <div class="header-title">TRANSPORTADORA</div>
        <div class="header-transport">${formatText(transport_company) || 'No especificada'}</div>
        <div class="small muted">Método: ${shippingMethodLabels[delivery_method] || formatText(delivery_method) || '—'}</div>
        <div class="shipping-payment">Forma de pago de envío: ${formatText(shipping_payment_method) || '—'}</div>
      </div>
      <div class="header-cell t-center">
        <div class="header-title">GUÍA DE ENVÍO</div>
        <div class="small muted">Pedido/Referencia</div>
        <div class="header-guia-number">No. ${formatText(order_number) || '—'}</div>
      </div>
      <div class="header-cell header-right">
        <div>
          <div><span class="label">Fecha:</span> ${day}/${month}/${year}</div>
        </div>
        <div class="qr-box">
          <div id="qr-code" aria-label="Código QR de verificación"></div>
        </div>
      </div>
    </div>

    <!-- CUERPO: REMITENTE | DESTINATARIO | VALORES -->
    <div class="body-grid">
      <!-- Remitente -->
      <div class="panel">
        <div class="block-title">REMITENTE</div>
        <div class="content">
          <div class="kv">
            <div class="k">Nombre cliente:</div><div class="v">${formatText(sender_name) || 'PERLAS EXPLOSIVAS COLOMBIA S.A.S'}</div>
            <div class="k">NIT/CC:</div><div class="v">${formatText(sender_nit)}</div>
            <div class="k">Teléfono:</div><div class="v">${formatText(sender_phone)}</div>
            <div class="k">Dirección:</div><div class="v">${formatText(sender_address)}</div>
            <div class="k">Ciudad origen:</div><div class="v">${formatText(sender_city)}${sender_department ? ' - ' + sender_department : ''}</div>
            <div class="k">E-mail:</div><div class="v">${formatText(sender_email)}</div>
          </div>
        </div>
      </div>

      <!-- Destinatario -->
      <div class="panel">
        <div class="block-title">DESTINATARIO</div>
        <div class="content">
          <div class="kv">
            <div class="k">Nombre destinatario:</div><div class="v">${formatText(customer_name) || '—'}</div>
            <div class="k">NIT/CC:</div><div class="v">${formatText(customer_nit)}</div>
            <div class="k">Teléfono:</div><div class="v">${formatText(phone)}</div>
            <div class="k">Dirección:</div><div class="v">${formatText(address)}</div>
            <div class="k">Ciudad destino:</div><div class="v">${formatText(city)}${department ? ' - ' + department : ''}</div>
            <div class="k">E-mail:</div><div class="v"> </div>
          </div>
        </div>
      </div>

    </div>

    <!-- OBSERVACIONES -->
    <div class="panel">
      <div class="block-title">OBSERVACIONES</div>
      <div class="content obs">${formatText(notes) || 'Ninguna'}</div>
    </div>

    <!-- PIE -->
    <div class="foot-grid">
      <div class="foot-cell legal">
        El transportador declara haber recibido la mercancía sin verificar contenido ni estado de la misma.
      </div>
      <div class="foot-cell">
        <div class="label small">RECIBE CONFORME (Nombre legible con C.C.):</div>
        <div style="border-top: 1px solid #000; margin-top: 18px;"></div>
      </div>
      <div class="foot-cell">
        <div class="small"><span class="label">Elaborado por:</span> ${formatText(sender_name) || '—'}</div>
        <div class="small mt-4"><span class="label">Zona:</span> </div>
      </div>
    </div>

    <div class="small muted t-center mt-6">Generado: ${new Date().toLocaleString('es-CO')} — Sistema de Gestión de Pedidos</div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <script>
    (function() {
      try {
        var payload = JSON.stringify({
          type: 'handoff_to_carrier',
          order_id: '${order_id}',
          order_number: '${order_number}'
        });
        var container = document.getElementById('qr-code');
        if (window.QRCode && container) {
          QRCode.toString(payload, { type: 'svg', margin: 0, width: 110 }, function (err, svg) {
            if (!err && svg) container.innerHTML = svg;
          });
        }
      } catch (e) {
        console && console.warn && console.warn('QR render error', e);
      }
    })();
  </script>
</body>
</html>`;
};

// Función para extraer datos del destinatario desde las notas de SIIGO
const extractRecipientDataFromNotes = (notes) => {
  if (!notes) return null;

  const data = {};
  const text = String(notes).replace(/\r/g, '');
  const lines = text.split('\n');

  const pick = (line, re) => {
    const m = line.match(re);
    return m ? m[1].trim() : null;
  };

  for (const line of lines) {
    const l = line.trim();

    let v;
    if ((v = pick(l, /forma\s*de\s*pago\s*de\s*env[ií]o\s*:\s*(.+)$/i))) {
      data.paymentMethod = v;
    } else if ((v = pick(l, /^nombre\s*:?\s*(.+)$/i))) {
      data.name = v;
    } else if ((v = pick(l, /^(?:nit|n\.?i\.?t\.?|nit\/cc|nit-cc|nit cc|cc|c\.?c\.?|documento(?:\s+de)?\s+identidad)\s*:\s*(.+)$/i))) {
      data.nit = v;
    } else if ((v = pick(l, /^tel[eé]fono\s*:\s*([\d +()\-]+.*)$/i))) {
      data.phone = v;
    } else if ((v = pick(l, /^departamento\s*:\s*(.+)$/i))) {
      data.department = v;
    } else if ((v = pick(l, /^ciudad\s*:\s*(.+)$/i))) {
      data.city = v;
    } else if ((v = pick(l, /^direcci[oó]n\s*:\s*(.+)$/i))) {
      data.address = v;
    }
  }

  // Fallbacks contra todo el texto si faltan campos clave
  if (!data.nit) {
    const m = text.match(/(?:nit|n\.?i\.?t\.?|nit\/cc|cc|c\.?c\.?|documento(?:\s+de)?\s+identidad)\s*:\s*([0-9.\- ]+)/i);
    if (m) data.nit = m[1].trim();
  }
  if (!data.phone) {
    const m = text.match(/tel[eé]fono\s*:\s*([0-9 +()\-]+)/i);
    if (m) data.phone = m[1].trim();
  }
  if (!data.city) {
    const m = text.match(/ciudad\s*:\s*([^\n]+)/i);
    if (m) data.city = m[1].trim();
  }

  // Solo retornar si tenemos datos mínimos razonables
  if ((data.name || data.address) && data.phone) {
    return data;
  }

  return null;
};

// Generar guía HTML (endpoint)
const generateSimpleGuide = async (req, res) => {
  try {
    const input = { ...(req.query || {}), ...(req.body || {}) };
    const {
      orderId,
      orderNumber,
      order_number,
      shippingMethod,
      transportCompany,
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerDepartment,
      notes
    } = input;

    console.log('📋 Generando guía HTML media carta para pedido:', orderId || orderNumber || order_number);

    // Obtener información del pedido (por id o por número)
    let orderInfo = [];
    if (orderId) {
      try {
        orderInfo = await query(
          'SELECT o.*, c.name AS carrier_name, cu.identification AS customer_identification FROM orders o LEFT JOIN carriers c ON o.carrier_id = c.id LEFT JOIN customers cu ON o.customer_id = cu.id WHERE o.id = ?',
          [orderId]
        );
      } catch (e) {
        const msg = e?.sqlMessage || e?.message || '';
        if (
          e?.code === 'ER_BAD_FIELD_ERROR' ||
          e?.code === 'ER_NO_SUCH_TABLE' ||
          /Unknown column|Unknown table|does not exist|doesn'?t exist|Table .* doesn't exist/i.test(String(msg || ''))
        ) {
          // Fallback para entornos sin orders.customer_id o sin tabla customers
          orderInfo = await query(
            'SELECT o.*, c.name AS carrier_name FROM orders o LEFT JOIN carriers c ON o.carrier_id = c.id WHERE o.id = ?',
            [orderId]
          );
        } else {
          throw e;
        }
      }
    } else if (orderNumber || order_number) {
      const on = orderNumber || order_number;
      try {
        orderInfo = await query(
          'SELECT o.*, c.name AS carrier_name, cu.identification AS customer_identification FROM orders o LEFT JOIN carriers c ON o.carrier_id = c.id LEFT JOIN customers cu ON o.customer_id = cu.id WHERE o.order_number = ?',
          [on]
        );
      } catch (e) {
        const msg = e?.sqlMessage || e?.message || '';
        if (
          e?.code === 'ER_BAD_FIELD_ERROR' ||
          e?.code === 'ER_NO_SUCH_TABLE' ||
          /Unknown column|Unknown table|does not exist|doesn'?t exist|Table .* doesn't exist/i.test(String(msg || ''))
        ) {
          // Fallback para entornos sin orders.customer_id o sin tabla customers
          orderInfo = await query(
            'SELECT o.*, c.name AS carrier_name FROM orders o LEFT JOIN carriers c ON o.carrier_id = c.id WHERE o.order_number = ?',
            [on]
          );
        } else {
          throw e;
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere orderId o orderNumber'
      });
    }

    if (!orderInfo.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const order = orderInfo[0];

    // Intentar extraer datos del destinatario desde las notas de SIIGO
    const extractedData = extractRecipientDataFromNotes(order.notes);

    // Datos del destinatario
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
        name: customerName || order.customer_name,
        phone: customerPhone || order.customer_phone,
        address: customerAddress || order.customer_address,
        city: customerCity || order.customer_city,
        department: customerDepartment || order.customer_department,
        nit: '',
        paymentMethod: 'CONTRA ENTREGA'
      };
    }

    // Fallback documento (preferir customers.identification sobre orders.customer_document)
    if (!recipientData.nit) {
      recipientData.nit =
        (order.customer_identification ? String(order.customer_identification).trim() : '') ||
        (order.customer_document ? String(order.customer_document).trim() : '');
    }
    // Búsqueda adicional en customers si sigue vacío (sin bloquear)
    if (!recipientData.nit) {
      try {
        let rows = [];
        if (order.customer_id) {
          rows = await query('SELECT identification FROM customers WHERE id = ? LIMIT 1', [order.customer_id]);
        }
        if (!rows.length && order.customer_document) {
          rows = await query('SELECT identification FROM customers WHERE identification = ? LIMIT 1', [String(order.customer_document).trim()]);
        }
        if (!rows.length && order.customer_name) {
          rows = await query('SELECT identification FROM customers WHERE LOWER(name) = LOWER(?) ORDER BY updated_at DESC LIMIT 1', [order.customer_name]);
        }
        if (!rows.length && order.customer_phone) {
          rows = await query('SELECT identification FROM customers WHERE REPLACE(phone," ","") = REPLACE(?, " ", "") ORDER BY updated_at DESC LIMIT 1', [order.customer_phone]);
        }
        if (rows.length) {
          recipientData.nit = String(rows[0].identification || '').trim();
        }
      } catch (e) {
        console.warn('⚠️  Lookup identificación en customers falló:', e.message);
      }
    }

    // Remitente desde company_config
    let senderCfg = null;
    try {
      const rows = await query(
        `SELECT company_name, nit, address, whatsapp, city, department, email FROM company_config WHERE id = 1`
      );
      senderCfg = rows && rows.length ? rows[0] : null;
    } catch (e) {
      console.warn('⚠️  No se pudo obtener configuración de remitente (company_config):', e.message);
    }
    const senderData = senderCfg ? {
      name: senderCfg.company_name,
      nit: senderCfg.nit,
      phone: senderCfg.whatsapp,
      address: senderCfg.address,
      city: senderCfg.city,
      department: senderCfg.department,
      email: senderCfg.email
    } : {
      name: 'PERLAS EXPLOSIVAS COLOMBIA S.A.S',
      nit: '', phone: '', address: '', city: '', department: '', email: ''
    };

    const deliveryMethodDB = order.delivery_method;
    const isPickupDelivery = String(deliveryMethodDB || '').toLowerCase();
    const transportCompanyName = (isPickupDelivery === 'recoge_bodega' || isPickupDelivery === 'recogida_tienda')
      ? 'Recogida en Bodega'
      : (order.carrier_name || transportCompany || 'Transportadora');
    const shippingPaymentMethod = order.shipping_payment_method || recipientData.paymentMethod || '';

    const guideData = {
      order_id: order.id,
      order_number: order.order_number,
      delivery_method: deliveryMethodDB,
      transport_company: transportCompanyName,
      total_amount: order.total_amount,
      notes: notes || '',
      customer_name: recipientData.name,
      phone: recipientData.phone,
      address: recipientData.address,
      city: recipientData.city,
      department: recipientData.department,
      customer_nit: recipientData.nit,
      payment_method: order.payment_method || recipientData.paymentMethod,
      shipping_payment_method: shippingPaymentMethod,
      sender_name: senderData.name,
      sender_nit: senderData.nit,
      sender_phone: senderData.phone,
      sender_address: senderData.address,
      sender_city: senderData.city,
      sender_department: senderData.department,
      sender_email: senderData.email
    };

    // Generar HTML con nuevo layout
    const htmlContent = generateGuideHTML(guideData);

    console.log('✅ HTML media carta generado exitosamente');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.send(htmlContent);

  } catch (error) {
    console.error('❌ Error generando guía HTML:', error);
    // Responder SIEMPRE con detalle para diagnosticar en producción
    return res.status(500).json({
      success: false,
      message: 'Error generando guía de envío',
      error: (error && (error.message || String(error))) || 'unknown',
      stack: (error && error.stack) || undefined
    });
  }
};

module.exports = {
  generateSimpleGuide
};
