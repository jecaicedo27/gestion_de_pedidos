/* Centralized payment/shipping helpers for consistent UI behavior across the app */

// Normalize helper (strip accents, lowercase, trim)
export function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

// Detect if the order is a Credit customer
export function isCreditOrder(order) {
  // Helper para reunir valores de múltiples rutas (incluyendo anidados)
  const grab = (...paths) => {
    const out = [];
    for (const p of paths) {
      if (!p) continue;
      if (Array.isArray(p)) {
        for (const v of p) if (v != null && v !== '') out.push(v);
      } else if (typeof p === 'object') {
        // recorrer algunas claves comunes si nos pasan un objeto
        const obj = p;
        const keys = [
          'payment_method','method','paymentMethod',
          'payment_type','paymentType',
          'payment_term','paymentTerm',
          'payment_terms','paymentTerms',
          'payment_condition','paymentCondition',
          'payment_category','paymentCategory',
          'payment_mode','paymentMode',
          'payment_term_name','paymentTermName'
        ];
        for (const k of keys) if (k in obj) out.push(obj[k]);
      } else {
        out.push(p);
      }
    }
    return out;
  };

  // Construir candidatos desde nivel raíz y campos anidados frecuentes
  const candidatesRaw = grab(
    // raíz
    order?.payment_method ?? order?.method ?? order?.paymentMethod,
    order?.payment_type ?? order?.paymentType,
    order?.payment_term ?? order?.paymentTerm,
    order?.payment_terms ?? order?.paymentTerms,
    order?.payment_condition ?? order?.paymentCondition,
    order?.payment_category ?? order?.paymentCategory,
    order?.payment_mode ?? order?.paymentMode,
    order?.payment_term_name ?? order?.paymentTermName,
    // customer anidado
    order?.customer,
    order?.client,
    // billing/siigo anidados
    order?.billing,
    order?.siigo,
    order?.siigo_payment_info ?? order?.siigoPaymentInfo
  );

  // Normalizar y aplanar cadenas
  const candidates = candidatesRaw
    .flatMap(v => {
      if (typeof v === 'string') return [v];
      // probar parseo si viene como JSON stringificado
      try {
        if (typeof v === 'string' && /^[{\[]/.test(v.trim())) {
          const parsed = JSON.parse(v);
          return [parsed];
        }
      } catch (_) {}
      return [v];
    })
    .flatMap(v => (typeof v === 'object' && v != null ? [] : [v]))
    .map(v => normalize(v))
    .filter(Boolean);

  // Flags directos (aceptar varias variantes y niveles)
  const anyTrue = (val) => val === true || val === 1 || val === '1';
  const creditFlags =
    anyTrue(order?.is_credit) ||
    anyTrue(order?.credit) ||
    anyTrue(order?.customer_is_credit) ||
    anyTrue(order?.isCredit) ||
    anyTrue(order?.customerIsCredit) ||
    anyTrue(order?.customer?.is_credit) ||
    anyTrue(order?.customer?.isCredit) ||
    anyTrue(order?.client?.is_credit) ||
    anyTrue(order?.client?.isCredit);

  if (creditFlags) return true;

  // También considerar términos de días de crédito explícitos
  const termDaysCandidates = [
    order?.payment_term_days, order?.paymentTermDays,
    order?.customer?.payment_term_days, order?.customer?.paymentTermDays,
    order?.billing?.payment_term_days, order?.billing?.paymentTermDays
  ].map(n => Number(n)).filter(n => !Number.isNaN(n));
  if (termDaysCandidates.some(d => d > 0)) return true;

  if (candidates.length === 0) return false;

  // Evitar falsos positivos: cualquier token que contenga 'tarjeta' NO indica cliente a crédito
  const looksCard = (t) => t && t.includes('tarjeta');

  // Criterios de crédito
  const isCreditToken = (t) =>
    t === 'cliente_credito' ||
    t === 'credito' ||
    t.includes('cliente a credito') ||
    // Variaciones comunes y sinónimos
    t.includes('credito') ||
    t.includes('cliente_credito') ||
    t.includes('cliente credito') ||
    t.includes('30 dias') || t.includes('30dias') || t.includes('a 30') ||
    t.includes('60 dias') || t.includes('60dias') || t.includes('a 60');

  // Caso especial: algunos orígenes usan FV1 asociado a crédito.
  // Si existen ambos tokens 'fv1' y algún indicio de 'credito' en el conjunto, considerar crédito.
  const hasFV1 = candidates.some(t => t === 'fv1' || /\bfv\s*1\b/.test(t));
  const hasCredito = candidates.some(t => t.includes('credito') || t.includes('cliente a credito'));
  if (hasFV1 && hasCredito) return true;

  // Si existe algún token no-tarjeta que cumpla criterios de crédito, es cliente a crédito
  if (candidates.some(t => !looksCard(t) && isCreditToken(t))) return true;

  // Como último recurso, revisar estructuras anidadas por nombres conocidos de proveedor de términos
  try {
    const raw = order?.siigo_payment_info ?? order?.siigoPaymentInfo;
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const maybeTerm = normalize(
      obj?.payment_terms?.name ?? obj?.payment_terms?.type ?? obj?.payment_terms ??
      obj?.terms?.name ?? obj?.terms
    );
    if (maybeTerm && !looksCard(maybeTerm) && (maybeTerm.includes('credito') || maybeTerm.includes('cliente a credito'))) {
      return true;
    }
  } catch (_) {}

  return false;
}

// Methods managed/validated by Wallet (Cartera)
function isWalletLikeMethod(order) {
  const pm = normalize(order?.payment_method || order?.method || order?.paymentMethod);
  const walletLike = [
    'transferencia',
    'pago electronico',
    'pago_electronico',
    'tarjeta_credito',
    'tarjeta',
    'pse',
    'nequi',
    'daviplata',
    'deposito',
    'consignacion',
    'bancolombia'
  ];
  return walletLike.some(k => pm.includes(k));
}

// Determine if product payment should be considered PAID for badges on list views
export function hasOrderPayment(order) {
  // Credit: never show as paid
  if (isCreditOrder(order)) return false;

  // Do not mark as paid while in wallet review or before invoicing
  const status = normalize(order?.status);
  if (['revision_cartera', 'pendiente_por_facturacion'].includes(status)) return false;

  const pm = normalize(order?.payment_method || order?.method || order?.paymentMethod);

  // Unknown/automatic payment mapping should not mark as paid by default
  if (!pm || pm === 'auto') return false;

  const validation = normalize(order?.validation_status);
  if (validation === 'rejected' || validation === 'rechazado') return false;

  const count = Number(order?.cash_register_count ?? order?.cr_count ?? order?.cashCount ?? 0);
  const hasCashEntry = !Number.isNaN(count) && count > 0;

  if (isWalletLikeMethod(order)) {
    // Wallet-like methods: paid only if approved by wallet or cash entry exists
    return (validation === 'approved' || validation === 'aprobado') || hasCashEntry;
  }

  // Cash/contraentrega-like: require explicit cash entry or explicit paid flags
  if (hasCashEntry) return true;

  const paidFlags = [order?.payment_received, order?.is_paid, order?.paid];
  if (paidFlags.some(v => v === true || v === 1 || v === '1')) return true;

  // Only trust payment_status flags if explicitly set (avoid auto/unknown)
  const statusFlags = [normalize(order?.payment_status), normalize(order?.cash_status)];
  if (pm && statusFlags.some(s => s === 'paid' || s === 'pagado')) return true;

  return false;
}

// Determine if shipping fee is paid (for shipping badge)
export function hasShippingFeePaid(order) {
  const sm = normalize(order?.shipping_payment_method);
  if (!sm) return false;

  const unpaid = ['pending', 'pendiente', 'por_cobrar', 'unpaid', 'contraentrega', 'contra entrega'];
  if (unpaid.includes(sm)) return false;

  // Consider multiple synonyms for company-paid/prepaid shipping
  const paidKeywords = [
    'paid',
    'pagado',
    'prepagado',
    'prepaid',
    'contado',
    'empresa',
    'paga empresa',
    'paga_la_empresa',
    'paid_by_company',
    'prepaid_shipping'
  ];
  return paidKeywords.some(k => sm.includes(k));
}

// Compute amounts a messenger should collect at delivery
// Returns: { productDue, shippingDue, totalDue }
export function computeCollectionAmounts(order) {
  // Reposición: sin cobro por mensajero (producto ni flete)
  const pmOverall = normalize(order?.payment_method || order?.method || order?.paymentMethod);
  if (pmOverall === 'reposicion') {
    return { productDue: 0, shippingDue: 0, totalDue: 0 };
  }
  const total = Number(order?.total_amount ?? order?.total ?? 0);
  const paidAmount = Number(order?.paid_amount ?? order?.amount_paid ?? 0);

  // Base product amount: prefer explicit payment_amount/siigo_balance if available
  const rawBase = Number(order?.payment_amount ?? order?.siigo_balance ?? 0);
  const baseProduct = rawBase > 0 ? rawBase : total;

  // Flags and helpers
  const status = normalize(order?.status);
  const delivered =
    ['entregado_cliente', 'entregado_bodega', 'entregado', 'finalizado', 'completado'].includes(status) ||
    Boolean(order?.delivered_at) ||
    order?.is_delivered === true ||
    order?.is_delivered === 1;

  const validation = normalize(order?.validation_status);
  const count = Number(order?.cash_register_count ?? order?.cr_count ?? order?.cashCount ?? 0);
  const hasCashEntry = !Number.isNaN(count) && count > 0;

  // Normalized payment method and delivery method flags
  // Normalizamos método de pago con fallbacks defensivos:
  // - Si no viene payment_method pero el envío es contraentrega/por_cobrar, asumir 'contraentrega'
  // - Si no viene y existe saldo explícito (payment_amount/siigo_balance) o (total - pagado) > 0, asumir 'contraentrega'
  let pmNorm = normalize(order?.payment_method || order?.method || order?.paymentMethod);
  const shippingPayNorm = normalize(order?.shipping_payment_method || order?.shippingPaymentMethod);
  const naiveProductDueFallback = Math.max(
    0,
    (Number(order?.total ?? order?.total_amount ?? 0)) - (Number(order?.paid_amount ?? order?.amount_paid ?? 0))
  );
  if (!pmNorm) {
    if (['contraentrega', 'por_cobrar'].includes(shippingPayNorm)) {
      pmNorm = 'contraentrega';
    } else if (rawBase > 0 || naiveProductDueFallback > 0) {
      pmNorm = 'contraentrega';
    }
  }

  const pickup = ['recoge_bodega', 'recogida_tienda'].includes(normalize(order?.delivery_method));
  const cashLike = pmNorm === 'efectivo' || pmNorm === 'contraentrega' || pmNorm === 'contado' || pmNorm === 'cash';

  // Compute a robust requiresPay flag to avoid inconsistencies between endpoints
  let requiresPayFlag = (order?.requires_payment === true || order?.requires_payment === 1 || order?.requires_payment === '1');
  if (!requiresPayFlag) {
    if (!isCreditOrder(order) && !delivered) {
      if (cashLike) {
        requiresPayFlag = true;
      } else if (rawBase > 0) {
        requiresPayFlag = true;
      } else if (naiveProductDueFallback > 0 && !isWalletLikeMethod(order)) {
        requiresPayFlag = true;
      }
    }
  }

  // Product to collect
  let productDue = 0;

  if (delivered) {
    // Nothing to collect after delivery is completed
    productDue = 0;
  } else if (isCreditOrder(order)) {
    // Credit customers do not pay product at delivery
    productDue = 0;
  } else if (pickup && cashLike) {
    // Recoge en bodega con efectivo/contraentrega: exigir caja para considerar SIN COBRO
    productDue = hasCashEntry ? 0 : Math.max(0, baseProduct - paidAmount);
  } else if (pmNorm === 'sin_cobro' || (!requiresPayFlag && !(cashLike && pickup) && !isWalletLikeMethod(order))) {
    // No-charge orders (excluye efectivo/contraentrega en bodega y métodos wallet-like que requieren validación)
    productDue = 0;
  } else if (requiresPayFlag) {
    // Pago mixto validado por Cartera: cobrar exactamente el monto en efectivo (payment_amount/siigo_balance) sin restar paid_amount (que usualmente representa la transferencia ya abonada)
    productDue = rawBase > 0 ? Math.max(0, rawBase) : Math.max(0, total - paidAmount);
  } else if ((pmNorm === 'transferencia' || pmNorm === 'pago_electronico') && rawBase > 0) {
    // Fallback defensivo: si hay saldo explícito (payment_amount/siigo_balance) con transferencia/electrónico,
    // asumir pago mixto y cobrar exactamente ese saldo (sin restar paid_amount)
    productDue = Math.max(0, rawBase);
  } else if (isWalletLikeMethod(order)) {
    // Wallet-like methods: special rule for Recoge en Bodega/Tienda
    // En bodega exigimos registro en caja (cash_register) o validación aprobada por Cartera
    if (pickup && !hasCashEntry && !(validation === 'approved' || validation === 'aprobado')) {
      // Aún deben registrar pago/firma evidencias en bodega
      productDue = Math.max(0, baseProduct - paidAmount);
    } else {
      // Fuera de bodega, o con validación/caja, el mensajero no cobra producto
      productDue = 0;
    }
  } else if (hasCashEntry) {
    // Cash was already collected at warehouse/logistics
    productDue = 0;
  } else {
    // Cash/contraentrega: collect pending product value
    productDue = Math.max(0, baseProduct - paidAmount);
  }

  // If credit, never collect shipping at delivery either (handled by warehouse)
  if (isCreditOrder(order)) {
    return { productDue: 0, shippingDue: 0, totalDue: 0 };
  }

  // Shipping to collect
  const shippingPay = normalize(order?.shipping_payment_method || order?.shippingPaymentMethod);
  const FREE_SHIPPING_THRESHOLD = 150000;
  const shouldCollectDeliveryFee =
    order?.should_collect_delivery_fee === true ||
    order?.should_collect_delivery_fee === 1 ||
    order?.should_collect_delivery_fee === '1';
  const deliveryExempt =
    order?.delivery_fee_exempt === true ||
    order?.delivery_fee_exempt === 1 ||
    order?.delivery_fee_exempt === '1';
  const qualifiesFreeShipping = total >= FREE_SHIPPING_THRESHOLD;

  // Treat common synonyms for company-paid/prepaid shipping as paid
  const paidKeywords = [
    'paid',
    'pagado',
    'prepagado',
    'prepaid',
    'contado',
    'empresa',
    'paga empresa',
    'paga_la_empresa',
    'paid_by_company',
    'prepaid_shipping'
  ];
  const shippingAlreadyPaid =
    paidKeywords.some(k => shippingPay.includes(k)) ||
    (!shippingPay || shippingPay === 'auto'); // default to not collecting if unspecified

  const isContraentrega = ['contraentrega', 'por_cobrar'].includes(shippingPay);

  // After delivery is completed, do not suggest collecting shipping either
  let shippingDue = 0;
  if (!delivered) {
    const feeApplies =
      !shippingAlreadyPaid &&
      !qualifiesFreeShipping &&
      !deliveryExempt &&
      (isContraentrega || shouldCollectDeliveryFee);

    shippingDue = feeApplies ? Number(order?.delivery_fee || 0) : 0;
  }

  // Normalizar a pesos enteros para evitar errores de precisión (ghost cents) que activan cobros por $0
  const pDue = Math.max(0, Math.round(productDue));
  const sDue = Math.max(0, Math.round(shippingDue));

  return {
    productDue: pDue,
    shippingDue: sDue,
    totalDue: pDue + sDue
  };
}

/* Shared helpers for labeling and badges */
export function getPaymentMethodLabel(method) {
  const v = normalize(method);
  const map = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta_credito: 'Tarjeta de Crédito',
    tarjeta: 'Tarjeta',
    pago_electronico: 'Pago Electrónico',
    pse: 'PSE',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    cliente_credito: 'Cliente a Crédito',
    credito: 'Cliente a Crédito',
    contraentrega: 'Contraentrega',
    publicidad: 'Publicidad',
    reposicion: 'Reposición',
    sin_cobro: 'Sin cobro',
    auto: 'Por definir'
  };
  if (map[v]) return map[v];
  if (!v) return 'No especificado';
  if (v.includes('credito')) return 'Cliente a Crédito';
  if (v.includes('transfer')) return 'Transferencia';
  if (v.includes('efectivo')) return 'Efectivo';
  return method || 'No especificado';
}

export function getPaymentBadgeClass(method) {
  const v = normalize(method);
  if (!v || v === 'auto') return 'bg-gray-100 text-gray-800';
  if (v === 'sin_cobro' || v.includes('sin cobro') || v === 'publicidad' || v === 'reposicion') return 'bg-gray-100 text-gray-800';
  if (v.includes('credito')) return 'bg-yellow-100 text-yellow-800';
  if (v.includes('transfer')) return 'bg-blue-100 text-blue-800';
  if (v.includes('efectivo') || v.includes('contado')) return 'bg-green-100 text-green-800';
  if (v.includes('pago') || v.includes('tarjeta') || v.includes('pse') || v.includes('electron')) return 'bg-indigo-100 text-indigo-800';
  return 'bg-gray-100 text-gray-800';
}

export function getElectronicLabel(type) {
  const v = normalize(type);
  const map = {
    mercadopago: 'Mercado Pago',
    bold: 'BOLD',
    wompi: 'Wompi',
    placetopay: 'Place to Pay',
    tpaga: 'Tpaga',
    stripe: 'Stripe',
    paypal: 'PayPal',
    pse: 'PSE',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    tarjeta: 'Tarjeta',
    tarjeta_credito: 'Tarjeta de Crédito',
    otro: 'Otro'
  };
  if (map[v]) return map[v];
  if (!v) return 'No aplica';
  return type;
}

export function getElectronicBadgeClass(type) {
  const v = normalize(type);
  if (!v) return 'bg-gray-100 text-gray-800';
  if (v.includes('mercado')) return 'bg-blue-100 text-blue-800';
  if (v.includes('bold')) return 'bg-purple-100 text-purple-800';
  if (v.includes('wompi')) return 'bg-amber-100 text-amber-800';
  if (v.includes('placetopay') || v.includes('place to pay')) return 'bg-cyan-100 text-cyan-800';
  if (v.includes('tpaga')) return 'bg-lime-100 text-lime-800';
  if (v.includes('stripe')) return 'bg-sky-100 text-sky-800';
  if (v.includes('paypal')) return 'bg-blue-100 text-blue-800';
  if (v.includes('pse')) return 'bg-indigo-100 text-indigo-800';
  if (v.includes('nequi') || v.includes('daviplata')) return 'bg-pink-100 text-pink-800';
  if (v.includes('tarjeta')) return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
}

export function detectProviderFromString(str) {
  const n = normalize(str);
  if (!n) return null;

  // direct names / brands
  if (n.includes('bold')) return 'bold';
  // Avoid false positives: do NOT match plain "mp" inside words like "empacado".
  // Accept explicit "mercadopago", "mercado pago", or standalone token "mp"
  if (
    n.includes('mercadopago') ||
    n.includes('mercado pago') ||
    n.includes('mercado_pago') ||
    /\bmp\b/.test(n) ||
    /\bm\.?\s*p\.?\b/.test(n) || // "m p", "m.p", "mp"
    /\bmpago\b/.test(n)          // "mpago"
  ) return 'mercadopago';
  if (n.includes('wompi')) return 'wompi';
  if (
    n.includes('placetopay') ||
    n.includes('place to pay') ||
    n.includes('place_to_pay') ||
    n.includes('place2pay') ||
    /\b(p2p|ptp)\b/.test(n)
  ) return 'placetopay';
  if (n.includes('tpaga')) return 'tpaga';
  if (n.includes('stripe')) return 'stripe';
  if (n.includes('paypal')) return 'paypal';
  if (n.includes('pse')) return 'pse';
  if (n.includes('nequi')) return 'nequi';
  if (n.includes('daviplata') || n.includes('davi plata')) return 'daviplata';

  // card/dataphone hints
  if (n.includes('datafono') || n.includes('datáfono') || n.includes('dataphone')) return 'tarjeta';
  // Only treat explicit card terms as card; avoid generic "credito"/"debito" to prevent false positives (e.g., cliente_credito)
  if (n.includes('visa') || n.includes('master') || n.includes('tarjeta')) return 'tarjeta';

  // tokens like pago_electronico_bold, pago_electronico_mp, etc.
  if (n.includes('pago') && n.includes('electron') && n.includes('bold')) return 'bold';
  if (n.includes('pago') && n.includes('electron') && (/\bmp\b/.test(n) || n.includes('mercado'))) return 'mercadopago';
  if (n.includes('pago') && n.includes('electron') && n.includes('wompi')) return 'wompi';

  return null;
}

function deepScanProvider(value) {
  const tryParseJSON = (s) => {
    try {
      const trimmed = s.trim();
      if (/^[{\[]/.test(trimmed)) {
        return JSON.parse(trimmed);
      }
    } catch (_) {}
    return null;
  };

  const walk = (val) => {
    if (val == null) return null;

    if (typeof val === 'string') {
      // direct string detection
      const fromStr = detectProviderFromString(val);
      if (fromStr) return fromStr;
      // try parse JSON and scan
      const parsed = tryParseJSON(val);
      if (parsed) return walk(parsed);
      return null;
    }

    if (Array.isArray(val)) {
      for (const item of val) {
        const r = walk(item);
        if (r) return r;
      }
      return null;
    }

    if (typeof val === 'object') {
      // frequent keys
      const clueKeys = [
        'provider',
        'gateway',
        'method',
        'payment_method',
        'paymentMethod',
        'payment_provider',
        'paymentProvider',
        'electronic_payment_type',
        'electronicPaymentType',
        'electronic_payment_provider',
        'electronicPaymentProvider',
        'processor',
        'processor_name',
        'acquirer',
        'merchant',
        'bank',
        'provider_name',
        'payment_gateway'
      ];
      for (const k of clueKeys) {
        if (k in val && typeof val[k] === 'string') {
          const r = detectProviderFromString(val[k]);
          if (r) return r;
        }
      }
      // recurse
      for (const [, v] of Object.entries(val)) {
        const r = walk(v);
        if (r) return r;
      }
      return null;
    }

    return null;
  };

  return walk(value);
}
/**
 * Only show explicit PSP providers in UI (avoid inferring generic "tarjeta").
 * Approved PSPs for the "Pago Electrónico" column.
 */
const APPROVED_ELECTRONIC_PROVIDERS = new Set([
  'mercadopago',
  'bold',
  'wompi',
  'placetopay',
  'tpaga',
  'stripe',
  'paypal',
  'pse',
  'nequi',
  'daviplata'
]);

function isApprovedProvider(val) {
  if (!val) return false;
  const n = normalize(val);
  return APPROVED_ELECTRONIC_PROVIDERS.has(n);
}

export function resolveElectronicType(order) {
  // Short-circuit: show provider only for explicit electronic payments (Bold/MP)
  const pm = normalize(order?.payment_method || order?.method || order?.paymentMethod);
  // No provider for credit orders
  if (isCreditOrder(order)) return null;
  // Only show provider when payment method is explicitly electronic
  if (!pm || !(pm.includes('pago') || pm.includes('electron'))) return null;
  // 1) Direct read with common aliases
  let direct =
    order?.electronic_payment_type ??
    order?.electronicPaymentType ??
    order?.payment_provider ??
    order?.paymentProvider ??
    order?.electronic_payment_provider ??
    order?.electronicPaymentProvider;

  if (typeof direct === 'string') {
    const raw = direct.trim();
    const n = normalize(raw);

    // Treat generic tokens like "pago electronico" (even with prefixes like "pm:")
    // as meaningless unless a real provider hint is present.
    const providerHints = [
      'mercadopago', 'mercado pago', 'mercado_pago', 'mp',
      'wompi', 'bold', 'nequi', 'daviplata', 'pse', 'tpaga',
      'stripe', 'paypal', 'placetopay', 'place to pay', 'place_to_pay', 'place2pay',
      'tarjeta', 'visa', 'master', 'datafono', 'dataphone', 'datáfono'
    ];
    const looksGenericElectronic =
      (n.includes('pago') && n.includes('electron')) &&
      !providerHints.some(k => n.includes(k));

    const meaningless =
      !raw ||
      n === 'auto' ||
      n === 'por definir' ||
      n === 'por_definir' ||
      n === 'sin definir' ||
      n === 'no aplica' ||
      n === 'no_aplica' ||
      n === 'pago electronico' ||
      n === 'pago_electronico' ||
      looksGenericElectronic;

    if (!meaningless) {
      const detected = detectProviderFromString(raw);
      // Only accept approved PSP providers (exclude generic "tarjeta")
      if (detected && isApprovedProvider(detected)) return detected;
      if (isApprovedProvider(raw)) return raw;
      // Unapproved or generic values are ignored
    }
  }

  // 1.5) Infer from payment_method text (e.g., "Pago electrónico BOLD")
  const fromPaymentMethod = detectProviderFromString(order?.payment_method || order?.method || order?.paymentMethod);
  if (fromPaymentMethod && isApprovedProvider(fromPaymentMethod)) return fromPaymentMethod;

  // 2) Try siigo_payment_info (stringified JSON or object)
  try {
    const infoRaw = order?.siigo_payment_info ?? order?.siigoPaymentInfo;
    const info = typeof infoRaw === 'string' ? JSON.parse(infoRaw) : infoRaw;
    const candidate =
      info?.provider ??
      info?.gateway ??
      info?.method ??
      info?.payment_method ??
      info?.paymentMethod;
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      const raw = candidate.trim();
      const n = normalize(raw);
      const meaningless =
        !raw ||
        n === 'auto' ||
        n === 'por definir' ||
        n === 'por_definir' ||
        n === 'sin definir' ||
        n === 'no aplica' ||
        n === 'no_aplica' ||
        n === 'pago electronico' ||
        n === 'pago_electronico';
      if (!meaningless) {
        const detected = detectProviderFromString(raw);
        if (detected && isApprovedProvider(detected)) return detected;
        if (isApprovedProvider(raw)) return raw;
      }
    }
  } catch (_) {
    // ignore parse errors
  }

  // 3) Fallback: infer from electronic payment notes or general notes
  const notesRaw =
    order?.electronic_payment_notes ??
    order?.electronicPaymentNotes ??
    order?.payment_notes ??
    order?.paymentNotes ??
    order?.notes;
  if (typeof notesRaw === 'string' && notesRaw.trim()) {
    const fromNotes = detectProviderFromString(notesRaw);
    if (fromNotes && isApprovedProvider(fromNotes)) return fromNotes;
  }

  // 4) Deep scan entire order for hints (including nested JSON)
  const deep = deepScanProvider(order);
  if (deep && isApprovedProvider(deep)) return deep;

  return null;
}

export function getProviderHint(order) {
  try {
    // priority: explicit fields
    const direct =
      order?.payment_provider ||
      order?.electronic_payment_provider ||
      order?.electronic_payment_type ||
      order?.electronicPaymentType;

    const pm = String(order?.payment_method || '').trim();

    // try to deduce from siigo_payment_info
    let fromInfo = '';
    try {
      const raw = order?.siigo_payment_info ?? order?.siigoPaymentInfo;
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (obj) {
        const str = JSON.stringify(obj);
        const hit = detectProviderFromString(str);
        if (hit) fromInfo = hit;
      }
    } catch (_) {}

    const parts = [];
    if (direct) parts.push(`direct:${String(direct).slice(0, 40)}`);
    if (fromInfo) parts.push(`info:${fromInfo}`);
    if (pm) parts.push(`pm:${pm.slice(0, 40)}`);

    if (parts.length === 0) return 'sin pistas';
    return parts.join(' | ');
  } catch {
    return 'debug-unavailable';
  }
}

export default {
  normalize,
  getPaymentMethodLabel,
  getPaymentBadgeClass,
  getElectronicLabel,
  getElectronicBadgeClass,
  detectProviderFromString,
  resolveElectronicType,
  getProviderHint,
  isCreditOrder,
  hasOrderPayment,
  hasShippingFeePaid,
  computeCollectionAmounts
};
