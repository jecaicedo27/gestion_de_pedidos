
// Enhanced quotation controller with better error handling
const { query } = require('../config/database');

class QuotationController {
  // Get quotations with better error handling
  static async getQuotations(req, res) {
    try {
      // Validate and parse query parameters safely
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
      const offset = (page - 1) * limit;
      
      // Check if quotations table exists
      try {
        await query('DESCRIBE quotations');
      } catch (tableError) {
        return res.status(500).json({
          success: false,
          message: 'Database table not found',
          error: 'Quotations table does not exist. Please run database migrations.'
        });
      }
      
      const quotations = await query(`
        SELECT 
          q.id,
          q.quotation_number,
          q.customer_id,
          q.status,
          q.created_at,
          q.updated_at,
          q.siigo_quotation_id,
          q.siigo_quotation_number,
          q.siigo_public_url,
          COALESCE(c.name, c.commercial_name, 'Cliente no encontrado') as customer_name
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        ORDER BY q.created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);
      
      res.json({
        success: true,
        data: quotations,
        pagination: {
          page,
          limit,
          total: quotations.length
        }
      });
    } catch (error) {
      console.error('Error in getQuotations:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving quotations',
        error: error.message,
        details: 'Check backend logs for more information'
      });
    }
  }

  // Enhanced SIIGO invoice creation with better error handling
  static async createSiigoInvoiceWithChatGPT(req, res) {
    try {
      const { customer_id, natural_language_order } = req.body;
      const userId = req.user?.id || 1;

      // Comprehensive validation
      if (!customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required',
          field: 'customer_id'
        });
      }

      if (!natural_language_order || natural_language_order.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order text is required',
          field: 'natural_language_order'
        });
      }

      console.log('🤖 Starting ChatGPT + SIIGO invoice creation...');

      // Check if required services are available
      let customerService, chatgptService, siigoInvoiceService;
      
      try {
        customerService = require('../services/customerService');
        chatgptService = require('../services/chatgptService');
        siigoInvoiceService = require('../services/siigoInvoiceService');
      } catch (serviceError) {
        return res.status(500).json({
          success: false,
          message: 'Required services not available',
          error: serviceError.message,
          details: 'Some backend services are missing or misconfigured'
        });
      }

      // Verify customer exists
      let customer;
      try {
        customer = await customerService.getCustomerById(customer_id);
        if (!customer) {
          return res.status(404).json({
            success: false,
            message: 'Customer not found',
            customer_id
          });
        }
      } catch (customerError) {
        return res.status(500).json({
          success: false,
          message: 'Error verifying customer',
          error: customerError.message
        });
      }

      // Process with ChatGPT
      let processedItems = [];
      try {
        console.log('📝 Processing with ChatGPT...');
        const productCatalog = await chatgptService.getProductCatalog(50);
        const processingResult = await chatgptService.processNaturalLanguageOrder(
          null,
          natural_language_order,
          productCatalog
        );

        if (!processingResult.success) {
          return res.status(422).json({
            success: false,
            message: 'ChatGPT processing failed',
            error: processingResult.error,
            details: 'Unable to process natural language order'
          });
        }

        const enhancedOrder = await chatgptService.enhanceProcessedOrder(
          processingResult.processedOrder
        );

        processedItems = enhancedOrder.items || [];
        console.log(`✅ ChatGPT processed ${processedItems.length} items`);

      } catch (chatgptError) {
        console.error('ChatGPT processing error:', chatgptError);
        
        if (chatgptError.message.includes('QUOTA_EXCEEDED')) {
          return res.status(402).json({
            success: false,
            message: 'ChatGPT quota exceeded',
            errorType: 'QUOTA_EXCEEDED',
            details: 'OpenAI API quota has been reached'
          });
        }

        return res.status(422).json({
          success: false,
          message: 'ChatGPT service error',
          error: chatgptError.message,
          details: 'Unable to process order with AI'
        });
      }

      // Create SIIGO invoice
      try {
        console.log('🎯 Creating SIIGO invoice...');
        
        const siigoInvoiceData = siigoInvoiceService.prepareInvoiceData(
          customer,
          processedItems,
          'Factura generada con ChatGPT',
          natural_language_order
        );

        const siigoResponse = await siigoInvoiceService.createInvoice(siigoInvoiceData);
        
        console.log('✅ SIIGO invoice created successfully');

        // Save to local database (optional, don't fail if this errors)
        try {
          await query(`
            INSERT INTO quotations (
              quotation_number, customer_id, siigo_customer_id,
              siigo_quotation_id, siigo_quotation_number, siigo_public_url,
              raw_request, chatgpt_result, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'invoiced', ?)
          `, [
            siigoResponse.name || `FV-${siigoResponse.id}`,
            customer_id,
            customer.siigo_id,
            siigoResponse.id,
            siigoResponse.name || siigoResponse.number,
            siigoResponse.public_url || siigoResponse.url,
            natural_language_order,
            JSON.stringify({ structured_items: processedItems }),
            userId
          ]);
        } catch (dbSaveError) {
          console.warn('Warning: Could not save to local DB:', dbSaveError.message);
        }

        res.json({
          success: true,
          message: 'Invoice created successfully in SIIGO using ChatGPT',
          data: {
            siigo_invoice_id: siigoResponse.id,
            siigo_invoice_number: siigoResponse.name || siigoResponse.number,
            siigo_public_url: siigoResponse.public_url || siigoResponse.url,
            items_processed: processedItems.length,
            total_amount: siigoResponse.total || siigoInvoiceData.total,
            customer: {
              id: customer_id,
              name: customer.name,
              siigo_id: customer.siigo_id
            },
            chatgpt_stats: {
              items_detected: processedItems.length,
              processing_success: true
            }
          }
        });

      } catch (siigoError) {
        console.error('SIIGO invoice creation error:', siigoError);
        
        return res.status(500).json({
          success: false,
          message: 'SIIGO invoice creation failed',
          error: siigoError.response?.data || siigoError.message,
          details: 'Could not create invoice in SIIGO system'
        });
      }

    } catch (error) {
      console.error('General error in createSiigoInvoiceWithChatGPT:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
        details: 'Unexpected error during invoice creation'
      });
    }
  }

  // Add other methods with similar error handling...
}

module.exports = QuotationController;
