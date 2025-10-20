const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigiendo SiigoInvoiceService para que coincida exactamente con la prueba exitosa...\n');

const serviceFile = './backend/services/siigoInvoiceService.js';

// Leer el archivo actual
const originalContent = fs.readFileSync(serviceFile, 'utf8');

// Crear la versión corregida basada exactamente en la prueba exitosa
const correctedContent = `const axios = require('axios');
const siigoService = require('./siigoService');

class SiigoInvoiceService {
  
  constructor() {
    // Configuración por defecto aplicando EXACTAMENTE lo de la prueba exitosa
    this.defaultConfig = {
      documentId: 15047, // FV-1 - Factura No Electrónica (CONFIRMADO en prueba exitosa)
      seller: 388, // Jhon Caicedo (CONFIRMADO en prueba exitosa)
      defaultPaymentMethod: 3467, // Crédito (CONFIRMADO en prueba exitosa)
      dueDays: 30
      // IMPORTANTE: NO incluir cost_center porque no estaba en la prueba exitosa
    };
  }

  /**
   * Prepara los datos de factura para SIIGO según la estructura EXACTA de la prueba exitosa
   */
  async prepareInvoiceData(customer, items, notes, originalRequest, options = {}) {
    // Validar datos de entrada
    this.validateInputData(customer, items);

    // Configuración final con opciones
    const config = { ...this.defaultConfig, ...options };

    // Formatear items con estructura simple (como la prueba exitosa)
    const formattedItems = await this.formatItems(items);

    // Calcular totales usando los items formateados
    const calculations = this.calculateTotalsFromFormattedItems(formattedItems);

    // Formatear observaciones con límite de caracteres
    const observations = this.formatObservations(notes, originalRequest);

    // Calcular fecha de vencimiento
    const dueDate = this.calculateDueDate(config.dueDays);

    // Formatear datos del cliente según estructura exitosa
    const customerData = this.formatCustomerData(customer);

    // Estructura EXACTA de la prueba exitosa (sin cost_center)
    return {
      document: { 
        id: config.documentId
      },
      date: new Date().toISOString().split('T')[0],
      customer: customerData,
      seller: config.seller,
      observations: observations,
      items: formattedItems,
      payments: [{
        id: config.defaultPaymentMethod,
        value: calculations.total,
        due_date: dueDate
      }]
      // IMPORTANTE: NO incluir cost_center aquí porque no estaba en la prueba exitosa
    };
  }

  /**
   * Valida los datos de entrada antes de procesarlos
   */
  validateInputData(customer, items) {
    const errors = [];

    // Validar cliente
    if (!customer) {
      errors.push('Cliente es requerido');
    } else {
      if (!customer.identification && !customer.document) {
        errors.push('Cliente debe tener número de identificación');
      }
    }

    // Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      errors.push('Debe incluir al menos un item');
    } else {
      items.forEach((item, index) => {
        if (!item.code && !item.product_code && !item.siigo_code) {
          errors.push(\`Item \${index + 1} debe tener código de producto\`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(\`Item \${index + 1} debe tener cantidad válida\`);
        }
        if (!item.price && !item.unit_price && !item.suggested_price) {
          errors.push(\`Item \${index + 1} debe tener precio\`);
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(\`Errores de validación: \${errors.join(', ')}\`);
    }
  }

  /**
   * Calcula totales usando items ya formateados
   */
  calculateTotalsFromFormattedItems(formattedItems) {
    const subtotal = formattedItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 1);
      const price = parseFloat(item.price || 0);
      return sum + (quantity * price);
    }, 0);

    const taxRate = 0.19; // 19% IVA
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }

  /**
   * Formatea las observaciones con límite de caracteres
   */
  formatObservations(notes, originalRequest) {
    let observations = '';
    
    if (originalRequest) {
      const truncatedRequest = originalRequest.length > 500 
        ? originalRequest.substring(0, 500) + '...' 
        : originalRequest;
      observations += \`Pedido original: \${truncatedRequest}\\n\\n\`;
    }
    
    if (notes) {
      observations += notes + '\\n\\n';
    }
    
    observations += 'Factura generada automáticamente desde sistema interno usando ChatGPT.';
    
    // Limitar a 4000 caracteres según documentación oficial
    return observations.length > 4000 ? observations.substring(0, 3997) + '...' : observations;
  }

  /**
   * Calcula fecha de vencimiento en formato yyyy-MM-dd
   */
  calculateDueDate(dueDays = 30) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    return dueDate.toISOString().split('T')[0];
  }

  /**
   * Formatea datos del cliente según la estructura EXACTA de la prueba exitosa
   */
  formatCustomerData(customer) {
    // Estructura EXACTA de la prueba exitosa
    let customerData = {
      branch_office: 0 // Valor por defecto según prueba exitosa
    };

    // Obtener identificación del cliente
    const identification = customer.identification || customer.document;
    
    if (!identification) {
      throw new Error('Cliente debe tener número de identificación para crear factura en SIIGO');
    }

    // Limpiar identificación
    const cleanIdentification = identification.toString().trim();
    
    customerData.identification = cleanIdentification;
    
    // Si se especifica sucursal, usarla
    if (customer.branch_office !== undefined && customer.branch_office !== null) {
      customerData.branch_office = parseInt(customer.branch_office) || 0;
    }

    return customerData;
  }

  /**
   * Formatea los items según la estructura EXACTA de la prueba exitosa
   * Simplificado - sin obtener precios de SIIGO para evitar errores
   */
  async formatItems(items) {
    const formattedItems = [];
    
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const quantity = parseFloat(item.quantity || 1);
      
      // Obtener código del producto (obligatorio)
      let productCode = item.code || item.product_code || item.siigo_code;
      
      if (!productCode) {
        // Si no hay código, generar uno temporal
        const productName = item.product_name || item.description || \`Producto \${index + 1}\`;
        productCode = productName
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 10)
          .toUpperCase() + (index + 1).toString().padStart(2, '0');
        
        console.warn(\`⚠️ Item \${index + 1} no tiene código, usando temporal: \${productCode}\`);
      }

      // Usar precio proporcionado directamente (como en la prueba exitosa)
      let price = parseFloat(item.price || item.unit_price || item.suggested_price || 0);
      
      console.log(\`✅ Item \${index + 1}: \${productCode} - Cantidad: \${quantity} - Precio: \${price}\`);
      
      // Estructura EXACTA según la prueba exitosa
      const formattedItem = {
        code: productCode, // Campo obligatorio
        quantity: quantity, // Campo obligatorio
        price: price // Campo obligatorio
      };

      // Descripción (opcional - incluir si está disponible)
      if (item.description || item.product_name) {
        formattedItem.description = (item.description || item.product_name).substring(0, 100);
      }

      // NO incluir taxes, discount u otros campos que no estaban en la prueba exitosa

      formattedItems.push(formattedItem);
    }

    return formattedItems;
  }

  /**
   * Crea una factura en SIIGO siguiendo la estructura EXACTA de la prueba exitosa
   */
  async createInvoice(invoiceData) {
    try {
      console.log('📋 Creando factura en SIIGO con estructura exacta de prueba exitosa...');
      console.log('📊 Datos de factura:', JSON.stringify(invoiceData, null, 2));
      
      const token = await siigoService.authenticate();
      
      const response = await axios.post(
        \`\${siigoService.getBaseUrl()}/v1/invoices\`,
        invoiceData,
        {
          headers: {
            'Authorization': \`Bearer \${token}\`,
            'Content-Type': 'application/json',
            'Partner-Id': 'siigo'
          },
          timeout: 30000
        }
      );

      console.log('✅ Factura creada exitosamente en SIIGO:', response.data);
      
      return {
        success: true,
        data: response.data,
        invoiceNumber: response.data?.number || response.data?.id,
        siigoId: response.data?.id
      };

    } catch (error) {
      console.error('❌ Error creando factura en SIIGO:', error.response?.data || error.message);
      
      return this.handleCreateInvoiceError(error);
    }
  }

  /**
   * Maneja errores específicos de creación de factura
   */
  handleCreateInvoiceError(error) {
    if (error.response?.status === 400) {
      return {
        success: false,
        error: 'Error de validación en SIIGO',
        details: error.response.data,
        message: 'Los datos enviados no cumplen con el formato requerido por SIIGO',
        suggestions: this.generateErrorSuggestions(error.response.data)
      };
    }
    
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Error de autenticación',
        message: 'Token de acceso inválido o expirado'
      };
    }
    
    if (error.response?.status === 422) {
      return {
        success: false,
        error: 'Error de procesamiento',
        details: error.response.data,
        message: 'Error en el procesamiento de los datos por parte de SIIGO'
      };
    }
    
    return {
      success: false,
      error: 'Error inesperado',
      message: error.message || 'Error desconocido al crear factura'
    };
  }

  /**
   * Genera sugerencias basadas en el tipo de error
   */
  generateErrorSuggestions(errorData) {
    const suggestions = [];
    
    if (errorData?.errors) {
      Object.keys(errorData.errors).forEach(field => {
        switch (field) {
          case 'customer':
          case 'customer.identification':
            suggestions.push('Verificar que el cliente esté registrado en SIIGO con la identificación correcta');
            break;
          case 'items':
          case 'items.code':
            suggestions.push('Verificar que los códigos de productos existan en SIIGO y estén activos');
            break;
          case 'items.price':
            suggestions.push('Verificar que los precios sean válidos (máximo 6 decimales)');
            break;
          case 'items.quantity':
            suggestions.push('Verificar que las cantidades sean válidas (máximo 2 decimales)');
            break;
          case 'payments':
            suggestions.push('Verificar método de pago y montos');
            break;
          case 'document':
          case 'document.id':
            suggestions.push('Verificar que el tipo de documento existe en SIIGO');
            break;
          case 'seller':
            suggestions.push('Verificar que el vendedor existe en SIIGO y está activo');
            break;
          default:
            suggestions.push(\`Verificar campo: \${field}\`);
        }
      });
    } else {
      suggestions.push('Revisar que todos los datos requeridos estén presentes');
      suggestions.push('Verificar que cliente y productos existan en SIIGO');
    }
    
    return suggestions;
  }

  /**
   * Valida si los datos del cliente son suficientes para facturar
   */
  validateCustomerData(customer) {
    const errors = [];
    
    if (!customer) {
      errors.push('Cliente es requerido');
      return { valid: false, errors };
    }
    
    // Validar identificación (obligatoria)
    const identification = customer.identification || customer.document;
    if (!identification) {
      errors.push('El cliente debe tener número de identificación');
    } else {
      const doc = identification.toString().trim();
      if (doc.length < 6 || doc.length > 15) {
        errors.push('Identificación debe tener entre 6 y 15 caracteres');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtiene el detalle de una factura de SIIGO
   */
  async getInvoice(invoiceId) {
    try {
      console.log(\`📋 Obteniendo factura \${invoiceId} de SIIGO...\`);
      
      const token = await siigoService.authenticate();
      
      const response = await axios.get(
        \`\${siigoService.getBaseUrl()}/v1/invoices/\${invoiceId}\`,
        {
          headers: {
            'Authorization': \`Bearer \${token}\`,
            'Content-Type': 'application/json',
            'Partner-Id': 'siigo'
          }
        }
      );

      console.log('✅ Factura obtenida exitosamente');
      return response.data;
      
    } catch (error) {
      console.error('❌ Error obteniendo factura de SIIGO:', error.message);
      throw error;
    }
  }

  /**
   * Lista facturas con filtros opcionales
   */
  async listInvoices(filters = {}) {
    try {
      console.log('📋 Listando facturas de SIIGO...');
      
      const token = await siigoService.authenticate();
      
      const params = new URLSearchParams();
      if (filters.created_start) params.append('created_start', filters.created_start);
      if (filters.created_end) params.append('created_end', filters.created_end);
      if (filters.updated_start) params.append('updated_start', filters.updated_start);
      if (filters.updated_end) params.append('updated_end', filters.updated_end);
      
      const response = await axios.get(
        \`\${siigoService.getBaseUrl()}/v1/invoices\${params.toString() ? '?' + params.toString() : ''}\`,
        {
          headers: {
            'Authorization': \`Bearer \${token}\`,
            'Content-Type': 'application/json',
            'Partner-Id': 'siigo'
          }
        }
      );

      console.log(\`✅ \${response.data.results?.length || 0} facturas obtenidas\`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Error listando facturas de SIIGO:', error.message);
      throw error;
    }
  }
}

module.exports = new SiigoInvoiceService();`;

// Crear backup del archivo original
const backupFile = serviceFile + '.backup.' + Date.now();
fs.writeFileSync(backupFile, originalContent);

// Escribir la versión corregida
fs.writeFileSync(serviceFile, correctedContent);

console.log('✅ SiigoInvoiceService corregido exitosamente');
console.log(`📁 Backup creado: ${backupFile}`);
console.log('\n🔧 CAMBIOS REALIZADOS:');
console.log('✅ Eliminado cost_center (no estaba en la prueba exitosa)');
console.log('✅ Simplificado formatItems (sin obtener precios de SIIGO)');
console.log('✅ Estructura EXACTA de la prueba exitosa');
console.log('✅ Document ID: 15047 (confirmado)');
console.log('✅ Seller: 388 (confirmado)');
console.log('✅ Payment Method: 3467 (confirmado)');
console.log('\n🎯 El servicio ahora usa la estructura exacta que funcionó en la prueba con documento 1082746400');
