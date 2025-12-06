import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/api';
import { normalize, getPaymentMethodLabel, getPaymentBadgeClass, getElectronicLabel, getElectronicBadgeClass, resolveElectronicType, detectProviderFromString, getProviderHint, isCreditOrder } from '../utils/payments';
import { extractRecipientDataFromNotes } from '../utils/recipientExtractor';

/* Helpers de visualización de métodos de pago (producto y envío)
   Nota: normalize, getPaymentMethodLabel y getPaymentBadgeClass se importan desde utils/payments */
function getShippingPayLabel(method) {
  const v = normalize(method);
  if (v === 'contraentrega' || v === 'por_cobrar') return 'Contraentrega (paga cliente)';
  if (v === 'contado' || v === 'pagado' || v === 'prepagado') return 'Contado (paga empresa)';
  if (!v) return 'No especificado';
  return method;
}
function getShippingBadgeClass(method) {
  const v = normalize(method);
  if (v === 'contraentrega' || v === 'por_cobrar') return 'bg-orange-100 text-orange-800';
  if (v === 'contado' || v === 'pagado' || v === 'prepagado') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-800';
}

/* Proveedor de pago electrónico:
   Usar helpers centralizados de utils/payments:
   - resolveElectronicType, getElectronicLabel, getElectronicBadgeClass,
     detectProviderFromString, getProviderHint */

