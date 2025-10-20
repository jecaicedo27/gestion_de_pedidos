const axios = require('axios');
const siigoService = require('./siigoService');

class SiigoInvoiceService {
  
  /**
   * Prepara los datos de factura para SIIGO
   */
  prepareInvoiceData(customer, items, notes, originalRequest) {
    // Calcular el total
    const subtotal = items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 1);
      const price = parseFloat(item.unit_price || item.suggested_price || 1000);
      return sum + (quantity * price);
    }, 0);

    // Formatear observaciones
    let observations = notes || '';
    if (originalRequest) {
      observations = `Pedido original: ${originalRequest.substring(0, 200)}...\n\n${observations ? observations + '\n\n' : ''}Factura generada automáticamente desde sistema interno usando ChatGPT.`;
    }

    // Calcular fecha de vencimiento (30 días por defecto)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return {
      document: { 
        id: 5154 // FV-2 - Factura Electrónica de Venta
      },
      date: new Date().toISOString().split('T')[0],
      customer: {
        identification: customer.document,
        branch_office: 0
      },
      cost_center: 235,
      seller: 629,
      observations: observations,
      items: items.map((item, index) => ({
        code: item.product_code || `ITEM-${index + 1}`,
        description: item.product_name || item.description || `Producto ${index + 1}`,
        quantity: parseFloat(item.quantity || 1),
        price: parseFloat(item.unit_price || item.suggested_price || 1000),
        discount: 0,
        taxes: [{
          id: 13156 // IVA 19%
        }]
      })),
      payments: [{
        id: 8887, // Efectivo
        value: subtotal * 1.19, // Total con IVA
        due_date: dueDate.toISOString().split('T')[0]
      }],
      additional_fields: {}
    };
  }

  /**
   * Crea una factura en SIIGO
   */
  async createInvoice(invoiceData) {
    try {
      console.log('📋 Creando factura en SIIGO...');
      
      const token = await siigoService.authenticate();
      
      const response = await axios.post(
        `${siigoService.getBaseUrl()}/v1/invoices`,
        invoiceData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'siigo'
          },
          timeout: 30000
        }
      );

      console.log('✅ Factura creada exitosamente en SIIGO:', response.data);
      
      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('❌ Error creando factura en SIIGO:', error.response?.data || error.message);
      
      // Si el error es por el formato de datos, retornamos información útil
      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'Error de validación en SIIGO',
          details: error.response.data,
          message: 'Los datos enviados no cumplen con el formato requerido por SIIGO'
        };
      }
      
      throw error;
    }
  }

  /**
   * Valida si los datos del cliente son suficientes para facturar
   */
  validateCustomerData(customer) {
    const errors = [];
    
    if (!customer.document) {
      errors.push('El cliente no tiene documento de identidad');
    }
    
    if (!customer.siigo_id && !customer.document) {
      errors.push('El cliente no está registrado en SIIGO');
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
      const token = await siigoService.authenticate();
      
      const response = await axios.get(
        `${siigoService.getBaseUrl()}/v1/invoices/${invoiceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'siigo'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error obteniendo factura de SIIGO:', error.message);
      throw error;
    }
  }
}

module.exports = new SiigoInvoiceService();
