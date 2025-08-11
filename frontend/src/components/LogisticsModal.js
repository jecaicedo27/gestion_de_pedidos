import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';


// Componente CustomDropdown para reemplazar select nativo
const CustomDropdown = ({ value, onChange, options, placeholder, required }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (optionValue) => {
    console.log('🔄 CustomDropdown - Seleccionando:', optionValue);
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);

  // Log de depuración para el CustomDropdown
  console.log('🎯 CustomDropdown - Debug:', {
    value,
    valueType: typeof value,
    options: options.map(opt => ({value: opt.value, label: opt.label})),
    selectedOption,
    placeholder
  });

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

const LogisticsModal = ({ isOpen, onClose, order, onProcess }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    shippingMethod: '',
    transportCompany: '',
    trackingNumber: '',
    shippingDate: '',
    shippingPaymentMethod: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [initialCarrierSet, setInitialCarrierSet] = useState(false);

  // Función para extraer datos del destinatario desde las observaciones y notas de SIIGO
  const extractRecipientData = (observations, notes) => {
    const data = {};
    
    // Función para procesar texto línea por línea
    const processText = (text) => {
      if (!text) return;
      
      // Normalizar texto para mejor procesamiento
      const normalizedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\s+/g, ' ');
      
      const lines = normalizedText.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Buscar NOMBRE con mayor precisión
        if (trimmedLine.match(/^NOMBRE\s*:/i)) {
          const nameMatch = trimmedLine.replace(/^NOMBRE\s*:\s*/i, '').trim();
          if (nameMatch && nameMatch !== 'ESTADO DE PAGO' && !data.name) {
            data.name = nameMatch;
          }
        }
        // Buscar TELÉFONO
        else if (trimmedLine.match(/^TEL[ÉE]FONO\s*:/i)) {
          const phoneMatch = trimmedLine.replace(/^TEL[ÉE]FONO\s*:\s*/i, '').trim();
          if (phoneMatch && !data.phone) {
            data.phone = phoneMatch;
          }
        }
        // Buscar DIRECCIÓN  
        else if (trimmedLine.match(/^DIRECCI[ÓO]N\s*:/i)) {
          const addressMatch = trimmedLine.replace(/^DIRECCI[ÓO]N\s*:\s*/i, '').trim();
          if (addressMatch && !data.address) {
            data.address = addressMatch;
          }
        }
        // Buscar CIUDAD
        else if (trimmedLine.match(/^CIUDAD\s*:/i)) {
          const cityMatch = trimmedLine.replace(/^CIUDAD\s*:\s*/i, '').trim();
          if (cityMatch && !data.city) {
            data.city = cityMatch;
          }
        }
        // Buscar DEPARTAMENTO
        else if (trimmedLine.match(/^DEPARTAMENTO\s*:/i)) {
          const departmentMatch = trimmedLine.replace(/^DEPARTAMENTO\s*:\s*/i, '').trim();
          if (departmentMatch && !data.department) {
            data.department = departmentMatch;
          }
        }
        // Buscar NIT
        else if (trimmedLine.match(/^NIT\s*:/i)) {
          const nitMatch = trimmedLine.replace(/^NIT\s*:\s*/i, '').trim();
          if (nitMatch && !data.nit) {
            data.nit = nitMatch;
          }
        }
        // Buscar FORMA DE PAGO DE ENVIO (específico)
        else if (trimmedLine.match(/^FORMA\s+DE\s+PAGO\s+DE\s+ENVIO\s*:/i)) {
          const shippingPaymentMatch = trimmedLine.replace(/^FORMA\s+DE\s+PAGO\s+DE\s+ENVIO\s*:\s*/i, '').trim();
          if (shippingPaymentMatch && !data.shippingPaymentMethod) {
            data.shippingPaymentMethod = shippingPaymentMatch;
          }
        }
        // Buscar FORMA DE PAGO o MÉTODO DE PAGO (general)
        else if (trimmedLine.match(/^(FORMA|M[ÉE]TODO)\s+(DE\s+)?PAGO\s*:/i)) {
          const paymentMatch = trimmedLine.replace(/^(FORMA|M[ÉE]TODO)\s+(DE\s+)?PAGO\s*:\s*/i, '').trim();
          if (paymentMatch && !data.paymentMethod) {
            data.paymentMethod = paymentMatch;
          }
        }
        // Buscar MEDIO DE PAGO
        else if (trimmedLine.match(/^MEDIO\s+DE\s+PAGO\s*:/i)) {
          const paymentMatch = trimmedLine.replace(/^MEDIO\s+DE\s+PAGO\s*:\s*/i, '').trim();
          if (paymentMatch && !data.paymentMethod) {
            data.paymentMethod = paymentMatch;
          }
        }
      }
    };

    // PRIORIDAD 1: Extraer de observaciones de SIIGO
    if (observations) {
      processText(observations);
    }
    
    // PRIORIDAD 2: Si no hay nombre en observaciones, buscar en notas tradicionales
    if (notes && !data.name) {
      processText(notes);
    }

    // Retornar los datos extraídos (puede estar vacío si no se encuentra información)
    return Object.keys(data).length > 0 ? data : null;
  };

  // Extraer datos cuando cambie el pedido - priorizar observaciones de SIIGO
  React.useEffect(() => {
    if (order) {
      const extracted = extractRecipientData(order.siigo_observations, order.notes);
      setExtractedData(extracted);
      
      // Cargar método de envío preseleccionado por el facturador
      setFormData(prev => ({
        ...prev,
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
        notes: ''
      });
    }
  }, [order]);

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

  // Efecto separado para preseleccionar la transportadora cuando ya tengamos los carriers cargados
  React.useEffect(() => {
    console.log('🔍 Verificando preselección:', {
      orderExists: !!order,
      orderId: order?.id,
      carrierId: order?.carrier_id,
      carriersListLength: carriersList.length,
      transportCompaniesLength: transportCompanies.length,
      initialCarrierSet: initialCarrierSet,
      currentTransportCompany: formData.transportCompany,
      shippingMethod: formData.shippingMethod
    });
    
    // SOLO preseleccionar si el método de envío requiere transportadora
    if (order && order.carrier_id && carriersList.length > 0 && transportCompanies.length > 0 && 
        formData.shippingMethod && formData.shippingMethod !== 'recoge_bodega' && !initialCarrierSet) {
      
      const carrierId = parseInt(order.carrier_id);
      const selectedCarrier = carriersList.find(c => parseInt(c.id) === carrierId);
      
      console.log(`🔎 Buscando carrier ID ${carrierId} en lista:`, carriersList);
      console.log(`📋 Transportadoras disponibles en dropdown:`, transportCompanies);
      
      if (selectedCarrier) {
        console.log(`✅ Transportadora encontrada: ${selectedCarrier.name} (ID: ${selectedCarrier.id})`);
        
        // Verificar que el nombre existe en la lista de transportCompanies
        if (transportCompanies.includes(selectedCarrier.name)) {
          console.log(`📦 Preseleccionando transportadora: ${selectedCarrier.name}`);
          
          // Actualización inmediata sin setTimeout
          setFormData(prev => {
            // Solo actualizar si no está ya establecida
            if (prev.transportCompany !== selectedCarrier.name) {
              console.log('🔄 Actualizando transportadora:', {
                anterior: prev.transportCompany,
                nueva: selectedCarrier.name
              });
              return {
                ...prev,
                transportCompany: selectedCarrier.name
              };
            }
            return prev;
          });
          setInitialCarrierSet(true);
          
        } else {
          console.log(`⚠️ La transportadora ${selectedCarrier.name} no está en la lista del dropdown`);
        }
      } else {
        console.log(`❌ No se encontró transportadora con ID ${carrierId}`);
      }
    }
  }, [order?.carrier_id, carriersList.length, transportCompanies.length, formData.shippingMethod]); // Agregamos shippingMethod

  // Reset initialCarrierSet cuando cambie el pedido
  React.useEffect(() => {
    console.log('🔄 Reset initialCarrierSet para pedido:', order?.id);
    setInitialCarrierSet(false);
  }, [order?.id]);


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


    try {
      setLoading(true);
      
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

    try {
      setLoading(true);
      
      // Crear formulario para enviar datos por POST a nueva ventana
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/logistics/generate-guide-html';
      form.target = '_blank';
      
      // Datos para enviar
      const formData_guide = {
        orderId: order.id,
        shippingMethod: formData.shippingMethod,
        transportCompany: formData.transportCompany,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        customerCity: order.customer_city,
        customerDepartment: order.customer_department,
        notes: formData.notes
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ zIndex: 10000 }}>
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
            {/* Información del pedido - Más compacta */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2 text-sm">Información del Pedido</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Cliente:</span>
                  <span className="ml-1 font-medium">{order?.customer_name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Teléfono:</span>
                  <span className="ml-1 font-medium">{order?.customer_phone}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total:</span>
                  <span className="ml-1 font-medium text-green-600">${order?.total_amount?.toLocaleString('es-CO')}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Dirección:</span>
                  <span className="ml-1 font-medium">{order?.customer_address}</span>
                </div>
                <div>
                  <span className="text-gray-600">Items:</span>
                  <span className="ml-1 font-medium">{order?.items?.length || 0} productos</span>
                </div>
                <div>
                  <span className="text-gray-600">Ciudad:</span>
                  <span className="ml-1 font-medium">{order?.customer_city || 'No especificada'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Depto:</span>
                  <span className="ml-1 font-medium">{order?.customer_department || 'No especificado'}</span>
                </div>
              </div>

              {/* Link para descargar factura de SIIGO - Más compacto */}
              {order?.siigo_public_url && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Icons.FileText className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs font-medium text-blue-900">Factura Original SIIGO</p>
                        <p className="text-xs text-blue-700">Descarga la factura oficial</p>
                      </div>
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

            {/* Lista de Items del Pedido */}
            {order?.items && order.items.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-sm font-medium text-gray-900 flex items-center">
                    <Icons.Package className="w-3 h-3 mr-1" />
                    Productos del Pedido ({order.items.length} items)
                  </h3>
                </div>
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
                              ${parseFloat(item.unit_price || 0).toLocaleString('es-CO')}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-right">
                            <span className="font-medium text-gray-900 text-xs">
                              ${parseFloat(item.subtotal || (item.quantity * (item.unit_price || 0))).toLocaleString('es-CO')}
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
              </div>
            )}

            {/* Notas de la Factura SIIGO - Información consolidada */}
            {(order?.siigo_observations || order?.notes) && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Icons.FileText className="w-4 h-4 mr-2" />
                  Notas de la Factura SIIGO
                </h3>
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
            {formData.shippingMethod && formData.shippingMethod !== 'recoge_bodega' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transportadora
                </label>
                <CustomDropdown
                  value={formData.transportCompany}
                  onChange={(value) => handleInputChange('transportCompany', value)}
                  options={transportCompanies.map(company => ({ value: company, label: company }))}
                  placeholder="Seleccionar transportadora"
                />
              </div>
            )}


            {/* Método de Pago de Envío */}
            {formData.transportCompany && (
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
                          {extractedData?.name || order?.customer_name}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Teléfono:</td>
                        <td className="px-4 py-2 border-b">
                          {extractedData?.phone || order?.customer_phone}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Dirección:</td>
                        <td className="px-4 py-2 border-b">
                          {extractedData?.address || order?.customer_address}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Ciudad:</td>
                        <td className="px-4 py-2 border-b">
                          {extractedData?.city || order?.customer_city}, {extractedData?.department || order?.customer_department}
                        </td>
                      </tr>
                      {extractedData?.nit && (
                        <tr>
                          <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">NIT:</td>
                          <td className="px-4 py-2 border-b">{extractedData.nit}</td>
                        </tr>
                      )}

                      {/* Forma de Pago */}
                      <tr className="bg-yellow-50">
                        <td colSpan="2" className="px-4 py-2 font-semibold text-yellow-900 border-b">
                          💳 FORMA DE PAGO
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Método de Pago:</td>
                        <td className="px-4 py-2 border-b">
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                            {extractedData?.paymentMethod || 'CONTRA ENTREGA'}
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
              className="btn btn-primary"
              disabled={loading || !formData.shippingMethod}
            >
              {loading ? (
                <>
                  <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Icons.Truck className="w-4 h-4 mr-2" />
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
