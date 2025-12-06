import React, { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { walletService } from '../services/api';
import { computeCollectionAmounts } from '../utils/payments';

// Zona de carga que permite: pegar (Ctrl+V), arrastrar y seleccionar archivo
// Sólo acepta imágenes; valida tamaño (<= 5MB) y muestra estado
const UploadDropzone = ({
  label = 'Comprobante (imagen) *',
  file,
  onFile,
  required = false,
  hint = 'Pega (Ctrl+V) o usa "Pegar desde portapapeles"; tambien puedes arrastrar o usar el boton "Seleccionar archivo"',
  autoFocus = true,
  onFocusExtra = null,
  showPasteButton = false,
  onPasteClick
}) => {
  const inputRef = useRef(null);
  const zoneRef = useRef(null);

  // Enfocar automáticamente la zona para habilitar pegado inmediato (Ctrl+V)
  useEffect(() => {
    if (autoFocus && zoneRef.current) {
      const id = setTimeout(() => {
        try { zoneRef.current.focus(); } catch (_) {}
      }, 120);
      return () => clearTimeout(id);
    }
  }, [autoFocus]);

  const validateAndEmit = (f) => {
    if (!f) return;
    if (!f.type || !f.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('El archivo no puede ser mayor a 5MB');
      return;
    }
    onFile(f);
  };

  const onInputChange = (e) => {
    const f = e.target.files?.[0];
    validateAndEmit(f);
  };



  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    validateAndEmit(f);
  };

  const onDragOver = (e) => e.preventDefault();

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div
        ref={zoneRef}
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={(e) => { try { e.currentTarget.textContent = ''; } catch (_) {} }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onFocus={(e) => {
          // Opcional: al enfocar, seleccionar visualmente para indicar que ya puedes pegar
          e.currentTarget.classList.add('ring-2','ring-blue-500');
          if (typeof onFocusExtra === 'function') onFocusExtra();
        }}
        onBlur={(e) => {
          e.currentTarget.classList.remove('ring-2','ring-blue-500');
        }}
        className="flex flex-col items-center justify-center w-full px-3 py-6 border-2 border-dashed rounded-md cursor-pointer bg-white hover:bg-gray-50 border-gray-300 focus:outline-none"
        role="button"
        aria-label={label}
        style={{ caretColor: 'transparent' }}
      >
        <Icons.Upload className="w-6 h-6 text-gray-500 mb-2" />
        <p className="text-sm text-gray-700 text-center">
          {hint}
        </p>
        {showPasteButton && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPasteClick && onPasteClick(e); }}
            className="mt-2 text-xs text-blue-600 hover:underline focus:outline-none"
          >
            Pegar desde portapapeles
          </button>
        )}
        {file && (
          <p className="text-xs text-green-600 mt-2">Archivo: {file.name}</p>
        )}
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs px-2 py-1 border rounded text-gray-700 hover:bg-gray-50"
        >
          Seleccionar archivo
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onInputChange}
        className="hidden"
        aria-hidden="true"
        {...(required ? { required: true } : {})}
      />
    </div>
  );
};

