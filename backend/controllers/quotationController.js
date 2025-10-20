const { query } = require('../config/database');
const customerService = require('../services/customerService');
const chatgptService = require('../services/chatgptService');
const siigoService = require('../services/siigoService');
const siigoInvoiceService = require('../services/siigoInvoiceService');

class QuotationController {
  // Buscar clientes
  static async searchCustomers(req, res) {
    try {
      const { q: searchQuery, limit } = req.query;
      
      if (!searchQuery || searchQuery.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'La consulta debe tener al menos 2 caracteres'
        });
      }

      const customers = await customerService.searchCustomers(searchQuery.trim(), limit || 20);
      
      res.json({
        success: true,
        customers: customers,
        data: customers
      });
    } catch (error) {
      console.error('Error buscando clientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Sincronizar clientes desde SIIGO
  static async syncCustomers(req, res) {
    try {
      console.log('🔄 Iniciando sincronización de clientes desde SIIGO...');
      
      const result = await customerService.syncCustomersFromSiigo();
      
      if (result.success) {
        res.json({
          success: true,
          message: `Sincronización completada: ${result.totalSynced} clientes`,
          data: {
            totalSynced: result.totalSynced
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error en la sincronización',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error sincronizando clientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener estadísticas de clientes
  static async getCustomerStats(req, res) {
    try {
      const stats = await customerService.getCustomerStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Crear nueva cotización
  static async createQuotation(req, res) {
    try {
      const { customerId, rawRequest, requestType = 'text' } = req.body;
      const userId = req.user.id;

      // Validar datos requeridos
      if (!customerId || !rawRequest) {
        return res.status(400).json({
          success: false,
          message: 'Cliente y pedido son requeridos'
        });
      }

      // Verificar que el cliente existe
      const customer = await customerService.getCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Generar número de cotización
      const quotationNumber = await QuotationController.generateQuotationNumber();

      // Crear cotización en estado draft
      const result = await query(`
        INSERT INTO quotations (
          quotation_number, customer_id, siigo_customer_id, raw_request,
          status, created_by
        ) VALUES (?, ?, ?, ?, 'draft', ?)
      `, [
        quotationNumber,
        customerId,
        customer.siigo_id,
        rawRequest,
        userId
      ]);

      const quotationId = result.insertId;

      res.json({
        success: true,
        message: 'Cotización creada exitosamente',
        data: {
          quotationId,
          quotationNumber,
          customerId,
          status: 'draft'
        }
      });
    } catch (error) {
      console.error('Error creando cotización:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Procesar pedido en lenguaje natural con ChatGPT
  static async processNaturalLanguageOrder(req, res) {
    try {
      const { customer_id, natural_language_order, processing_type = 'text' } = req.body;

      // Validar datos requeridos
      if (!customer_id || !natural_language_order) {
        return res.status(400).json({
          success: false,
          message: 'Cliente y pedido son requeridos'
        });
      }

      console.log('🤖 Procesando pedido con ChatGPT...');

      // Obtener catálogo de productos para contexto
      const productCatalog = await chatgptService.getProductCatalog(50);

      // Procesar con ChatGPT
      const processingResult = await chatgptService.processNaturalLanguageOrder(
        `temp-${Date.now()}`, // ID temporal
        natural_language_order,
        productCatalog
      );

      if (!processingResult.success) {
        return res.status(422).json({
          success: false,
          message: 'Error procesando el pedido con ChatGPT',
          error: processingResult.error
        });
      }

      // Mejorar el pedido procesado
      const enhancedOrder = await chatgptService.enhanceProcessedOrder(
        processingResult.processedOrder
      );

      // Manejar diferentes formatos de respuesta de ChatGPT
      let processedItems = [];
      
      // Si enhancedOrder tiene items, usarlos
      if (enhancedOrder.items && Array.isArray(enhancedOrder.items)) {
        processedItems = enhancedOrder.items;
      } 
      // Si enhancedOrder es directamente un array (respuesta del Assistant)
      else if (Array.isArray(enhancedOrder)) {
        // Si es un array anidado [[items]]
        if (enhancedOrder.length > 0 && Array.isArray(enhancedOrder[0])) {
          processedItems = enhancedOrder[0];
        } else {
          processedItems = enhancedOrder;
        }
      }

      // Convertir items al formato esperado si vienen del Assistant con estructura simple
      if (processedItems.length > 0 && processedItems[0].codigo) {
        processedItems = processedItems.map(item => ({
          product_code: item.codigo || '',
          product_name: item.nombre || '',
          quantity: parseInt(item.cantidad) || 1,
          unit_price: parseFloat(item.precio) || parseFloat(item.unit_price) || 1000,
          confidence_score: item.confidence || 0.9,
          unit: item.unit || 'unidades'
        }));
      }
      
      // Asegurar que todos los items tengan precios válidos
      processedItems = processedItems.map(item => ({
        ...item,
        unit_price: item.unit_price || 1000, // Precio por defecto si es 0 o undefined
        quantity: item.quantity || 1,
        product_name: item.product_name || 'Producto no identificado'
      }));

      // Devolver la estructura optimizada sin duplicación
      res.json({
        success: true,
        message: 'Pedido procesado exitosamente con ChatGPT',
        data: {
          // Solo devolver los items estructurados una vez
          structured_items: processedItems,
          average_confidence: enhancedOrder.confidence || 0.8,
          // Metadatos del procesamiento
          processing_metadata: {
            processing_id: `chatgpt-${Date.now()}`,
            original_request: natural_language_order,
            processing_time_ms: processingResult.processingTimeMs || 0,
            tokens_used: processingResult.tokensUsed || 0,
            assistant_id: processingResult.assistantId || null
          }
        }
      });
    } catch (error) {
      console.error('Error en processNaturalLanguageOrder:', error);
      
      if (error.message.includes('QUOTA_EXCEEDED')) {
        return res.status(402).json({
          success: false,
          message: 'Cuota de ChatGPT excedida',
          details: 'La cuenta de OpenAI ha alcanzado su límite de uso. Contacte al administrador para renovar los créditos.',
          errorType: 'QUOTA_EXCEEDED'
        });
      }
      
      return res.status(422).json({
        success: false,
        message: 'Error al procesar con ChatGPT',
        details: error.message
      });
    }
  }

  // Procesar imagen con ChatGPT
  static async processImageOrder(req, res) {
    try {
      const { customer_id, processing_type = 'image' } = req.body;
      
      if (!customer_id || !req.files || !req.files.image) {
        return res.status(400).json({
          success: false,
          message: 'Cliente e imagen son requeridos'
        });
      }

      console.log('🖼️ Procesando imagen con ChatGPT...');

      // Convertir imagen a base64
      const imageBuffer = req.files.image.data;
      const imageBase64 = imageBuffer.toString('base64');

      // Obtener catálogo de productos para contexto
      const productCatalog = await chatgptService.getProductCatalog(50);

      // Procesar con ChatGPT
      const processingResult = await chatgptService.processImageOrder(
        `temp-${Date.now()}`, // ID temporal
        imageBase64,
        productCatalog
      );

      if (!processingResult.success) {
        return res.status(422).json({
          success: false,
          message: 'Error procesando la imagen con ChatGPT',
          error: processingResult.error
        });
      }

      // Mejorar el pedido procesado
      const enhancedOrder = await chatgptService.enhanceProcessedOrder(
        processingResult.processedOrder
      );

      res.json({
        success: true,
        message: 'Imagen procesada exitosamente con ChatGPT',
        data: {
          processing_id: `chatgpt-img-${Date.now()}`,
          structured_items: enhancedOrder.items || [],
          average_confidence: enhancedOrder.confidence || 0.7,
          processing_notes: 'Procesado desde imagen con ChatGPT',
          processing_time_ms: processingResult.processingTimeMs || 0,
          tokens_used: processingResult.tokensUsed || 0
        }
      });
    } catch (error) {
      console.error('Error en processImageOrder:', error);
      
      if (error.message.includes('QUOTA_EXCEEDED')) {
        return res.status(402).json({
          success: false,
          message: 'Cuota de ChatGPT excedida',
          details: 'La cuenta de OpenAI ha alcanzado su límite de uso. Contacte al administrador para renovar los créditos.',
          errorType: 'QUOTA_EXCEEDED'
        });
      }
      
      return res.status(422).json({
        success: false,
        message: 'Error al procesar con ChatGPT',
        details: error.message
      });
    }
  }

  // Crear factura desde cotización por ID o directamente con items
  static async createInvoice(req, res) {
    try {
      const { 
        quotationId,
        customer_id,
        items,
        notes,
        document_type = 'FV-1',
        documentType,
        natural_language_order,
        chatgpt_processing_id 
      } = req.body;
      
      const userId = req.user.id;
      const finalDocumentType = document_type || documentType || 'FV-1';

      console.log('📋 Creando factura...');
      console.log('Parámetros recibidos:', {
        quotationId,
        customer_id,
        itemsCount: items?.length,
        document_type: finalDocumentType
      });

      // Caso 1: Crear desde cotización existente
      if (quotationId) {
        console.log('Creando desde cotización ID:', quotationId);
        
        // Obtener la cotización desde la base de datos
        console.log('🔍 Buscando cotización en base de datos...');
        const quotations = await query(`
        SELECT q.*, c.id as customer_id, c.name as customer_name, 
               c.identification as customer_identification, c.siigo_id as customer_siigo_id,
               c.commercial_name
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        WHERE q.id = ? OR q.quotation_number = ?
      `, [quotationId, quotationId]);

      if (quotations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cotización no encontrada'
        });
      }

      const quotationData = quotations[0];
      console.log('✅ Cotización encontrada:', quotationData.quotation_number);

      // Verificar que tenga cliente
      if (!quotationData.customer_id) {
        return res.status(400).json({
          success: false,
          message: 'La cotización no tiene cliente asociado'
        });
      }

      // Preparar datos del cliente en formato esperado por siigoInvoiceService
      const customer = {
        id: quotationData.customer_id,
        identification: quotationData.customer_identification,
        name: quotationData.customer_name || quotationData.commercial_name,
        commercial_name: quotationData.commercial_name,
        siigo_id: quotationData.customer_siigo_id
      };

      console.log('👤 Cliente asociado:', customer.name, '- ID SIIGO:', customer.siigo_id);
      // Validación temprana: el cliente debe tener identificación para SIIGO
      if (!customer.identification) {
        return res.status(422).json({
          success: false,
          message: 'Cliente sin identificación. Actualice el documento del cliente antes de facturar.',
          error_type: 'VALIDATION_ERROR',
          field: 'customer.identification'
        });
      }

      // Obtener items de la cotización o usar los proporcionados
      // Si vienen items en el request, usarlos (para facturas desde el frontend)
      // Si no, intentar obtenerlos de la base de datos
      let itemsToUse = items;
      
      if (!itemsToUse || itemsToUse.length === 0) {
        // Intentar obtener items de la tabla quotation_items
        const quotationItems = await query(`
          SELECT * FROM quotation_items WHERE quotation_id = ?
        `, [quotationData.id]).catch(err => {
          console.log('⚠️ No se pudieron obtener items de quotation_items:', err.message);
          return [];
        });
        
        if (quotationItems.length > 0) {
          itemsToUse = quotationItems.map(item => ({
            code: item.product_code || item.code,
            product_name: item.product_name || item.description,
            quantity: item.quantity || 1,
            price: item.unit_price || item.price || 0,
            siigo_code: item.siigo_code || item.product_code
          }));
        } else {
          // Si no hay items en la BD, usar items de ejemplo
          console.log('⚠️ No hay items guardados, usando items de ejemplo');
          itemsToUse = [
            {
              code: 'IMPLE04',
              product_name: 'Implemento de Prueba',
              quantity: 1,
              price: 106,
              siigo_code: 'IMPLE04'
            }
          ];
        }
      }

      console.log(`📦 Items a facturar: ${itemsToUse.length} productos`);
      itemsToUse.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.code} - ${item.product_name} x${item.quantity} @ $${item.price}`);
      });

      // Configurar tipo de documento (EXACTO de la prueba exitosa)
      const documentConfig = {
        'FV-1': 15047, // FV-1 - Factura No Electrónica (CONFIRMADO exitoso)
        'FV-2': 5154   // FV-2 - Factura electrónica 
      };

      const config = {
        documentId: documentConfig[finalDocumentType] || 15047 // Default FV-1
      };

      console.log(`🎯 Usando Document ID: ${config.documentId} para ${finalDocumentType}`);

      // Preparar datos de factura para SIIGO usando configuración exitosa
      let siigoInvoiceData;
      try {
        siigoInvoiceData = await siigoInvoiceService.prepareInvoiceData(
          customer,
          itemsToUse,
          notes || quotationData.raw_request || 'Factura creada desde cotización',
          natural_language_order || quotationData.raw_request || `Factura ${finalDocumentType} creada desde cotización ${quotationData.quotation_number}`,
          config
        );
      } catch (prepError) {
        console.warn('⚠️ Validación de datos antes de SIIGO (cotización):', prepError.message);
        return res.status(422).json({
          success: false,
          message: 'Datos inválidos para crear factura',
          error: prepError.message,
          error_type: 'VALIDATION_ERROR',
          context: 'prepareInvoiceData(quotation)'
        });
      }

      console.log('📊 JSON para SIIGO (estructura exitosa):', JSON.stringify(siigoInvoiceData, null, 2));

      // Crear factura en SIIGO usando servicio optimizado
      const siigoResponse = await siigoInvoiceService.createInvoice(siigoInvoiceData);

      if (!siigoResponse.success) {
        return res.status(422).json({
          success: false,
          message: 'Error creando factura en SIIGO',
          error: siigoResponse.error,
          details: siigoResponse.details,
          suggestions: siigoResponse.suggestions
        });
      }

      console.log('✅ Factura creada exitosamente en SIIGO');

      // Actualizar estado de la cotización
      try {
        await query(`
          UPDATE quotations 
          SET status = 'invoiced', siigo_quotation_id = ?, siigo_quotation_number = ?
          WHERE id = ? OR quotation_number = ?
        `, [
          siigoResponse.data.id,
          siigoResponse.data.number || siigoResponse.data.name,
          quotationId, 
          quotationId
        ]);
      } catch (dbError) {
        console.warn('⚠️ No se pudo actualizar cotización en BD local:', dbError.message);
      }

      res.json({
        success: true,
        message: `${finalDocumentType === 'FV-2' ? 'Factura electrónica' : 'Factura'} creada exitosamente desde cotización`,
        data: {
          siigo_invoice_id: siigoResponse.data.id,
          siigo_invoice_number: siigoResponse.data.number || siigoResponse.data.name,
          siigo_public_url: siigoResponse.data.public_url || siigoResponse.data.url,
          pdf_url: siigoResponse.data.pdf_url,
          quotation_id: quotationId,
          quotation_number: quotationData.quotation_number,
          items_processed: itemsToUse.length,
          customer: {
            id: customer.id,
            name: customer.name,
            identification: customer.identification,
            siigo_id: customer.siigo_id
          },
          document_type: finalDocumentType,
          document_id: config.documentId,
          // Datos técnicos para debugging
          siigo_request_data: siigoInvoiceData,
          siigo_response: siigoResponse.data
        }
      });

      
      // Caso 2: Crear factura directamente con customer_id + items
      } else if (customer_id && items && items.length > 0) {
        console.log('Creando factura directamente con customer_id + items');
        
        // Verificar que el cliente existe
        const customer = await customerService.getCustomerById(customer_id);
        if (!customer) {
          return res.status(404).json({
            success: false,
            message: 'Cliente no encontrado'
          });
        }

        console.log('👤 Cliente:', customer.name, '- ID:', customer.identification);
        // Validación temprana: el cliente debe tener identificación para SIIGO
        if (!customer.identification) {
          return res.status(422).json({
            success: false,
            message: 'Cliente sin identificación. Actualice el documento del cliente antes de facturar.',
            error_type: 'VALIDATION_ERROR',
            field: 'customer.identification'
          });
        }
        console.log(`📦 Items a facturar: ${items.length} productos`);
        items.forEach((item, idx) => {
          console.log(`  ${idx + 1}. ${item.code || item.product_code} - ${item.product_name || item.description} x${item.quantity} @ $${item.price || item.unit_price}`);
        });

        // Configurar tipo de documento
        const documentConfig = {
          'FV-1': 15047, // FV-1 - Factura No Electrónica (CONFIRMADO exitoso)
          'FV-2': 5154   // FV-2 - Factura electrónica 
        };

        const config = {
          documentId: documentConfig[finalDocumentType] || 15047
        };

        console.log(`🎯 Usando Document ID: ${config.documentId} para ${finalDocumentType}`);

        // Preparar datos de factura para SIIGO
        let siigoInvoiceData;
        try {
          siigoInvoiceData = await siigoInvoiceService.prepareInvoiceData(
            customer,
            items,
            notes || 'Factura creada desde sistema',
            natural_language_order || `Factura ${finalDocumentType} creada`,
            config
          );
        } catch (prepError) {
          console.warn('⚠️ Validación de datos antes de SIIGO (inventario):', prepError.message);
          return res.status(422).json({
            success: false,
            message: 'Datos inválidos para crear factura',
            error: prepError.message,
            error_type: 'VALIDATION_ERROR',
            context: 'prepareInvoiceData(inventory)'
          });
        }

        console.log('📊 JSON para SIIGO:', JSON.stringify(siigoInvoiceData, null, 2));

        // Crear factura en SIIGO
        const siigoResponse = await siigoInvoiceService.createInvoice(siigoInvoiceData);

        if (!siigoResponse.success) {
          return res.status(422).json({
            success: false,
            message: 'Error creando factura en SIIGO',
            error: siigoResponse.error,
            details: siigoResponse.details,
            suggestions: siigoResponse.suggestions
          });
        }

        console.log('✅ Factura creada exitosamente en SIIGO');

        // Guardar información en BD local si es necesario
        if (chatgpt_processing_id) {
          try {
            await query(`
              INSERT INTO quotations (
                quotation_number, customer_id, siigo_customer_id, 
                siigo_quotation_id, siigo_quotation_number, siigo_public_url,
                raw_request, status, created_by, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'invoiced', ?, NOW())
            `, [
              siigoResponse.data.number || `${finalDocumentType}-${siigoResponse.data.id}`,
              customer_id,
              customer.siigo_id,
              siigoResponse.data.id,
              siigoResponse.data.number,
              siigoResponse.data.public_url || siigoResponse.data.url,
              natural_language_order || 'Factura creada con ChatGPT',
              userId
            ]);
          } catch (dbError) {
            console.warn('⚠️ No se pudo guardar en BD local:', dbError.message);
          }
        }

        res.json({
          success: true,
          message: `${finalDocumentType === 'FV-2' ? 'Factura electrónica' : 'Factura'} creada exitosamente`,
          data: {
            siigo_invoice_id: siigoResponse.data.id,
            siigo_invoice_number: siigoResponse.data.number || siigoResponse.data.name,
            siigo_public_url: siigoResponse.data.public_url || siigoResponse.data.url,
            pdf_url: siigoResponse.data.pdf_url,
            items_processed: items.length,
            customer: {
              id: customer_id,
              name: customer.name,
              identification: customer.identification,
              siigo_id: customer.siigo_id
            },
            document_type: finalDocumentType,
            document_id: config.documentId,
            chatgpt_processing_id: chatgpt_processing_id,
            natural_language_order: natural_language_order,
            // Datos técnicos para debugging
            siigo_request_data: siigoInvoiceData,
            siigo_response: siigoResponse.data
          }
        });
        
      } else {
        // No se proporcionaron datos suficientes
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar quotationId o (customer_id + items) para crear la factura'
        });
      }

    } catch (error) {
      console.error('Error en createInvoice:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Error creando factura',
        error: error.response?.data || error.message
      });
    }
  }

  // Crear factura desde cotización existente (método original para compatibilidad)
  static async createInvoiceFromQuotation(req, res) {
    try {
      const { customerId, items, notes, documentType = 'FV-1' } = req.body;
      const userId = req.user.id;

      console.log('📋 Creando factura desde cotización (método legacy)...');

      // Validar datos requeridos
      if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cliente e items son requeridos'
        });
      }

      // Verificar que el cliente existe
      const customer = await customerService.getCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Configurar tipo de documento (CORRECTO del test exitoso)
      const documentConfig = {
        'FV-1': 15047, // FV-1 - Factura No Electrónica (CORRECTO del test exitoso)
        'FV-2': 5154   // FV-2 - Factura electrónica (por confirmar)
      };

      const config = {
        documentId: documentConfig[documentType] || 15047 // Usar 15047 por defecto
      };

      // Preparar datos de factura para SIIGO (ahora es async para obtener precios reales)
      const siigoInvoiceData = await siigoInvoiceService.prepareInvoiceData(
        customer,
        items,
        notes,
        `Factura creada desde cotización - ${new Date().toISOString()}`,
        config
      );

      console.log('📊 JSON que se enviará a SIIGO:', JSON.stringify(siigoInvoiceData, null, 2));

      // Crear factura en SIIGO
      const siigoResponse = await siigoInvoiceService.createInvoice(siigoInvoiceData);

      if (!siigoResponse.success) {
        return res.status(422).json({
          success: false,
          message: 'Error creando factura en SIIGO',
          error: siigoResponse.error,
          details: siigoResponse.details,
          suggestions: siigoResponse.suggestions
        });
      }

      console.log('✅ Factura creada exitosamente en SIIGO');

      // Guardar información de la factura en base de datos local
      try {
        await query(`
          INSERT INTO quotations (
            quotation_number, customer_id, siigo_customer_id, 
            siigo_quotation_id, siigo_quotation_number, siigo_public_url,
            raw_request, status, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'invoiced', ?, NOW())
        `, [
          siigoResponse.data.name || `${documentType}-${siigoResponse.data.id}`,
          customerId,
          customer.siigo_id,
          siigoResponse.data.id,
          siigoResponse.data.name || siigoResponse.data.number,
          siigoResponse.data.public_url || siigoResponse.data.url,
          'Factura creada desde cotización',
          userId
        ]);
      } catch (dbError) {
        console.warn('⚠️ No se pudo guardar en BD local, pero la factura fue creada en SIIGO:', dbError.message);
      }

      res.json({
        success: true,
        message: `${documentType === 'FV-2' ? 'Factura electrónica' : 'Factura'} creada exitosamente en SIIGO`,
        data: {
          siigo_invoice_id: siigoResponse.data.id,
          siigo_invoice_number: siigoResponse.data.name || siigoResponse.data.number,
          siigo_public_url: siigoResponse.data.public_url || siigoResponse.data.url,
          pdf_url: siigoResponse.data.pdf_url,
          items_processed: items.length,
          customer: {
            id: customerId,
            name: customer.name,
            identification: customer.identification,
            siigo_id: customer.siigo_id
          },
          document_type: documentType,
          // Incluir petición JSON enviada a SIIGO para mostrar en UI  
          siigo_request_data: siigoInvoiceData,
          // Incluir respuesta completa de SIIGO
          siigo_response: siigoResponse.data
        }
      });

    } catch (error) {
      console.error('Error en createInvoiceFromQuotation:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Error creando factura en SIIGO',
        error: error.response?.data || error.message
      });
    }
  }

  // Crear factura directamente en SIIGO usando ChatGPT
  static async createSiigoInvoiceWithChatGPT(req, res) {
    try {
      const { customer_id, notes, items, chatgpt_processing_id, natural_language_order } = req.body;
      const userId = req.user.id;

      console.log('🤖 Iniciando creación de factura ChatGPT → SIIGO...');

      // Validar datos requeridos
      if (!customer_id || !natural_language_order) {
        return res.status(400).json({
          success: false,
          message: 'Cliente y pedido son requeridos'
        });
      }

      // Verificar que el cliente existe
      const customer = await customerService.getCustomerById(customer_id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      if (!customer.siigo_id) {
        return res.status(400).json({
          success: false,
          message: 'Cliente no tiene ID de SIIGO. Debe sincronizar primero.'
        });
      }

      // PASO 1: Procesar pedido con ChatGPT si no está procesado
      console.log('📝 PASO 1: Procesando pedido con ChatGPT...');
      
      let enhancedOrder;
      if (items && items.length > 0) {
        // Usar items ya procesados
        enhancedOrder = { items };
      } else {
        // Procesar con ChatGPT
        const productCatalog = await chatgptService.getProductCatalog(50);
        const processingResult = await chatgptService.processNaturalLanguageOrder(
          null,
          natural_language_order,
          productCatalog
        );

        if (!processingResult.success) {
          return res.status(422).json({
            success: false,
            message: 'Error procesando el pedido con ChatGPT',
            error: processingResult.error
          });
        }

        enhancedOrder = await chatgptService.enhanceProcessedOrder(
          processingResult.processedOrder
        );
      }

      console.log(`✅ ChatGPT procesó ${enhancedOrder.items.length} items exitosamente`);

      // PASO 2: Crear factura en SIIGO
      console.log('🎯 PASO 2: Creando factura electrónica en SIIGO...');

      // Preparar datos de factura para SIIGO (ahora es async para obtener precios reales)
      const siigoInvoiceData = await siigoInvoiceService.prepareInvoiceData(
        customer,
        enhancedOrder.items,
        notes,
        natural_language_order
      );

      // Crear factura en SIIGO usando el servicio dedicado
      const siigoResponse = await siigoInvoiceService.createInvoice(siigoInvoiceData);

      console.log('✅ Factura electrónica creada exitosamente en SIIGO');

      // Guardar información de la factura en base de datos local (opcional)
      try {
        const actualSiigoData = siigoResponse.data || {};
        await query(`
          INSERT INTO quotations (
            quotation_number, customer_id, siigo_customer_id, 
            siigo_quotation_id, siigo_quotation_number, siigo_public_url,
            raw_request, status, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'invoiced', ?, NOW())
        `, [
          actualSiigoData.name || actualSiigoData.number || `FV-${actualSiigoData.id || 'temp'}`,
          customer_id,
          customer.siigo_id,
          actualSiigoData.id,
          actualSiigoData.name || actualSiigoData.number,
          actualSiigoData.public_url || actualSiigoData.url,
          natural_language_order,
          userId
        ]);
      } catch (dbError) {
        console.warn('⚠️ No se pudo guardar en BD local, pero la factura fue creada en SIIGO:', dbError.message);
      }

      // Acceder correctamente a los datos de la respuesta de SIIGO
      const actualSiigoData = siigoResponse.data || {};
      
      res.json({
        success: true,
        message: 'Factura electrónica creada exitosamente en SIIGO usando ChatGPT',
        data: {
          siigo_invoice_id: actualSiigoData.id,
          siigo_invoice_number: actualSiigoData.name || actualSiigoData.number,
          siigo_public_url: actualSiigoData.public_url || actualSiigoData.url,
          pdf_url: actualSiigoData.pdf_url,
          items_processed: enhancedOrder.items.length,
          total_amount: actualSiigoData.total || siigoInvoiceData.total,
          customer: {
            id: customer_id,
            name: customer.name,
            siigo_id: customer.siigo_id
          },
          chatgpt_stats: {
            items_detected: enhancedOrder.items.length,
            confidence_average: enhancedOrder.confidence || 0.8,
            processing_id: chatgpt_processing_id
          },
          // Incluir respuesta completa de ChatGPT para mostrar en UI
          chatgpt_response: enhancedOrder,
          // Incluir petición JSON enviada a SIIGO para mostrar en UI  
          siigo_request_data: siigoInvoiceData,
          // Incluir respuesta completa de SIIGO
          siigo_response: actualSiigoData
        }
      });

    } catch (error) {
      console.error('Error en createSiigoInvoiceWithChatGPT:', error);
      
      if (error.message.includes('QUOTA_EXCEEDED')) {
        return res.status(402).json({
          success: false,
          message: 'Cuota de ChatGPT excedida',
          details: 'La cuenta de OpenAI ha alcanzado su límite de uso. Contacte al administrador para renovar los créditos.',
          errorType: 'QUOTA_EXCEEDED'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error creando factura en SIIGO',
        error: error.response?.data || error.message
      });
    }
  }

  // Obtener estadísticas de cotizaciones
  static async getStats(req, res) {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_quotations,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved
        FROM quotations
      `);
      
      res.json({
        success: true,
        data: stats[0]
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener todas las cotizaciones
  static async getQuotations(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
      
      const quotations = await query(`
        SELECT q.*, c.name as customer_name
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        ORDER BY q.created_at DESC
        LIMIT ? OFFSET ?
      `, [parseInt(limit), parseInt(offset)]);
      
      res.json({
        success: true,
        data: quotations
      });
    } catch (error) {
      console.error('Error obteniendo cotizaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener una cotización específica
  static async getQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      
      const quotation = await query(`
        SELECT q.*, c.name as customer_name, c.identification as customer_document
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        WHERE q.id = ?
      `, [quotationId]);
      
      if (quotation.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cotización no encontrada'
        });
      }
      
      res.json({
        success: true,
        data: quotation[0]
      });
    } catch (error) {
      console.error('Error obteniendo cotización:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Procesar cotización existente con ChatGPT
  static async processWithChatGPT(req, res) {
    try {
      const { quotationId } = req.params;
      const { natural_language_order } = req.body;

      // Obtener la cotización
      const quotation = await query(`
        SELECT * FROM quotations WHERE id = ?
      `, [quotationId]);

      if (quotation.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cotización no encontrada'
        });
      }

      const orderText = natural_language_order || quotation[0].raw_request;

      // Procesar con ChatGPT
      const productCatalog = await chatgptService.getProductCatalog(50);
      const processingResult = await chatgptService.processNaturalLanguageOrder(
        quotationId,
        orderText,
        productCatalog
      );

      if (!processingResult.success) {
        return res.status(422).json({
          success: false,
          message: 'Error procesando con ChatGPT',
          error: processingResult.error
        });
      }

      res.json({
        success: true,
        message: 'Cotización procesada exitosamente con ChatGPT',
        data: processingResult
      });
    } catch (error) {
      console.error('Error en processWithChatGPT:', error);
      
      if (error.message.includes('QUOTA_EXCEEDED')) {
        return res.status(402).json({
          success: false,
          message: 'Cuota de ChatGPT excedida',
          details: 'La cuenta de OpenAI ha alcanzado su límite de uso. Contacte al administrador para renovar los créditos.',
          errorType: 'QUOTA_EXCEEDED'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Actualizar item de cotización
  static async updateQuotationItem(req, res) {
    try {
      const { quotationId, itemId } = req.params;
      const { quantity, price, description } = req.body;

      // Aquí iría la lógica para actualizar items de cotización
      // Por ahora retornamos un placeholder
      res.json({
        success: true,
        message: 'Item actualizado exitosamente',
        data: { quotationId, itemId, quantity, price, description }
      });
    } catch (error) {
      console.error('Error actualizando item:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Generar cotización en SIIGO
  static async generateSiigoQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      
      // Obtener la cotización
      const quotation = await query(`
        SELECT q.*, c.siigo_id as customer_siigo_id
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        WHERE q.id = ?
      `, [quotationId]);

      if (quotation.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cotización no encontrada'
        });
      }

      const quotationData = quotation[0];

      if (!quotationData.customer_siigo_id) {
        return res.status(400).json({
          success: false,
          message: 'Cliente no tiene ID de SIIGO'
        });
      }

      // Aquí iría la lógica de generación en SIIGO
      res.json({
        success: true,
        message: 'Cotización generada en SIIGO exitosamente',
        data: { quotationId, siigoId: 'placeholder' }
      });
    } catch (error) {
      console.error('Error generando en SIIGO:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener estadísticas de ChatGPT
  static async getChatGPTStats(req, res) {
    try {
      // Aquí iría la lógica para obtener estadísticas de uso de ChatGPT
      res.json({
        success: true,
        data: {
          totalProcessed: 0,
          tokensUsed: 0,
          quotaRemaining: 'Unknown'
        }
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas de ChatGPT:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Crear factura directa desde inventario
  static async createDirectInvoice(req, res) {
    try {
      const { 
        customer_id, 
        items, 
        total_amount,
        invoice_type = 'FV-1',
        payment_method = 'efectivo',
        notes 
      } = req.body;
      
      const userId = req.user.id;

      console.log('🛒 Creando factura directa desde inventario...');
      console.log('Datos recibidos:', {
        customer_id,
        itemsCount: items?.length,
        total_amount,
        invoice_type,
        payment_method
      });

      // Validar datos requeridos
      if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cliente e items son requeridos'
        });
      }

      // Validar stock disponible para cada producto antes de facturar
      console.log('🔍 Validando stock disponible de productos...');
      const { query: db } = require('../config/database');
      
      for (const item of items) {
        try {
          // Buscar el producto en la base de datos local
          const productResult = await db(`
            SELECT id, product_name, available_quantity, stock 
            FROM products 
            WHERE id = ?
          `, [item.product_id]);

          if (productResult.length === 0) {
            return res.status(400).json({
              success: false,
              message: `Producto con ID ${item.product_id} no encontrado`,
              product_name: item.product_name
            });
          }

          const product = productResult[0];
          const availableStock = product.available_quantity || product.stock || 0;

          console.log(`📦 Validando: ${product.product_name} - Stock disponible: ${availableStock}, Solicitado: ${item.quantity}`);

          // Validar que hay suficiente stock
          if (availableStock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Stock insuficiente para ${product.product_name}. Disponible: ${availableStock}, Solicitado: ${item.quantity}`,
              product_id: item.product_id,
              product_name: product.product_name,
              available_stock: availableStock,
              requested_quantity: item.quantity,
              error_type: 'INSUFFICIENT_STOCK'
            });
          }

          // Validar que no se esté solicitando 0 o cantidad negativa
          if (item.quantity <= 0) {
            return res.status(400).json({
              success: false,
              message: `Cantidad inválida para ${product.product_name}: ${item.quantity}`,
              product_id: item.product_id,
              product_name: product.product_name,
              error_type: 'INVALID_QUANTITY'
            });
          }

        } catch (stockError) {
          console.error(`Error validando stock para producto ${item.product_id}:`, stockError);
          return res.status(500).json({
            success: false,
            message: `Error validando stock del producto ${item.product_name}`,
            error_type: 'STOCK_VALIDATION_ERROR'
          });
        }
      }

      console.log('✅ Validación de stock completada - todos los productos tienen stock suficiente');

      // Verificar que el cliente existe
      const customer = await customerService.getCustomerById(customer_id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      if (!customer.siigo_id) {
        return res.status(400).json({
          success: false,
          message: 'Cliente no tiene ID de SIIGO. Debe sincronizar clientes primero.'
        });
      }

      console.log('👤 Cliente encontrado:', customer.name, '- SIIGO ID:', customer.siigo_id);
      console.log(`📦 Items a facturar: ${items.length} productos`);
      
      // Mostrar detalles de items
      items.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.product_name} x${item.quantity} @ $${item.unit_price} = $${item.total || (item.unit_price * item.quantity)}`);
      });

      // Configurar tipo de documento
      const documentConfig = {
        'FV-1': 15047, // FV-1 - Factura No Electrónica
        'FV-2': 5154   // FV-2 - Factura electrónica
      };

      const config = {
        documentId: documentConfig[invoice_type] || 15047,
        paymentMethod: payment_method
      };

      console.log(`🎯 Usando Document ID: ${config.documentId} para ${invoice_type}`);

      // Convertir items al formato esperado por siigoInvoiceService
      const siigoItems = items.map(item => ({
        code: item.product_code || item.code || `PROD-${item.product_id}`,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.unit_price,
        siigo_code: item.siigo_code || item.product_code || item.code
      }));

      // Preparar datos de factura para SIIGO
      const siigoInvoiceData = await siigoInvoiceService.prepareInvoiceData(
        customer,
        siigoItems,
        notes || `Factura ${invoice_type} desde inventario directo - ${new Date().toLocaleString()}`,
        `Factura generada desde inventario con ${items.length} productos`,
        config
      );

      console.log('📊 JSON para SIIGO:', JSON.stringify(siigoInvoiceData, null, 2));

      // Crear factura en SIIGO
      const siigoResponse = await siigoInvoiceService.createInvoice(siigoInvoiceData);

      if (!siigoResponse.success) {
        return res.status(422).json({
          success: false,
          message: 'Error creando factura en SIIGO',
          error: siigoResponse.error,
          details: siigoResponse.details,
          suggestions: siigoResponse.suggestions
        });
      }

      console.log('✅ Factura directa creada exitosamente en SIIGO');

      // Guardar información de la factura en base de datos local
      try {
        const quotationNumber = await QuotationController.generateQuotationNumber();
        await query(`
          INSERT INTO quotations (
            quotation_number, customer_id, siigo_customer_id, 
            siigo_quotation_id, siigo_quotation_number, siigo_public_url,
            raw_request, status, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'invoiced', ?, NOW())
        `, [
          quotationNumber,
          customer_id,
          customer.siigo_id,
          siigoResponse.data.id,
          siigoResponse.data.number || siigoResponse.data.name,
          siigoResponse.data.public_url || siigoResponse.data.url,
          `Factura ${invoice_type} desde inventario - ${items.length} productos`,
          userId
        ]);
        
        console.log('💾 Factura guardada en BD local con número:', quotationNumber);
      } catch (dbError) {
        console.warn('⚠️ No se pudo guardar en BD local, pero la factura fue creada en SIIGO:', dbError.message);
      }

      // Respuesta exitosa
      res.json({
        success: true,
        message: `Factura ${invoice_type} creada exitosamente desde inventario`,
        data: {
          siigo_invoice_id: siigoResponse.data.id,
          siigo_invoice_number: siigoResponse.data.number || siigoResponse.data.name,
          siigo_public_url: siigoResponse.data.public_url || siigoResponse.data.url,
          pdf_url: siigoResponse.data.pdf_url,
          invoice_number: siigoResponse.data.number || siigoResponse.data.name,
          items_processed: items.length,
          total_amount: total_amount,
          customer: {
            id: customer_id,
            name: customer.name,
            identification: customer.identification,
            siigo_id: customer.siigo_id
          },
          invoice_type: invoice_type,
          payment_method: payment_method,
          document_id: config.documentId,
          created_from: 'inventory_direct',
          // Datos técnicos para debugging
          siigo_request_data: siigoInvoiceData,
          siigo_response: siigoResponse.data
        }
      });

    } catch (error) {
      console.error('Error en createDirectInvoice:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Error creando factura directa',
        error: error.response?.data || error.message,
        details: 'Error interno del servidor al procesar la facturación directa'
      });
    }
  }

  // Generar número de cotización
  static async generateQuotationNumber() {
    try {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      const result = await query(`
        SELECT MAX(CAST(SUBSTRING(quotation_number, -4) AS UNSIGNED)) as last_number
        FROM quotations
        WHERE quotation_number LIKE ?
      `, [`COT-${year}${month}-%`]);

      const lastNumber = result[0].last_number || 0;
      const nextNumber = String(lastNumber + 1).padStart(4, '0');
      
      return `COT-${year}${month}-${nextNumber}`;
    } catch (error) {
      console.error('Error generando número de cotización:', error);
      throw error;
    }
  }
}

module.exports = QuotationController;
