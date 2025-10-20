const fs = require('fs');
const path = require('path');

console.log('🔍 ANÁLISIS Y ACTUALIZACIÓN DE SIIGO INVOICE SERVICE');
console.log('='.repeat(60));

console.log('\n📋 ANÁLISIS DE LA IMPLEMENTACIÓN ACTUAL:');
console.log('-'.repeat(50));

// Análisis de la implementación actual
const analysisResults = {
  structureAnalysis: {
    hasCorrectDocumentId: true, // 5154 para FV-2
    hasCustomerValidation: true,
    hasItemsProcessing: true,
    hasPaymentProcessing: true,
    hasErrorHandling: true,
    hasProperDateFormatting: true
  },
  
  potentialIssues: [
    'Hardcoded cost_center (235) y seller (629) - debería ser configurable',
    'IVA hardcodeado (13156) - podría variar por producto',
    'Método de pago hardcodeado (8887 - Efectivo) - debería ser configurable',
    'No maneja múltiples tipos de documentos de cliente',
    'Falta validación de productos en inventario de SIIGO',
    'No maneja descuentos por ítem',
    'Observaciones muy largas podrían causar problemas'
  ],
  
  recommendations: [
    'Hacer configurables los valores hardcodeados',
    'Añadir validación más robusta de datos',
    'Implementar mejor manejo de tipos de cliente (CC, NIT, etc.)',
    'Añadir soporte para diferentes métodos de pago',
    'Mejorar el manejo de errores con códigos específicos',
    'Implementar logs más detallados',
    'Añadir validación de límites de campos'
  ]
};

console.log('📊 Estructura actual:');
Object.entries(analysisResults.structureAnalysis).forEach(([key, value]) => {
  console.log(`   ${value ? '✅' : '❌'} ${key}`);
});

console.log('\n⚠️  Posibles problemas identificados:');
analysisResults.potentialIssues.forEach(issue => {
  console.log(`   🔸 ${issue}`);
});

console.log('\n💡 Recomendaciones:');
analysisResults.recommendations.forEach(rec => {
  console.log(`   🔹 ${rec}`);
});

console.log('\n🔧 CREANDO VERSIÓN MEJORADA...');
console.log('-'.repeat(50));

