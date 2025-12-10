const { query, transaction } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const siigoRefreshService = require('../services/siigoRefreshService');

// Helper: emitir evento de cambio de estado para notificaciones en tiempo real (Logística)
const emitStatusChange = (orderId, orderNumber, fromStatus, toStatus) => {
  try {
    const payload = {
      orderId,
      order_number: orderNumber || null,
      from_status: fromStatus || null,
      to_status: toStatus,
      timestamp: new Date().toISOString()
    };
    if (global.io) {
      global.io.to('orders-updates').emit('order-status-changed', payload);
    }
    console.log('📡 (cartera) Emitido order-status-changed:', payload);
  } catch (e) {
    console.error('⚠️  Error emitiendo order-status-changed (cartera):', e?.message || e);
  }
};

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/payment-proofs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `payment-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Obtener información de crédito de un cliente CON SIIGO SDK
const getCustomerCredit = async (req, res) => {
  try {
    const { customerName } = req.params;
    console.log(`🔍 [WALLET] Consultando crédito para cliente: ${customerName}`);
    // Deshabilitar caché para evitar respuestas obsoletas
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    // 1. Buscar información local del cliente (robusto por NOMBRE y NIT)
    const normalize = (s = '') => String(s)
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toUpperCase()
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const rawName = String(customerName || '');
    const normName = normalize(rawName);

    // Intento A: coincidencia exacta por nombre normalizado
    let creditInfo = await query(
      `SELECT * FROM customer_credit 
       WHERE status = 'active' AND TRIM(UPPER(customer_name)) = TRIM(UPPER(?))
       ORDER BY created_at DESC 
       LIMIT 1`,
      [normName]
    );

    // Intento B: por NIT si viene como query (?nit=)
    if (!creditInfo.length) {
      const nitRaw = (req.query?.nit || '').toString();
      const nitOnly = nitRaw.replace(/[^0-9]/g, '');
      if (nitOnly) {
        const byNit = await query(
          `SELECT * FROM customer_credit 
           WHERE status = 'active' AND REPLACE(customer_nit, '-', '') = ? 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [nitOnly]
        );
        if (byNit.length) creditInfo = byNit;
      }
    }

    // Intento B.2: si no enviaron ?nit=, intentar leerlo desde la última orden con ese nombre
    if (!creditInfo.length && !(req.query?.nit)) {
      try {
        const lastOrderRows = await query(
          `SELECT customer_identification FROM orders 
           WHERE TRIM(UPPER(customer_name)) = TRIM(UPPER(?))
           ORDER BY created_at DESC LIMIT 1`,
          [rawName]
        );
        const extractedNit = (lastOrderRows?.[0]?.customer_identification || '').toString().replace(/[^0-9]/g, '');
        if (extractedNit) {
          const byNitFromOrders = await query(
            `SELECT * FROM customer_credit 
             WHERE status = 'active' AND REPLACE(customer_nit, '-', '') = ?
             ORDER BY created_at DESC LIMIT 1`,
            [extractedNit]
          );
          if (byNitFromOrders.length) creditInfo = byNitFromOrders;
        }
      } catch (e) {
        console.warn('⚠️  [WALLET] No se pudo extraer NIT desde orders:', e.message);
      }
    }

    // Intento C: fuzzy por tokens (ignora S.A.S., LTDA, DE, LA, EL, Y, &) y tolera singular/plural
    if (!creditInfo.length) {
      const stop = new Set(['SAS', 'SA', 'LTDA', 'DE', 'LA', 'EL', 'Y', 'E', '&', 'THE', 'DEL']);
      const rawTokens = normName.split(' ').filter(w => w && !stop.has(w));
      // Generar variantes de token (ej: SALSAS -> SALSA)
      const tokens = rawTokens.map(w => w.trim()).filter(Boolean);
      if (tokens.length) {
        let sql = `SELECT * FROM customer_credit WHERE status = 'active'`;
        const params = [];
        for (const tkn of tokens) {
          const variants = new Set([tkn]);
          // quitar plural común en español si el token es suficientemente largo
          if (tkn.length > 4) {
            if (tkn.endsWith('ES')) variants.add(tkn.slice(0, -2));
            if (tkn.endsWith('S')) variants.add(tkn.slice(0, -1));
          }
          // Construir (LIKE v1 OR LIKE v2 ...)
          const ors = Array.from(variants).map(() => 'UPPER(customer_name) LIKE ?').join(' OR ');
          sql += ` AND (${ors})`;
          for (const v of variants) params.push(`%${v}%`);
        }
        sql += ` ORDER BY created_at DESC LIMIT 1`;
        const byTokens = await query(sql, params);
        if (byTokens.length) creditInfo = byTokens;
      }
    }

    // 2. Intentar obtener saldos reales desde SIIGO usando SDK (solo si el cliente está configurado localmente)
    let siigoBalance = null;
    let siigoData = null;

    if (creditInfo.length > 0) {
      try {
        const localNit = creditInfo[0]?.customer_nit || null;
        if (!localNit) {
          throw new Error('Cliente sin NIT configurado en BD');
        }

        console.log(`💰 [WALLET] Consultando saldos SIIGO con SDK para NIT: ${localNit}`);
        siigoData = await siigoRefreshService.getCustomerBalanceWithRefresh(localNit);
        siigoBalance = siigoData?.total_balance || 0;
        console.log(`💰 [WALLET] Saldo SIIGO obtenido: $${siigoBalance?.toLocaleString()} (Fuente: ${siigoData?.source})`);
      } catch (siigoError) {
        console.warn(`⚠️  [WALLET] Error consultando SIIGO:`, siigoError.message);
        siigoBalance = 0;
        siigoData = {
          total_balance: 0,
          source: 'error',
          error: siigoError.message
        };
      }
    }

    // 3. Combinar información local con saldos SIIGO
    if (creditInfo.length > 0) {
      const localCredit = creditInfo[0];

      // Si no tiene límite configurado (> 0), considerar como no configurado
      if (!(parseFloat(localCredit.credit_limit || 0) > 0)) {
        console.log(`⚠️  [WALLET] Cliente ${customerName} sin límite configurado (>0). Se responde 404.`);
        return res.status(404).json({
          success: false,
          code: 'CREDIT_NOT_CONFIGURED',
          message: 'No se encontró información de crédito para este cliente',
          data: {
            customer_name: customerName,
            checked_sources: ['local_database'],
            reason: 'credit_limit<=0'
          }
        });
      }

      // Respuesta combinada con información local + saldos SIIGO
      const responseData = {
        // Información local de configuración de crédito
        id: localCredit.id,
        customer_name: localCredit.customer_name,
        customer_phone: localCredit.customer_phone,
        customer_email: localCredit.customer_email,
        credit_limit: parseFloat(localCredit.credit_limit || 0),
        notes: localCredit.notes,
        status: localCredit.status,
        created_at: localCredit.created_at,
        updated_at: localCredit.updated_at,

        // ✅ CORREGIDO: Usar current_balance con el saldo real de SIIGO
        current_balance: siigoBalance,

        // Información adicional de SIIGO para debugging
        siigo_data: siigoData,

        // Cálculos basados en SIIGO
        available_credit: Math.max(0, parseFloat(localCredit.credit_limit || 0) - siigoBalance),
        credit_utilization: parseFloat(localCredit.credit_limit || 0) > 0
          ? ((siigoBalance / parseFloat(localCredit.credit_limit || 0)) * 100).toFixed(2)
          : 0,

        // Información de origen
        data_source: {
          local_config: 'database',
          balance_source: siigoData?.source || 'unknown',
          balance_updated: new Date().toISOString(),
          siigo_balance: siigoBalance
        },

        // Mantener saldo local como referencia histórica
        local_current_balance: parseFloat(localCredit.current_balance || 0)
      };

      console.log(`✅ [WALLET] Información combinada para ${customerName}:`);
      console.log(`   - Límite de crédito: $${responseData.credit_limit.toLocaleString()}`);
      console.log(`   - Saldo SIIGO: $${responseData.current_balance.toLocaleString()}`);
      console.log(`   - Crédito disponible: $${responseData.available_credit.toLocaleString()}`);
      console.log(`   - Utilización: ${responseData.credit_utilization}%`);

      res.json({
        success: true,
        data: responseData
      });

    } else {
      // Cliente no está configurado localmente: responder 404 de forma consistente
      console.log(`⚠️  [WALLET] Cliente ${customerName} no tiene crédito configurado localmente (se responde 404)`);
      return res.status(404).json({
        success: false,
        code: 'CREDIT_NOT_CONFIGURED',
        message: 'No se encontró información de crédito para este cliente',
        data: {
          customer_name: customerName,
          checked_sources: ['local_database']
        }
      });
    }

  } catch (error) {
    console.error('❌ [WALLET] Error obteniendo información de crédito:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Validar pago y enviar a logística
const validatePayment = async (req, res) => {
  try {
    const {
      orderId,
      paymentMethod,
      validationType = 'approved', // 'approved' o 'rejected'
      validationNotes,
      paymentReference,
      paymentAmount,
      paymentDate,
      bankName,
      creditApproved,
      customerCreditLimit,
      customerCurrentBalance,
      // Nuevos campos para pagos mixtos
      paymentType,
      transferredAmount,
      cashAmount
    } = req.body;

    // Helpers de coerción segura para evitar errores de tipo en MySQL (STRICT)
    const toBoolean = (v) => {
      if (typeof v === 'boolean') return v;
      const s = String(v ?? '').trim().toLowerCase();
      if (s === '') return false;
      return ['true', '1', 'yes', 'si', 'sí', 'on'].includes(s);
    };
    // Flag: cartera marcó que el efectivo lo cobra el mensajero
    const cashByMessenger = toBoolean(req.body?.cashByMessenger);
    const toNumberOrNull = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const toDateOrNull = (v) => {
      if (!v) return null;
      // Acepta YYYY-MM-DD o cualquier fecha parseable por Date
      const d = v instanceof Date ? v : new Date(typeof v === 'string' ? v.replace(' ', 'T') : v);
      if (Number.isNaN(d.getTime())) return null;
      // Normalizar a YYYY-MM-DD
      return d.toISOString().slice(0, 10);
    };

    // Normalizar método de pago a valores canónicos usados en BD (robusto contra acentos y espacios)
    const normalizePaymentMethod = (raw) => {
      const s0 = String(raw || '').trim().toLowerCase();
      const s = s0.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const token = s.replace(/\s+/g, '_');
      if (!token) return '';
      if (token.includes('electronico')) return 'pago_electronico';
      if (token.includes('mercadopago') || token.includes('bold')) return 'pago_electronico';
      if (token === 'tarjeta' || token.includes('tarjeta_credito')) return 'tarjeta_credito';
      if (token === 'credito' || token.includes('cliente_credito') || (token.includes('cliente') && token.includes('credito'))) return 'cliente_credito';
      if (token.includes('transfer') || token.includes('bancolombia')) return 'transferencia';
      if (token.includes('efectivo') || token === 'cash') return 'efectivo';
      return token;
    };
    const pmNormalized = normalizePaymentMethod(paymentMethod);

    // Asegurar valor base de pm antes de cualquier uso
    let pmFinal = pmNormalized;

    const userId = req.user.id;

    // Debug: log incoming payload y archivos (sin referenciar variables no inicializadas)
    try {
      const bodyKeys = Object.keys(req.body || {});
      const filesInfo = {
        hasFile: !!req.file,
        fields: Object.keys(req.files || {}),
        paymentProofImage: req.files?.paymentProofImage?.[0]?.originalname || null,
        cashProofImage: req.files?.cashProofImage?.[0]?.originalname || null
      };
      console.log('🧾 [WALLET] validatePayment incoming:', {
        orderId,
        paymentMethod,
        pmNormalized,
        pmFinal,
        validationType,
        bodyKeys,
        creditApproved,
        customerCreditLimit,
        customerCurrentBalance,
        paymentAmount,
        paymentDate,
        bankName,
        filesInfo
      });
    } catch (e) {
      console.warn('⚠️ [WALLET] Debug logging failed:', e.message);
    }

    // Avisos no bloqueantes de crédito (para que Cartera decida)
    let creditWarning = null;
    let creditWarningData = null;

    // Manejar múltiples archivos para pagos mixtos
    const files = req.files || {};
    const paymentProofImage = req.file ? req.file.filename :
      (files.paymentProofImage ? files.paymentProofImage[0].filename : null);
    const cashProofImage = files.cashProofImage ? files.cashProofImage[0].filename : null;

    // Normalizar tipo de pago (simple/mix) aceptando variantes en español y tolerando acentos
    const normalizePaymentType = (raw) => {
      const s0 = String(raw || '').trim().toLowerCase();
      const s = s0.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!s) return '';
      // Aceptar: mixed, mixto, mix
      if (s === 'mixed' || s === 'mixto' || s.includes('mix')) return 'mixed';
      return 'single';
    };
    let paymentTypeSafe = normalizePaymentType(paymentType);

    // Requisito: para pagos electrónicos (Bold/MercadoPago) es obligatorio adjuntar comprobante
    const pmLower = pmFinal;
    if (validationType === 'approved' && (pmLower === 'pago_electronico' || pmLower === 'pago_electrónico' || pmLower === 'electronico' || pmLower === 'electrónico')) {
      // Usar banco enviado inicialmente; el fallback se calcula más adelante con orderData
      const providerRaw = String(bankName || '').toLowerCase();

      // Verificar si hay comprobante en el request o en la tabla payment_evidences
      let hasEvidence = !!paymentProofImage;
      if (!hasEvidence) {
        const existingEvidences = await query('SELECT id FROM payment_evidences WHERE order_id = ? LIMIT 1', [orderId]);
        hasEvidence = existingEvidences.length > 0;
      }

      if (!hasEvidence) {
        return res.status(400).json({
          success: false,
          message: 'Debe adjuntar el comprobante de la transacción (imagen) para pagos electrónicos (Bold/MercadoPago)'
        });
      }
      if (!['bold', 'mercadopago', 'mercado_pago'].includes(providerRaw)) {
        return res.status(400).json({
          success: false,
          message: 'Debe seleccionar el proveedor del pago electrónico (Bold o MercadoPago)'
        });
      }
    }

    // Verificar que el pedido existe y está en un estado válido para (re)validación
    // Permitimos también "listo_para_entrega" para poder corregir pagos mixtos ya preparados
    const order = await query(
      'SELECT * FROM orders WHERE id = ? AND (status = "revision_cartera" OR status = "en_logistica" OR status = "listo_para_entrega")',
      [orderId]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o no está en revisión por cartera'
      });
    }

    const orderData = order[0];

    // Fallbacks si el frontend no envía algunos campos (evita 500 por ENUM/NULL)
    pmFinal = pmNormalized;
    if (!pmFinal) {
      const raw = orderData.payment_method;
      pmFinal = normalizePaymentMethod(raw);
      console.log('[WALLET] pm vacío; fallback desde order.payment_method =', raw, '->', pmFinal);
    }
    // Forzar a valores permitidos del ENUM para evitar 500 por "Incorrect enum value"
    const allowedPaymentMethods = new Set(['efectivo', 'transferencia', 'pago_electronico', 'tarjeta_credito', 'cliente_credito']);
    if (!allowedPaymentMethods.has(pmFinal)) {
      const fallbackFromOrder = normalizePaymentMethod(orderData.payment_method);
      pmFinal = allowedPaymentMethods.has(fallbackFromOrder) ? fallbackFromOrder : 'efectivo';
      console.log('[WALLET] pm no reconocido; forzando a valor permitido:', pmFinal);
    }

    let bankNameFinal = bankName;
    let paymentAmountFinal = paymentAmount;
    let paidAmountForUpdate = null;

    // Validaciones de negocio para pagos mixtos (transferencia + efectivo)
    // Acepta 'mixed'/'mixto' o deriva mixto por montos (transferido + efectivo)
    if (validationType === 'approved' && pmFinal === 'transferencia') {
      const transferredNum = toNumberOrNull(transferredAmount);
      const orderTotalNum = toNumberOrNull(orderData.total_amount);
      const expectedCash = (orderTotalNum ?? 0) - (transferredNum ?? 0);
      const cashNum = toNumberOrNull(typeof cashAmount !== 'undefined' && cashAmount !== null ? cashAmount : expectedCash);
      try {
        console.log('[WALLET][MIXED] totales:', { orderTotalNum, transferredNum, expectedCash, incomingCashAmount: cashAmount, cashNum, paymentType: paymentTypeSafe, cashByMessengerFlag: cashByMessenger });
      } catch (_) { }

      // Derivar mixto si no vino etiquetado pero los montos lo indican
      let isMixed = (paymentTypeSafe === 'mixed');
      if (!isMixed) {
        if ((transferredNum > 0 && cashNum > 0) ||
          (transferredNum > 0 && (orderTotalNum ?? 0) - transferredNum > 0)) {
          isMixed = true;
          paymentTypeSafe = 'mixed'; // asegurar persistencia en wallet_validations
        }
      }

      if (isMixed) {
        if (!(transferredNum > 0) || !(cashNum > 0)) {
          return res.status(400).json({
            success: false,
            message: 'Montos inválidos para pago mixto: ambos, transferido y efectivo, deben ser > 0'
          });
        }
        if ((transferredNum + cashNum) !== orderTotalNum) {
          return res.status(400).json({
            success: false,
            message: 'La suma de transferencia + efectivo debe ser exactamente igual al total del pedido'
          });
        }
        // Para registro general, usar el total como payment_amount
        paymentAmountFinal = String(orderData.total_amount || 0);
        // Para pagos mixtos aprobados, el efectivo restante lo cobra el mensajero por defecto.
        // Persistimos siempre requires_payment=1 y payment_amount=cashNum
        var requiresPaymentOverride = 1;
        var paymentAmountOverride = cashNum;

        // Exponer overrides en el request para su uso en el UPDATE
        req.__requiresPaymentOverride = requiresPaymentOverride;
        req.__paymentAmountOverride = paymentAmountOverride;
        // Para pago mixto, el monto pagado (paid_amount) corresponde a lo transferido
        paidAmountForUpdate = transferredNum;
      }
    }
    if (validationType === 'approved') {
      if (!bankNameFinal && pmFinal === 'pago_electronico') {
        bankNameFinal = orderData.electronic_payment_type || bankNameFinal;
        if (bankNameFinal) {
          console.log('[WALLET] bankName fallback from order.electronic_payment_type =', bankNameFinal);
        }
      }
      if (!paymentAmountFinal || paymentAmountFinal === '') {
        paymentAmountFinal = String(orderData.total_amount || 0);
      }
      // Para pagos simples (transferencia/electrónico/tarjeta), registrar paid_amount = monto pagado
      if (!paidAmountForUpdate && (pmFinal === 'transferencia' || pmFinal === 'pago_electronico' || pmFinal === 'tarjeta_credito')) {
        paidAmountForUpdate = toNumberOrNull(paymentAmountFinal);
      }
    }

    // Coerciones finales a tipos compatibles con BD
    const creditApprovedBool = toBoolean(creditApproved);
    const paymentAmountFinalNum = toNumberOrNull(paymentAmountFinal);
    const customerCreditLimitFinal = toNumberOrNull(customerCreditLimit);
    const customerCurrentBalanceFinal = toNumberOrNull(customerCurrentBalance);
    const paymentDateFinal = toDateOrNull(paymentDate);

    // ID del cliente de crédito (si aplica) para actualizaciones seguras
    let creditCustomerId = null;

    // Validación de crédito no bloqueante: Cartera tiene decisión final
    try {
      const isCreditMethod = pmFinal.includes('credito');
      if (validationType === 'approved' && isCreditMethod) {
        const creditRows = await query(
          'SELECT * FROM customer_credit WHERE TRIM(UPPER(customer_name)) = TRIM(UPPER(?)) LIMIT 1',
          [orderData.customer_name]
        );

        if (!creditRows.length) {
          creditWarning = 'CREDIT_NOT_CONFIGURED';
        } else {
          const localCredit = creditRows[0];
          creditCustomerId = localCredit.id;

          if ((localCredit.status || '').toLowerCase() !== 'active') {
            creditWarning = 'CREDIT_INACTIVE';
          }

          // Obtener saldo real desde SIIGO si es posible
          let siigoBalance = parseFloat(localCredit.current_balance || 0);
          try {
            let customerNit = localCredit.customer_nit || null;
            if (!customerNit) {
              const nitMatch = (orderData.customer_name || '').match(/(\d{6,12}-?\d?)/);
              if (nitMatch) {
                customerNit = nitMatch[1].replace('-', '');
              }
            }
            if (customerNit) {
              const siigoData = await siigoRefreshService.getCustomerBalanceWithRefresh(customerNit);
              if (siigoData && typeof siigoData.total_balance !== 'undefined' && siigoData.total_balance !== null) {
                siigoBalance = parseFloat(siigoData.total_balance) || 0;
              }
            }
          } catch (e) {
            console.warn('[WALLET] No se pudo refrescar saldo SIIGO para validación de crédito:', e.message);
          }

          const orderAmount = parseFloat(orderData.total_amount || 0);
          const creditLimit = parseFloat(localCredit.credit_limit || 0);
          const available = creditLimit - siigoBalance;

          if (!(available >= orderAmount)) {
            creditWarning = creditWarning || 'INSUFFICIENT_CREDIT';
            creditWarningData = { creditLimit, siigoBalance, availableCredit: available, orderAmount };
          }
        }
      }
    } catch (strictErr) {
      console.error('Error en validación (no bloqueante) de crédito:', strictErr);
      // Continuar: cartera podrá decidir igualmente
    }

    const finalValidationNotes = creditWarning
      ? `${validationNotes || ''} [AVISO_CREDITO:${creditWarning}${creditWarningData ? ` ${JSON.stringify(creditWarningData)}` : ''}]`
      : (validationNotes || null);

    await transaction(async (connection) => {
      // Crear registro de validación
      const paymentTypeForDB = pmFinal === 'cliente_credito' ? 'single' : pmFinal === 'transferencia' ? (paymentTypeSafe === 'mixed' ? 'mixed' : 'single') : 'single'; // evitar NULL siempre

      const insertParams = [
        orderId,
        pmFinal,
        validationType,
        paymentProofImage,
        paymentReference || null,
        paymentAmountFinalNum,
        paymentDateFinal,
        bankNameFinal || null,
        paymentTypeForDB,
        toNumberOrNull(transferredAmount),
        toNumberOrNull(cashAmount),
        cashProofImage,
        customerCreditLimitFinal,
        customerCurrentBalanceFinal,
        creditApprovedBool ? 1 : 0,
        validationType, // validation_status
        finalValidationNotes,
        userId
      ];
      try {
        console.log('🧾 [WALLET] Insert wallet_validations params:', insertParams.map(v => ({ value: v, type: typeof v })));
      } catch (logErr) {
        console.warn('⚠️ [WALLET] No se pudo loguear insertParams:', logErr?.message);
      }
      await connection.execute(
        `INSERT INTO wallet_validations (
          order_id, payment_method, validation_type, payment_proof_image,
          payment_reference, payment_amount, payment_date, bank_name,
          payment_type, transferred_amount, cash_amount, cash_proof_image,
          customer_credit_limit, customer_current_balance, credit_approved,
          validation_status, validation_notes, validated_by, validated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        insertParams
      );

      if (validationType === 'approved') {
        // Si es cliente a crédito, actualizar el saldo
        if (pmFinal === 'cliente_credito' && creditApprovedBool) {
          await connection.execute(
            `UPDATE customer_credit 
             SET current_balance = current_balance + ?, updated_at = NOW()
             WHERE id = ? AND status = 'active'`,
            [orderData.total_amount, creditCustomerId]
          );
        }

        // Actualizar estado del pedido
        if (orderData.is_service) {
          // Calcular provider si aplica (aunque sea servicio, podría ser pago electrónico)
          const bankLower = String(bankNameFinal || '').toLowerCase();
          let normalizedProvider = null;
          if (bankLower === 'mercado_pago' || bankLower === 'mercadopago') {
            normalizedProvider = 'mercadopago';
          } else if (bankLower === 'bold') {
            normalizedProvider = 'bold';
          }
          // Si es bancolombia u otro, se deja en null (es transferencia, no pago electrónico tipo gateway)

          // Pedidos de servicio: pasan directo a entregado (pendiente cierre SIIGO)
          await connection.execute(
            `UPDATE orders 
             SET status = "entregado", 
                 validation_status = "approved",
                 validation_notes = ?,
                 electronic_payment_type = ?,
                 electronic_payment_notes = ?,
                 payment_method = ?,
                 requires_payment = IF(? = 'cliente_credito', 0, requires_payment),
                 paid_amount = COALESCE(?, paid_amount),
                 updated_at = NOW() 
             WHERE id = ?`,
            [finalValidationNotes, normalizedProvider, paymentReference || null, pmFinal, pmFinal, paidAmountForUpdate, orderId]
          );
          console.log('✅ [WALLET] Pedido de SERVICIO validado y marcado como entregado (skip logística)');
        } else if (pmLower === 'pago_electronico' || pmLower === 'pago_electrónico' || pmLower === 'electronico' || pmLower === 'electrónico') {
          const bankLower = String(bankNameFinal || '').toLowerCase();
          const normalizedProvider = (bankLower === 'mercado_pago' || bankLower === 'mercadopago') ? 'mercadopago' : 'bold';
          await connection.execute(
            `UPDATE orders 
             SET status = "en_logistica", 
                 validation_status = "approved",
                 validation_notes = ?,
                 electronic_payment_type = ?,
                 electronic_payment_notes = ?,
                 payment_method = ?,
                 requires_payment = IF(? = 'cliente_credito', 0, requires_payment),
                 paid_amount = COALESCE(?, paid_amount),
                 updated_at = NOW() 
             WHERE id = ?`,
            [finalValidationNotes, normalizedProvider, paymentReference || null, pmFinal, pmFinal, paidAmountForUpdate, orderId]
          );
        } else {
          // Aplicar overrides cuando Cartera marca efectivo pendiente por mensajero (pago mixto)
          // Fallback robusto: si no vienen overrides, derivar de paymentTypeSafe/cashAmount

          // NUEVO: Detectar transferencia completa (no mixta) para marcar requires_payment = 0
          // Esto evita que el mensajero cobre dinero cuando Cartera ya validó transferencia completa
          const isFullTransfer = (
            pmFinal === 'transferencia' &&
            paymentTypeSafe !== 'mixed' &&
            typeof req.__requiresPaymentOverride === 'undefined'  // No hay override de pago mixto
          );

          const rpOverride = (typeof req.__requiresPaymentOverride !== 'undefined')
            ? req.__requiresPaymentOverride
            : (paymentTypeSafe === 'mixed' ? 1 : (isFullTransfer ? 0 : null));

          const paOverride = (typeof req.__paymentAmountOverride !== 'undefined')
            ? req.__paymentAmountOverride
            : (paymentTypeSafe === 'mixed' ? toNumberOrNull(cashAmount) : (isFullTransfer ? 0 : null));

          try {
            console.log('[WALLET][UPDATE] applying overrides:', {
              rpOverride, paOverride, pmFinal, paymentTypeSafe, isFullTransfer
            });
          } catch (_) { }

          await connection.execute(
            `UPDATE orders 
             SET status = "en_logistica", 
                 validation_status = "approved",
                 validation_notes = ?,
                 payment_method = ?,
                 requires_payment = IFNULL(?, CASE 
                   WHEN ? = 'cliente_credito' THEN 0 
                   WHEN ? = 'mixed' THEN 1
                   WHEN ? = 'transferencia' THEN 0
                   ELSE requires_payment END),
                 payment_amount = COALESCE(?, payment_amount),
                 paid_amount = COALESCE(?, paid_amount),
                 updated_at = NOW() 
             WHERE id = ?`,
            [finalValidationNotes, pmFinal, rpOverride, pmFinal, paymentTypeSafe, pmFinal, paOverride, paidAmountForUpdate, orderId]
          );

          // Fallback robusto: si sigue inconsistente un pago mixto (transferencia + efectivo),
          // forzar requires_payment/payment_amount/paid_amount a los valores correctos.
          if (paymentTypeSafe === 'mixed' && pmFinal === 'transferencia') {
            try {
              const cashNum = toNumberOrNull(typeof cashAmount !== 'undefined' && cashAmount !== null ? cashAmount : null);
              const transferredNum = toNumberOrNull(transferredAmount);
              console.log('[WALLET][UPDATE][FALLBACK] Forzando campos para mixto transferencia:', {
                orderId, cashNum, transferredNum
              });
              await connection.execute(
                `UPDATE orders 
                 SET 
                   requires_payment = 1,
                   payment_amount = CASE WHEN COALESCE(payment_amount,0)=0 THEN ? ELSE payment_amount END,
                   paid_amount = CASE WHEN COALESCE(paid_amount,0)=0 THEN ? ELSE paid_amount END,
                   updated_at = NOW()
                 WHERE id = ?`,
                [cashNum, transferredNum, orderId]
              );
            } catch (fbErr) {
              console.warn('[WALLET][UPDATE][FALLBACK] Error aplicando fallback mixto:', fbErr?.message);
            }
          }
        }
      } else {
        // Rechazado - mantener en cartera pero marcar como rechazado
        await connection.execute(
          `UPDATE orders 
           SET validation_status = "rejected",
               validation_notes = ?,
               updated_at = NOW() 
           WHERE id = ?`,
          [finalValidationNotes, orderId]
        );
      }
    });

    // Notificar a Logística en tiempo real si el pedido pasó a en_logistica
    if (validationType === 'approved') {
      try {
        emitStatusChange(
          Number(orderId),
          (order?.[0]?.order_number) || null,
          (order?.[0]?.status) || null,
          'en_logistica'
        );
      } catch (_) { }
    }

    // Obtener el pedido actualizado
    const updatedOrder = await query(
      `SELECT 
        o.*, 
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
       WHERE o.id = ?`,
      [orderId]
    );
    try {
      const uo = updatedOrder[0] || {};
      console.log('[WALLET][RESULT] requires_payment/payment_amount/method/status:', { id: uo.id, requires_payment: uo.requires_payment, payment_amount: uo.payment_amount, payment_method: uo.payment_method, status: uo.status });
    } catch (_) { }

    const message = validationType === 'approved'
      ? 'Pago validado exitosamente y enviado a logística'
      : 'Pedido marcado como no apto para logística';

    res.json({
      success: true,
      message,
      data: updatedOrder[0]
    });

  } catch (error) {
    console.error('Error validando pago:', {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
      sql: error?.sql
    });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      // Exponer detalle para diagnóstico (temporal; retirar si no se requiere)
      error: error?.message || String(error)
    });
  }
};

// Obtener historial de validaciones
const getValidationHistory = async (req, res) => {
  try {
    const { orderId } = req.params;

    const validations = await query(
      `SELECT 
        wv.*,
        u.full_name as validated_by_name
       FROM wallet_validations wv
       LEFT JOIN users u ON wv.validated_by = u.id
       WHERE wv.order_id = ?
       ORDER BY wv.created_at DESC`,
      [orderId]
    );

    res.json({
      success: true,
      data: validations
    });

  } catch (error) {
    console.error('Error obteniendo historial de validaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener lista de clientes con crédito
const getCreditCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const customers = await query(
      `SELECT * FROM customer_credit 
       ${whereClause}
       ORDER BY customer_name ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalResult = await query(
      `SELECT COUNT(*) as total FROM customer_credit ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo clientes con crédito:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear o actualizar cliente con crédito
const upsertCreditCustomer = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      creditLimit,
      currentBalance = 0,
      status = 'active',
      notes
    } = req.body;

    const userId = req.user.id;

    // Verificar si el cliente ya existe
    const existingCustomer = await query(
      'SELECT id FROM customer_credit WHERE customer_name = ?',
      [customerName]
    );

    if (existingCustomer.length > 0) {
      // Actualizar cliente existente
      await query(
        `UPDATE customer_credit 
         SET customer_phone = ?, customer_email = ?, credit_limit = ?, 
             current_balance = ?, status = ?, notes = ?, updated_at = NOW()
         WHERE customer_name = ?`,
        [customerPhone, customerEmail, creditLimit, currentBalance, status, notes, customerName]
      );

      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente'
      });
    } else {
      // Crear nuevo cliente
      await query(
        `INSERT INTO customer_credit 
         (customer_name, customer_phone, customer_email, credit_limit, 
          current_balance, status, notes, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [customerName, customerPhone, customerEmail, creditLimit, currentBalance, status, notes, userId]
      );

      res.json({
        success: true,
        message: 'Cliente creado exitosamente'
      });
    }

  } catch (error) {
    console.error('Error creando/actualizando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener pedidos pendientes de validación en cartera
const getWalletOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '', dateFrom = '', dateTo = '' } = req.query;
    const offset = (page - 1) * limit;

    // Base: excluir eliminados (soft delete)
    let whereClause = 'WHERE o.deleted_at IS NULL';
    const params = [];
    // Flag opcional: incluir también "en_logistica" pendientes cuando no se envía status explícito
    const includeLogisticaPending = ['1', 'true', 'yes', 'si', 'sí'].includes(String(req.query.include_logistica_pending || '').toLowerCase());

    // Si el frontend envía un estado específico (ej. status=revision_cartera),
    // respetarlo estrictamente y no incluir otros estados.
    if (status) {
      if (status === 'revision_cartera') {
        whereClause += ' AND (o.status = ? OR o.is_pending_payment_evidence = 1)';
      } else {
        whereClause += ' AND o.status = ?';
      }
      params.push(status);
    } else {
      // Comportamiento por defecto (vista de Cartera):
      // Por defecto SOLO mostrar "revision_cartera".
      // Si include_logistica_pending=1, incluir también "en_logistica" con cobro pendiente y validación pendiente.
      // ADEMÁS: Siempre incluir is_pending_payment_evidence = 1 (pedidos marcados por mensajeros para subir comprobante)
      if (includeLogisticaPending) {
        whereClause += ' AND (o.status = "revision_cartera" OR (o.status = "en_logistica" AND o.requires_payment = 1 AND (o.validation_status IS NULL OR o.validation_status = "" OR o.validation_status = "pending")) OR o.is_pending_payment_evidence = 1)';
      } else {
        whereClause += ' AND (o.status = "revision_cartera" OR o.is_pending_payment_evidence = 1)';
      }
    }

    // Rango de fechas opcional (por fecha de creación)
    if (dateFrom) {
      whereClause += ' AND DATE(o.created_at) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND DATE(o.created_at) <= ?';
      params.push(dateTo);
    }

    // Búsqueda por texto
    if (search) {
      whereClause += ' AND (o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.order_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // CONSULTA ESPECÍFICA PARA CARTERA CON TODOS LOS CAMPOS NECESARIOS
    const orders = await query(
      `SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_email,
        o.customer_identification,
        o.customer_address,
        o.customer_department,
        o.customer_city,
        o.payment_method,
        o.delivery_method,
        o.shipping_payment_method,
        o.delivery_fee_exempt,
        o.delivery_fee,
        o.shipping_date,
        o.total_amount,
        o.status,
        o.notes,
        o.validation_status,
        o.validation_notes,
        o.electronic_payment_type,
        o.electronic_payment_notes,
        o.payment_evidence_path,
        o.is_pending_payment_evidence,
        o.siigo_observations,
        o.is_service,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
        o.created_at,
        o.updated_at,
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
       ${whereClause}
       ORDER BY o.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Contar total de pedidos
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );

    // PROCESAR PEDIDOS SIN SOBRESCRIBIR DATOS VÁLIDOS
    const processedOrders = orders.map(order => ({
      ...order,
      // Solo asegurar que delivery_method tenga un valor por defecto si está vacío
      delivery_method: order.delivery_method || 'domicilio',
      // Solo asegurar que customer_name tenga un valor por defecto si está vacío
      customer_name: order.customer_name || 'Cliente sin nombre',
      // Formatear el total
      total_amount: parseFloat(order.total_amount || 0)
      // NO sobrescribir payment_method - mantener el valor original de la base de datos
    }));

    res.json({
      success: true,
      data: {
        orders: processedOrders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo pedidos de cartera:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de cartera
const getWalletStats = async (req, res) => {
  try {
    // Pedidos pendientes de validación
    const pendingValidations = await query(
      'SELECT COUNT(*) as count FROM orders WHERE status = "revision_cartera"'
    );

    // Total de crédito otorgado
    const totalCredit = await query(
      'SELECT SUM(credit_limit) as total FROM customer_credit WHERE status = "active"'
    );

    // Total de saldo pendiente
    const totalBalance = await query(
      'SELECT SUM(current_balance) as total FROM customer_credit WHERE status = "active"'
    );

    // Validaciones del día
    const todayValidations = await query(
      'SELECT COUNT(*) as count FROM wallet_validations WHERE DATE(validated_at) = CURDATE()'
    );

    // Clientes con cupo agotado (calculado dinámicamente)
    const exhaustedCredit = await query(
      `SELECT COUNT(*) as count FROM customer_credit 
       WHERE status = "active" AND (credit_limit - current_balance) <= 0`
    );

    res.json({
      success: true,
      data: {
        pendingValidations: pendingValidations[0].count,
        totalCredit: totalCredit[0].total || 0,
        totalBalance: totalBalance[0].total || 0,
        todayValidations: todayValidations[0].count,
        exhaustedCredit: exhaustedCredit[0].count
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de cartera:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener comprobantes de pago de un pedido
const getPaymentEvidences = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Verificar permisos (cartera, admin, o facturador)
    // Nota: Asumimos que el middleware de autenticación ya validó el token
    // y que los roles se verifican en la ruta o aquí si es necesario.
    // Por ahora permitimos acceso a usuarios autenticados que tengan acceso a la orden.

    const evidences = await query(
      `SELECT pe.*, u.full_name as uploaded_by_name 
       FROM payment_evidences pe 
       LEFT JOIN users u ON pe.uploaded_by = u.id 
       WHERE pe.order_id = ? 
       ORDER BY pe.uploaded_at DESC`,
      [orderId]
    );

    res.json({
      success: true,
      data: evidences
    });
  } catch (error) {
    console.error('Error obteniendo comprobantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener comprobantes'
    });
  }
};

// Eliminar un comprobante de pago
const deletePaymentEvidence = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener información del archivo para eliminarlo del disco
    const evidence = await query(
      'SELECT * FROM payment_evidences WHERE id = ?',
      [id]
    );

    if (!evidence || evidence.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comprobante no encontrado'
      });
    }

    const filePath = path.join(__dirname, '../../frontend/build', evidence[0].file_path);

    // Eliminar registro de la BD
    await query('DELETE FROM payment_evidences WHERE id = ?', [id]);

    // Intentar eliminar archivo físico (no fallar si no existe)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('No se pudo eliminar el archivo físico:', err);
    }

    res.json({
      success: true,
      message: 'Comprobante eliminado correctamente'
    });
  } catch (error) {
    console.error('Error eliminando comprobante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar comprobante'
    });
  }
};

// Subir múltiples comprobantes
const uploadPaymentEvidences = async (req, res) => {
  try {
    const { orderId } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se han subido archivos'
      });
    }

    const userId = req.user ? req.user.id : null;
    const insertedIds = [];

    for (const file of files) {
      // Construir path relativo para guardar en BD
      // Nota: Multer guarda en frontend/build/uploads/payment-proofs/
      // El path en BD debe ser relativo a frontend/build/
      const relativePath = `uploads/payment-proofs/${file.filename}`;

      const result = await query(
        'INSERT INTO payment_evidences (order_id, file_path, uploaded_by) VALUES (?, ?, ?)',
        [orderId, relativePath, userId]
      );
      insertedIds.push(result.insertId);
    }

    res.json({
      success: true,
      message: `${files.length} comprobantes subidos correctamente`,
      data: { insertedIds }
    });
  } catch (error) {
    console.error('Error subiendo comprobantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir comprobantes'
    });
  }
};

module.exports = {
  getCustomerCredit,
  validatePayment: [upload.fields([
    { name: 'paymentProofImage', maxCount: 1 },
    { name: 'cashProofImage', maxCount: 1 }
  ]), validatePayment],
  getValidationHistory,
  getCreditCustomers,
  upsertCreditCustomer,
  getWalletOrders,
  getWalletStats,
  getPaymentEvidences,
  deletePaymentEvidence,
  uploadPaymentEvidences: [
    upload.array('payment_evidences', 5), // Permitir hasta 5 archivos
    uploadPaymentEvidences
  ]
};