// Componente CustomDropdown para reemplazar select nativo
const CustomDropdown = ({ value, onChange, options, placeholder, required }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);


  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
        style={{ zIndex: 1 }}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Icons.ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors ${
                option.value === value ? 'bg-blue-50 text-blue-900' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Helpers robustos para obtener precios desde diferentes formas (unit_price, price, subtotal, total)
const toMoneyNumber = (v) => {
  if (v === null || v === undefined) return 0;
  const s = typeof v === 'number' ? String(v) : String(v).trim();
  const cleaned = s.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};
const getUnitPrice = (item) => {
  const qty = Number(item?.quantity || 1) || 1;
  const candidates = [
    item?.unit_price,
    item?.price,
    item?.unitPrice,
    item?.precio,
    item?.value,
    (item?.total ?? item?.total_amount)
      ? toMoneyNumber(item?.total ?? item?.total_amount) / qty
      : null
  ];
  for (const c of candidates) {
    const n = toMoneyNumber(c);
    if (n > 0) return n;
  }
  // Si todo falla, devolver 0
  return 0;
};
const getSubtotal = (item) => {
  const qty = Number(item?.quantity || 1) || 1;
  const candidates = [
    item?.subtotal,
    item?.total,
    item?.total_amount,
    getUnitPrice(item) * qty
  ];
  for (const c of candidates) {
    const n = toMoneyNumber(c);
    if (n > 0) return n;
  }
  return 0;
};

const LogisticsModal = ({ isOpen, onClose, order, onProcess }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    shippingMethod: '',
    transportCompany: '',
    trackingNumber: '',
    shippingDate: '',
    shippingPaymentMethod: '',
    deliveryFee: '',
    deliveryFeeExempt: false,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [initialCarrierSet, setInitialCarrierSet] = useState(false);
  // UI antibobos: bloquear/forzar decisiones rápidas para domicilio
  const [lockDeliveryFee, setLockDeliveryFee] = useState(false);
  // Secciones plegables para reducir ruido visual
  const [showItems, setShowItems] = useState(false);
  const [showSiigoNotes, setShowSiigoNotes] = useState(false);

  // Métodos de envío considerados "locales" (no requieren transportadora)
  // Robustez: aceptar variantes con espacios, guiones y acentos (ej. "Domicilio local", "mensajería urbana", etc.)
  const LOCAL_METHODS = new Set(['domicilio', 'domicilio_ciudad', 'mensajeria_local', 'mensajeria_urbana', 'domicilio_local']);
  const normalizeMethod = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quitar acentos
      .replace(/\s+/g, '_') // espacios -> underscore
      .replace(/-+/g, '_'); // guiones -> underscore
  const isLocalMethod = (m) => {
    const v = normalizeMethod(m);
    if (LOCAL_METHODS.has(v)) return true;
    // Cualquier "domicilio" que NO sea nacional/internacional se considera local
    if (v.includes('domicilio') && !v.includes('nacional') && !v.includes('internacional')) return true;
    // Mensajería urbana/local
    if (v.includes('mensajeria') && !v.includes('nacional')) return true;
    return false;
  };

  // Abrir por defecto las secciones plegables para el rol Logística
  React.useEffect(() => {
    if (!isOpen) return;
    const role = String(user?.role || '').toLowerCase();
    const hasLogRole = role === 'logistica' || (Array.isArray(user?.roles) && user.roles.some(r => String(r.role_name || '').toLowerCase() === 'logistica'));
    if (hasLogRole) {
      setShowItems(true);
      setShowSiigoNotes(true);
    }
  }, [isOpen, user]);

  // Función para extraer datos del destinatario desde las observaciones y notas de SIIGO
  const extractRecipientData = (observations, notes) => {
    const data = {};
    // Unir todo el texto disponible
    const fullText = [observations, notes].filter(Boolean).join('\n');
    
    // Lista de etiquetas conocidas para el lookahead (detenerse si encontramos otra etiqueta)
    const labelsPattern = '(?:NOMBRE|CLIENTE|NIT|TEL[ÉE]FONO|CELULAR|TEL|CEL|DIRECCI[ÓO]N|DIR|CIUDAD|MUNICIPIO|DESTINO|DEPARTAMENTO|DEPTO|DPTO|DEP|FORMA|MEDIO|M[ÉE]TODO|ESTADO|NOTA)';
    
    // Helper para crear regex robusto que busque: ETIQUETA + separador opcional + VALOR + (hasta sgte etiqueta o fin)
    const extractValue = (keyPattern) => {
      // Regex explicado:
      // 1. (?:${keyPattern}) : La clave que buscamos (no capturante)
      // 2. \s*[:\-]?\s*     : Separador opcional (: o -) y espacios alrededor
      // 3. (.+?)            : Captura el valor (non-greedy)
      // 4. Lookahead relajado: permite 0 espacios antes de la siguiente etiqueta para casos pegados
      const regex = new RegExp(`(?:${keyPattern})\\s*[:\\-]?\\s*(.+?)(?=\\s*(?:${labelsPattern})\\s*[:\\-]|$)`, 'is');
      const match = fullText.match(regex);
      return match ? match[1].trim() : null;
    };

    // Extracciones
    
    // NOMBRE
    const name = extractValue('NOMBRE|CLIENTE');
    if (name && name !== 'ESTADO DE PAGO') data.name = name;

    // TELÉFONO
    const phone = extractValue('TEL[ÉE]FONO|CELULAR|TEL|CEL');
    if (phone) data.phone = phone;

    // DIRECCIÓN
    const address = extractValue('DIRECCI[ÓO]N|DIR');
    if (address) data.address = address;

    // CIUDAD
    // Intento 1: Usar extractValue general
    let city = extractValue('CIUDAD(?:\\s*DESTINO)?|MUNICIPIO|DESTINO');
    
    // Intento 2: Regex específico y simple si falla el general (para casos pegados o con formato raro)
    if (!city) {
      const mCity = fullText.match(/(?:CIUDAD|MUNICIPIO)\s*[:\-]\s*([^:\n]+?)\s*(?:DIRECCI[ÓO]N|DIR|TEL|CEL|NIT|FORMA|MEDIO|NOTA|$)/i);
      if (mCity) city = mCity[1];
    }

    if (city) {
      // Limpiar si viene con departamento (ej: "Manizales, Caldas" -> "Manizales")
      // También limpiar si capturó "MEDELLIN" (por defecto) y queremos asegurar que no sea ruido
      data.city = city.split(/[,.\-]/)[0].trim();
    }

    // DEPARTAMENTO
    let dept = extractValue('DEPARTAMENTO|DEPTO|DPTO|DEP');
    
    if (!dept) {
       const mDep = fullText.match(/(?:DEPARTAMENTO|DEPTO)\s*[:\-]\s*([^:\n]+?)\s*(?:CIUDAD|MUNICIPIO|DIRECCI[ÓO]N|DIR|TEL|CEL|NIT|$)/i);
       if (mDep) dept = mDep[1];
    }

    if (dept) {
      data.department = dept.split(/[,.\-]/)[0].trim();
    }

    // NIT
    const nit = extractValue('NIT');
    if (nit) data.nit = nit;

    // FORMA DE PAGO DE ENVIO
    const shippingPay = extractValue('FORMA\\s+DE\\s+PAGO\\s+DE\\s+ENVIO');
    if (shippingPay) data.shippingPaymentMethod = shippingPay;

    // FORMA DE PAGO (General)
    const payMethod = extractValue('MEDIO\\s+(?:DE\\s+)?PAGO|FORMA\\s+(?:DE\\s+)?PAGO|M[ÉE]TODO\\s+(?:DE\\s+)?PAGO');
    if (payMethod) data.paymentMethod = payMethod;

    // Detectar proveedor en el texto completo
    const providerInText = detectProviderFromString(fullText);
    if (providerInText && !data.electronicProvider) {
      data.electronicProvider = providerInText;
    }

    return Object.keys(data).length > 0 ? data : null;
  };

  // Extraer datos cuando cambie el pedido - priorizar observaciones de SIIGO
  React.useEffect(() => {
    if (order) {
      const extracted = extractRecipientDataFromNotes([order?.siigo_observations, order?.notes].filter(Boolean).join('\n'));
      setExtractedData(extracted);
      console.log('LogisticsModal: extractedData (on order change)', extracted);
      
      // Cargar método de envío preseleccionado por el facturador
      setFormData(prev => ({
        ...prev,
        // Siempre limpiar selección previa al cargar un pedido para evitar preselecciones residuales
        transportCompany: '',
        trackingNumber: '',
        shippingMethod: order.delivery_method || '',
        // Cargar automáticamente el método de pago de envío
        // PRIORIDAD 1: Desde la base de datos
        // PRIORIDAD 2: Desde los datos extraídos
        shippingPaymentMethod: order.shipping_payment_method || extracted?.shippingPaymentMethod?.toLowerCase() || '',
        notes: order.notes || ''
      }));
    } else {
      setExtractedData(null);
      // Reset form cuando no hay pedido
      setFormData({
        shippingMethod: '',
        transportCompany: '',
        trackingNumber: '',
        shippingPaymentMethod: '',
        deliveryFee: '',
        deliveryFeeExempt: false,
        notes: ''
      });
    }
  }, [order]);

  // Al abrir el modal, limpiar selección de transportadora/tracking para evitar valores residuales
  React.useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        transportCompany: '',
        trackingNumber: ''
      }));
    }
  }, [isOpen]);

  // Recalcular extracción cuando se abre el modal, por si el estado se montó antes de tener observaciones
  React.useEffect(() => {
    if (isOpen && order) {
      const extracted = extractRecipientDataFromNotes([order?.siigo_observations, order?.notes].filter(Boolean).join('\n'));
      setExtractedData(extracted);
      console.log('LogisticsModal: extractedData (on open)', extracted);
    }
  }, [isOpen, order]);

  // Recalcular extracción cuando cambien Observaciones/Notas
  // (cubre el caso donde el padre muta propiedades en el mismo objeto 'order' sin cambiar la referencia)
  React.useEffect(() => {
    const keyObs = order?.siigo_observations ?? '';
    const keyNotes = order?.notes ?? '';
    if (keyObs || keyNotes) {
      const extracted = extractRecipientDataFromNotes([keyObs, keyNotes].filter(Boolean).join('\n'));
      setExtractedData(extracted);
      console.log('LogisticsModal: extractedData (on obs/notes change)', extracted);
    }
  }, [order?.siigo_observations, order?.notes]);

  // Estados para métodos de envío dinámicos
  const [shippingMethods, setShippingMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(true);

  // Efecto para asegurar que el método de envío se establezca correctamente después de cargar los métodos
  React.useEffect(() => {
    if (order && shippingMethods.length > 0 && !loadingMethods) {
      // Solo actualizar si el método existe en las opciones disponibles
      if (order.delivery_method && shippingMethods.find(m => m.value === order.delivery_method)) {
        setFormData(prev => ({
          ...prev,
          shippingMethod: order.delivery_method
        }));
      }
    }
  }, [order, shippingMethods, loadingMethods]);

  // Cargar métodos de envío y datos de la empresa dinámicamente desde la API
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingMethods(true);
        
        // Cargar métodos de envío
        const methodsResponse = await fetch('/api/delivery-methods/active');
        
        if (methodsResponse.ok) {
          const methodsData = await methodsResponse.json();
          
          if (methodsData.success && methodsData.data) {
            // Formatear los datos para el dropdown
            const formattedMethods = methodsData.data.map(method => ({
              value: method.code,
              label: method.name
            }));
            
            setShippingMethods(formattedMethods);
          }
        } else {
          console.error('Error cargando métodos de envío');
          // Fallback: usar algunos métodos básicos
          setShippingMethods([
            { value: 'recogida_tienda', label: 'Recoge en Bodega' },
            { value: 'domicilio', label: 'Domicilio' },
            { value: 'envio_nacional', label: 'Envío Nacional' }
          ]);
        }

        // Cargar datos de la empresa
        const companyResponse = await fetch('/api/company-config/public');
        
        if (companyResponse.ok) {
          const companyData = await companyResponse.json();
          
          if (companyData.success && companyData.data) {
            setCompanyData(companyData.data);
          } else {
        // Fallback: datos por defecto
        setCompanyData({
          company_name: 'PERLAS EXPLOSIVAS COLOMBIA',
          nit: '901749888',
          address: 'CALLE 50 # 31-46',
          whatsapp: '3105244298',
          email: 'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
          city: 'medellin',
          department: 'Antioquia'
        });
          }
        } else {
          console.error('Error cargando datos de la empresa');
          // Fallback: datos por defecto
          setCompanyData({
            company_name: 'PERLAS EXPLOSIVAS COLOMBIA',
            nit: '901749888',
            address: 'CALLE 50 # 31-46',
            whatsapp: '3105244298',
            email: 'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
            city: 'medellin',
            department: 'Antioquia'
          });
        }
        
      } catch (error) {
        console.error('Error cargando datos:', error);
        
        // Fallback para métodos de envío
        setShippingMethods([
          { value: 'recogida_tienda', label: 'Recoge en Bodega' },
          { value: 'domicilio', label: 'Domicilio' },
          { value: 'envio_nacional', label: 'Envío Nacional' }
        ]);
        
        // Fallback para datos de la empresa
        setCompanyData({
          company_name: 'PERLAS EXPLOSIVAS COLOMBIA',
          nit: '901749888',
          address: 'CALLE 50 # 31-46',
          whatsapp: '3105244298',
          email: 'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
          city: 'medellin',
          department: 'Antioquia'
        });
        
      } finally {
        setLoadingMethods(false);
      }
    };

    // Solo cargar cuando el modal esté abierto
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Estado para transportadoras dinámicas con el objeto completo (id + name)
  const [transportCompanies, setTransportCompanies] = useState([]);
  const [carriersList, setCarriersList] = useState([]); // Lista completa de carriers con ID y nombre

  // Cargar transportadoras dinámicamente desde la API - COMPLETAMENTE DINÁMICO
  React.useEffect(() => {
    const fetchCarriers = async () => {
      try {
        // Cargar desde el endpoint público de transportadoras activas
        const response = await fetch('/api/carriers/active');
        
        if (response.ok) {
          const result = await response.json();
          let carriers = [];
          
          // Si el response viene con success/data
          if (result.success && result.data) {
            carriers = result.data;
          } 
          // Si el response es un array directo
          else if (Array.isArray(result)) {
            carriers = result;
          }

          // Siempre usar solo las transportadoras de la base de datos
          // No usar fallbacks hardcodeados para escalabilidad
          setCarriersList(carriers);
          
          // Extraer solo los nombres para el dropdown
          const carrierNames = carriers.map(c => c.name);
          setTransportCompanies(carrierNames);
          
          console.log(`✅ ${carrierNames.length} transportadoras cargadas desde la base de datos`);
          console.log('📦 Transportadoras disponibles:', carriers);
          
        } else {
          console.error('Error cargando transportadoras:', response.status);
          // No usar fallback hardcodeado - mantener lista vacía
          setCarriersList([]);
          setTransportCompanies([]);
          toast.error('No se pudieron cargar las transportadoras');
        }
      } catch (error) {
        console.error('Error cargando transportadoras:', error);
        // No usar fallback hardcodeado - mantener lista vacía
        setCarriersList([]);
        setTransportCompanies([]);
        toast.error('Error de conexión al cargar transportadoras');
      }
    };

    // Solo cargar cuando el modal esté abierto
    if (isOpen) {
      fetchCarriers();
    }
  }, [isOpen]);

  // Política: NO preseleccionar transportadora para evitar errores.
  // Requiere selección explícita del usuario en el dropdown.

  // Limpieza automática al cambiar el método de envío: evita que quede “pegada” una transportadora previa
  React.useEffect(() => {
    if (!isOpen) return;
    setFormData(prev => {
      // Solo limpiar si hay un método seleccionado y existe algún valor previo
      if (prev.shippingMethod && (prev.transportCompany || prev.trackingNumber)) {
        return { ...prev, transportCompany: '', trackingNumber: '' };
      }
      return prev;
    });
  }, [formData.shippingMethod, isOpen]);



  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.shippingMethod) {
      toast.error('Debe seleccionar un método de envío');
      return;
    }
    // Requerir transportadora solo para métodos que NO son locales ni 'recoge_bodega'
    if (formData.shippingMethod && !isLocalMethod(formData.shippingMethod) && formData.shippingMethod !== 'recoge_bodega' && !formData.transportCompany) {
      toast.error('Debe seleccionar una transportadora');
      return;
    }

    // Validación y persistencia del valor de domicilio cuando aplica
    const isLocal = isLocalMethod(formData.shippingMethod);
    const isContraentrega = (formData.shippingPaymentMethod || '').toLowerCase() === 'contraentrega';

    if (isLocal && isContraentrega && !formData.deliveryFeeExempt) {
      const fee = Number(formData.deliveryFee || 0);
      if (!fee || fee <= 0) {
        toast.error('Debe ingresar el valor del domicilio a cobrar');
        return;
      }
    }


    try {
      setLoading(true);
      
      // Si aplica, actualizar el pedido con el valor de domicilio y exención
      if (isLocal && isContraentrega) {
        try {
          await orderService.updateOrder(order.id, {
            delivery_fee: Number(formData.deliveryFee || 0),
            delivery_fee_exempt: Boolean(formData.deliveryFeeExempt)
          });
        } catch (err) {
          console.error('Error guardando valor de domicilio:', err);
          toast.error('No se pudo guardar el valor de domicilio');
          setLoading(false);
          return;
        }
      }

      const processData = {
        orderId: order.id,
        shippingMethod: formData.shippingMethod,
        transportCompany: formData.transportCompany,
        trackingNumber: formData.trackingNumber,
        shippingPaymentMethod: formData.shippingPaymentMethod,
        assignedMessenger: formData.assignedMessenger,
        notes: formData.notes
      };

      await onProcess(processData);
      
      toast.success('Pedido procesado exitosamente');
      onClose();
      
      // Reset form
      setFormData({
        shippingMethod: '',
        transportCompany: '',
        trackingNumber: '',
        assignedMessenger: '',
        shippingPaymentMethod: '',
        deliveryFee: '',
        deliveryFeeExempt: false,
        notes: ''
      });
      
    } catch (error) {
      console.error('Error procesando pedido:', error);
      toast.error(error.message || 'Error procesando pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGuide = async () => {
    if (!formData.shippingMethod) {
      toast.error('Debe seleccionar un método de envío primero');
      return;
    }
    if (!isLocalMethod(formData.shippingMethod) && formData.shippingMethod !== 'recoge_bodega' && !formData.transportCompany) {
      toast.error('Debe seleccionar una transportadora');
      return;
    }

    try {
      setLoading(true);
      
      // Crear formulario para enviar datos por POST a nueva ventana
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/logistics/generate-guide-html';
      form.target = '_blank';
      
      // Datos para enviar (priorizar datos extraídos de Notas/Observaciones)
      const combinedNotes = [order.siigo_observations, formData.notes].filter(Boolean).join('\n');
      const formData_guide = {
        orderId: order.id,
        shippingMethod: formData.shippingMethod,
        transportCompany: formData.transportCompany,
        customerName: extractedData?.name || order.customer_name,
        customerPhone: extractedData?.phone || order.customer_phone,
        customerAddress: extractedData?.address || order.customer_address,
        customerCity: extractedData?.city || order.customer_city,
        customerDepartment: extractedData?.department || order.customer_department,
        notes: combinedNotes
      };
      
      // Agregar campos al formulario
      Object.keys(formData_guide).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = formData_guide[key] || '';
        form.appendChild(input);
      });
      
      // Enviar formulario
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      toast.success('Guía abierta en nueva ventana. Use Ctrl+P para imprimir o guardar como PDF');
      
    } catch (error) {
      console.error('Error generando guía:', error);
      toast.error('Error generando guía de envío');
    } finally {
      setLoading(false);
    }
  };

  // Indicadores de pago para mostrar estado claro del monto
  const isTransfer = normalize(order?.payment_method) === 'transferencia';
  const walletApproved = order?.validation_status === 'approved';

  // Distribución derivada cuando los ítems no traen precios desde backend
  const derivedBreakdown = React.useMemo(() => {
    try {
      const items = Array.isArray(order?.items) ? order.items : [];
      if (!items.length) return null;
      const anyVal = items.some((it) => getUnitPrice(it) > 0 || getSubtotal(it) > 0);
      const total = toMoneyNumber(order?.total_amount ?? order?.total);
      if (anyVal || !(total > 0)) return null;
      const sumQty = items.reduce((s, it) => s + (Number(it?.quantity || 1) || 1), 0) || 1;
      const breakdown = [];
      let allocated = 0;
      items.forEach((it, idx) => {
        const qty = Number(it?.quantity || 1) || 1;
        const raw = Math.round((total * qty) / sumQty);
        breakdown[idx] = { unit: Math.round(raw / qty), subtotal: raw };
        allocated += raw;
      });
      if (breakdown.length) {
        const diff = total - allocated;
        breakdown[breakdown.length - 1].subtotal += diff;
        const qtyLast = Number(items[items.length - 1]?.quantity || 1) || 1;
        breakdown[breakdown.length - 1].unit = Math.round(breakdown[breakdown.length - 1].subtotal / qtyLast);
      }
      return breakdown;
    } catch {
      return null;
    }
  }, [order]);

  // Fallback seguro para render: si extractedData aún es null en este render,
  // calcular en caliente desde Observaciones/Notas para que la Vista Previa no quede desfasada.
  const effectiveData = React.useMemo(() => {
    try {
      return extractedData || extractRecipientDataFromNotes([order?.siigo_observations, order?.notes].filter(Boolean).join('\n')) || null;
    } catch {
      return extractedData || null;
    }
  }, [extractedData, order?.siigo_observations, order?.notes]);

  const cityToShow = effectiveData?.city || order?.customer_city || '';
  const deptToShow = effectiveData?.department || order?.customer_department || '';

  // Debug: verificar qué se está renderizando en la Vista Previa
  console.log(
    'LogisticsModal: effectiveData',
    effectiveData,
    { customer_city: order?.customer_city, customer_department: order?.customer_department },
    'order.siigo_observations:',
    order?.siigo_observations,
    'order.notes:',
    order?.notes
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Procesar Envío - Pedido {order?.order_number}
            </h2>
            <p className="text-xs text-gray-600">
              Cliente: {order?.customer_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-3">
            {/* Información del pedido - Ordenado */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">Información del Pedido</h3>
                <span className="text-[11px] text-gray-500">#{order?.order_number}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Columna izquierda */}
                <div className="space-y-1.5">
                  <div className="flex">
                    <div className="w-28 text-gray-500">Cliente</div>
                    <div className="flex-1 font-medium text-gray-900 truncate">{order?.customer_name}</div>
                  </div>
                  <div className="flex">
                    <div className="w-28 text-gray-500">Teléfono</div>
                    <div className="flex-1 font-medium text-gray-900">{order?.customer_phone}</div>
                  </div>
                  <div className="flex">
                    <div className="w-28 text-gray-500">Dirección</div>
                    <div className="flex-1 font-medium text-gray-900">{order?.customer_address}</div>
                  </div>
                </div>

                {/* Columna derecha */}
                <div className="space-y-1.5">
                  <div className="flex">
                    <div className="w-28 text-gray-500">Total</div>
                    <div className="flex-1">
                      <div className="font-semibold text-green-600">
                        ${order?.total_amount?.toLocaleString('es-CO')}
                      </div>
                      {/* Descripción de monto según proceso de pago */}
                      <div className="mt-1 flex items-center flex-wrap gap-2">
                        {isTransfer && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${getPaymentBadgeClass('transferencia')}`}>
                            Transferencia
                          </span>
                        )}
                        {walletApproved && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-green-100 text-green-800">
                            Pago validado por Cartera
                          </span>
                        )}
                        {isTransfer && walletApproved && (
                          <span className="text-[11px] text-green-700">
                            Pagado por transferencia
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-28 text-gray-500">Ciudad</div>
                    <div className="flex-1 font-medium text-gray-900">{cityToShow || 'No especificada'}</div>
                  </div>
                  <div className="flex">
                    <div className="w-28 text-gray-500">Depto</div>
                    <div className="flex-1 font-medium text-gray-900">{deptToShow || 'No especificado'}</div>
                  </div>
                  <div className="flex">
                    <div className="w-28 text-gray-500">Items</div>
                    <div className="flex-1 font-medium text-gray-900">{order?.items?.length || 0} productos</div>
                  </div>
                </div>
              </div>

              {/* Forma de pago resumen para logística (alineado) */}
              <div className="mt-3 grid grid-cols-12 text-xs">
                <div className="col-span-12 md:col-span-6 md:pr-3">
                  <div className="text-gray-500 mb-1">Forma de Pago (Producto)</div>
                  <div className="flex items-center flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${getPaymentBadgeClass(order?.payment_method || extractedData?.paymentMethod || 'auto')}`}>
                      {getPaymentMethodLabel(order?.payment_method || extractedData?.paymentMethod)}
                    </span>
                    {(() => {
                      // Nunca mostrar proveedor para clientes a crédito
                      if (isCreditOrder(order)) {
                        return null;
                      }

                      // Resolver exclusivamente con el helper centralizado
                      const t = resolveElectronicType(order);
                      if (t) {
                        return (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${getElectronicBadgeClass(t)}`}>
                            {getElectronicLabel(t)}
                          </span>
                        );
                      }

                      // Solo mostrar placeholder cuando el método de pago es explícitamente electrónico
                      const pmv = normalize(order?.payment_method || '');
                      if (pmv.includes('pago') || pmv.includes('electron')) {
                        return (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 bg-gray-100 text-gray-800"
                            title="Proveedor no definido"
                          >
                            Por definir
                          </span>
                        );
                      }

                      // Para métodos no electrónicos, no mostrar chip de proveedor
                      return null;
                    })()}
                  </div>
                </div>

                {(order?.shipping_payment_method || extractedData?.shippingPaymentMethod || formData.shippingPaymentMethod) && (
                  <div className="col-span-12 md:col-span-6 md:pl-3 mt-2 md:mt-0 md:border-l border-gray-200">
                    <div className="text-gray-500 mb-1">Pago del Envío</div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${getShippingBadgeClass(order?.shipping_payment_method || extractedData?.shippingPaymentMethod || formData.shippingPaymentMethod)}`}>
                      {getShippingPayLabel(order?.shipping_payment_method || extractedData?.shippingPaymentMethod || formData.shippingPaymentMethod)}
                    </span>
                  </div>
                )}
              </div>

              {/* Link para descargar factura de SIIGO - Compacto */}
              {order?.siigo_public_url && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Icons.FileText className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-medium text-blue-900">Factura SIIGO</p>
                    </div>
                    <a
                      href={order.siigo_public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                    >
                      <Icons.Download className="w-3 h-3" />
                      <span>Descargar</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Items del Pedido (plegable) */}
            {order?.items && order.items.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShowItems(!showItems)}
                  className="w-full px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-900 flex items-center">
                    <Icons.Package className="w-3 h-3 mr-1" />
                    Productos del Pedido ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
                  </span>
                  <Icons.ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showItems ? 'rotate-180' : ''}`} />
                </button>

                {showItems && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-gray-700">Producto</th>
                          <th className="px-2 py-1 text-center font-medium text-gray-700">Cantidad</th>
                          <th className="px-2 py-1 text-center font-medium text-gray-700">Precio Unit.</th>
                          <th className="px-2 py-1 text-right font-medium text-gray-700">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {order.items.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-2 py-1">
                              <div>
                                <p className="font-medium text-gray-900 text-xs">{item.name}</p>
                                {item.product_description && (
                                  <p className="text-xs text-gray-500 mt-0.5">{item.product_description}</p>
                                )}
                                {item.product_code && (
                                  <p className="text-xs text-blue-600 mt-0.5">Código: {item.product_code}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {item.quantity} {item.unit || 'und'}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <span className="text-gray-900 text-xs">
                                ${(getUnitPrice(item) || derivedBreakdown?.[index]?.unit || 0).toLocaleString('es-CO')}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-right">
                              <span className="font-medium text-gray-900 text-xs">
                                ${(getSubtotal(item) || derivedBreakdown?.[index]?.subtotal || 0).toLocaleString('es-CO')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan="3" className="px-2 py-2 text-right font-medium text-gray-900 text-xs">
                            Total del Pedido:
                          </td>
                          <td className="px-2 py-2 text-right font-bold text-sm text-green-600">
                            ${order.total_amount?.toLocaleString('es-CO')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Notas de la Factura SIIGO (plegable para reducir ruido visual) */}
            {(order?.siigo_observations || order?.notes) && (
              <div className="bg-blue-50 rounded-lg border border-blue-200">
                <button
                  type="button"
                  onClick={() => setShowSiigoNotes(!showSiigoNotes)}
                  className="w-full px-4 py-3 flex items-center justify-between"
                >
                  <span className="font-medium text-blue-900 flex items-center">
                    <Icons.FileText className="w-4 h-4 mr-2" />
                    Notas de la Factura SIIGO
                  </span>
                  <Icons.ChevronDown className={`w-4 h-4 text-blue-700 transition-transform ${showSiigoNotes ? 'rotate-180' : ''}`} />
                </button>

                {showSiigoNotes && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Información importante acordada con el cliente:</strong>
                    </p>
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {(() => {
                          // Priorizar siigo_observations si existe, sino usar notes
                          let textToFormat = order.siigo_observations || order.notes || '';
                          
                          // Si hay observaciones de SIIGO, formatearlas
                          if (order.siigo_observations) {
                            // Lista de campos específicos a identificar y separar
                            const fieldsToSeparate = [
                              'OBSERVACIONES SIIGO:',
                              'ESTADO DE PAGO:',
                              'MEDIO DE PAGO:',
                              'FORMA DE PAGO DE ENVIO:',
                              'NOMBRE:',
                              'NIT:',
                              'TELÉFONO:',
                              'DEPARTAMENTO:',
                              'CIUDAD:',
                              'DIRECCIÓN:',
                              'NOTA:'
                            ];
                            
                            // Separar cada campo específico con un salto de línea
                            fieldsToSeparate.forEach(field => {
                              const pattern = new RegExp(`([^\\n])${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
                              textToFormat = textToFormat.replace(pattern, `$1\n${field}`);
                            });
                            
                            // Normalizar saltos de línea y espacios
                            textToFormat = textToFormat
                              .replace(/\r\n/g, '\n')
                              .replace(/\r/g, '\n')
                              .replace(/\n+/g, '\n')
                              .split('\n')
                              .map(line => line.replace(/\s+/g, ' ').trim())
                              .filter(line => line.length > 0)
                              .join('\n');
                          }
                          
                          return textToFormat;
                        })()}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Datos del Destinatario Extraídos */}
            {extractedData && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-900 mb-3 flex items-center">
                  <Icons.MapPin className="w-4 h-4 mr-2" />
                  Datos del Destinatario Detectados
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-700 font-medium">Nombre:</span>
                    <p className="text-green-800">{extractedData.name}</p>
                  </div>
                  <div>
                    <span className="text-green-700 font-medium">Teléfono:</span>
                    <p className="text-green-800">{extractedData.phone}</p>
                  </div>
                  <div>
                    <span className="text-green-700 font-medium">Ciudad:</span>
                    <p className="text-green-800">{extractedData.city}</p>
                  </div>
                  <div>
                    <span className="text-green-700 font-medium">Departamento:</span>
                    <p className="text-green-800">{extractedData.department}</p>
                  </div>
                  {extractedData.address && (
                    <div className="col-span-2">
                      <span className="text-green-700 font-medium">Dirección:</span>
                      <p className="text-green-800">{extractedData.address}</p>
                    </div>
                  )}
                  {extractedData.nit && (
                    <div>
                      <span className="text-green-700 font-medium">NIT:</span>
                      <p className="text-green-800">{extractedData.nit}</p>
                    </div>
                  )}
                  {extractedData.paymentMethod && (
                    <div>
                      <span className="text-green-700 font-medium">Forma de Pago:</span>
                      <p className="text-green-800">{extractedData.paymentMethod}</p>
                    </div>
                  )}
                  {extractedData.shippingPaymentMethod && (
                    <div>
                      <span className="text-green-700 font-medium">Método de Pago de Envío:</span>
                      <p className="text-green-800 font-bold">{extractedData.shippingPaymentMethod}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 p-2 bg-green-100 rounded border border-green-300">
                  <p className="text-xs text-green-700">
                    ✅ <strong>Datos extraídos automáticamente</strong> - Estos datos se usarán para generar la guía de envío
                    {extractedData.shippingPaymentMethod && (
                      <span className="block mt-1">
                        💰 <strong>Método de Pago de Envío detectado:</strong> {extractedData.shippingPaymentMethod}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Método de envío */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Envío *
              </label>
              <CustomDropdown
                value={formData.shippingMethod}
                onChange={(value) => handleInputChange('shippingMethod', value)}
                options={shippingMethods}
                placeholder="Seleccionar método de envío"
                required
              />
            </div>

            {/* Transportadora */}
            {formData.shippingMethod && formData.shippingMethod !== 'recoge_bodega' && !isLocalMethod(formData.shippingMethod) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transportadora <span className="text-red-600">*</span>
                </label>
                <CustomDropdown
                  value={formData.transportCompany}
                  onChange={(value) => handleInputChange('transportCompany', value)}
                  options={transportCompanies.map(company => ({ value: company, label: company }))}
                  placeholder="Seleccione transportadora"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Selecciona manualmente la transportadora. No se preselecciona ninguna por defecto.
                </p>
              </div>
            )}


            {/* Método de Pago de Envío */}
            {(formData.transportCompany || isLocalMethod(formData.shippingMethod)) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago de Envío *
                </label>
                <CustomDropdown
                  value={formData.shippingPaymentMethod}
                  onChange={(value) => handleInputChange('shippingPaymentMethod', value)}
                  options={[
                    { value: 'contado', label: 'Contado (Paga la empresa)' },
                    { value: 'contraentrega', label: 'Contraentrega (Paga el cliente)' }
                  ]}
                  placeholder="Seleccionar método de pago"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.shippingPaymentMethod === 'contado' 
                    ? '💰 La empresa pagará el costo del envío'
                    : formData.shippingPaymentMethod === 'contraentrega'
                    ? '📦 El cliente pagará al recibir el pedido'
                    : ''}
                </p>

                {/* Campo para valor de domicilio cuando aplica (UI antibobos) */}
                {isLocalMethod(formData.shippingMethod) &&
                 (formData.shippingPaymentMethod === 'contraentrega') && (
                  <div className="mt-3 p-3 border border-orange-200 bg-orange-50 rounded-md">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-800">
                        Valor del Domicilio a Cobrar (COP)
                      </label>
                      <span className="text-xs text-orange-700">
                        Modo fácil: use los botones para autollenar
                      </span>
                    </div>

                    {/* Botones rápidos antibobos */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = Number(formData.deliveryFee || (order?.delivery_fee ?? 15000)) || 15000;
                          handleInputChange('deliveryFeeExempt', false);
                          handleInputChange('deliveryFee', suggested);
                          setLockDeliveryFee(true);
                        }}
                        className="px-3 py-2 rounded-md text-sm font-medium border bg-orange-600 text-white border-orange-600 hover:bg-orange-700"
                      >
                        Cobrar domicilio ${Number(formData.deliveryFee || (order?.delivery_fee ?? 15000) || 15000).toLocaleString('es-CO')}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleInputChange('deliveryFeeExempt', true);
                          setLockDeliveryFee(true);
                        }}
                        className="px-3 py-2 rounded-md text-sm font-medium border bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200"
                      >
                        Exento por excepción
                      </button>

                      {lockDeliveryFee && (
                        <button
                          type="button"
                          onClick={() => setLockDeliveryFee(false)}
                          className="px-3 py-2 rounded-md text-sm font-medium border bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
                        >
                          Editar manualmente
                        </button>
                      )}
                    </div>

                    {/* Input controlado con bloqueo opcional */}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.deliveryFee}
                      onChange={(e) => handleInputChange('deliveryFee', e.target.value)}
                      placeholder="0.00"
                      className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      disabled={formData.deliveryFeeExempt || lockDeliveryFee}
                    />

                    {/* Toggle exento (respaldo) */}
                    <div className="mt-2 flex items-center">
                      <input
                        id="deliveryFeeExempt"
                        type="checkbox"
                        checked={formData.deliveryFeeExempt}
                        onChange={(e) => handleInputChange('deliveryFeeExempt', e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        disabled={lockDeliveryFee}
                      />
                      <label htmlFor="deliveryFeeExempt" className="ml-2 text-sm text-gray-700">
                        Exento de cobro de domicilio por excepción
                      </label>
                    </div>

                    <div className="mt-2 text-xs text-orange-700 space-y-1">
                      <p>• Si el cliente paga el flete al recibir (contraentrega), use "Cobrar domicilio" para autollenar.</p>
                      <p>• Si por acuerdo no se cobra, marque "Exento por excepción".</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Número de guía - Solo para transportadoras que no sean Mensajería Local */}
            {formData.transportCompany && formData.transportCompany !== 'Mensajería Local' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Guía
                </label>
                <input
                  type="text"
                  value={formData.trackingNumber}
                  onChange={(e) => handleInputChange('trackingNumber', e.target.value)}
                  placeholder="Ingrese el número de guía"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Vista previa de la guía de envío */}
            {formData.shippingMethod && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <Icons.FileText className="w-5 h-5 mr-2" />
                  Vista Previa - Guía de Envío
                </h4>
                
                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {/* Información del Pedido */}
                      <tr className="bg-blue-50">
                        <td colSpan="2" className="px-4 py-2 font-semibold text-blue-900 border-b">
                          📦 INFORMACIÓN DEL PEDIDO
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Número de Pedido:</td>
                        <td className="px-4 py-2 border-b">{order?.order_number}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Método de Envío:</td>
                        <td className="px-4 py-2 border-b">
                          {shippingMethods.find(m => m.value === formData.shippingMethod)?.label}
                        </td>
                      </tr>
                      {formData.transportCompany && (
                        <tr>
                          <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Transportadora:</td>
                          <td className="px-4 py-2 border-b">{formData.transportCompany}</td>
                        </tr>
                      )}
                      {formData.trackingNumber && (
                        <tr>
                          <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Número de Guía:</td>
                          <td className="px-4 py-2 border-b">{formData.trackingNumber}</td>
                        </tr>
                      )}

                      {/* Información del Remitente */}
                      <tr className="bg-green-50">
                        <td colSpan="2" className="px-4 py-2 font-semibold text-green-900 border-b">
                          🏢 REMITENTE
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Empresa:</td>
                        <td className="px-4 py-2 border-b">{companyData?.company_name || 'PERLAS EXPLOSIVAS COLOMBIA'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">NIT:</td>
                        <td className="px-4 py-2 border-b">{companyData?.nit || '901749888'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Dirección:</td>
                        <td className="px-4 py-2 border-b">{companyData?.address || 'CALLE 50 # 31-46'}, {companyData?.city || 'medellin'}, {companyData?.department || 'Antioquia'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">WhatsApp:</td>
                        <td className="px-4 py-2 border-b">+57 {companyData?.whatsapp || '3105244298'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Correo:</td>
                        <td className="px-4 py-2 border-b">{companyData?.email || 'COMERCIAL@PERLAS-EXPLOSIVAS.COM'}</td>
                      </tr>

                      {/* Información del Destinatario */}
                      <tr className="bg-orange-50">
                        <td colSpan="2" className="px-4 py-2 font-semibold text-orange-900 border-b">
                          👤 DESTINATARIO
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Nombre:</td>
                        <td className="px-4 py-2 border-b">
                          {effectiveData?.name || order?.customer_name}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Teléfono:</td>
                        <td className="px-4 py-2 border-b">
                          {effectiveData?.phone || order?.customer_phone}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Dirección:</td>
                        <td className="px-4 py-2 border-b">
                          {effectiveData?.address || order?.customer_address}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Ciudad:</td>
                        <td className="px-4 py-2 border-b">
                          {cityToShow}, {deptToShow}
                        </td>
                      </tr>
                      {extractedData?.nit && (
                        <tr>
                          <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">NIT:</td>
                          <td className="px-4 py-2 border-b">{extractedData.nit}</td>
                        </tr>
                      )}

                      {/* Pago del Envío */}
                      <tr className="bg-yellow-50">
                        <td colSpan="2" className="px-4 py-2 font-semibold text-yellow-900 border-b">
                          💳 PAGO DEL ENVÍO
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Pago del Envío:</td>
                        <td className="px-4 py-2 border-b">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getShippingBadgeClass(order?.shipping_payment_method || effectiveData?.shippingPaymentMethod || formData.shippingPaymentMethod)}`}>
                            {getShippingPayLabel(order?.shipping_payment_method || effectiveData?.shippingPaymentMethod || formData.shippingPaymentMethod)}
                          </span>
                        </td>
                      </tr>

                      {/* Notas Adicionales */}
                      {formData.notes && (
                        <>
                          <tr className="bg-gray-50">
                            <td colSpan="2" className="px-4 py-2 font-semibold text-gray-900 border-b">
                              📝 NOTAS ADICIONALES
                            </td>
                          </tr>
                          <tr>
                            <td colSpan="2" className="px-4 py-2 border-b">
                              {formData.notes}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Botón para generar PDF */}
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={handleGenerateGuide}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Icons.Download className="w-4 h-4" />
                    <span>Descargar PDF de la Guía</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 mt-4 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancelar
            </button>
              <button
                type="submit"
                className="btn-cta-primary"
                disabled={loading || !formData.shippingMethod}
              >
              {loading ? (
                <>
                  <Icons.Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Icons.Truck className="w-5 h-5 mr-2" />
                  Procesar Envío
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogisticsModal;