const WalletValidationModal = ({ isOpen, onClose, order, onValidate }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  // Zona activa para pegado global: 'transfer' o 'cash'
  const [activeDropzone, setActiveDropzone] = useState('transfer');
  const modalRef = useRef(null);
  const pasteCatcherRef = useRef(null);
  // Evitar duplicados de pegado (varios listeners pueden dispararse)
  const pasteGuardRef = useRef(0);
  const recentlyHandledPaste = () => (Date.now() - pasteGuardRef.current) < 2000;
  const markPasteHandled = () => { pasteGuardRef.current = Date.now(); };
  // Guard adicional para notificación visual única
  const lastToastRef = useRef(0);
  const showUniquePasteToast = () => {
    const now = Date.now();
    // Coalescar múltiples llamadas en el mismo tick (StrictMode/HMR/ráfagas)
    if (typeof window !== 'undefined') {
      if (window.__walletPasteToastScheduled) return;
      window.__walletPasteToastScheduled = true;
      setTimeout(() => {
        try {
          window.__walletPasteToastScheduled = false;
          if (window.__walletPasteToastShownAt && (Date.now() - window.__walletPasteToastShownAt) < 3000) {
            return;
          }
          window.__walletPasteToastShownAt = Date.now();
          toast.success('Imagen pegada desde el portapapeles', { duration: 2500 });
        } catch (_) {
          // fallback sin window
          if ((Date.now() - lastToastRef.current) >= 3000) {
            lastToastRef.current = Date.now();
            toast.success('Imagen pegada desde el portapapeles', { duration: 2500 });
          }
        }
      }, 0);
      return;
    }

    // Fallback no-window
    if ((now - lastToastRef.current) >= 3000) {
      lastToastRef.current = now;
      toast.success('Imagen pegada desde el portapapeles', { duration: 2500 });
    }
  };
  // Asegurar foco del modal y del catcher oculto para habilitar Ctrl+V sin clic
  useEffect(() => {
    if (isOpen) {
      const idA = setTimeout(() => {
        try { modalRef.current && modalRef.current.focus(); } catch (_) {}
      }, 0);
      // Foco inicial + refuerzo para el catcher oculto (algunos navegadores mueven el foco)
      const idB = setTimeout(() => { try { pasteCatcherRef.current && pasteCatcherRef.current.focus(); } catch (_) {} }, 50);
      const idC = setTimeout(() => { try { pasteCatcherRef.current && pasteCatcherRef.current.focus(); } catch (_) {} }, 300);
      return () => { clearTimeout(idA); clearTimeout(idB); clearTimeout(idC); };
    }
  }, [isOpen]);

  // Helper: intenta extraer una imagen del portapapeles (archivo, items, dataURL o URL http) y adjuntarla
  const handleClipboardImage = async (e) => {
    try {
      const dt = e?.clipboardData;
      let file = null;

      // 1) Si vienen archivos directos
      if (dt && dt.files && dt.files.length) {
        const f0 = dt.files[0];
        if (f0 && f0.type && f0.type.startsWith('image/')) {
          file = f0;
        }
      }

      // 2) Si vienen items
      if (!file && dt && dt.items && dt.items.length) {
        for (const it of dt.items) {
          if (it.type && it.type.startsWith('image/')) {
            const blob = it.getAsFile();
            if (blob) {
              const ext = blob.type.includes('jpeg') ? 'jpg' : (blob.type.split('/')[1] || 'png');
              file = new File([blob], `comprobante-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
              break;
            }
          }
        }
      }

      // 3) Si viene texto: dataURL o URL de imagen
      if (!file && dt) {
        const txt = dt.getData && dt.getData('text/plain');
        if (txt && typeof txt === 'string' && txt.length) {
          if (txt.startsWith('data:image/')) {
            // dataURL -> Blob
            const arr = txt.split(',');
            const mime = arr[0].match(/:(.*?);/)[1] || 'image/png';
            const bstr = atob(arr[1]);
            let n = bstr.length; const u8 = new Uint8Array(n);
            while (n--) u8[n] = bstr.charCodeAt(n);
            const blob = new Blob([u8], { type: mime });
            const ext = mime.includes('jpeg') ? 'jpg' : (mime.split('/')[1] || 'png');
            file = new File([blob], `comprobante-${Date.now()}.${ext}`, { type: mime });
          } else if (/^https?:.*\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(txt)) {
            try {
              const res = await fetch(txt, { mode: 'cors' });
              const blob = await res.blob();
              if (blob && blob.type && blob.type.startsWith('image/')) {
                const ext = blob.type.includes('jpeg') ? 'jpg' : (blob.type.split('/')[1] || 'png');
                file = new File([blob], `comprobante-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
              }
            } catch (_) { /* noop */ }
          }
        }
      }

      if (file) {
        if (recentlyHandledPaste()) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return true;
        }
        setFormData(prev => ({
          ...prev,
          ...(prev.paymentType === 'mixed' && activeDropzone === 'cash'
            ? { cashProofImage: file }
            : { paymentProofImage: file })
        }));
        markPasteHandled();
        showUniquePasteToast();
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        return true;
      }
    } catch (_) { /* noop */ }
    return false;
  };

  // Intento usando Clipboard API (requiere gesto de usuario; capturamos Ctrl+V en keydown)
  const handleClipboardReadViaAPI = async (e) => {
    if (!navigator.clipboard || !navigator.clipboard.read) return false;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const types = item.types || [];
        const imgType = types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          if (blob) {
            const ext = blob.type.includes('jpeg') ? 'jpg' : (blob.type.split('/')[1] || 'png');
            const file = new File([blob], `comprobante-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
            if (recentlyHandledPaste()) {
              if (e && typeof e.preventDefault === 'function') e.preventDefault();
              return true;
            }
            setFormData(prev => ({
              ...prev,
              ...(prev.paymentType === 'mixed' && activeDropzone === 'cash'
                ? { cashProofImage: file }
                : { paymentProofImage: file })
            }));
            markPasteHandled();
            showUniquePasteToast();
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('navigator.clipboard.read() falló', err);
    }
    return false;
  };

  



  // Listener único en captura (window) para maximizar compatibilidad y evitar duplicados
  useEffect(() => {
    if (!isOpen) {
      // Si cerramos, quitar cualquier handler global previo
      if (typeof window !== 'undefined' && window.__walletPasteHandler) {
        try { window.removeEventListener('paste', window.__walletPasteHandler, true); } catch (_) {}
        window.__walletPasteHandler = null;
      }
      return;
    }

    // Antes de agregar, eliminar cualquier handler colgado por HMR/StrictMode
    if (typeof window !== 'undefined' && window.__walletPasteHandler) {
      try { window.removeEventListener('paste', window.__walletPasteHandler, true); } catch (_) {}
      window.__walletPasteHandler = null;
    }

    const handlePasteCapture = async (e) => {
      // Guard instantáneo por ráfagas (múltiples listeners o múltiples eventos del mismo pegado)
      if (typeof window !== 'undefined') {
        if (window.__walletPasteInFlight) {
          try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
          return;
        }
        window.__walletPasteInFlight = true;
        setTimeout(() => { try { window.__walletPasteInFlight = false; } catch (_) {} }, 150);
      }

      if (recentlyHandledPaste()) {
        try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
        return;
      }
      const ok = await handleClipboardImage(e);
      if (ok) {
        try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
      }
    };

    if (typeof window !== 'undefined') {
      window.__walletPasteHandler = handlePasteCapture;
      window.addEventListener('paste', handlePasteCapture, true);
    }

    return () => {
      if (typeof window !== 'undefined' && window.__walletPasteHandler) {
        try { window.removeEventListener('paste', window.__walletPasteHandler, true); } catch (_) {}
        window.__walletPasteHandler = null;
      }
    };
  }, [isOpen, activeDropzone]);

  

  // Cálculo de montos a cobrar para decidir si mostrar campos de transferencia
  const { productDue, shippingDue, totalDue } = computeCollectionAmounts(order || {});
  const requiresPayment = productDue > 0;
  // Soportar multi-rol: considerar base role y roles adicionales en user.roles
  const baseRole = (user?.role || '').toLowerCase();
  const extraRoles = Array.isArray(user?.roles)
    ? user.roles.map(r => String(r.role_name || r).toLowerCase())
    : [];
  const hasRole = (r) => baseRole === r || extraRoles.includes(r);
  const isWalletValidator = hasRole('cartera') || hasRole('admin');
  const isBillingValidator = hasRole('facturador');
  const isCarteraRole = hasRole('cartera');

  // Detección simple del canal desde texto (para autocompletar sin mostrar campos)
  const detectProviderFromStringLocal = (text = '') => {
    const t = String(text).toLowerCase();
    if (t.includes('nequi')) return 'nequi';
    if (t.includes('daviplata')) return 'daviplata';
    if (t.includes('bancolombia') || t.includes('banco')) return 'bancolombia';
    if (t.includes('mercadopago')) return 'mercadopago';
    if (t.includes('bold')) return 'bold';
    return 'otro';
  };

  // Autocompletar (oculto) proveedor/referencia/fecha para mensajero, no relaja validaciones de cartera
  useEffect(() => {
    if (!isWalletValidator) {
      const pm = normalizePaymentMethod(order?.payment_method);
      if (pm === 'transferencia' || pm === 'pago_electronico') {
        const fromOrder = (order?.electronic_payment_type || order?.payment_provider || '').toLowerCase();
        const detected = detectProviderFromStringLocal(order?.notes || '');
        const bank = (fromOrder || detected || 'otro');
        const ref = `auto-${Date.now()}`;
        const dateStr = new Date().toISOString().slice(0, 10);
        setFormData(prev => ({
          ...prev,
          bankName: prev.bankName || bank,
          paymentReference: prev.paymentReference || ref,
          paymentDate: prev.paymentDate || dateStr
        }));
      }
    }
  }, [user, order]);
  const [customerCredit, setCustomerCredit] = useState(null);
  const [loadingCredit, setLoadingCredit] = useState(false);
  
  // FUNCIONES DE TRADUCCIÓN UNIVERSALES
  const getPaymentMethodLabel = (method) => {
    const v = (method || '').toString().toLowerCase();
    const labels = {
      'efectivo': 'Efectivo',
      'transferencia': 'Transferencia',
      'tarjeta_credito': 'Tarjeta de Crédito',
      'cliente_credito': 'Cliente a Crédito',
      'credito': 'Cliente a Crédito',
      'pago_electronico': 'Pago Electrónico',
      'contraentrega': 'Contraentrega'
    };
    return labels[v] || 'No Especificado';
  };

  // Normaliza el método de pago a un token canónico sin acentos ni espacios
  const normalizePaymentMethod = (method) => {
    const raw = (method || '').toString().trim().toLowerCase();
    // Quitar acentos
    const noAccents = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Reemplazar espacios por guion bajo
    const token = noAccents.replace(/\s+/g, '_');
    // Aliases comunes
    if (token.includes('electronico')) return 'pago_electronico';
    if (token === 'tarjeta_credito' || token === 'tarjeta') return 'tarjeta_credito';
    return token;
  };

  const getDeliveryMethodLabel = (method) => {
    const v = (method || '').toString().toLowerCase();
    const labels = {
      'domicilio': 'Domicilio',
      'domicilio_ciudad': 'Domicilio Ciudad',
      'domicilio_local': 'Domicilio Local',
      'mensajeria_urbana': 'Mensajería Urbana',
      'recogida_tienda': 'Recoge en Bodega',
      'recoge_bodega': 'Recoge en Bodega',
      'envio_nacional': 'Envío Nacional',
      'nacional': 'Envío Nacional'
    };
    return labels[v] || 'No Especificado';
  };

  const getShippingDateLabel = (order) => {
    const v = order?.shipping_date;
    if (v) {
      let d;
      if (v instanceof Date) {
        d = v;
      } else if (typeof v === 'string') {
        // Soportar formatos: 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss', ISO, etc.
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          const [y,m,dd] = v.split('-').map(Number);
          d = new Date(y, m - 1, dd);
        } else {
          d = new Date(v.replace(' ', 'T'));
        }
      }
      if (d && !isNaN(d.getTime())) {
        return d.toLocaleDateString('es-CO');
      }
      // Si llega un formato raro, mostrar texto crudo para no confundir
      return String(v);
    }
    const dm = (order?.delivery_method || '').toLowerCase();
    if (dm === 'recogida_tienda' || dm === 'recoge_bodega') {
      return 'No aplica (recoge en bodega)';
    }
    return 'No especificada';
  };

  const formatAmount = (amount) => {
    const numAmount = parseFloat(amount || 0);
    return numAmount.toLocaleString('es-CO');
  };

  // Formatear notas de SIIGO a múltiples líneas legibles
  const formatSiigoNotes = (raw = '') => {
    if (!raw) return '';
    let t = String(raw).replace(/\s+/g, ' ').trim();
    const labels = [
      'OBSERVACIONES:',
      'ESTADO DE PAGO:',
      'MEDIO DE PAGO:',
      'FORMA DE PAGO DE ENVIO:',
      'FORMA DE PAGO DE ENVÍO:',
      'NOMBRE:',
      'NIT:',
      'TELÉFONO:',
      'TELEFONO:',
      'DEPARTAMENTO:',
      'CIUDAD:',
      'DIRECCIÓN:',
      'DIRECCION:',
      'NOTA:',
      'NOTAS:'
    ];
    // Insertar salto de línea antes de cada etiqueta conocida
    labels.forEach(lbl => {
      const esc = lbl.replace(/([.*+?^${}()|\[\]\\])/g, '\\$1');
      const re = new RegExp(`\\s*${esc}`, 'g');
      t = t.replace(re, `\n${lbl} `);
    });
    // Limpiar saltos duplicados y espacios
    t = t.replace(/\n+/g, '\n').trim();
    return t;
  };

  // Margen permitido para diferencias de redondeo en validación de montos
  // Regla: máximo entre $200 y 0.5% del total, con tope de $5.000
  const getAllowedTolerance = (orderTotal) => {
    const total = parseFloat(orderTotal || 0);
    const minTol = 200; // $200
    const relTol = total * 0.005; // 0.5%
    const tol = Math.max(minTol, relTol);
    return Math.min(tol, 5000);
  };
  
  const [formData, setFormData] = useState({
    // Para transferencias y efectivo
    paymentProofImage: null,
    paymentReference: '',
    paymentAmount: '', // Iniciar vacío, no con 0
    paymentDate: (() => {
      // Obtener fecha local en formato YYYY-MM-DD
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })(),
    bankName: '',
    
    // Para pagos mixtos (efectivo + transferencia)
    paymentType: 'single', // 'single' o 'mixed'
    transferredAmount: '', // Iniciar vacío, no con 0
    cashAmount: '', // Iniciar vacío, no con 0
    cashProofImage: null,
    cashByMessenger: false, // ✅ Cartera indica que el efectivo lo cobra el mensajero
    
    // Para validación de crédito
    creditApproved: false,
    
    // Notas generales
    validationNotes: '',
    
    // Estado de validación
    validationType: 'approved' // 'approved' o 'rejected'
  });

  

  // Cargar información de crédito del cliente si el método de pago es cliente_credito
  useEffect(() => {
    const pm = (order?.payment_method || '').toLowerCase();
    if ((pm === 'cliente_credito' || pm === 'credito') && order?.customer_name) {
      loadCustomerCredit();
    }
  }, [order]);

  // Prellenar proveedor/canal desde facturación para Pago Electrónico
  useEffect(() => {
    if (normalizePaymentMethod(order?.payment_method) === 'pago_electronico') {
      const provider = (order?.electronic_payment_type || order?.payment_provider || '').toLowerCase();
      if (provider) {
        setFormData(prev => ({ ...prev, bankName: provider }));
      }
    }
  }, [order]);

  // Prellenar referencia y monto para Pago Electrónico si vienen desde la orden
  useEffect(() => {
    if (normalizePaymentMethod(order?.payment_method) === 'pago_electronico') {
      const ref = order?.electronic_payment_notes || order?.payment_reference || '';
      const amount = order?.total_amount != null ? String(order.total_amount) : '';
      setFormData(prev => ({
        ...prev,
        paymentReference: prev.paymentReference || ref,
        // Solo establecer el monto si el usuario aún no escribió uno
        paymentAmount: prev.paymentAmount === '' ? amount : prev.paymentAmount
      }));
    }
  }, [order]);

  const loadCustomerCredit = async () => {
    // Limpiar estado previo para evitar mostrar datos del cliente anterior
    setCustomerCredit(null);
    setLoadingCredit(true);
    try {
      // Preferir identificación/NIT para el cruce (más confiable que el nombre)
      const rawNit = (order?.customer_identification || order?.customer_nit || '').toString();
      const nit = rawNit.replace(/[^0-9]/g, '');
      const base = `/api/wallet/customer-credit/${encodeURIComponent(order.customer_name || '')}`;
      const url = nit ? `${base}?nit=${encodeURIComponent(nit)}` : base;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomerCredit(data.data || null);
      } else {
        console.error('Error cargando información de crédito');
        setCustomerCredit(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setCustomerCredit(null);
    } finally {
      setLoadingCredit(false);
    }
  };

  // Normaliza inputs numéricos (acepta 24.600, 24,600, etc.)
  const normalizeNumericInput = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    const cleaned = String(v).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : '';
  };

  const handleInputChange = (field, value) => {
    const numericFields = ['paymentAmount', 'transferredAmount', 'cashAmount'];
    const newValue = numericFields.includes(field) ? normalizeNumericInput(value) : value;
    setFormData(prev => {
      const next = { ...prev, [field]: newValue };
      // Si Cartera marcó que el efectivo lo cobra el mensajero, autocalcular efectivo = total - transferido
      if (next.paymentType === 'mixed' && next.cashByMessenger) {
        const tAmt = parseFloat(next.transferredAmount || 0);
        const oTotal = parseFloat(order?.total_amount || 0);
        const computedCash = Math.max(oTotal - tAmt, 0);
        next.cashAmount = Number.isFinite(computedCash) ? computedCash : '';
      }
      return next;
    });
  };

  // Mantenemos la compatibilidad: selector simple de archivo para pago principal
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten archivos de imagen');
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo no puede ser mayor a 5MB');
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        paymentProofImage: file
      }));
    }
  };

  const validateForm = () => {
    const pm = normalizePaymentMethod(order?.payment_method);
    
    // Si no hay cobro pendiente, omitir validaciones de transferencia SOLO para roles distintos a cartera
    if (pm === 'transferencia' && !requiresPayment && !isWalletValidator) {
      return true;
    }
    
    if (pm === 'transferencia') {
      if (formData.paymentType === 'mixed') {
        // VALIDACIÓN ULTRA-ESTRICTA PARA PAGO MIXTO (TRANSFERENCIA + EFECTIVO)
        const orderTotal = parseFloat(order.total_amount || 0);
        const transferredAmount = parseFloat(formData.transferredAmount || 0);
        const cashAmount = parseFloat(formData.cashAmount || 0);
        const totalPaid = transferredAmount + cashAmount;
        
        // Validación de campos obligatorios primero
        if (!formData.transferredAmount || formData.transferredAmount === '') {
          toast.error('❌ CAMPO OBLIGATORIO: Debe ingresar el monto transferido');
          return false;
        }
        
        if (!formData.cashAmount || formData.cashAmount === '') {
          toast.error('❌ CAMPO OBLIGATORIO: Debe ingresar el monto en efectivo');
          return false;
        }
        
        // Validación de montos válidos (no negativos, no cero)
        if (transferredAmount <= 0) {
          toast.error('❌ MONTO INVÁLIDO: El monto transferido debe ser mayor a cero');
          return false;
        }
        
        if (cashAmount <= 0) {
          toast.error('❌ MONTO INVÁLIDO: El monto en efectivo debe ser mayor a cero');
          return false;
        }
        
        // Validación de suma con tolerancia (redondeos)
        const diffMixed = Math.abs(totalPaid - orderTotal);
        if (diffMixed > getAllowedTolerance(orderTotal)) {
          const difference = orderTotal - totalPaid;
          if (difference > 0) {
            toast.error(
              `Validación fallida: Pago insuficiente.\n\n` +
              `Monto transferido: $${transferredAmount.toLocaleString('es-CO')}\n` +
              `Monto en efectivo: $${cashAmount.toLocaleString('es-CO')}\n` +
              `Total pagado: $${totalPaid.toLocaleString('es-CO')}\n` +
              `Total requerido: $${orderTotal.toLocaleString('es-CO')}\n` +
              `Faltante: $${difference.toLocaleString('es-CO')}\n\n` +
              `Permite redondeo +/-$${getAllowedTolerance(orderTotal).toLocaleString('es-CO')}.`,
              { duration: 8000 }
            );
          } else {
            const excess = Math.abs(difference);
            toast.error(
              `Validación fallida: Pago excesivo.\n\n` +
              `Monto transferido: $${transferredAmount.toLocaleString('es-CO')}\n` +
              `Monto en efectivo: $${cashAmount.toLocaleString('es-CO')}\n` +
              `Total pagado: $${totalPaid.toLocaleString('es-CO')}\n` +
              `Total requerido: $${orderTotal.toLocaleString('es-CO')}\n` +
              `Exceso: $${excess.toLocaleString('es-CO')}\n\n` +
              `Permite redondeo +/-$${getAllowedTolerance(orderTotal).toLocaleString('es-CO')}.`,
              { duration: 8000 }
            );
          }
          return false;
        }
        
        // Validación de comprobantes
        if (!formData.paymentProofImage) {
          toast.error('❌ COMPROBANTE FALTANTE: Debe subir el comprobante de transferencia');
          return false;
        }
        
        // Comprobante de efectivo: ya no es obligatorio en pago mixto (lo dejamos opcional para todos los roles)
        // if (!formData.cashProofImage) { ... } // Eliminado según requerimiento
        
        // Validación de datos de transferencia
        if (isWalletValidator && !formData.paymentReference.trim()) {
          toast.error('❌ REFERENCIA FALTANTE: Debe ingresar la referencia de la transferencia');
          return false;
        }
        
        if (isWalletValidator && !formData.bankName.trim()) {
          toast.error('❌ BANCO FALTANTE: Debe seleccionar el banco de origen');
          return false;
        }
      } else {
        // VALIDACIÓN ULTRA-ESTRICTA DE MONTO PARA TRANSFERENCIA COMPLETA
        const orderTotal = parseFloat(order.total_amount || 0);
        const paymentAmount = parseFloat(formData.paymentAmount || 0);
        
        // Validación de campo obligatorio
        if (!formData.paymentAmount || formData.paymentAmount === '') {
          toast.error('❌ CAMPO OBLIGATORIO: Debe ingresar el monto transferido');
          return false;
        }
        
        // Validación de monto válido (no negativo, no cero)
        if (paymentAmount <= 0) {
          toast.error('❌ MONTO INVÁLIDO: El monto transferido debe ser mayor a cero');
          return false;
        }
        
        // Validación de monto con tolerancia (redondeos)
        const diff = Math.abs(paymentAmount - orderTotal);
        if (diff > getAllowedTolerance(orderTotal)) {
          const difference = orderTotal - paymentAmount;
          if (difference > 0) {
            toast.error(
              `Validación fallida: Transferencia insuficiente.\n\n` +
              `Monto transferido: $${paymentAmount.toLocaleString('es-CO')}\n` +
              `Total requerido: $${orderTotal.toLocaleString('es-CO')}\n` +
              `Faltante: $${(orderTotal - paymentAmount).toLocaleString('es-CO')}\n\n` +
              `Permite redondeo +/-$${getAllowedTolerance(orderTotal).toLocaleString('es-CO')}.`,
              { duration: 7000 }
            );
          } else {
            toast.error(
              `Validación fallida: Transferencia excesiva.\n\n` +
              `Monto transferido: $${paymentAmount.toLocaleString('es-CO')}\n` +
              `Total requerido: $${orderTotal.toLocaleString('es-CO')}\n` +
              `Exceso: $${Math.abs(orderTotal - paymentAmount).toLocaleString('es-CO')}\n\n` +
              `Permite redondeo +/-$${getAllowedTolerance(orderTotal).toLocaleString('es-CO')}.`,
              { duration: 7000 }
            );
          }
          return false;
        }
        
        // Validaciones adicionales obligatorias
        if (!formData.paymentProofImage) {
          toast.error('❌ COMPROBANTE FALTANTE: Debe subir el comprobante de transferencia');
          return false;
        }
        
        if (isWalletValidator && !formData.paymentReference.trim()) {
          toast.error('❌ REFERENCIA FALTANTE: Debe ingresar la referencia de la transferencia');
          return false;
        }
        
        if (isWalletValidator && !formData.bankName.trim()) {
          toast.error('❌ BANCO FALTANTE: Debe seleccionar el banco de origen');
          return false;
        }
      }
    }
    
    // Pago electrónico (Bold/MercadoPago): comprobante y proveedor obligatorios
    if (pm === 'pago_electronico') {
      if (!formData.paymentProofImage) {
        toast.error('❌ COMPROBANTE FALTANTE: Debe subir el comprobante del pago electrónico');
        return false;
      }
      if (isWalletValidator) {
        const provider = (formData.bankName || '').toLowerCase();
        if (!['bold', 'mercadopago'].includes(provider)) {
          toast.error('❌ PROVEEDOR REQUERIDO: Debe seleccionar Bold o MercadoPago');
          return false;
        }
        if (!formData.paymentReference.trim()) {
          toast.error('❌ REFERENCIA FALTANTE: Debe ingresar la referencia/ID de la transacción');
          return false;
        }
      }
    }

    if (pm === 'efectivo') {
      if (!formData.paymentProofImage) {
        toast.error('Debe subir la imagen del pago en efectivo');
        return false;
      }
    }
    
    if (pm === 'cliente_credito' || pm === 'credito') {
      // Política: si el cliente no tiene cupo asignado o no alcanza, Cartera decide.
      // No bloqueamos la aprobación; solo mostramos advertencias informativas.
      if (!customerCredit) {
        toast('Validación de crédito sin información de cartera: se permitirá continuar bajo criterio.');
        return true;
      }

      if ((customerCredit.status || '').toLowerCase() !== 'active') {
        toast('Cliente con crédito no activo. Se permitirá continuar bajo criterio.');
        return true;
      }

      const orderAmount = parseFloat(order.total_amount || 0);
      const availableCredit = parseFloat(customerCredit.available_credit || 0);

      if (orderAmount > availableCredit) {
        toast('Pedido excede cupo disponible. Se permitirá continuar bajo criterio.', { duration: 6000 });
        return true;
      }
    }
    
    return true;
  };

  const handleValidate = async (validationType = 'approved') => {
    // Para rechazos, solo validamos que haya notas
    if (validationType === 'rejected') {
      if (!formData.validationNotes.trim()) {
        toast.error('Debe especificar el motivo por el cual no puede pasar a logística');
        return;
      }
    } else {
      // Para aprobaciones, validamos el formulario completo
      if (!validateForm()) return;
    }
    
    setLoading(true);
    try {
    const formDataToSend = new FormData();
    const pm = normalizePaymentMethod(order.payment_method);
    
    // Datos básicos
    formDataToSend.append('orderId', order.id);
    formDataToSend.append('paymentMethod', order.payment_method);
    formDataToSend.append('validationType', validationType);
    // Inyectar nota técnica si Cartera marca que el efectivo lo cobra el mensajero
    const notesWithFlag = formData.cashByMessenger
      ? `${formData.validationNotes || ''} [cash_pending_by_messenger]`
      : formData.validationNotes;
    formDataToSend.append('validationNotes', notesWithFlag);
    
    // Solo agregar datos de pago si es aprobación
    if (validationType === 'approved') {
      // Para transferencias
      if (pm === 'transferencia') {
        formDataToSend.append('paymentType', formData.paymentType);
        
        if (formData.paymentType === 'mixed') {
          // Pago mixto
          const mixedCash = formData.cashByMessenger
            ? (parseFloat(order.total_amount || 0) - parseFloat(formData.transferredAmount || 0) || 0)
            : formData.cashAmount;
          formDataToSend.append('transferredAmount', formData.transferredAmount);
          formDataToSend.append('cashAmount', mixedCash);
          if (formData.cashByMessenger) formDataToSend.append('cashByMessenger', 'true');
          
          if (formData.paymentProofImage) {
            formDataToSend.append('paymentProofImage', formData.paymentProofImage);
          }
          if (formData.cashProofImage) {
            formDataToSend.append('cashProofImage', formData.cashProofImage);
          }
        } else {
          // Pago simple
          formDataToSend.append('paymentAmount', formData.paymentAmount);
          
          if (formData.paymentProofImage) {
            formDataToSend.append('paymentProofImage', formData.paymentProofImage);
          }
        }
        
        formDataToSend.append('paymentReference', formData.paymentReference);
        formDataToSend.append('paymentDate', formData.paymentDate);
        formDataToSend.append('bankName', formData.bankName);
      }
      
      // Para pago electrónico (Bold/MercadoPago)
      if (pm === 'pago_electronico') {
        if (formData.paymentProofImage) {
          formDataToSend.append('paymentProofImage', formData.paymentProofImage);
        }
        // Enviar referencia, fecha y proveedor (bankName usado como canal)
        formDataToSend.append('paymentReference', formData.paymentReference);
        formDataToSend.append('paymentDate', formData.paymentDate);
        formDataToSend.append('bankName', formData.bankName);
        // Registrar monto (total del pedido)
        formDataToSend.append('paymentAmount', formData.paymentAmount || order.total_amount);
      }

      // Para efectivo
      if (pm === 'efectivo') {
        if (formData.paymentProofImage) {
          formDataToSend.append('paymentProofImage', formData.paymentProofImage);
        }
        formDataToSend.append('paymentAmount', formData.paymentAmount || order.total_amount);
        formDataToSend.append('paymentDate', formData.paymentDate);
      }
      
      // Para crédito
      if (pm === 'cliente_credito' || pm === 'credito') {
        formDataToSend.append('creditApproved', formData.creditApproved);
        formDataToSend.append('customerCreditLimit', customerCredit?.credit_limit || 0);
        formDataToSend.append('customerCurrentBalance', customerCredit?.current_balance || 0);
      }
    }
      
      await onValidate(formDataToSend);
      onClose();
      
      if (validationType === 'approved') {
        toast.success('Pago validado y enviado a logística exitosamente');
      } else {
        toast.success('Pedido marcado como no apto para logística');
      }
    } catch (error) {
      console.error('Error validando pago:', error);
      toast.error('Error al procesar la validación');
    } finally {
      setLoading(false);
    }
  };

  const getValidationType = () => {
    switch ((order?.payment_method || '').toLowerCase()) {
      case 'transferencia':
        return 'Validación de Transferencia';
      case 'efectivo':
        return 'Validación de Pago en Efectivo';
      case 'cliente_credito':
      case 'credito':
        return 'Validación de Cupo de Crédito';
      default:
        return 'Validación de Pago';
    }
  };

  const canApproveCredit = () => {
    if (!customerCredit || !['cliente_credito','credito'].includes((order?.payment_method||'').toLowerCase())) return false;
    return (customerCredit.status === 'active') &&
      (parseFloat(order.total_amount || 0) <= parseFloat(customerCredit.available_credit || 0));
  };

  const getCreditStatus = () => {
    if (!customerCredit || !['cliente_credito','credito'].includes((order?.payment_method||'').toLowerCase())) return null;
    const orderAmount = parseFloat(order.total_amount || 0);
    const availableCredit = customerCredit.available_credit;
    return {
      exceedsCredit: orderAmount > availableCredit,
      orderAmount,
      availableCredit
    };
  };

  const isElectronic = normalizePaymentMethod(order?.payment_method) === 'pago_electronico';
  const approveDisabled = loading || (
    isElectronic && isWalletValidator && (
      !formData.paymentProofImage ||
      !['bold','mercadopago'].includes((formData.bankName || '').toLowerCase()) ||
      !formData.paymentReference.trim()
    )
  );

  // Normalización segura para pago mixto (evitar concatenaciones)
  const transferred = parseFloat(formData.transferredAmount || 0);
  const cash = parseFloat(formData.cashAmount || 0);
  const orderTotal = parseFloat(order?.total_amount || 0);
  const totalPaidMixed = transferred + cash;
  const allowedTolerance = getAllowedTolerance(orderTotal);
  const isMixedWithinTolerance = Math.abs(totalPaidMixed - orderTotal) <= allowedTolerance;
  const singlePaymentWithinTolerance = Math.abs(parseFloat(formData.paymentAmount || 0) - orderTotal) <= allowedTolerance;

  if (!isOpen || !order) return null;

  return (
    <div
      ref={modalRef}
      tabIndex={0}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Catcher oculto para activar onPaste sin clic previo */}
        <div
          ref={pasteCatcherRef}
          contentEditable
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {getValidationType()}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pedido {order.order_number} - {order.customer_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Bloque SIEMPRE VISIBLE para Pago Electrónico (desactivado para evitar duplicado; los campos se muestran abajo) */}
          {false && (
            <div className="mb-6 border-2 border-blue-300 bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icons.Info className="w-5 h-5 text-blue-600 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">Comprobante requerido (Pago Electrónico)</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Antes de enviar a Logística debes adjuntar el comprobante de la transacción y seleccionar el proveedor: Bold o MercadoPago.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comprobante (imagen) *
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                    {formData.paymentProofImage && (
                      <p className="text-xs text-green-600 mt-1">
                        Archivo: {formData.paymentProofImage.name}
                      </p>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proveedor / Canal *
                  </label>
                  <select
                    value={formData.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar</option>
                    <option value="bold">Bold</option>
                    <option value="mercadopago">MercadoPago</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referencia / ID transacción *
                  </label>
                  <input
                    type="text"
                    value={formData.paymentReference}
                    onChange={(e) => handleInputChange('paymentReference', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: ID de Bold o MercadoPago"
                    required
                  />
                </div>
              </div>
            </div>
          )}
          

          {/* Información del pedido */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Información del Pedido</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total:</span>
                <span className="ml-2 font-medium text-green-600">
                  ${formatAmount(order.total_amount)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Método de Pago:</span>
                <span className="ml-2 font-medium">
                  {getPaymentMethodLabel(order.payment_method)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Método de Entrega:</span>
                <span className="ml-2 font-medium">
                  {getDeliveryMethodLabel(order.delivery_method)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Fecha de Envío:</span>
                <span className="ml-2 font-medium">
                  {getShippingDateLabel(order)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Cliente:</span>
                <span className="ml-2 font-medium">{order.customer_name}</span>
              </div>
            </div>
          </div>

          {(isBillingValidator || isWalletValidator) && order?.siigo_observations && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50">
              <div className="px-4 py-3 border-b border-blue-200 flex items-center gap-2 text-blue-900 font-medium">
                <Icons.FileText className="w-4 h-4" />
                <span>Notas de la Factura SIIGO</span>
              </div>
              <div className="p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{formatSiigoNotes(order.siigo_observations)}</pre>
                <p className="mt-2 text-xs text-blue-700">Estas notas provienen de la factura de SIIGO</p>
              </div>
            </div>
          )}

          {/* Formulario según tipo de pago */}
          <div className="space-y-6">
            
            {/* Para Transferencias */}
            {normalizePaymentMethod(order.payment_method) === 'transferencia' && (requiresPayment || isWalletValidator) && (
              <>
                {/* Selector de tipo de pago */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-3">Tipo de Pago</h4>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="paymentType"
                        value="single"
                        checked={formData.paymentType === 'single'}
                        onChange={(e) => handleInputChange('paymentType', e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">Transferencia Completa</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="paymentType"
                        value="mixed"
                        checked={formData.paymentType === 'mixed'}
                        onChange={(e) => handleInputChange('paymentType', e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">Pago Mixto (Transferencia + Efectivo)</span>
                    </label>
                  </div>
                </div>

                {formData.paymentType === 'single' ? (
                  // Pago Simple - Solo Transferencia
                  <>
                    <UploadDropzone
                      label="Comprobante de Transferencia *"
                      file={formData.paymentProofImage}
                      onFile={(f) => handleInputChange('paymentProofImage', f)}
                      required
                      hint={'Pega (Ctrl+V) o usa "Pegar desde portapapeles"; tambien puedes arrastrar o usar el boton "Seleccionar archivo"'}
                      onFocusExtra={() => setActiveDropzone('transfer')}
                      showPasteButton
                      onPasteClick={() => handleClipboardReadViaAPI({ preventDefault: () => {} })}
                    />

                    <div className={`grid grid-cols-2 gap-4 ${!isWalletValidator ? 'hidden' : ''}`}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Referencia de Transferencia *
                        </label>
                        <input
                          type="text"
                          value={formData.paymentReference}
                          onChange={(e) => handleInputChange('paymentReference', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Número de referencia"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Destino dinero *
                        </label>
                        <select
                          value={formData.bankName}
                          onChange={(e) => handleInputChange('bankName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Seleccionar destino</option>
                          <option value="bancolombia">Bancolombia</option>
                          <option value="mercadopago">MercadoPago</option>
                        </select>
                      </div>
                    </div>

                    {/* Validación visual del monto */}
                    <div className={`p-4 rounded-lg border-2 ${
                      singlePaymentWithinTolerance
                        ? 'bg-green-50 border-green-300'
                        : 'bg-red-50 border-red-300'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Validación de Monto</h4>
                        {singlePaymentWithinTolerance ? (
                          <Icons.CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Icons.AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total Pedido:</span>
                          <p className="font-medium">${formatAmount(order.total_amount)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Monto Transferido:</span>
                          <p className={`font-medium ${
                            singlePaymentWithinTolerance
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            ${formatAmount(formData.paymentAmount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Diferencia:</span>
                          <p className={`font-medium ${
                            singlePaymentWithinTolerance
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            ${formatAmount(Math.abs(parseFloat(order.total_amount || 0) - parseFloat(formData.paymentAmount || 0)))}
                          </p>
                        </div>
                      </div>
                      {!singlePaymentWithinTolerance && (
                        <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                          <Icons.AlertTriangle className="w-4 h-4 inline mr-1" />
                          ATENCION: El monto debe estar dentro de +/-${formatAmount(allowedTolerance)} del total.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <div className="h-12 flex flex-col justify-start">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto Transferido *
                          </label>
                          <span className="text-xs text-gray-500">
                            (Debe coincidir exactamente con el total)
                          </span>
                        </div>
                        <input
                          type="number"
                          value={formData.paymentAmount}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '' : e.target.value;
                            handleInputChange('paymentAmount', value);
                          }}
                          className={`w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring-2 ${
                            singlePaymentWithinTolerance && formData.paymentAmount !== ''
                              ? 'border-green-300 focus:ring-green-500 bg-green-50'
                              : 'border-red-300 focus:ring-red-500 bg-red-50'
                          }`}
                          min="0"
                          step="0.01"
                          placeholder={`Debe ser: ${formatAmount(order.total_amount)}`}
                          required
                        />
                        <div className="min-h-[20px] mt-1">
                          {formData.paymentAmount !== '' && !singlePaymentWithinTolerance && (
                            <p className="text-xs text-red-600">
                              Monto fuera de tolerancia (+/-${formatAmount(allowedTolerance)}).
                            </p>
                          )}
                          {singlePaymentWithinTolerance && formData.paymentAmount !== '' && (
                            <p className="text-xs text-green-600">
                              Monto dentro de tolerancia
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col">
                        <div className="h-12 flex flex-col justify-start">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha de Transferencia
                          </label>
                          <div className="text-xs text-transparent">
                            {/* Espacio para alinear con el otro campo */}
                            placeholder
                          </div>
                        </div>
                        <input
                          type="date"
                          value={formData.paymentDate}
                          onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="min-h-[20px] mt-1">
                          {/* Espacio reservado para mantener alineación */}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  // Pago Mixto - Transferencia + Efectivo
                  <>
                    {/* Validación de Montos */}
                    <div className={`p-4 rounded-lg border ${
                      isMixedWithinTolerance ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Validación de Montos</h4>
                        {isMixedWithinTolerance ? (
                          <Icons.CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Icons.AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total Factura:</span>
                          <p className="font-medium">${formatAmount(order.total_amount)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Pagado:</span>
                          <p className={`font-medium ${
                            isMixedWithinTolerance ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${formatAmount(totalPaidMixed)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Diferencia:</span>
                          <p className={`font-medium ${
                            isMixedWithinTolerance ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${formatAmount(orderTotal - totalPaidMixed)}
                          </p>
                        </div>
                      </div>
                      {Math.abs((parseFloat(formData.transferredAmount || 0) + parseFloat(formData.cashAmount || 0)) - parseFloat(order.total_amount || 0)) > allowedTolerance && (
                        <p className="text-xs text-red-600 mt-2">
                          Los montos deben estar dentro de +/-${formatAmount(allowedTolerance)} del total
                        </p>
                      )}
                    </div>

                    {/* Montos */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Monto Transferido * 
                        </label>
                        <input
                          type="number"
                          value={formData.transferredAmount}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '' : e.target.value;
                            handleInputChange('transferredAmount', value);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.01"
                          placeholder="Ingrese el monto transferido"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Monto en Efectivo *
                        </label>
                        <input
                          type="number"
                          value={formData.cashByMessenger ? (parseFloat(order?.total_amount||0) - parseFloat(formData.transferredAmount||0) || 0) : formData.cashAmount}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '' : e.target.value;
                            handleInputChange('cashAmount', value);
                          }}
                          disabled={formData.cashByMessenger}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.cashByMessenger ? 'bg-gray-100 text-gray-600' : ''}`}
                          min="0"
                          step="0.01"
                          placeholder={formData.cashByMessenger ? 'Se calculará automáticamente' : 'Ingrese el monto en efectivo'}
                          required
                        />
                        <label className="mt-2 flex items-center text-sm text-gray-700 select-none">
                          <input
                            type="checkbox"
                            checked={formData.cashByMessenger}
                            onChange={(e) => handleInputChange('cashByMessenger', e.target.checked)}
                            className="mr-2"
                            disabled={!isWalletValidator}
                          />
                          El efectivo lo cobra el mensajero en la entrega
                        </label>
                        {formData.cashByMessenger && (
                          <p className="text-xs text-gray-500 mt-1">
                            Se tomará como monto en efectivo: Total - Transferredido. El mensajero reportará y cuadrará con Cartera.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Comprobante de Transferencia */}
                    <UploadDropzone
                      label="Comprobante de Transferencia *"
                      file={formData.paymentProofImage}
                      onFile={(f) => handleInputChange('paymentProofImage', f)}
                      required
                      hint={'Pega (Ctrl+V) o usa "Pegar desde portapapeles"; tambien puedes arrastrar o usar el boton "Seleccionar archivo"'}
                      onFocusExtra={() => setActiveDropzone('transfer')}
                      showPasteButton
                      onPasteClick={() => handleClipboardReadViaAPI({ preventDefault: () => {} })}
                    />

                    {/* Comprobante de Efectivo: para Cartera/Admin ya no se solicita ni se muestra */}
                    {!isWalletValidator && (
                      <UploadDropzone
                        label={'Comprobante de Efectivo (opcional)'}
                        file={formData.cashProofImage}
                        onFile={(f) => handleInputChange('cashProofImage', f)}
                        required={false}
                        hint={'Pega (Ctrl+V) o usa "Pegar desde portapapeles"; tambien puedes arrastrar o usar el boton "Seleccionar archivo"'}
                        onFocusExtra={() => setActiveDropzone('cash')}
                        showPasteButton
                        onPasteClick={() => handleClipboardReadViaAPI({ preventDefault: () => {} })}
                      />
                    )}

                    {/* Detalles de Transferencia */}
                    <div className={`grid grid-cols-2 gap-4 ${!isWalletValidator ? 'hidden' : ''}`}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Referencia de Transferencia *
                        </label>
                        <input
                          type="text"
                          value={formData.paymentReference}
                          onChange={(e) => handleInputChange('paymentReference', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Número de referencia"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Destino dinero *
                        </label>
                        <select
                          value={formData.bankName}
                          onChange={(e) => handleInputChange('bankName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Seleccionar destino</option>
                          <option value="bancolombia">Bancolombia</option>
                          <option value="mercadopago">MercadoPago</option>
                        </select>
                      </div>
                    </div>

                      <div className={!isWalletValidator ? 'hidden' : ''}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Fecha de Transferencia
                      </label>
                      <input
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Para Pago Electrónico (Bold / MercadoPago) */}
            {isElectronic && (
              <>
                <UploadDropzone
                  label="Comprobante de Pago Electrónico (Bold/MercadoPago) *"
                  file={formData.paymentProofImage}
                  onFile={(f) => handleInputChange('paymentProofImage', f)}
                  required
                  hint={'Pega (Ctrl+V) o usa "Pegar desde portapapeles"; tambien puedes arrastrar o usar el boton "Seleccionar archivo"'}
                  onFocusExtra={() => setActiveDropzone('transfer')}
                  showPasteButton
                  onPasteClick={() => handleClipboardReadViaAPI({ preventDefault: () => {} })}
                />

                <div className={`grid grid-cols-2 gap-4 ${!isWalletValidator ? 'hidden' : ''}`}>
                  {(order?.electronic_payment_type || order?.payment_provider) ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Proveedor / Canal
                      </label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700">
                        {(order?.electronic_payment_type || order?.payment_provider || '').charAt(0).toUpperCase() + (order?.electronic_payment_type || order?.payment_provider || '').slice(1)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Proveedor / Canal *
                      </label>
                      <select
                        value={formData.bankName}
                        onChange={(e) => handleInputChange('bankName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Seleccionar proveedor</option>
                        <option value="bold">Bold</option>
                        <option value="mercadopago">MercadoPago</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Seleccione el canal por donde se realizó el pago electrónico
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Referencia / ID de Transacción *
                    </label>
                    <input
                      type="text"
                      value={formData.paymentReference}
                      onChange={(e) => handleInputChange('paymentReference', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: ID de Bold o MercadoPago"
                      required
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-4 ${!isWalletValidator ? 'hidden' : ''}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha del Pago
                    </label>
                    <input
                      type="date"
                      value={formData.paymentDate}
                      onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto Pagado
                    </label>
                    <input
                      type="number"
                      value={formData.paymentAmount}
                      onChange={(e) => handleInputChange('paymentAmount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                      placeholder={`Debe ser: ${formatAmount(order.total_amount)}`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si el procesador cobró comisión, ingrese el monto recibido por la empresa
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Para Efectivo */}
            {normalizePaymentMethod(order.payment_method) === 'efectivo' && (
              <div>
                <UploadDropzone
                  label="Imagen del Pago en Efectivo *"
                  file={formData.paymentProofImage}
                  onFile={(f) => handleInputChange('paymentProofImage', f)}
                  required
                  hint={'Pega (Ctrl+V) o usa "Pegar desde portapapeles"; tambien puedes arrastrar o usar el boton "Seleccionar archivo"'}
                  onFocusExtra={() => setActiveDropzone('cash')}
                  showPasteButton
                  onPasteClick={() => handleClipboardReadViaAPI({ preventDefault: () => {} })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Suba una foto del dinero recibido o del recibo de pago
                </p>
              </div>
            )}

            {/* Para Cliente a Crédito */}
            {['cliente_credito','credito'].includes(normalizePaymentMethod(order.payment_method)) && (
              <div>
                {loadingCredit ? (
                  <div className="flex items-center justify-center py-8">
                    <Icons.Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Cargando información de crédito...</span>
                  </div>
                ) : customerCredit ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-3">
                      Información de Crédito del Cliente
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700">Cupo Total:</span>
                        <span className="ml-2 font-medium">
                          ${customerCredit.credit_limit?.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700">Saldo Actual:</span>
                        <span className="ml-2 font-medium">
                          ${customerCredit.current_balance?.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700">Cupo Disponible:</span>
                        <span className={`ml-2 font-medium ${
                          customerCredit.available_credit >= parseFloat(order.total_amount || 0)
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          ${customerCredit.available_credit?.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700">Estado:</span>
                        <span className={`ml-2 font-medium capitalize ${
                          customerCredit.status === 'active' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {customerCredit.status}
                        </span>
                      </div>
                    </div>
                    
                    {canApproveCredit() ? (
                      <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded">
                        <div className="flex items-center">
                          <Icons.CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                          <span className="text-green-800 font-medium">
                            El cliente tiene cupo suficiente para este pedido
                          </span>
                        </div>
                        <p className="text-green-700 text-xs mt-2">
                          Tienes la decisión final: puedes aprobar o rechazar según tu criterio
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
                        <div className="flex items-center">
                          <Icons.AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                          <span className="text-red-800 font-medium">
                            ATENCION: El pedido excede el cupo disponible del cliente
                          </span>
                        </div>
                        <p className="text-red-700 text-xs mt-2">
                          La decisión es tuya: puedes rechazarlo por exceso de cupo o aprobarlo bajo tu criterio
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Icons.AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                      <span className="text-yellow-800">
                        No se encontró información de crédito para este cliente
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notas de validación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas de Validación
              </label>
              <textarea
                value={formData.validationNotes}
                onChange={(e) => handleInputChange('validationNotes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observaciones sobre la validación del pago..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={() => handleValidate('rejected')}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? (
                <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Icons.XCircle className="w-4 h-4 mr-2" />
              )}
              No es posible pasar a Logística
            </button>
            
              <button
                onClick={() => handleValidate('approved')}
                disabled={approveDisabled}
                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
              {loading ? (
                <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Icons.CheckCircle className="w-4 h-4 mr-2" />
              )}
              Validar y Enviar a Logística
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletValidationModal;
