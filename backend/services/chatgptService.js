const { query } = require('../config/database');

class ChatGPTService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    
    // Configuración para GPT personalizado (Assistant API)
    this.customAssistantId = process.env.CUSTOM_GPT_ASSISTANT_ID; // Tu Assistant ID personalizado
    this.useCustomAssistant = process.env.USE_CUSTOM_ASSISTANT === 'true';
    this.assistantApiUrl = 'https://api.openai.com/v1';
    
    // Configuración tradicional (Chat Completions API)
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o-mini'; // Modelo optimizado para costo-beneficio
    
    console.log(`🤖 ChatGPT Service initialized - Custom Assistant: ${this.useCustomAssistant ? 'ENABLED' : 'DISABLED'}`);
    if (this.useCustomAssistant && this.customAssistantId) {
      console.log(`🎯 Using Custom Assistant ID: ${this.customAssistantId}`);
    }
  }

  // Procesar pedido en lenguaje natural
  async processNaturalLanguageOrder(quotationId, orderText, productCatalog = null) {
    const startTime = Date.now();
    
    try {
      console.log('🤖 Iniciando procesamiento con ChatGPT...');
      console.log('📝 Texto del pedido:', orderText.substring(0, 200) + '...');

      // Decidir si usar Assistant personalizado o API tradicional
      if (this.useCustomAssistant && this.customAssistantId) {
        return await this.processWithCustomAssistant(quotationId, orderText, productCatalog, 'text', startTime);
      }

      // Usar API tradicional de Chat Completions
      const systemPrompt = await this.buildSystemPrompt(productCatalog);
      const userPrompt = this.buildUserPrompt(orderText);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1, // Baja creatividad para mayor precisión
          max_tokens: 1500,
          response_format: { type: "json_object" }
        })
      });

      // Manejo específico para errores de cuota
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error de ChatGPT:', errorData);
        
        if (response.status === 429 && errorData.error?.type === 'insufficient_quota') {
          throw new Error('QUOTA_EXCEEDED: La cuenta de OpenAI ha excedido su cuota. Revisar billing en platform.openai.com');
        }
        
        throw new Error(`ChatGPT API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;
      
      // Parsear la respuesta JSON
      let processedOrder;
      try {
        processedOrder = JSON.parse(data.choices[0].message.content);
      } catch (parseError) {
        console.error('❌ Error parseando respuesta JSON:', parseError);
        throw new Error('Respuesta de ChatGPT no es JSON válido');
      }

      // Validar estructura de respuesta
      const validationResult = this.validateProcessedOrder(processedOrder);
      if (!validationResult.isValid) {
        throw new Error(`Respuesta inválida: ${validationResult.errors.join(', ')}`);
      }

      // Guardar log del procesamiento
      await this.saveProcessingLog({
        quotationId,
        requestType: 'text',
        inputContent: orderText,
        chatgptResponse: {
          rawResponse: data,
          processedOrder: processedOrder
        },
        tokensUsed: data.usage?.total_tokens || 0,
        processingTimeMs: processingTime,
        success: true
      });

      console.log('✅ Procesamiento completado exitosamente');
      console.log(`📊 Tokens usados: ${data.usage?.total_tokens || 0}`);
      console.log(`⏱️ Tiempo: ${processingTime}ms`);
      console.log(`📦 Items encontrados: ${processedOrder.items?.length || 0}`);

      return {
        success: true,
        processedOrder,
        tokensUsed: data.usage?.total_tokens || 0,
        processingTimeMs: processingTime
      };

    } catch (error) {
      console.error('❌ Error en procesamiento ChatGPT:', error);
      
      const processingTime = Date.now() - startTime;
      
      // Guardar log de error
      await this.saveProcessingLog({
        quotationId,
        requestType: 'text',
        inputContent: orderText,
        chatgptResponse: null,
        tokensUsed: 0,
        processingTimeMs: processingTime,
        success: false,
        errorMessage: error.message
      });

      return {
        success: false,
        error: error.message,
        processingTimeMs: processingTime
      };
    }
  }

  // Procesar imagen de pedido (WhatsApp, foto, etc.)
  async processImageOrder(quotationId, imageBase64, productCatalog = null) {
    const startTime = Date.now();
    
    try {
      console.log('🖼️ Iniciando procesamiento de imagen con ChatGPT...');

      const systemPrompt = await this.buildSystemPrompt(productCatalog);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Modelo con capacidad de visión
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analiza esta imagen y extrae el pedido de productos. La imagen puede contener texto manuscrito, mensajes de WhatsApp, listas de productos, o cualquier formato de pedido.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 1500,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error de ChatGPT Vision: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;
      
      let processedOrder;
      try {
        processedOrder = JSON.parse(data.choices[0].message.content);
      } catch (parseError) {
        throw new Error('Respuesta de ChatGPT no es JSON válido');
      }

      const validationResult = this.validateProcessedOrder(processedOrder);
      if (!validationResult.isValid) {
        throw new Error(`Respuesta inválida: ${validationResult.errors.join(', ')}`);
      }

      await this.saveProcessingLog({
        quotationId,
        requestType: 'image',
        inputContent: 'Imagen procesada',
        chatgptResponse: {
          rawResponse: data,
          processedOrder: processedOrder
        },
        tokensUsed: data.usage?.total_tokens || 0,
        processingTimeMs: processingTime,
        success: true
      });

      console.log('✅ Procesamiento de imagen completado');
      console.log(`📊 Tokens usados: ${data.usage?.total_tokens || 0}`);
      console.log(`📦 Items encontrados: ${processedOrder.items?.length || 0}`);

      return {
        success: true,
        processedOrder,
        tokensUsed: data.usage?.total_tokens || 0,
        processingTimeMs: processingTime
      };

    } catch (error) {
      console.error('❌ Error en procesamiento de imagen:', error);
      
      const processingTime = Date.now() - startTime;
      
      await this.saveProcessingLog({
        quotationId,
        requestType: 'image',
        inputContent: 'Imagen procesada',
        chatgptResponse: null,
        tokensUsed: 0,
        processingTimeMs: processingTime,
        success: false,
        errorMessage: error.message
      });

      return {
        success: false,
        error: error.message,
        processingTimeMs: processingTime
      };
    }
  }

  // Construir prompt del sistema con contexto de productos
  async buildSystemPrompt(productCatalog) {
    let systemPrompt = `Eres un asistente especializado en procesar pedidos comerciales en lenguaje natural para una empresa. 

Tu tarea es convertir pedidos escritos en lenguaje natural (que pueden venir de WhatsApp, mensajes, notas, etc.) en una estructura JSON clara y precisa.

IMPORTANTE: Siempre responde únicamente en formato JSON válido.

Estructura JSON de respuesta requerida:
{
  "confidence": 0.95,
  "items": [
    {
      "product_name": "Nombre del producto",
      "product_code": "CODIGO123" (si lo puedes identificar),
      "quantity": 10,
      "unit": "unidades/kg/litros/cajas/etc",
      "confidence": 0.90,
      "notes": "observaciones específicas del item"
    }
  ],
  "customer_notes": "Observaciones generales del pedido",
  "special_instructions": "Instrucciones especiales de entrega/empaque",
  "ambiguities": ["Lista de ambigüedades que requieren aclaración"]
}

Reglas importantes:
1. Extrae TODOS los productos mencionados
2. Identifica cantidades precisas (números + unidades)
3. Si hay ambigüedad en cantidad o producto, inclúyelo en "ambiguities"
4. Mantén nombres de productos lo más específicos posible
5. El campo "confidence" debe ser un número entre 0 y 1
6. Si no puedes identificar un código de producto, déjalo como null
7. Incluye variaciones como sabores, tamaños, presentaciones`;

    // Si tenemos catálogo de productos, añadirlo al contexto
    if (productCatalog && productCatalog.length > 0) {
      systemPrompt += `\n\nCATÁLOGO DE PRODUCTOS DISPONIBLES:\n`;
      productCatalog.forEach(product => {
        systemPrompt += `- ${product.code}: ${product.name}`;
        if (product.category) systemPrompt += ` (${product.category})`;
        systemPrompt += `\n`;
      });
      systemPrompt += `\nUsa este catálogo para identificar códigos de productos cuando sea posible. Si un producto del pedido coincide con el catálogo, usa el código exacto.`;
    }

    return systemPrompt;
  }

  // Construir prompt del usuario
  buildUserPrompt(orderText) {
    return `Analiza el siguiente pedido y conviértelo al formato JSON especificado:

PEDIDO:
${orderText}

Responde únicamente con el JSON, sin texto adicional.`;
  }

  // Validar estructura de pedido procesado
  validateProcessedOrder(processedOrder) {
    const errors = [];

    if (!processedOrder || typeof processedOrder !== 'object') {
      errors.push('La respuesta no es un objeto JSON válido');
      return { isValid: false, errors };
    }

    if (typeof processedOrder.confidence !== 'number' || 
        processedOrder.confidence < 0 || processedOrder.confidence > 1) {
      errors.push('El campo confidence debe ser un número entre 0 y 1');
    }

    if (!Array.isArray(processedOrder.items)) {
      errors.push('El campo items debe ser un array');
    } else {
      processedOrder.items.forEach((item, index) => {
        if (!item.product_name || typeof item.product_name !== 'string') {
          errors.push(`Item ${index}: product_name es requerido y debe ser string`);
        }
        
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          errors.push(`Item ${index}: quantity debe ser un número positivo`);
        }
        
        if (!item.unit || typeof item.unit !== 'string') {
          errors.push(`Item ${index}: unit es requerido y debe ser string`);
        }
        
        if (typeof item.confidence !== 'number' || 
            item.confidence < 0 || item.confidence > 1) {
          errors.push(`Item ${index}: confidence debe ser un número entre 0 y 1`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Obtener catálogo de productos para contexto
  async getProductCatalog(limit = 100) {
    try {
      const products = await query(`
        SELECT 
          internal_code as code,
          product_name as name,
          category,
          standard_price as price,
          is_active as active
        FROM products 
        WHERE is_active = 1
        ORDER BY 
          CASE WHEN standard_price > 0 THEN 0 ELSE 1 END,
          product_name ASC
        LIMIT ?
      `, [limit]);

      return products;
    } catch (error) {
      console.error('Error obteniendo catálogo de productos:', error);
      return [];
    }
  }

  // Guardar log de procesamiento
  async saveProcessingLog(logData) {
    try {
      // Generar session ID único para tracking
      const sessionId = logData.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await query(`
        INSERT INTO chatgpt_processing_log (
          quotation_id, processing_session_id, request_source, request_type, 
          input_content, chatgpt_response, tokens_used, processing_time_ms, 
          success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        logData.quotationId || null, // Ahora puede ser null
        sessionId,
        logData.requestSource || 'api',
        logData.requestType,
        logData.inputContent,
        JSON.stringify(logData.chatgptResponse),
        logData.tokensUsed,
        logData.processingTimeMs,
        logData.success,
        logData.errorMessage || null
      ]);

      console.log(`📊 Log guardado - Session: ${sessionId}, Success: ${logData.success}`);
      return { success: true, sessionId };
    } catch (error) {
      console.error('Error guardando log de procesamiento:', error);
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de uso
  async getUsageStats(days = 30) {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN success = TRUE THEN 1 END) as successful_requests,
          COUNT(CASE WHEN request_type = 'text' THEN 1 END) as text_requests,
          COUNT(CASE WHEN request_type = 'image' THEN 1 END) as image_requests,
          SUM(tokens_used) as total_tokens,
          AVG(processing_time_ms) as avg_processing_time,
          AVG(CASE WHEN success = TRUE THEN processing_time_ms END) as avg_success_time
        FROM chatgpt_processing_log 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [days]);

      return stats[0];
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }

  // Mejorar pedido procesado con información de productos
  async enhanceProcessedOrder(processedOrder) {
    try {
      console.log('🔍 Mejorando pedido procesado con información de productos...');
      
      // Buscar productos en la base de datos para cada item
      for (let item of processedOrder.items) {
        console.log(`📦 Procesando item: ${item.product_name}`);
        
        // Buscar producto por código si ya existe
        let products = [];
        if (item.product_code) {
          products = await query(`
            SELECT internal_code as code, product_name as name, standard_price as price, category
            FROM products 
            WHERE is_active = 1 AND internal_code = ?
            LIMIT 1
          `, [item.product_code]);
        }
        
        // Si no encontró por código, buscar por nombre
        if (products.length === 0) {
          products = await query(`
            SELECT internal_code as code, product_name as name, standard_price as price, category
            FROM products 
            WHERE is_active = 1 AND (
              LOWER(product_name) LIKE LOWER(?) OR
              LOWER(product_name) LIKE LOWER(?) OR
              LOWER(product_name) LIKE LOWER(?)
            )
            ORDER BY 
              CASE 
                WHEN LOWER(product_name) = LOWER(?) THEN 1
                WHEN LOWER(product_name) LIKE LOWER(?) THEN 2
                ELSE 3
              END
            LIMIT 3
          `, [
            `%${item.product_name}%`,
            `${item.product_name}%`,
            `%${item.product_name}`,
            item.product_name,
            `${item.product_name}%`
          ]);
        }

        if (products.length > 0) {
          const bestMatch = products[0];
          
          // Asignar información del producto encontrado
          if (!item.product_code) {
            item.product_code = bestMatch.code;
          }
          
          // Asignar precio del catálogo si no tiene precio o es 0
          if (!item.unit_price || item.unit_price === 0) {
            item.unit_price = bestMatch.price || 1000; // Precio por defecto si no hay en catálogo
            console.log(`💰 Precio asignado desde catálogo: $${item.unit_price}`);
          }
          
          item.category = bestMatch.category;
          item.match_confidence = products.length === 1 ? 0.9 : 0.7;
          item.database_match = true;
          
          console.log(`✅ Match encontrado: ${bestMatch.name} - Código: ${bestMatch.code} - Precio: $${bestMatch.price}`);
        } else {
          // Si no se encuentra el producto, asignar precio por defecto
          if (!item.unit_price || item.unit_price === 0) {
            item.unit_price = 1000; // Precio por defecto de $1,000
            console.log(`⚠️ No se encontró producto, precio por defecto asignado: $${item.unit_price}`);
          }
          item.database_match = false;
          console.log(`❌ No se encontró match para: ${item.product_name}`);
        }
        
        // Asegurar que el item tenga una estructura completa
        item.total_amount = (item.unit_price || 0) * (item.quantity || 1);
      }

      // Calcular totales del pedido
      const total_items = processedOrder.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const total_amount = processedOrder.items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
      
      processedOrder.summary = {
        total_items,
        total_amount,
        items_with_match: processedOrder.items.filter(item => item.database_match).length,
        items_without_match: processedOrder.items.filter(item => !item.database_match).length
      };

      console.log(`📊 Resumen del pedido: ${total_items} items, Total: $${total_amount}`);
      
      return processedOrder;
    } catch (error) {
      console.error('Error mejorando pedido procesado:', error);
      return processedOrder;
    }
  }

  // ==================== MÉTODOS PARA ASSISTANT PERSONALIZADO ====================

  // Procesar con Assistant personalizado
  async processWithCustomAssistant(quotationId, inputContent, productCatalog, requestType, startTime) {
    try {
      console.log(`🎯 Usando Assistant personalizado ID: ${this.customAssistantId}`);
      console.log(`📋 Tipo de solicitud: ${requestType}`);

      // 1. Crear un thread (conversación)
      const thread = await this.createThread();
      console.log(`🧵 Thread creado: ${thread.id}`);

      // 2. Preparar el mensaje según el tipo
      let messageContent;
      if (requestType === 'text') {
        // Construir contexto si tenemos catálogo
        let contextText = inputContent;
        if (productCatalog && productCatalog.length > 0) {
          contextText = `CATÁLOGO DE PRODUCTOS DISPONIBLES:\n`;
          productCatalog.forEach(product => {
            contextText += `- ${product.code}: ${product.name}`;
            if (product.category) contextText += ` (${product.category})`;
            contextText += `\n`;
          });
          contextText += `\nPEDIDO A PROCESAR:\n${inputContent}\n\nPor favor procesa este pedido en formato JSON según tus instrucciones de entrenamiento.`;
        }
        messageContent = contextText;
      } else if (requestType === 'image') {
        messageContent = 'Analiza esta imagen y extrae el pedido según tus instrucciones de entrenamiento.';
        // Para imágenes, necesitaremos manejar de forma diferente
      }

      // 3. Añadir mensaje al thread
      const message = await this.addMessageToThread(thread.id, messageContent);
      console.log(`💬 Mensaje añadido al thread`);

      // 4. Ejecutar el Assistant
      const run = await this.runAssistant(thread.id);
      console.log(`▶️ Assistant ejecutándose: ${run.id}`);

      // 5. Esperar la respuesta
      const result = await this.waitForRunCompletion(thread.id, run.id);
      console.log(`✅ Assistant completado con estado: ${result.status}`);

      // 6. Obtener la respuesta
      const response = await this.getThreadMessages(thread.id);
      const assistantMessage = response.data[0]; // El primer mensaje es la respuesta más reciente
      
      if (!assistantMessage || !assistantMessage.content[0]) {
        throw new Error('No se recibió respuesta del Assistant');
      }

      const responseText = assistantMessage.content[0].text.value;
      console.log(`📝 Respuesta recibida (${responseText.length} caracteres)`);

      // 7. Parsear la respuesta JSON
      let processedOrder;
      try {
        // El Assistant puede devolver texto con código o directamente JSON
        let jsonText = responseText.trim();
        
        // Intentar extraer JSON de diferentes formatos
        if (jsonText.includes('```json')) {
          const jsonMatch = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
          jsonText = jsonMatch ? jsonMatch[1].trim() : jsonText;
        } else if (jsonText.includes('```')) {
          const jsonMatch = jsonText.match(/```\n?([\s\S]*?)\n?```/);
          jsonText = jsonMatch ? jsonMatch[1].trim() : jsonText;
        }
        
        // Si el texto comienza con [ en lugar de {, es una array de productos simple
        if (jsonText.startsWith('[') && jsonText.endsWith(']')) {
          const productsArray = JSON.parse(jsonText);
          // Convertir array simple a estructura completa
          processedOrder = {
            confidence: 0.8,
            items: productsArray.map(item => ({
              product_name: item.nombre || item.product_name || 'Producto no identificado',
              product_code: item.codigo || item.product_code || item.code || null,
              quantity: parseInt(item.cantidad || item.quantity || 1),
              unit: 'unidades',
              confidence: 0.8,
              notes: `Código: ${item.codigo || item.code || 'N/A'}`
            })),
            customer_notes: `Productos identificados correctamente por el Assistant`,
            special_instructions: '',
            ambiguities: []
          };
        } else {
          // Buscar JSON de objeto completo
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
          processedOrder = JSON.parse(jsonText);
        }
        
        // Si no tiene la estructura esperada, crear una estructura básica
        if (!processedOrder || typeof processedOrder !== 'object') {
          throw new Error('No es un objeto válido');
        }
        
        // Asegurar que tenga los campos requeridos con valores por defecto
        if (typeof processedOrder.confidence !== 'number') {
          processedOrder.confidence = 0.5;
        }
        
        if (!Array.isArray(processedOrder.items)) {
          processedOrder.items = [];
        }
        
        // Validar y corregir cada item
        processedOrder.items = processedOrder.items.map((item, index) => {
          if (!item || typeof item !== 'object') {
            return {
              product_name: `Item ${index + 1}`,
              quantity: 1,
              unit: 'unidades',
              confidence: 0.3,
              notes: 'Item no identificado correctamente'
            };
          }
          
          return {
            product_name: item.product_name || `Item ${index + 1}`,
            product_code: item.product_code || null,
            quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
            unit: item.unit || 'unidades',
            confidence: typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1 ? item.confidence : 0.5,
            notes: item.notes || ''
          };
        });
        
        // Asegurar otros campos opcionales
        processedOrder.customer_notes = processedOrder.customer_notes || '';
        processedOrder.special_instructions = processedOrder.special_instructions || '';
        processedOrder.ambiguities = Array.isArray(processedOrder.ambiguities) ? processedOrder.ambiguities : [];
        
      } catch (parseError) {
        console.error('❌ Error parseando respuesta JSON del Assistant:', parseError);
        console.log('📝 Respuesta completa del Assistant:', responseText);
        
        // Crear una respuesta de respaldo basada en el texto
        processedOrder = {
          confidence: 0.3,
          items: [{
            product_name: 'Procesamiento manual requerido',
            quantity: 1,
            unit: 'unidades',
            confidence: 0.3,
            notes: `Respuesta del Assistant: ${responseText.substring(0, 500)}...`
          }],
          customer_notes: responseText.substring(0, 200) + '...',
          special_instructions: 'Requiere revisión manual - error en procesamiento automático',
          ambiguities: ['Respuesta del Assistant no pudo ser procesada automáticamente']
        };
      }

      // 8. Validar estructura de respuesta
      const validationResult = this.validateProcessedOrder(processedOrder);
      if (!validationResult.isValid) {
        throw new Error(`Respuesta inválida del Assistant: ${validationResult.errors.join(', ')}`);
      }

      const processingTime = Date.now() - startTime;

      // 9. Guardar log del procesamiento
      await this.saveProcessingLog({
        quotationId,
        requestType: requestType,
        inputContent: inputContent,
        chatgptResponse: {
          assistantId: this.customAssistantId,
          threadId: thread.id,
          runId: run.id,
          rawResponse: responseText,
          processedOrder: processedOrder
        },
        tokensUsed: result.usage?.total_tokens || 0,
        processingTimeMs: processingTime,
        success: true
      });

      console.log('✅ Procesamiento con Assistant completado exitosamente');
      console.log(`📊 Tokens usados: ${result.usage?.total_tokens || 0}`);
      console.log(`⏱️ Tiempo: ${processingTime}ms`);
      console.log(`📦 Items encontrados: ${processedOrder.items?.length || 0}`);

      // 10. Limpiar el thread (opcional)
      await this.deleteThread(thread.id);

      return {
        success: true,
        processedOrder,
        tokensUsed: result.usage?.total_tokens || 0,
        processingTimeMs: processingTime,
        assistantId: this.customAssistantId
      };

    } catch (error) {
      console.error('❌ Error en procesamiento con Assistant:', error);
      
      const processingTime = Date.now() - startTime;
      
      // Guardar log de error
      await this.saveProcessingLog({
        quotationId,
        requestType: requestType,
        inputContent: inputContent,
        chatgptResponse: null,
        tokensUsed: 0,
        processingTimeMs: processingTime,
        success: false,
        errorMessage: error.message
      });

      return {
        success: false,
        error: error.message,
        processingTimeMs: processingTime,
        assistantId: this.customAssistantId
      };
    }
  }

  // Crear un thread para la conversación
  async createThread() {
    const response = await fetch(`${this.assistantApiUrl}/threads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error creando thread: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
    }

    return await response.json();
  }

  // Añadir mensaje a un thread
  async addMessageToThread(threadId, content) {
    const response = await fetch(`${this.assistantApiUrl}/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: content
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error añadiendo mensaje: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
    }

    return await response.json();
  }

  // Ejecutar el Assistant
  async runAssistant(threadId) {
    const response = await fetch(`${this.assistantApiUrl}/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: this.customAssistantId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error ejecutando Assistant: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
    }

    return await response.json();
  }

  // Esperar a que el Assistant complete la ejecución
  async waitForRunCompletion(threadId, runId, maxWaitTime = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const response = await fetch(`${this.assistantApiUrl}/threads/${threadId}/runs/${runId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error consultando estado del run: ${response.status} - ${errorData.error?.message}`);
      }

      const run = await response.json();
      console.log(`🔄 Estado del Assistant: ${run.status}`);

      if (run.status === 'completed') {
        return run;
      } else if (run.status === 'failed') {
        throw new Error(`Assistant falló: ${run.last_error?.message || 'Error desconocido'}`);
      } else if (run.status === 'cancelled') {
        throw new Error('Assistant fue cancelado');
      } else if (run.status === 'expired') {
        throw new Error('Assistant expiró');
      }

      // Esperar antes de la siguiente consulta
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Timeout esperando respuesta del Assistant');
  }

  // Obtener mensajes del thread
  async getThreadMessages(threadId) {
    const response = await fetch(`${this.assistantApiUrl}/threads/${threadId}/messages`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error obteniendo mensajes: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
    }

    return await response.json();
  }

  // Eliminar thread (limpieza)
  async deleteThread(threadId) {
    try {
      const response = await fetch(`${this.assistantApiUrl}/threads/${threadId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (response.ok) {
        console.log(`🧹 Thread ${threadId} eliminado`);
      }
    } catch (error) {
      console.error('Error eliminando thread:', error.message);
      // No es crítico, solo para limpieza
    }
  }

  // Obtener información del Assistant personalizado
  async getAssistantInfo() {
    if (!this.customAssistantId) {
      return null;
    }

    try {
      const response = await fetch(`${this.assistantApiUrl}/assistants/${this.customAssistantId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error obteniendo información del Assistant:', error);
      return null;
    }
  }
}

module.exports = new ChatGPTService();
