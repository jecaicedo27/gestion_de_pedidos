const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs').promises;

class PDFService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async generateShippingGuide(orderData, carrierData) {
    let browser = null;
    let page = null;

    try {
      console.log('🔄 Iniciando generación de PDF...');

      browser = await this.initBrowser();
      page = await browser.newPage();

      // Configurar página para mejor renderizado
      await page.setViewport({ width: 1200, height: 1600 });

      // Configurar el HTML de la guía
      const html = this.generateShippingGuideHTML(orderData, carrierData);

      console.log('📄 HTML generado, longitud:', html.length);

      // Cargar contenido con timeout más largo
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      console.log('✅ Contenido HTML cargado en la página');

      // Configurar opciones del PDF con mejores configuraciones
      const pdfOptions = {
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        },
        timeout: 30000
      };

      console.log('🔄 Generando PDF con Puppeteer...');

      // Generar PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      console.log(`✅ PDF generado exitosamente: ${pdfBuffer.length} bytes`);

      // Verificar que el PDF no está vacío
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF buffer está vacío');
      }

      // Verificar header del PDF
      const header = pdfBuffer.toString('ascii', 0, Math.min(10, pdfBuffer.length));
      if (!header.startsWith('%PDF-')) {
        throw new Error(`PDF generado tiene header inválido: ${header}`);
      }

      console.log('✅ PDF válido con header:', header.substring(0, 8));

      await page.close();
      return pdfBuffer;

    } catch (error) {
      console.error('❌ Error generando PDF de guía de envío:', error);

      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          console.error('Error cerrando página:', closeError);
        }
      }

      // Fallback a PDFKit cuando Puppeteer no está disponible
      try {
        console.log('🔁 Intentando fallback PDFKit...');
        const pdfBuffer = await this.generateShippingGuidePDFKit(orderData, carrierData);
        console.log(`✅ PDF generado con PDFKit: ${pdfBuffer.length} bytes`);
        return pdfBuffer;
      } catch (fallbackError) {
        console.error('❌ Error en fallback PDFKit:', fallbackError);
        throw error;
      }
    }
  }

  // Función para limpiar y escapar texto para HTML
  escapeHtml(text) {
    if (!text) return '';

    return String(text)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>')
      .replace(/\r/g, '');
  }

  // Función para limpiar texto simple (sin HTML)
  cleanText(text) {
    if (!text) return '';

    return String(text)
      .replace(/[<>'"&]/g, '')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .trim();
  }

  generateShippingGuideHTML(orderData, carrierData) {
    const currentDate = new Date().toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const shippingMethodLabels = {
      'recoge_bodega': 'Recoge en Bodega',
      'domicilio_local': 'Envío Domicilio Local',
      'envio_nacional': 'Envío Nacional',
      'envio_terminal': 'Envío por Terminal',
      'envio_aereo': 'Envío Aéreo',
      'camion_externo': 'Camión Externo'
    };

    // Limpiar y preparar datos
    const cleanOrderData = {
      order_number: this.cleanText(orderData.order_number) || 'Sin número',
      customer_name: this.cleanText(orderData.customer_name) || 'Sin nombre',
      phone: this.cleanText(orderData.phone) || 'Sin teléfono',
      address: this.cleanText(orderData.address) || 'Sin dirección',
      city: this.cleanText(orderData.city) || 'Sin ciudad',
      department: this.cleanText(orderData.department) || 'Sin departamento',
      email: this.cleanText(orderData.email) || 'Sin email',
      customer_nit: this.cleanText(orderData.customer_nit) || '',
      payment_method: this.cleanText(orderData.payment_method) || 'Sin especificar',
      total_amount: orderData.total_amount || 0,
      delivery_method: orderData.delivery_method || 'sin_especificar',
      tracking_number: this.cleanText(orderData.tracking_number) || '',
      notes: this.escapeHtml(orderData.notes) || '',
      status: this.cleanText(orderData.status) || 'Sin estado'
    };

    const cleanCarrierData = {
      name: this.cleanText(carrierData.name) || 'Sin transportadora',
      code: this.cleanText(carrierData.code) || 'SIN_CODIGO',
      contact_phone: this.cleanText(carrierData.contact_phone) || 'Sin teléfono',
      contact_email: this.cleanText(carrierData.contact_email) || 'Sin email'
    };

    // Nuevos datos estructurados (si vienen del controlador)
    const cleanSender = {
      name: this.cleanText(orderData.sender?.name) || 'PERLAS EXPLOSIVAS COLOMBIA SAS',
      nit: this.cleanText(orderData.sender?.nit) || '901749888',
      address: this.cleanText(orderData.sender?.address) || 'Calle 50 # 31-46',
      city: this.cleanText(orderData.sender?.city) || 'Medellín',
      department: this.cleanText(orderData.sender?.department) || 'Antioquia',
      phone: this.cleanText(orderData.sender?.phone) || '3105244298',
      email: this.cleanText(orderData.sender?.email) || 'logistica@perlas-explosivas.com'
    };

    const cleanRecipient = {
      name: this.cleanText(orderData.recipient?.name) || cleanOrderData.customer_name,
      nit: this.cleanText(orderData.recipient?.nit) || cleanOrderData.customer_nit,
      phone: this.cleanText(orderData.recipient?.phone) || cleanOrderData.phone,
      address: this.cleanText(orderData.recipient?.address) || cleanOrderData.address,
      city: this.cleanText(orderData.recipient?.city) || cleanOrderData.city,
      department: this.cleanText(orderData.recipient?.department) || cleanOrderData.department,
      email: this.cleanText(orderData.recipient?.email) || cleanOrderData.email,
      payment_method: this.cleanText(orderData.recipient?.paymentMethod) || cleanOrderData.payment_method
    };

    const cleanDriver = {
      plate: this.cleanText(orderData.driver?.plate) || '',
      name: this.cleanText(orderData.driver?.name) || '',
      whatsapp: this.cleanText(orderData.driver?.whatsapp) || '',
      boxes: this.cleanText(orderData.driver?.boxes) || ''
    };

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Guía de Envío - Pedido ${orderData.order_number}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Helvetica', 'Arial', sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
                background: white;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #e74c3c;
                padding-bottom: 15px;
            }
            
            .logo {
                font-size: 22px;
                font-weight: bold;
                color: #e74c3c;
                margin-bottom: 8px;
                text-transform: uppercase;
            }
            
            .subtitle {
                font-size: 14px;
                color: #555;
                margin-bottom: 3px;
            }
            
            .guide-number {
                font-size: 16px;
                font-weight: bold;
                color: #2c3e50;
                margin-top: 12px;
                padding: 5px 10px;
                background: #f8f9fa;
                display: inline-block;
                border-radius: 4px;
            }
            
            .section {
                margin-bottom: 20px;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                overflow: hidden;
            }
            
            .section-header {
                background: #f1f2f6;
                padding: 10px 15px;
                font-weight: bold;
                color: #2c3e50;
                border-bottom: 1px solid #e0e0e0;
                font-size: 13px;
                text-transform: uppercase;
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
                margin-bottom: 8px;
            }
            
            .info-label {
                font-weight: bold;
                color: #7f8c8d;
                font-size: 11px;
                margin-bottom: 2px;
                text-transform: uppercase;
            }
            
            .info-value {
                color: #2c3e50;
                font-size: 12px;
            }
            
            .shipping-method {
                background: #e8f5e8;
                border: 1px solid #27ae60;
                border-radius: 6px;
                padding: 8px;
                text-align: center;
                font-weight: bold;
                color: #27ae60;
                font-size: 13px;
                margin-bottom: 20px;
                text-transform: uppercase;
            }
            
            .tracking-number {
                background: #fff3cd;
                border: 1px solid #ffc107;
                border-radius: 6px;
                padding: 12px;
                text-align: center;
                margin: 20px 0;
            }
            
            .tracking-label {
                font-size: 11px;
                color: #856404;
                margin-bottom: 4px;
                font-weight: bold;
            }
            
            .tracking-value {
                font-size: 16px;
                font-weight: bold;
                color: #856404;
                letter-spacing: 1px;
            }
            
            .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 10px;
                color: #95a5a6;
                border-top: 1px solid #eee;
                padding-top: 15px;
            }
            
            .barcode-placeholder {
                height: 50px;
                background: #fafafa;
                border: 1px dashed #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 15px 0;
                color: #999;
                font-size: 11px;
            }
            
            @media print {
                .container {
                    max-width: none;
                    margin: 0;
                    padding: 0;
                }
                .section {
                    break-inside: avoid;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <div class="logo">${cleanSender.name}</div>
                <div class="subtitle">NIT: ${cleanSender.nit}</div>
                <div class="subtitle">${cleanSender.address} - ${cleanSender.city}${cleanSender.department ? ', ' + cleanSender.department : ''}</div>
                <div class="subtitle">Teléfono: ${cleanSender.phone}${cleanSender.email ? ' | ' + cleanSender.email : ''}</div>
                <div class="guide-number">GUÍA DE ENVÍO #${cleanOrderData.order_number}</div>
            </div>

            <!-- Método de Envío -->
            <div class="shipping-method">
                ${shippingMethodLabels[cleanOrderData.delivery_method] || cleanOrderData.delivery_method}
            </div>

            <!-- Información del Remitente -->
            <div class="section">
                <div class="section-header">INFORMACIÓN DEL REMITENTE</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div>
                            <div class="info-item">
                                <div class="info-label">Empresa</div>
                                <div class="info-value">${cleanSender.name}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">NIT</div>
                                <div class="info-value">${cleanSender.nit}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Dirección</div>
                                <div class="info-value">${cleanSender.address}</div>
                            </div>
                        </div>
                        <div>
                            <div class="info-item">
                                <div class="info-label">Ciudad</div>
                                <div class="info-value">${cleanSender.city}${cleanSender.department ? ', ' + cleanSender.department : ''}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Teléfono</div>
                                <div class="info-value">${cleanSender.phone}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Email</div>
                                <div class="info-value">${cleanSender.email}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Información del Destinatario -->
            <div class="section">
                <div class="section-header">INFORMACIÓN DEL DESTINATARIO</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div>
                            <div class="info-item">
                                <div class="info-label">Nombre:</div>
                                <div class="info-value">${cleanRecipient.name}</div>
                            </div>
                            ${cleanRecipient.nit ? `
                            <div class="info-item">
                                <div class="info-label">NIT:</div>
                                <div class="info-value">${cleanRecipient.nit}</div>
                            </div>
                            ` : ''}
                            <div class="info-item">
                                <div class="info-label">Teléfono:</div>
                                <div class="info-value">${cleanRecipient.phone}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Dirección:</div>
                                <div class="info-value">${cleanRecipient.address}</div>
                            </div>
                        </div>
                        <div>
                            <div class="info-item">
                                <div class="info-label">Ciudad:</div>
                                <div class="info-value">${cleanRecipient.city}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Departamento:</div>
                                <div class="info-value">${cleanRecipient.department}</div>
                            </div>
                            ${cleanRecipient.payment_method ? `
                            <div class="info-item">
                                <div class="info-label">Forma de Pago de Envío:</div>
                                <div class="info-value" style="font-weight: bold; color: #e74c3c;">${cleanRecipient.payment_method}</div>
                            </div>
                            ` : ''}
                            <div class="info-item">
                                <div class="info-label">Email:</div>
                                <div class="info-value">${cleanRecipient.email}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Información del Conductor (Camión Externo) -->
            ${cleanDriver.plate || cleanDriver.name || cleanDriver.whatsapp || cleanDriver.boxes ? `
            <div class="section">
                <div class="section-header">🚛 INFORMACIÓN DEL CONDUCTOR</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div>
                            <div class="info-item">
                                <div class="info-label">Placa del Vehículo:</div>
                                <div class="info-value">${cleanDriver.plate || '-'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Nombre del Conductor:</div>
                                <div class="info-value">${cleanDriver.name || '-'}</div>
                            </div>
                        </div>
                        <div>
                            <div class="info-item">
                                <div class="info-label">WhatsApp del Conductor:</div>
                                <div class="info-value">${cleanDriver.whatsapp || '-'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Número de Cajas Enviadas:</div>
                                <div class="info-value">${cleanDriver.boxes || '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Información de la Transportadora -->
            <div class="section">
                <div class="section-header">🚚 INFORMACIÓN DE TRANSPORTADORA</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div>
                            <div class="info-item">
                                <div class="info-label">Transportadora:</div>
                                <div class="info-value">${cleanCarrierData.name}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Código:</div>
                                <div class="info-value">${cleanCarrierData.code}</div>
                            </div>
                        </div>
                        <div>
                            <div class="info-item">
                                <div class="info-label">Teléfono:</div>
                                <div class="info-value">${cleanCarrierData.contact_phone}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Email:</div>
                                <div class="info-value">${cleanCarrierData.contact_email}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Información del Pedido -->
            <div class="section">
                <div class="section-header">📦 INFORMACIÓN DEL PEDIDO</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div>
                            <div class="info-item">
                                <div class="info-label">Número de Pedido:</div>
                                <div class="info-value">${cleanOrderData.order_number}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Fecha de Envío:</div>
                                <div class="info-value">${orderData.shipping_date ? new Date(orderData.shipping_date).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : currentDate}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Método de Pago:</div>
                                <div class="info-value">${cleanOrderData.payment_method}</div>
                            </div>
                        </div>
                        <div>
                            <div class="info-item">
                                <div class="info-label">Total del Pedido:</div>
                                <div class="info-value">$${cleanOrderData.total_amount ? Number(cleanOrderData.total_amount).toLocaleString('es-CO') : '0'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Estado:</div>
                                <div class="info-value">${cleanOrderData.status}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Fecha de Generación:</div>
                                <div class="info-value">${currentDate}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Número de Seguimiento -->
            ${cleanOrderData.tracking_number ? `
            <div class="tracking-number">
                <div class="tracking-label">NÚMERO DE SEGUIMIENTO</div>
                <div class="tracking-value">${cleanOrderData.tracking_number}</div>
            </div>
            ` : ''}

            <!-- Código de Barras Placeholder -->
            <div class="barcode-placeholder">
                Código de Barras: ${cleanOrderData.order_number}
            </div>

            <!-- Notas Adicionales -->
            ${cleanOrderData.notes ? `
            <div class="section">
                <div class="section-header">📝 NOTAS ADICIONALES</div>
                <div class="section-content">
                    <div class="info-value">${cleanOrderData.notes}</div>
                </div>
            </div>
            ` : ''}

            <!-- Footer -->
            <div class="footer">
                <p>Esta guía fue generada automáticamente el ${currentDate}</p>
                <p>PERLAS EXPLOSIVAS COLOMBIA SAS - Sistema de Gestión de Pedidos</p>
                <p>Para consultas: 3105244298 | logistica@perlas-explosivas.com</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Fallback generator using PDFKit (no headless browser required)
  async generateShippingGuidePDFKit(orderData, carrierData) {
    return new Promise((resolve, reject) => {
      try {
        // Professional Layout Configuration
        const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (e) => reject(e));

        // Colors & Fonts
        const colors = {
          primary: '#1a237e', // Deep Navy Blue
          secondary: '#c62828', // Professional Red
          text: '#212121',
          lightText: '#757575',
          background: '#f5f5f5',
          white: '#ffffff',
          border: '#e0e0e0'
        };

        const shippingMethodLabels = {
          recoge_bodega: 'Recoge en Bodega',
          domicilio_local: 'Domicilio Local',
          envio_nacional: 'Envío Nacional',
          envio_terminal: 'Envío Terminal',
          envio_aereo: 'Envío Aéreo',
          camion_externo: 'Camión Externo'
        };

        const clean = (v) => (v ? String(v) : '');

        // --- HELPER FUNCTIONS ---

        const drawSectionHeader = (title, y) => {
          doc.rect(20, y, 555, 20).fill(colors.background);
          doc.rect(20, y, 3, 20).fill(colors.primary); // Accent bar
          doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.primary)
            .text(title.toUpperCase(), 30, y + 5, { characterSpacing: 1 });
          return y + 25;
        };

        const drawField = (label, value, x, y, width) => {
          doc.font('Helvetica-Bold').fontSize(7).fillColor(colors.lightText)
            .text(label.toUpperCase(), x, y, { width: width });

          const labelHeight = doc.heightOfString(label, { width: width });
          doc.font('Helvetica').fontSize(9).fillColor(colors.text)
            .text(value || '-', x, y + labelHeight + 2, { width: width });

          return y + labelHeight + 14;
        };

        // --- HEADER SECTION ---
        // Full width header background
        doc.rect(0, 0, 595, 100).fill(colors.primary);

        // Logo / Company Name
        doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.white)
          .text('PERLAS EXPLOSIVAS', 30, 30);
        doc.fontSize(10).opacity(0.8)
          .text('COLOMBIA S.A.S', 30, 55);

        // Order Number Box (Right aligned in header)
        doc.roundedRect(380, 25, 190, 50, 4).fill(colors.white);
        doc.opacity(1).fillColor(colors.lightText).fontSize(8)
          .text('NÚMERO DE GUÍA / PEDIDO', 395, 35);
        doc.fillColor(colors.secondary).fontSize(16).font('Helvetica-Bold')
          .text(clean(orderData.order_number), 395, 50);

        // Reset position below header
        doc.y = 110;

        // --- COMPANY INFO ---
        const sender = {
          name: clean(orderData.sender?.name) || 'PERLAS EXPLOSIVAS COLOMBIA SAS',
          nit: clean(orderData.sender?.nit) || '901749888',
          address: clean(orderData.sender?.address) || 'Calle 50 # 31-46',
          city: clean(orderData.sender?.city) || 'Medellín',
          department: clean(orderData.sender?.department) || 'Antioquia',
          phone: clean(orderData.sender?.phone) || '3105244298',
          email: clean(orderData.sender?.email) || 'logistica@perlas-explosivas.com'
        };

        doc.font('Helvetica').fontSize(8).fillColor(colors.text);
        const infoText = `${sender.address} | ${sender.city}, ${sender.department} | Tel: ${sender.phone} | ${sender.email}`;
        doc.text(infoText, 30, 110, { align: 'center', width: 535 });

        doc.moveDown(1.5);

        // --- SHIPPING METHOD BADGE ---
        const method = clean(orderData.delivery_method);
        const methodLabel = shippingMethodLabels[method] || method || 'Sin especificar';

        doc.roundedRect(20, doc.y, 555, 24, 2).fillAndStroke('#e8f5e9', '#2e7d32');
        doc.fillColor('#2e7d32').fontSize(10).font('Helvetica-Bold')
          .text(methodLabel.toUpperCase(), 20, doc.y + 7, { width: 555, align: 'center' });

        doc.moveDown(2);

        // --- SENDER SECTION ---
        let currentY = doc.y;
        const fullWidth = 535;
        const col1 = 30;
        const col2 = 300; // Keep for internal 2-col within sections if needed, or just use flow

        // 1. DATOS DEL REMITENTE
        currentY = drawSectionHeader('DATOS DEL REMITENTE', currentY);

        // Sender Data - Row 1
        let sy = currentY;
        // Empresa | NIT
        drawField('Empresa', sender.name, col1, sy, 250);
        drawField('NIT', sender.nit, col2, sy, 250);
        sy += 35;

        // Dirección | Ciudad
        drawField('Dirección', sender.address, col1, sy, 250);
        drawField('Ciudad', `${sender.city}, ${sender.department}`, col2, sy, 250);
        sy += 35;

        // Contacto
        drawField('Contacto', `${sender.phone} | ${sender.email}`, col1, sy, 500);
        sy += 35;

        currentY = sy + 10;

        // 2. DATOS DEL DESTINATARIO
        // Recipient Section
        const recip = {
          name: clean(orderData.recipient?.name) || clean(orderData.customer_name) || 'Sin nombre',
          nit: clean(orderData.recipient?.nit) || clean(orderData.customer_nit),
          phone: clean(orderData.recipient?.phone) || clean(orderData.phone),
          address: clean(orderData.recipient?.address) || clean(orderData.address),
          city: clean(orderData.recipient?.city) || clean(orderData.city),
          department: clean(orderData.recipient?.department) || clean(orderData.department),
          email: clean(orderData.recipient?.email) || clean(orderData.email),
          payment_method: clean(orderData.recipient?.paymentMethod) || clean(orderData.payment_method)
        };

        currentY = drawSectionHeader('DATOS DEL DESTINATARIO', currentY);
        let ry = currentY;

        // Nombre | Identificación
        drawField('Nombre', recip.name, col1, ry, 250);
        drawField('Identificación', recip.nit, col2, ry, 250);
        ry += 35;

        // Dirección | Ciudad
        drawField('Dirección', recip.address, col1, ry, 250);
        drawField('Ciudad', `${recip.city}, ${recip.department}`, col2, ry, 250);
        ry += 35;

        // Teléfono | Email
        drawField('Teléfono', recip.phone, col1, ry, 250);
        drawField('Email', recip.email, col2, ry, 250);
        ry += 35;

        // Payment Method Highlight (Full width or prominent)
        if (recip.payment_method) {
          doc.roundedRect(col1, ry, 520, 24, 2).fill('#ffebee');
          doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.secondary)
            .text('FORMA DE PAGO ENVÍO:', col1 + 10, ry + 7);
          doc.fontSize(10).text(recip.payment_method, col1 + 130, ry + 6);
          ry += 35;
        }

        currentY = ry + 10;

        // 3. INFORMACIÓN DE TRANSPORTE
        const d = {
          plate: clean(orderData.driver?.plate),
          name: clean(orderData.driver?.name),
          whatsapp: clean(orderData.driver?.whatsapp),
          boxes: clean(orderData.driver?.boxes)
        };

        if (d.plate || d.name || d.whatsapp || d.boxes) {
          currentY = drawSectionHeader('INFORMACIÓN DE TRANSPORTE', currentY);
          let dy = currentY;

          // Conductor | Placa
          drawField('Conductor', d.name, col1, dy, 250);
          drawField('Placa Vehículo', d.plate, col2, dy, 250);
          dy += 35;

          // WhatsApp | Cajas
          drawField('WhatsApp', d.whatsapp, col1, dy, 250);
          drawField('No. Cajas', d.boxes, col2, dy, 250);
          dy += 35;

          currentY = dy + 10;
        }

        doc.y = currentY;

        // --- NOTES SECTION ---
        if (clean(orderData.notes)) {
          let notesY = drawSectionHeader('OBSERVACIONES', doc.y);
          doc.font('Helvetica').fontSize(8).fillColor(colors.text)
            .text(clean(orderData.notes), 30, notesY, { width: 535, align: 'justify' });
          doc.moveDown(2);
        }

        // --- SIGNATURES ---
        // Push to bottom
        const bottomMargin = 80;
        const signatureY = doc.page.height - bottomMargin;

        // Draw lines
        doc.lineWidth(1).strokeColor(colors.lightText);
        doc.moveTo(50, signatureY).lineTo(250, signatureY).stroke();
        doc.moveTo(345, signatureY).lineTo(545, signatureY).stroke();

        // Received Confirmation Text (Red)
        if (d.boxes && Number(d.boxes) > 0) {
          const textY = signatureY - 40;
          doc.font('Helvetica').fontSize(8).fillColor(colors.secondary);
          doc.text('He recibido a conformidad la cantidad de', 345, textY, { width: 200, align: 'center' });

          doc.font('Helvetica-Bold').fontSize(16).fillColor(colors.secondary);
          doc.text(`${d.boxes} CAJAS`, 345, textY + 12, { width: 200, align: 'center' });
        }

        // Labels
        doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.text);
        doc.text('FIRMA CONDUCTOR', 50, signatureY + 5, { width: 200, align: 'center' });
        doc.text('FIRMA RECIBIDO', 345, signatureY + 5, { width: 200, align: 'center' });

        doc.font('Helvetica').fontSize(7).fillColor(colors.lightText);
        doc.text('C.C.', 50, signatureY + 15, { width: 200, align: 'center' });
        doc.text('C.C. / Sello', 345, signatureY + 15, { width: 200, align: 'center' });

        // --- FOOTER ---
        const footerY = doc.page.height - 30;
        doc.rect(0, footerY, 595, 30).fill(colors.background);
        doc.font('Helvetica').fontSize(7).fillColor(colors.lightText);
        const dateStr = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
        doc.text(`Generado el ${dateStr} | Sistema de Gestión de Pedidos - Perlas Explosivas Colombia S.A.S`, 0, footerY + 10, { align: 'center', width: 595 });

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  async generateCarrierManifest(orders = [], options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 28 });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (e) => reject(e));

        const carrierName = this.cleanText(options.carrierName || 'Transportadora');
        const titleDate = options.date ? new Date(options.date) : new Date();
        const dateStr = titleDate.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });

        // Encabezado
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('PERLAS EXPLOSIVAS COLOMBIA SAS');
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(12).fillColor('#374151').text('Planilla de Entrega a Transportadora');
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(`Transportadora: ${carrierName}`);
        doc.font('Helvetica').fontSize(11).fillColor('#111827')
          .text(`Fecha: ${dateStr}    Total pedidos: ${Array.isArray(orders) ? orders.length : 0}`);
        doc.moveDown(0.6);

        // Configuración de tabla
        const table = {
          x: doc.x,
          y: doc.y,
          rowMinHeight: 28,
          headers: ['CÓDIGO', 'CLIENTE', 'FIRMA QUIEN ENTREGA', 'FIRMA QUIEN RECIBE'],
          widths: [110, 240, 95, 95]
        };

        // Ajustar anchos a la página
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const sum = table.widths.reduce((a, b) => a + b, 0);
        if (sum !== pageWidth) {
          const scale = pageWidth / sum;
          table.widths = table.widths.map(w => Math.floor(w * scale));
        }

        const drawHeader = () => {
          doc.font('Helvetica-Bold').fontSize(10);
          let x = table.x;
          const y = doc.y;
          for (let i = 0; i < table.headers.length; i++) {
            // fondo y borde del header
            doc.save();
            doc.rect(x, y, table.widths[i], table.rowMinHeight).fillAndStroke('#f3f4f6', '#d1d5db');
            doc.restore();
            doc.fillColor('#111827').text(table.headers[i], x + 6, y + 9, { width: table.widths[i] - 12 });
            x += table.widths[i];
          }
          doc.fillColor('#000');
          doc.y = y + table.rowMinHeight;
        };

        const needNewPage = (nextRowHeight) => {
          const bottom = doc.page.height - doc.page.margins.bottom;
          return (doc.y + nextRowHeight + 30) > bottom;
        };

        const drawRow = (order) => {
          const code = this.cleanText(order.order_number || order.code || order.id || '');
          const clientName = this.cleanText(order.customer_name || order.client_name || '');
          const phone = this.cleanText(order.phone || order.customer_phone || '');
          const client = phone ? `${clientName}\n${phone}` : clientName;

          // Calcular alto real de la celda cliente
          const clientOptions = { width: table.widths[1] - 12 };
          const clientHeight = doc.heightOfString(client, clientOptions);
          const rowHeight = Math.max(table.rowMinHeight, clientHeight + 12);

          if (needNewPage(rowHeight)) {
            doc.addPage();
            drawHeader();
          }

          const startY = doc.y;
          let x = table.x;

          // Bordes de celdas
          for (let i = 0; i < table.widths.length; i++) {
            doc.strokeColor('#d1d5db').rect(x, startY, table.widths[i], rowHeight).stroke();
            x += table.widths[i];
          }

          // Escribir contenido
          x = table.x;
          doc.font('Helvetica').fontSize(10).fillColor('#111827')
            .text(code, x + 6, startY + 9, { width: table.widths[0] - 12 });
          x += table.widths[0];

          doc.text(client, x + 6, startY + 6, { width: table.widths[1] - 12 });
          x += table.widths[1];

          // Firmas: línea y etiqueta centrada al final de la celda
          const drawSignatureCell = (width) => {
            const lineY = startY + rowHeight - 18;
            doc.moveTo(x + 10, lineY).lineTo(x + width - 10, lineY).strokeColor('#9ca3af').stroke();
            doc.fillColor('#374151').fontSize(9)
              .text('Firma', x + 6, lineY + 2, { width: width - 12, align: 'center' });
            x += width;
          };
          drawSignatureCell(table.widths[2]);
          drawSignatureCell(table.widths[3]);

          doc.y = startY + rowHeight;
          doc.fillColor('#000');
        };

        // Pintar tabla
        drawHeader();
        (orders || []).forEach(drawRow);

        // Pie
        doc.moveDown(1);
        doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
          .text(`Generado automáticamente el ${dateStr}`, { align: 'right' });

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  async saveShippingGuide(orderNumber, pdfBuffer) {
    try {
      // Crear directorio si no existe
      const uploadsDir = path.join(__dirname, '../uploads/shipping-guides');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Generar nombre del archivo
      const fileName = `guia-envio-${orderNumber}-${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);

      // Guardar archivo
      await fs.writeFile(filePath, pdfBuffer);

      return {
        fileName,
        filePath,
        relativePath: `uploads/shipping-guides/${fileName}`
      };
    } catch (error) {
      console.error('Error guardando guía de envío:', error);
      throw error;
    }
  }
}

module.exports = new PDFService();