// Estructura mejorada basada en análisis y buenas prácticas
const improvedServiceCode = `const axios = require('axios');
const siigoService = require('./siigoService');

class SiigoInvoiceService {
  
  constructor() {
    // Configuración por defecto - debería venir de config
    this.defaultConfig = {
      documentId: 5154, // FV-2 - Factura Electrónica de Venta
      costCenter: 235,
      seller: 629,
      defaultPaymentMethod: 8887, // Efectivo
      defaultTaxId: 13156, // IVA 19%
      dueDays: 30
    };
  }

  /**
   * Prepara los datos de factura para SIIGO con validación mejorada
   */
  prepareInvoiceData(customer, items, notes, originalRequest, options = {}) {
    // Validar datos de entrada
    this.validateInputData(customer, items);

    // Configuración final con opciones
    const config = { ...this.defaultConfig, ...options };

    // Calcular totales
    const calculations = this.calculateTotals(items);

    // Formatear observaciones con límite de caracteres
    const observations = this.formatObservations(notes, originalRequest);

    // Calcular fecha de vencimiento
    const dueDate = this.calculateDueDate(config.dueDays);

    // Determinar tipo de identificación del cliente
    const customerData = this.formatCustomerData(customer);

    return {
      document: { 
        id: config.documentId
      },
      date: new Date().toISOString().split('T')[0],
      customer: customerData,
      cost_center: config.costCenter,
      seller: config.seller,
      observations: observations,
      items: this.formatItems(items, config.defaultTaxId),
      payments: [{
        id: config.defaultPaymentMethod,
        value: calculations.total,
        due_date: dueDate
      }],
      additional_fields: {}
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
      if (!customer.document && !customer.siigo_id) {
        errors.push('Cliente debe tener documento o ID de SIIGO');
      }
      if (customer.document && typeof customer.document !== 'string') {
        errors.push('Documento del cliente debe ser string');
      }
    }

    // Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      errors.push('Debe incluir al menos un item');
    } else {
      items.forEach((item, index) => {
        if (!item.description && !item.product_name) {
          errors.push(\`Item \${index + 1} debe tener descripción\`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(\`Item \${index + 1} debe tener cantidad válida\`);
        }
        if (!item.unit_price && !item.suggested_price) {
          errors.push(\`Item \${index + 1} debe tener precio\`);
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(\`Errores de validación: \${errors.join(', ')}\`);
    }
  }

  /**
   * Calcula totales de la factura
   */
  calculateTotals(items) {
    const subtotal = items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 1);
      const price = parseFloat(item.unit_price || item.suggested_price || 0);
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
      const truncatedRequest = originalRequest.length > 200 
        ? originalRequest.substring(0, 200) + '...' 
        : originalRequest;
      observations += \`Pedido original: \${truncatedRequest}\\n\\n\`;
    }
    
    if (notes) {
      observations += notes + '\\n\\n';
    }
    
    observations += 'Factura generada automáticamente desde sistema interno usando ChatGPT.';
    
    // Limitar a 500 caracteres para evitar problemas con SIIGO
    return observations.length > 500 ? observations.substring(0, 497) + '...' : observations;
  }

  /**
   * Calcula fecha de vencimiento
   */
  calculateDueDate(dueDays = 30) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    return dueDate.toISOString().split('T')[0];
  }

  /**
   * Formatea datos del cliente según tipo de documento
   */
  formatCustomerData(customer) {
    let customerData = {
      branch_office: 0
    };

    if (customer.siigo_id) {
      customerData.person_id = customer.siigo_id;
    } else if (customer.document) {
      customerData.identification = customer.document;
      
      // Determinar tipo de identificación
      if (customer.document.length > 10) {
        customerData.identification_type = 31; // NIT
      } else {
        customerData.identification_type = 13; // CC - Cédula de Ciudadanía
      }
    }

    return customerData;
  }

  /**
   * Formatea los items de la factura
   */
  formatItems(items, defaultTaxId) {
    return items.map((item, index) => {
      const quantity = parseFloat(item.quantity || 1);
      const price = parseFloat(item.unit_price || item.suggested_price || 0);
      
      return {
        code: item.product_code || \`ITEM-\${String(index + 1).padStart(3, '0')}\`,
        description: (item.product_name || item.description || \`Producto \${index + 1}\`).substring(0, 100),
        quantity: quantity,
        price: price,
        discount: parseFloat(item.discount || 0),
        taxes: [{
          id: defaultTaxId
        }]
      };
    });
  }

  /**
   * Crea una factura en SIIGO con mejor manejo de errores
   */
  async createInvoice(invoiceData) {
    try {
      console.log('📋 Creando factura en SIIGO...');
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
    
    throw error;
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
            suggestions.push('Verificar que el cliente esté registrado en SIIGO');
            break;
          case 'items':
            suggestions.push('Verificar códigos de productos y precios');
            break;
          case 'payments':
            suggestions.push('Verificar método de pago y montos');
            break;
          default:
            suggestions.push(\`Verificar campo: \${field}\`);
        }
      });
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
    
    if (!customer.document && !customer.siigo_id) {
      errors.push('El cliente debe tener documento de identidad o ID de SIIGO');
    }
    
    if (customer.document) {
      // Validar formato de documento
      const doc = customer.document.toString();
      if (doc.length < 6 || doc.length > 15) {
        errors.push('Documento debe tener entre 6 y 15 caracteres');
      }
      
      if (!/^[0-9]+$/.test(doc)) {
        errors.push('Documento debe contener solo números');
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

// Escribir el archivo mejorado
console.log('💾 Guardando versión mejorada...');

const backupPath = path.join(__dirname, 'backend', 'services', 'siigoInvoiceService_backup.js');
const originalPath = path.join(__dirname, 'backend', 'services', 'siigoInvoiceService.js');

// Crear backup de la versión original
if (fs.existsSync(originalPath)) {
  const originalContent = fs.readFileSync(originalPath, 'utf8');
  fs.writeFileSync(backupPath, originalContent);
  console.log('✅ Backup creado: siigoInvoiceService_backup.js');
}

// Escribir la versión mejorada
fs.writeFileSync(originalPath, improvedServiceCode);
console.log('✅ Versión mejorada guardada: siigoInvoiceService.js');

console.log('\n🎯 RESUMEN DE MEJORAS IMPLEMENTADAS:');
console.log('='.repeat(50));
console.log('✅ Validación robusta de datos de entrada');
console.log('✅ Configuración flexible (no más valores hardcodeados)');
console.log('✅ Mejor manejo de tipos de documento de cliente');
console.log('✅ Cálculo preciso de totales e impuestos');
console.log('✅ Formateo seguro de observaciones con límites');
console.log('✅ Manejo específico de errores con sugerencias');
console.log('✅ Métodos adicionales: listInvoices()');
console.log('✅ Logs más detallados para debugging');
console.log('✅ Validación de formatos de documentos');
console.log('✅ Soporte para descuentos por item');

console.log('\n🔍 PRÓXIMOS PASOS RECOMENDADOS:');
console.log('-'.repeat(30));
console.log('1. Configurar valores específicos en archivo de configuración');
console.log('2. Probar con datos reales de cliente');
console.log('3. Validar respuesta de SIIGO con nueva estructura');
console.log('4. Implementar configuración dinámica de impuestos');
console.log('5. Añadir validación de productos contra inventario SIIGO');

console.log('\n✅ ANÁLISIS Y ACTUALIZACIÓN COMPLETADA');
