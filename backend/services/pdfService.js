const puppeteer = require('puppeteer');
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
      
      throw error;
    }
  }

  // Función para limpiar y escapar texto para HTML
  escapeHtml(text) {
    if (!text) return '';
    
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
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
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const shippingMethodLabels = {
      'recoge_bodega': 'Recoge en Bodega',
      'domicilio_local': 'Envío Domicilio Local',
      'envio_nacional': 'Envío Nacional',
      'envio_terminal': 'Envío por Terminal',
      'envio_aereo': 'Envío Aéreo'
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
                font-family: 'Arial', sans-serif;
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
                margin-bottom: 30px;
                border-bottom: 3px solid #e74c3c;
                padding-bottom: 20px;
            }
            
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #e74c3c;
                margin-bottom: 10px;
            }
            
            .subtitle {
                font-size: 16px;
                color: #666;
                margin-bottom: 5px;
            }
            
            .guide-number {
                font-size: 18px;
                font-weight: bold;
                color: #2c3e50;
                margin-top: 10px;
            }
            
            .section {
                margin-bottom: 25px;
                border: 1px solid #ddd;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .section-header {
                background: #f8f9fa;
                padding: 12px 15px;
                font-weight: bold;
                color: #2c3e50;
                border-bottom: 1px solid #ddd;
            }
            
            .section-content {
                padding: 15px;
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
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
                padding: 5px 0;
            }
            
            .shipping-method {
                background: #e8f5e8;
                border: 2px solid #27ae60;
                border-radius: 6px;
                padding: 10px;
                text-align: center;
                font-weight: bold;
                color: #27ae60;
                font-size: 14px;
                margin-bottom: 15px;
            }
            
            .tracking-number {
                background: #fff3cd;
                border: 2px solid #ffc107;
                border-radius: 6px;
                padding: 15px;
                text-align: center;
                margin: 20px 0;
            }
            
            .tracking-label {
                font-size: 12px;
                color: #856404;
                margin-bottom: 5px;
            }
            
            .tracking-value {
                font-size: 18px;
                font-weight: bold;
                color: #856404;
                letter-spacing: 2px;
            }
            
            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 10px;
                color: #666;
                border-top: 1px solid #ddd;
                padding-top: 15px;
            }
            
            .barcode-placeholder {
                height: 60px;
                background: #f8f9fa;
                border: 2px dashed #ddd;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 15px 0;
                color: #666;
                font-style: italic;
            }
            
            @media print {
                .container {
                    max-width: none;
                    margin: 0;
                    padding: 10px;
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
                <div class="logo">PERLAS EXPLOSIVAS COLOMBIA SAS</div>
                <div class="subtitle">NIT: 901749888</div>
                <div class="subtitle">Calle 50 # 31-46 - Medellín</div>
                <div class="subtitle">Celular: 3105244298</div>
                <div class="guide-number">GUÍA DE ENVÍO #${cleanOrderData.order_number}</div>
            </div>

            <!-- Método de Envío -->
            <div class="shipping-method">
                ${shippingMethodLabels[cleanOrderData.delivery_method] || cleanOrderData.delivery_method}
            </div>

            <!-- Información del Remitente -->
            <div class="section">
                <div class="section-header">📤 INFORMACIÓN DEL REMITENTE</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div>
                            <div class="info-item">
                                <div class="info-label">Empresa:</div>
                                <div class="info-value">PERLAS EXPLOSIVAS COLOMBIA SAS</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">NIT:</div>
                                <div class="info-value">901749888</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Dirección:</div>
                                <div class="info-value">Calle 50 # 31-46</div>
                            </div>
                        </div>
                        <div>
                            <div class="info-item">
                                <div class="info-label">Ciudad:</div>
                                <div class="info-value">Medellín, Antioquia</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Teléfono:</div>
                                <div class="info-value">3105244298</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Email:</div>
                                <div class="info-value">logistica@perlas-explosivas.com</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Información del Destinatario -->
            <div class="section">
                <div class="section-header">📥 INFORMACIÓN DEL DESTINATARIO</div>
                <div class="section-content">
                    <div class="info-grid">
                        <div>
                            <div class="info-item">
                                <div class="info-label">Nombre:</div>
                                <div class="info-value">${cleanOrderData.customer_name}</div>
                            </div>
                            ${cleanOrderData.customer_nit ? `
                            <div class="info-item">
                                <div class="info-label">NIT:</div>
                                <div class="info-value">${cleanOrderData.customer_nit}</div>
                            </div>
                            ` : ''}
                            <div class="info-item">
                                <div class="info-label">Teléfono:</div>
                                <div class="info-value">${cleanOrderData.phone}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Dirección:</div>
                                <div class="info-value">${cleanOrderData.address}</div>
                            </div>
                        </div>
                        <div>
                            <div class="info-item">
                                <div class="info-label">Ciudad:</div>
                                <div class="info-value">${cleanOrderData.city}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Departamento:</div>
                                <div class="info-value">${cleanOrderData.department}</div>
                            </div>
                            ${cleanOrderData.payment_method ? `
                            <div class="info-item">
                                <div class="info-label">Forma de Pago de Envío:</div>
                                <div class="info-value" style="font-weight: bold; color: #e74c3c;">${cleanOrderData.payment_method}</div>
                            </div>
                            ` : ''}
                            <div class="info-item">
                                <div class="info-label">Email:</div>
                                <div class="info-value">${cleanOrderData.email}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
                                <div class="info-value">${orderData.shipping_date ? new Date(orderData.shipping_date).toLocaleDateString('es-CO') : currentDate}</div>
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
