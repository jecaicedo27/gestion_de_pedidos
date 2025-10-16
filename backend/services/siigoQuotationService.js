const axios = require('axios');
const siigoService = require('./siigoService');

class SiigoQuotationService {
  
  /**
   * Prepara los datos de cotización para SIIGO
   */
  prepareQuotationData(customer, items, notes, originalRequest) {
    // Calcular el total
    const total = items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 1);
      const price = parseFloat(item.unit_price || item.suggested_price || 1000);
      return sum + (quantity * price);
    }, 0);

    // Formatear observaciones
    let observations = notes || '';
    if (originalRequest) {
      observations = `Pedido original: ${originalRequest.substring(0, 200)}...${observations ? '\n\n' + observations : ''}\n\nCotización generada automáticamente desde sistema interno usando ChatGPT.`;
    }

    return {
      // Por ahora usamos la estructura de facturas ya que no hay endpoint de cotizaciones
      document: { 
        id: 1 // Factura de venta - temporal mientras no haya endpoint de cotizaciones
      },
      date: new Date().toISOString().split('T')[0],
      due_date: this.calculateDueDate(30),
      customer: {
        id: customer.siigo_id,
        identification: customer.document,
        name: customer.name || customer.commercial_name
      },
      seller: 1,
      observations: observations,
      items: items.map((item, index) => ({
        code: item.product_code || `ITEM-${index + 1}`,
        description: item.product_name || item.description || `Producto ${index + 1}`,
        quantity: parseFloat(item.quantity || 1),
        price: parseFloat(item.unit_price || item.suggested_price || 1000),
        discount: 0,
        taxes: [],
        total: parseFloat(item.quantity || 1) * parseFloat(item.unit_price || item.suggested_price || 1000)
      })),
      payments: [],
      currency: {
        code: 'COP',
        exchange_rate: 1
      },
      total: total,
      balance: 0
    };
  }

  /**
   * Crea una cotización en SIIGO (temporalmente como borrador de factura)
   * NOTA: SIIGO no tiene endpoint de cotizaciones, por lo que por ahora
   * solo retornamos una respuesta simulada
   */
  async createQuotation(quotationData) {
    try {
      console.log('⚠️ SIIGO no tiene endpoint de cotizaciones disponible');
      console.log('📋 Retornando respuesta simulada para mostrar en UI');
      
      // Respuesta simulada mientras SIIGO no tenga endpoint de cotizaciones
      const simulatedResponse = {
        id: `TEMP-${Date.now()}`,
        name: `COT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        number: String(Math.floor(Math.random() * 10000)),
        date: quotationData.date,
        customer: quotationData.customer,
        items: quotationData.items,
        total: quotationData.total,
        status: 'draft',
        public_url: null,
        pdf_url: null,
        message: 'Cotización preparada (SIIGO no soporta cotizaciones vía API)',
        note: 'Los datos han sido procesados correctamente por ChatGPT y están listos para ser ingresados manualmente en SIIGO'
      };

      return simulatedResponse;

    } catch (error) {
      console.error('❌ Error en createQuotation:', error.message);
      throw error;
    }
  }

  /**
   * Calcula la fecha de vencimiento
   */
  calculateDueDate(days = 30) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Valida si SIIGO soporta cotizaciones
   */
  async checkQuotationSupport() {
    try {
      const headers = await siigoService.getHeaders();
      
      // Intentar obtener tipos de documentos
      const response = await axios.get(`${siigoService.getBaseUrl()}/v1/document-types?type=sales`, {
        headers
      });

      // Buscar si hay algún tipo de documento de cotización
      const quotationTypes = response.data.filter(doc => 
        doc.name?.toLowerCase().includes('cotiz') || 
        doc.name?.toLowerCase().includes('quote') ||
        doc.code === 'COT'
      );

      return {
        supported: quotationTypes.length > 0,
        types: quotationTypes
      };
    } catch (error) {
      console.error('Error verificando soporte de cotizaciones:', error.message);
      return {
        supported: false,
        types: []
      };
    }
  }
}

module.exports = new SiigoQuotationService();
