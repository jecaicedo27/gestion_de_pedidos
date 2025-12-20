const axios = require('axios');
const siigoService = require('./siigoService');
const configService = require('./configService');
const { query } = require('../config/database');

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

    // Caché simple de productos por código para reducir latencia
    this.productCache = new Map();
  }

  /**
   * Prepara los datos de factura para SIIGO según la estructura EXACTA de la prueba exitosa
   */
  async prepareInvoiceData(customer, items, notes, originalRequest, options = {}) {
    // Cargar configuración de IVA y flags ANTES de validar para conocer reglas
    const taxIdCfg = await configService.getConfig('siigo_tax_iva_id', null);
    const pricesIncludeCfg = await configService.getConfig('siigo_prices_include_tax', false);
    const ivaRateCfg = await configService.getConfig('siigo_iva_rate', '19');
    const pricesIncludeTax = options.priceIncludeTax !== undefined
      ? options.priceIncludeTax
      : (pricesIncludeCfg === true || pricesIncludeCfg === 'true' || pricesIncludeCfg === 1 || pricesIncludeCfg === '1');
    const taxId = taxIdCfg ? Number(taxIdCfg) : null;
    const ivaRate = Number(ivaRateCfg) || 19;

    // Usar SIIGO como única fuente de precios (por defecto true)
    const useSiigoPricesCfg = await configService.getConfig('siigo_use_prices_from_siigo', 'true');
    const useSiigoPrices = (useSiigoPricesCfg === true || useSiigoPricesCfg === 'true' || useSiigoPricesCfg === 1 || useSiigoPricesCfg === '1');

    // Validar datos de entrada (permitir omitir precio cuando useSiigoPrices=true)
    this.validateInputData(customer, items, { allowMissingPrice: useSiigoPrices });

    // Configuración final con opciones
    const config = { ...this.defaultConfig, ...options };

    // Formatear items (si useSiigoPrices=true, precio/descripcion/taxes vienen 100% de SIIGO)
    const formattedItems = await this.formatItems(items, {
      taxId,
      priceIncludeTax: pricesIncludeTax,
      ivaRate,
      useSiigoPrices,
      discount: options.discount,
      retefuente: options.retefuente,
      useTaxedPrice: true // IMPORTANTE: Facturas SÍ soportan taxed_price y es preferible para evitar errores de redondeo
    });

    // Calcular totales usando los items formateados
    const calculations = this.calculateTotalsFromFormattedItems(formattedItems, { ivaRate });

    // Formatear observaciones con límite de caracteres
    const observations = this.formatObservations(notes, originalRequest);

    // Calcular fecha de vencimiento
    const dueDate = this.calculateDueDate(config.dueDays);

    // Formatear datos del cliente según estructura exitosa
    const customerData = this.formatCustomerData(customer);

    // Calcular valor de pagos igual al total esperado por SIIGO (incluye IVA cuando aplique)
    const paymentsValue = this.calculatePaymentsValue(formattedItems, { ivaRate });

    // Leer flag para habilitar/inhabilitar additional_fields (por defecto: deshabilitado)
    const includeAdditionalFieldsCfg = await configService.getConfig('siigo_enable_additional_fields', 'false');
    const includeAdditionalFields = (includeAdditionalFieldsCfg === true || includeAdditionalFieldsCfg === 'true' || includeAdditionalFieldsCfg === 1 || includeAdditionalFieldsCfg === '1');

    // Construir campos adicionales opcionales para SIIGO (solo si está habilitado)
    const additionalFields = includeAdditionalFields
      ? this.buildAdditionalFields({ notes, originalRequest, options })
      : null;

    // Estructura EXACTA de la prueba exitosa (sin cost_center)
    return {
      document: {
        id: config.documentId
      },
      date: new Date().toISOString().split('T')[0],
      customer: customerData,
      seller: config.seller,
      observations: observations,
      ...(includeAdditionalFields && additionalFields && Object.keys(additionalFields).length ? { additional_fields: additionalFields } : {}),
      items: formattedItems,
      payments: [{
        id: config.defaultPaymentMethod,
        value: paymentsValue,
        due_date: dueDate
      }]
      // IMPORTANTE: NO incluir cost_center aquí porque no estaba en la prueba exitosa
    };
  }

  /**
   * Valida los datos de entrada antes de procesarlos
   */
  validateInputData(customer, items, options = {}) {
    const errors = [];
    const allowMissingPrice = options.allowMissingPrice === true;

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
          errors.push(`Item ${index + 1} debe tener código de producto`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1} debe tener cantidad válida`);
        }
        if (!allowMissingPrice && !item.price && !item.unit_price && !item.suggested_price) {
          errors.push(`Item ${index + 1} debe tener precio`);
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }
  }

  /**
   * Calcula totales usando items ya formateados
   * - Prefiere base (sin IVA). Si solo viene taxed_price, calcula base = taxed_price / (1 + ivaRate)
   */
  calculateTotalsFromFormattedItems(formattedItems, options = {}) {
    const ivaRate = Number(options.ivaRate) || 19;
    const factor = 1 + (ivaRate / 100);

    const subtotal = formattedItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 1);
      let unitBase = 0;

      if (typeof item.price === 'number' && !Number.isNaN(item.price)) {
        unitBase = item.price;
      } else if (typeof item.taxed_price === 'number' && !Number.isNaN(item.taxed_price)) {
        unitBase = item.taxed_price / factor;
      }

      return sum + (quantity * unitBase);
    }, 0);

    // IMPORTANTE: SIIGO calcula el IVA internamente.
    // Mantenemos payments.value en subtotal (sin IVA) para alinearnos con el flujo previo.
    const tax = subtotal * (ivaRate / 100);
    const total = subtotal;

    return { subtotal, tax, total };
  }

  /**
   * Calcula el valor de payments para que sea igual al total de la factura en SIIGO.
   * - Si el ítem trae taxed_price (o marcamos price_include_tax), sumamos taxed_price * qty.
   * - Si el ítem tiene impuestos y solo trae price (base), aproximamos total = price * (1 + ivaRate/100) * qty.
   * - Si el ítem está exento (sin taxes), usamos price * qty.
   * Nota: Esto evita el error invalid_total_payments al alinear payments.value con el total.
   */
  calculatePaymentsValue(formattedItems, options = {}) {
    const ivaRate = Number(options.ivaRate) || 19;
    const factor = 1 + (ivaRate / 100);

    // Nueva lógica v2: Calcular totales por línea partiendo del TOTAL BRUTO (Precio * Cantidad)
    // Siigo parece tomar el precio total de la línea y de ahí desglosar la base.

    let totalGrossWithIVA = 0;
    let totalBaseForRete = 0;

    for (const it of formattedItems) {
      const qty = parseFloat(it.quantity || 1);
      const hasTaxes = Array.isArray(it.taxes) && it.taxes.length > 0;

      // Obtener porcentaje de descuento
      let discountPercent = 0;
      if (typeof it.discount === 'number') {
        discountPercent = it.discount;
      } else if (it.discount && typeof it.discount.percentage === 'number') {
        discountPercent = it.discount.percentage;
      }

      // Usar el precio BASE que estamos enviando a SIIGO (it.price)
      // SIIGO calculará el IVA sobre este precio
      const unitBase = typeof it.price === 'number' ? it.price : 0;
      let lineBase = Number((unitBase * qty).toFixed(2));

      // Aplicar descuento a la base total de la línea
      const discountValue = Number((lineBase * (discountPercent / 100)).toFixed(2));
      const lineBaseAfterDiscount = Number((lineBase - discountValue).toFixed(2));

      // Calcular IVA sobre la base usando el MISMO redondeo que SIIGO
      let lineIVA = 0;
      if (hasTaxes) {
        lineIVA = Number((lineBaseAfterDiscount * (ivaRate / 100)).toFixed(2));
      }

      const lineTotalFinal = lineBaseAfterDiscount + lineIVA;
      totalGrossWithIVA += lineTotalFinal;

      // Acumular base para ReteFuente si aplica
      if (hasTaxes) {
        const hasRetefuente = it.taxes.some(t => t.id === 8101);
        if (hasRetefuente) {
          totalBaseForRete += lineBaseAfterDiscount;
        }
      }
    }

    // Calcular ReteFuente total
    const totalReteFuente = Number((totalBaseForRete * 0.025).toFixed(2));

    // Total a Pagar = Total Bruto con IVA - ReteFuente
    const totalPayment = totalGrossWithIVA - totalReteFuente;

    // Redondeo final a 2 decimales
    return Number(totalPayment.toFixed(2));
  }

  /**
   * Formatea las observaciones con límite de caracteres
   */
  formatObservations(notes, originalRequest) {
    // Solo retornar las notas sin agregar información adicional
    // El frontend ya incluye toda la información necesaria en las notas
    if (notes) {
      // Limitar a 500 caracteres si es necesario
      return notes.length > 500 ? notes.substring(0, 500) + '...' : notes;
    }

    return '';
  }

  /**
   * Construye campos adicionales para SIIGO (se imprimen en el PDF)
   * Máximo 15 pares name/value. Cada value se trunca a 140 caracteres.
   */
  buildAdditionalFields(ctx = {}) {
    const { notes, originalRequest, options = {} } = ctx;
    const result = {};

    const makeString = (x) => {
      if (!x) return '';
      try { return String(x).trim(); } catch { return ''; }
    };

    // Construir un "purchase_order" válido para SIIGO con información resumida
    const pm = makeString(options.payment_method_name || options.payment_method);
    const spm = makeString(options.shipping_payment_method || options.delivery_payment_method);

    const parts = [];
    if (pm) parts.push(`Medio: ${pm}`);
    if (spm) parts.push(`Envío: ${spm}`);
    if (notes) parts.push(`Notas: ${makeString(notes)}`);

    const poNumber = parts.join(' | ').substring(0, 60);
    if (poNumber) {
      result.purchase_order = {
        number: poNumber,
        date: new Date().toISOString().split('T')[0]
      };
    }

    // Opcional: incluir un resumen corto del pedido original en "delivery_order"
    if (originalRequest) {
      const summary = (typeof originalRequest === 'string'
        ? originalRequest
        : JSON.stringify(originalRequest)).substring(0, 60);
      if (summary) {
        result.delivery_order = { number: summary };
      }
    }

    return result;
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
  async formatItems(items, options = {}) {
    const formattedItems = [];
    const taxIdFromConfig = options.taxId ? Number(options.taxId) : null;
    const priceIncludeTaxFlag = options.priceIncludeTax === true;
    const useSiigoPrices = options.useSiigoPrices === true;

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const quantity = parseFloat(item.quantity || 1);

      // Intentar resolver códigos desde BD si viene product_id
      try {
        if (item.product_id) {
          const rows = await query(
            'SELECT internal_code, barcode, siigo_id FROM products WHERE id = ? LIMIT 1',
            [item.product_id]
          );
          if (rows && rows.length > 0) {
            const r = rows[0];
            // Completar campos faltantes con lo que haya en BD
            // Priorizar datos de BD sobre los del request si existen
            item.internal_code = r.internal_code || item.internal_code || null;
            item.barcode = r.barcode || item.barcode || null;
            item.siigo_id = r.siigo_id || item.siigo_id || null;

            // Si tenemos internal_code de BD, usarlo como code preferido
            if (r.internal_code) {
              item.code = r.internal_code;
            } else {
              item.code = item.code || r.internal_code || null;
            }
          } else {
            // console.warn(`⚠️ Producto con ID ${item.product_id} no encontrado en BD`);
          }
        }
      } catch (e) {
        console.warn(`⚠️ No se pudo leer códigos desde BD para product_id=${item.product_id}: ${e.message}`);
      }

      // Obtener código del producto (obligatorio)
      // Preferir internal_code. Evitar barcodes largos cuando existan alternativas.
      let productCode = item.code || item.internal_code || item.barcode;
      if (productCode && /^\d{12,}$/.test(String(productCode)) && String(productCode).startsWith('770')) {
        // Si el código es un barcode largo, preferir internal_code si existe
        if (item.internal_code && !(/^\d{12,}$/.test(String(item.internal_code)))) {
          productCode = item.internal_code;
        } else if (item.code && !(/^\d{12,}$/.test(String(item.code)))) {
          productCode = item.code;
        }
      }
      // Normalizar código (SIIGO suele manejar mayúsculas en códigos alfanuméricos)
      if (productCode) {
        productCode = String(productCode).trim().toUpperCase();
      }

      // Fallback: intentar obtener siigo_id desde BD usando el código elegido
      if (!item.siigo_id && productCode) {
        try {
          const rowsByCode = await query(
            `SELECT siigo_id FROM products 
             WHERE siigo_id IS NOT NULL AND TRIM(siigo_id) <> '' AND (
               internal_code = ? OR barcode = ?
             ) LIMIT 1`,
            [productCode, productCode]
          );
          if (rowsByCode && rowsByCode.length > 0 && rowsByCode[0].siigo_id) {
            item.siigo_id = rowsByCode[0].siigo_id;
            console.log(`🔁 Mapeado código ${productCode} → siigo_id desde BD: ${item.siigo_id}`);
          }
        } catch (e) {
          console.warn(`⚠️ Falló búsqueda de siigo_id por código ${productCode}: ${e.message}`);
        }
      }

      if (!productCode) {
        // Si no hay código, generar uno temporal
        const productName = item.product_name || item.description || `Producto ${index + 1}`;
        productCode = productName
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 10)
          .toUpperCase() + (index + 1).toString().padStart(2, '0');

        console.warn(`⚠️ Item ${index + 1} no tiene código, usando temporal: ${productCode}`);
      }

      // Base inicial
      let priceFromRequest = parseFloat(item.price || item.unit_price || item.suggested_price || 0);
      let descriptionFromRequest = (item.description || item.product_name) || null;

      // Estructura base
      const formattedItem = {
        code: productCode,
        quantity: quantity
      };

      // Si está habilitado, tomar precio/descripcion/taxes exclusivos desde SIIGO
      if (useSiigoPrices) {
        try {
          // Intentar resolver un código válido en SIIGO probando múltiples candidatos (internal_code, code, barcode)
          let resolvedCode = productCode;
          let info = null;
          try {
            const rawCandidates = [productCode, item.code, item.internal_code, item.barcode];
            const candidates = Array.from(new Set(rawCandidates.filter(Boolean).map(c => String(c).trim().toUpperCase())));
            for (const cand of candidates) {
              try {
                const probe = await this.getProductInfoByCode(cand);
                if (probe) {
                  info = probe;
                  resolvedCode = cand;
                  break;
                }
              } catch (e) {
                // Continuar con siguiente candidato
                console.warn(`⚠️ Código no encontrado en SIIGO (${cand}): ${e.message}`);
              }
            }
            // Fallback opcional por configuración: siigo_fallback_product_code (ej: 'IMPLE04')
            if (!info) {
              try {
                const fallbackCfg = await configService.getConfig('siigo_fallback_product_code', null);
                const fb = fallbackCfg ? String(fallbackCfg).trim().toUpperCase() : null;
                if (fb) {
                  const probe = await this.getProductInfoByCode(fb);
                  if (probe) {
                    info = probe;
                    resolvedCode = fb;
                    console.warn(`🔁 Usando código fallback configurado para SIIGO: ${fb}`);
                  }
                }
              } catch (e) {
                console.warn(`⚠️ Fallback siigo_fallback_product_code no disponible: ${e.message}`);
              }
            }

            // ACTUALIZAR el código en el objeto formateado con el resuelto
            if (resolvedCode !== productCode) {
              formattedItem.code = resolvedCode;
              productCode = resolvedCode;
            }

            // Si encontramos info en SIIGO, usar el ID (UUID) que es más seguro
            if (info && info.id) {
              formattedItem.id = info.id;
              // Si enviamos ID, el código es opcional, pero lo dejamos por claridad
            }

          } catch (e) {
            console.warn(`⚠️ Error resolviendo código SIIGO para item: ${e.message}`);
          }
          const ivaRate = Number(options.ivaRate) || 19;
          const factor = 1 + (ivaRate / 100);
          if (info && Number.isFinite(info.basePrice) && info.basePrice > 0) {
            // Si priceIncludeTaxFlag está activo, significa que info.basePrice viene con IVA incluido
            // Necesitamos dividir para obtener el precio base real
            if (priceIncludeTaxFlag) {
              const basePrice = Number((info.basePrice / factor).toFixed(6));
              formattedItem.price = basePrice;
            } else {
              // SIIGO devuelve el precio BASE (sin IVA) directamente
              formattedItem.price = Number(info.basePrice.toFixed(6));
            }
          } else {
            // Fallback al valor de la solicitud
            if (priceIncludeTaxFlag) {
              // Si el precio recibido ya incluye IVA, calcular la base
              const basePrice = Number((priceFromRequest / factor).toFixed(6));
              formattedItem.price = basePrice;
            } else {
              formattedItem.price = Number(Number(priceFromRequest).toFixed(6));
            }
          }

          // Descripción desde SIIGO si está disponible
          if (info && info.name) {
            formattedItem.description = String(info.name).substring(0, 100);
          } else if (descriptionFromRequest) {
            formattedItem.description = String(descriptionFromRequest).substring(0, 100);
          }

          // Impuestos desde el producto en SIIGO (no forzar globalmente)
          if (Array.isArray(info?.taxes) && info.taxes.length > 0) {
            const taxIds = info.taxes
              .map(t => t?.id || t?.tax_id || t?.code)
              .filter(Boolean)
              .map(v => ({ id: Number(v) }));
            if (taxIds.length > 0) {
              formattedItem.taxes = taxIds;
            }
          } else {
            // Si SIIGO no devuelve impuestos, intentar aplicar el IVA por defecto (19%) si no es exento
            // Esto es crítico para productos nuevos o servicios como Flete
            const defaultTaxId = 8095; // IVA 19%
            formattedItem.taxes = [{ id: defaultTaxId }];
          }

          // REDONDEO:
          // Si es factura (useTaxedPrice=true), usamos 6 decimales en el precio base para mayor precisión
          // Si es cotización (useTaxedPrice=false), VOLVEMOS A 2 DECIMALES porque 6 causa error 422
          if (formattedItem.price) {
            if (options.useTaxedPrice) {
              formattedItem.price = Number(formattedItem.price.toFixed(6));
            } else {
              formattedItem.price = Number(formattedItem.price.toFixed(2));
            }
          }

          // NUEVA LÓGICA: Si tenemos precio con IVA incluido y está habilitado (solo facturas)
          // Esto delega el cálculo base a SIIGO y evita discrepancias de centavos
          if (priceIncludeTaxFlag && options.useTaxedPrice) {
            // Si priceFromRequest es el precio total con IVA
            formattedItem.taxed_price = Number(priceFromRequest.toFixed(2));
            // Eliminamos 'price' para que SIIGO use 'taxed_price'
            delete formattedItem.price;
          }
        } catch (e) {
          console.warn(`⚠️ No se pudo obtener info de producto ${productCode} desde SIIGO: ${e.message}`);
          // Fallback a lo que venga de la solicitud
          formattedItem.price = Number((priceFromRequest).toFixed(6));
          if (descriptionFromRequest) {
            formattedItem.description = String(descriptionFromRequest).substring(0, 100);
          }
        }
      } else {
        // Mantener comportamiento previo (calcular base si el precio viene con IVA)
        const ivaRate = Number(options.ivaRate) || 19;
        const factor = 1 + (ivaRate / 100);

        // Aplicar IVA si está configurado o viene por ítem (omitir si está marcado como exento)
        const effectiveTaxId = item.tax_id ? Number(item.tax_id) : taxIdFromConfig;
        const isExempt = item.is_exempt === true || item.tax_exempt === true || effectiveTaxId === 0;

        if (descriptionFromRequest) {
          formattedItem.description = String(descriptionFromRequest).substring(0, 100);
        }

        if ((priceIncludeTaxFlag || item.price_include_tax === true) && !isExempt) {
          const taxed = typeof item.taxed_price !== 'undefined' ? parseFloat(item.taxed_price) : priceFromRequest;
          // SIEMPRE enviar precio base (sin IVA), SIIGO calculará el IVA automáticamente
          const basePrice = Number((taxed / factor).toFixed(2));
          formattedItem.price = basePrice;
        } else if (typeof item.taxed_price !== 'undefined' && !isExempt) {
          // Si viene taxed_price pero no está marcado como incluido, calcular base
          const basePrice = Number((parseFloat(item.taxed_price) / factor).toFixed(2));
          formattedItem.price = basePrice;
        } else {
          // Enviar precio base (sin IVA)
          formattedItem.price = Number((priceFromRequest).toFixed(2));
        }

        if (effectiveTaxId && !isExempt) {
          formattedItem.taxes = [{ id: effectiveTaxId }];
        }
      }

      // Descuento por ítem: para evitar errores invalid_type de SIIGO, omitimos completamente el campo.
      // Si se requiere descuento, ajustar a la estructura exacta esperada por el documento configurado y validar con SIIGO.

      // Descuento por ítem
      // Prioridad: 1. Descuento específico del ítem, 2. Descuento global
      let itemDiscount = 0;
      if (item.discount !== undefined && item.discount !== null) {
        itemDiscount = Number(item.discount);
      } else if (options.discount) {
        itemDiscount = Number(options.discount);
      }

      if (itemDiscount > 0) {
        formattedItem.discount = itemDiscount;
      }

      // Aplicar Retención en la Fuente (2.5%) - ID 8101
      if (options.retefuente) {
        if (!formattedItem.taxes) {
          formattedItem.taxes = [];
        }
        // Evitar duplicados si ya existe
        const hasRetefuente = formattedItem.taxes.some(t => t.id === 8101);
        if (!hasRetefuente) {
          formattedItem.taxes.push({ id: 8101 });
        }
      }

      formattedItems.push(formattedItem);
    }

    console.log('🔍 Items formateados para SIIGO:', JSON.stringify(formattedItems, null, 2));
    return formattedItems;
  }

  /**
   * Crea una factura en SIIGO siguiendo la estructura EXACTA de la prueba exitosa
   */
  async createInvoice(invoiceData) {
    try {
      console.log('📋 Creando factura en SIIGO con estructura exacta de prueba exitosa...');
      console.log('📊 Datos de factura:', JSON.stringify(invoiceData, null, 2));

      // Sanear campo additional_fields si llega con tipo inválido (evita 400 invalid_type)
      if (invoiceData && Object.prototype.hasOwnProperty.call(invoiceData, 'additional_fields')) {
        const af = invoiceData.additional_fields;
        if (!af || Array.isArray(af) || typeof af !== 'object' || Object.keys(af).length === 0) {
          delete invoiceData.additional_fields;
        }
      }

      const headers = await siigoService.getHeaders();

      const response = await axios.post(
        `${siigoService.getBaseUrl()}/v1/invoices`,
        invoiceData,
        {
          headers,
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
      console.error('❌ Error creando factura en SIIGO (RAW):', error.message);
      if (error.response) {
        console.error('❌ Status:', error.response.status);
        console.error('❌ Data:', JSON.stringify(error.response.data, null, 2));
      }
      return this.handleCreateInvoiceError(error);
    }
  }

  /**
   * Prepara los datos de cotización para SIIGO
   */
  async prepareQuotationData(customer, items, notes, originalRequest, options = {}) {
    // Configuración por defecto para cotizaciones
    const config = {
      documentId: 15048, // ID de Cotización (CC) corregido
      seller: 388, // Jhon Caicedo
      ...options
    };

    // Validar datos de entrada
    this.validateInputData(customer, items, { allowMissingPrice: true });

    // Formatear items (reutilizamos la lógica de facturas)
    const formattedItems = await this.formatItems(items, {
      taxId: await configService.getConfig('siigo_tax_iva_id', null),
      priceIncludeTax: await configService.getConfig('siigo_prices_include_tax', false),
      ivaRate: await configService.getConfig('siigo_iva_rate', '19'),
      useSiigoPrices: true, // Usar precios de SIIGO por defecto
      discount: options.discount,
      retefuente: options.retefuente,
      useTaxedPrice: false // IMPORTANTE: Cotizaciones NO soportan taxed_price (causa error 422)
    });

    // Formatear observaciones
    const observations = this.formatObservations(notes, originalRequest);

    // Formatear datos del cliente
    const customerData = this.formatCustomerData(customer);

    // Estructura para Cotización
    return {
      document: {
        id: config.documentId
      },
      date: new Date().toISOString().split('T')[0],
      customer: customerData,
      seller: config.seller,
      observations: observations,
      items: formattedItems
    };
  }

  /**
   * Crea una cotización en SIIGO
   */
  async createQuotation(quotationData) {
    try {
      console.log('📋 Creando cotización en SIIGO...');
      console.log('📊 Datos de cotización:', JSON.stringify(quotationData, null, 2));

      const headers = await siigoService.getHeaders();

      // Endpoint para cotizaciones (asumimos /v1/quotations basado en la documentación estándar)
      const response = await axios.post(
        `${siigoService.getBaseUrl()}/v1/quotations`,
        quotationData,
        {
          headers,
          timeout: 30000
        }
      );

      console.log('✅ Cotización creada exitosamente en SIIGO:', response.data);

      return {
        success: true,
        data: response.data,
        quotationNumber: response.data?.number || response.data?.name,
        siigoId: response.data?.id
      };

    } catch (error) {
      console.error('❌ Error creando cotización en SIIGO:', error.response?.data || error.message);
      return this.handleCreateInvoiceError(error); // Reutilizamos el manejador de errores de facturas
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
            suggestions.push(`Verificar campo: ${field}`);
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
      console.log(`📋 Obteniendo factura ${invoiceId} de SIIGO...`);

      const headers = await siigoService.getHeaders();

      const response = await axios.get(
        `${siigoService.getBaseUrl()}/v1/invoices/${invoiceId}`,
        { headers }
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

      const headers = await siigoService.getHeaders();

      const params = new URLSearchParams();
      if (filters.created_start) params.append('created_start', filters.created_start);
      if (filters.created_end) params.append('created_end', filters.created_end);
      if (filters.updated_start) params.append('updated_start', filters.updated_start);
      if (filters.updated_end) params.append('updated_end', filters.updated_end);
      if (filters.page) params.append('page', filters.page);
      if (filters.page_size) params.append('page_size', filters.page_size);

      const response = await axios.get(
        `${siigoService.getBaseUrl()}/v1/invoices${params.toString() ? '?' + params.toString() : ''}`,
        { headers }
      );

      console.log(`✅ ${response.data.results?.length || 0} facturas obtenidas`);
      return response.data;

    } catch (error) {
      console.error('❌ Error listando facturas de SIIGO:', error.message);
      throw error;
    }
  }

  /**
   * Lista cotizaciones con filtros opcionales
   */
  async listQuotations(filters = {}) {
    try {
      console.log('📋 Listando cotizaciones de SIIGO...');

      const headers = await siigoService.getHeaders();

      const params = new URLSearchParams();
      if (filters.created_start) params.append('created_start', filters.created_start);
      if (filters.created_end) params.append('created_end', filters.created_end);
      if (filters.updated_start) params.append('updated_start', filters.updated_start);
      if (filters.updated_end) params.append('updated_end', filters.updated_end);
      if (filters.page) params.append('page', filters.page);
      if (filters.page_size) params.append('page_size', filters.page_size);

      const response = await axios.get(
        `${siigoService.getBaseUrl()}/v1/quotations${params.toString() ? '?' + params.toString() : ''}`,
        { headers }
      );

      console.log(`✅ ${response.data.results?.length || 0} cotizaciones obtenidas`);
      return response.data;

    } catch (error) {
      console.error('❌ Error listando cotizaciones de SIIGO:', error.message);
      throw error;
    }
  }
  /**
   * Obtiene y normaliza información de producto desde SIIGO por código:
   * - name (para descripción)
   * - basePrice (precio sin IVA)
   * - taxes (arreglo como viene de SIIGO)
   */
  async getProductInfoByCode(code) {
    if (!code) throw new Error('Código de producto vacío');
    if (this.productCache.has(code)) return this.productCache.get(code);

    const headers = await siigoService.getHeaders();
    const baseURL = siigoService.getBaseUrl();

    // Intento directo con query por código (si la API lo soporta)
    let product = null;
    try {
      const resp = await axios.get(`${baseURL}/v1/products`, {
        headers,
        params: { page: 1, page_size: 1, code },
        timeout: 20000
      });
      const list = resp.data?.results || [];
      if (Array.isArray(list) && list.length > 0) {
        product = list[0];
      }
    } catch (e) {
      console.warn(`⚠️ Búsqueda por code falló (${code}): ${e.message}`);
    }

    if (!product) {
      throw new Error(`Producto no encontrado por código: ${code}`);
    }

    const info = this.extractProductInfo(product);
    this.productCache.set(code, info);
    return info;
  }

  extractProductInfo(product) {
    const name = product?.name || product?.description || null;

    // Precios: intentar múltiples estructuras comunes
    let basePrice = null;
    if (Array.isArray(product?.prices) && product.prices.length > 0) {
      // Estructura típica: { prices: [{ price: 12345 }] } o { value: 12345 }
      basePrice = Number(product.prices[0]?.price ?? product.prices[0]?.value ?? NaN);
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      basePrice = Number(product?.price ?? product?.unit_price ?? NaN);
    }
    if (!Number.isFinite(basePrice)) {
      basePrice = 0;
    }

    // Impuestos tal cual vienen del producto
    const taxes = Array.isArray(product?.taxes) ? product.taxes : [];

    return { name, basePrice, taxes };
  }

}

module.exports = new SiigoInvoiceService();
