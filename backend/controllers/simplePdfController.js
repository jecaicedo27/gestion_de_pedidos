const { query } = require('../config/database');

// Función para generar HTML de la guía de envío
const generateGuideHTML = (guideData) => {
  const {
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
    notes
  } = guideData;

  const shippingMethodLabels = {
    'recoge_bodega': 'Recoge en Bodega',
    'domicilio_local': 'Envío Domicilio Local',
    'envio_nacional': 'Envío Nacional',
    'envio_terminal': 'Envío por Terminal',
    'envio_aereo': 'Envío Aéreo'
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guía de Envío - ${order_number}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            color: #333;
            line-height: 1.4;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 2px solid #333;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            color: #333;
        }
        .header h2 {
            margin: 5px 0 0 0;
            font-size: 28px;
            color: #333;
            font-weight: bold;
        }
        .section {
            margin-bottom: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
            overflow: hidden;
        }
        .section-header {
            background: #f5f5f5;
            padding: 10px 15px;
            font-weight: bold;
            border-bottom: 1px solid #ddd;
            font-size: 14px;
        }
        .section-content {
            padding: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .info-item {
            margin-bottom: 10px;
        }
        .info-label {
            font-weight: bold;
            color: #555;
            margin-bottom: 3px;
        }
        .info-value {
            color: #333;
            font-size: 14px;
        }
        .payment-method {
            background: #ffebee;
            border: 2px solid #f44336;
            padding: 10px;
            text-align: center;
            font-weight: bold;
            color: #d32f2f;
            font-size: 16px;
            margin: 10px 0;
        }
        .notes {
            background: #f9f9f9;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 15px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }
        @media print {
            body { margin: 0; padding: 10px; }
            .container { border: 1px solid #333; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GUÍA DE ENVÍO</h1>
            <h2>Pedido: ${order_number}</h2>
        </div>

        <div class="section">
            <div class="section-header">📦 INFORMACIÓN DEL PEDIDO</div>
            <div class="section-content">
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Número de Pedido:</div>
                        <div class="info-value">${order_number}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Método de Envío:</div>
                        <div class="info-value">${shippingMethodLabels[delivery_method] || delivery_method}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Transportadora:</div>
                        <div class="info-value">${transport_company || 'Recogida en Bodega'}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">🏢 REMITENTE</div>
            <div class="section-content">
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Empresa:</div>
                        <div class="info-value">Perlas Explosivas</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Teléfono:</div>
                        <div class="info-value">+57 310 524 4298</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Dirección:</div>
                        <div class="info-value">Calle 123 #45-67</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Ciudad:</div>
                        <div class="info-value">Medellín, Antioquia</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">👤 DESTINATARIO</div>
            <div class="section-content">
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Nombre:</div>
                        <div class="info-value">${customer_name || 'No especificado'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Teléfono:</div>
                        <div class="info-value">${phone || 'No especificado'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Dirección:</div>
                        <div class="info-value">${address || 'No especificado'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Ciudad:</div>
                        <div class="info-value">${city || 'No especificado'}, ${department || 'No especificado'}</div>
                    </div>
                    ${customer_nit ? `
                    <div class="info-item">
                        <div class="info-label">NIT:</div>
                        <div class="info-value">${customer_nit}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>

        <div class="payment-method">
            💳 FORMA DE PAGO: ${payment_method || 'CONTRA ENTREGA'}
        </div>

        ${notes ? `
        <div class="notes">
            <div class="info-label">📝 NOTAS ADICIONALES:</div>
            <div class="info-value">${notes}</div>
        </div>
        ` : ''}

        <div class="footer">
            <p>Generado el: ${new Date().toLocaleString('es-CO')}</p>
            <p>Perlas Explosivas - Sistema de Gestión de Pedidos</p>
        </div>
    </div>
</body>
</html>
  `;
};

// Función para extraer datos del destinatario desde las notas de SIIGO
const extractRecipientDataFromNotes = (notes) => {
  if (!notes) return null;

  const data = {};
  const lines = notes.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.includes('FORMA DE PAGO DE ENVIO:')) {
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

// Generar guía HTML simplificada
const generateSimpleGuide = async (req, res) => {
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

    console.log('📋 Generando guía HTML simple para pedido:', orderId);

    // Obtener información del pedido
    const orderInfo = await query(
      'SELECT order_number, total_amount, notes, customer_name, customer_phone, customer_address, customer_city, customer_department FROM orders WHERE id = ?',
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
        name: customerName || order.customer_name,
        phone: customerPhone || order.customer_phone,
        address: customerAddress || order.customer_address,
        city: customerCity || order.customer_city,
        department: customerDepartment || order.customer_department,
        nit: '',
        paymentMethod: 'CONTRA ENTREGA'
      };
    }

    // Datos para la guía
    const guideData = {
      order_number: order.order_number,
      delivery_method: shippingMethod,
      transport_company: transportCompany || 'Recogida en Bodega',
      total_amount: order.total_amount,
      notes: notes || '',
      customer_name: recipientData.name,
      phone: recipientData.phone,
      address: recipientData.address,
      city: recipientData.city,
      department: recipientData.department,
      customer_nit: recipientData.nit,
      payment_method: recipientData.paymentMethod
    };

    // Generar HTML
    const htmlContent = generateGuideHTML(guideData);

    console.log('✅ HTML generado exitosamente');

    // Configurar headers para mostrar HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Enviar HTML
    res.send(htmlContent);

  } catch (error) {
    console.error('❌ Error generando guía HTML:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando guía de envío',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  generateSimpleGuide
};
