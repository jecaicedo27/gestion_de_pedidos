import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

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
              className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors"
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

const OrderReviewModal = ({ isOpen, onClose, order, onConfirm }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    delivery_method: '',
    payment_method: '',
    electronic_payment_type: '', // Tipo específico de pago electrónico
    electronic_payment_notes: '', // Notas para "otro" medio electrónico
    shipping_payment_method: 'contado', // contado o contraentrega
    shipping_date: '', // Fecha de envío para logística
    notes: ''
  });

  const [loading, setLoading] = useState(false);

  // Actualizar formData cuando cambie el pedido
  React.useEffect(() => {
    if (order && isOpen) {
      // Calcular fecha de envío por defecto (hoy - mismo día)
      const today = new Date();
      const defaultShippingDate = today.toISOString().split('T')[0];

      setFormData({
        delivery_method: '',  // Siempre vacío para forzar selección manual
        payment_method: '',   // Siempre vacío para forzar selección manual
        electronic_payment_type: '', // Resetear tipo de pago electrónico
        electronic_payment_notes: '', // Resetear notas de pago electrónico
        shipping_payment_method: 'contado',
        shipping_date: order.shipping_date || defaultShippingDate,
        notes: order.notes || ''
      });
    }
  }, [order, isOpen]);

  const [deliveryMethods, setDeliveryMethods] = useState([]);

  // Cargar métodos de envío dinámicamente desde la API
  React.useEffect(() => {
    const fetchDeliveryMethods = async () => {
      try {
        const response = await fetch('/api/delivery-methods/active', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const apiResponse = await response.json();
          // Manejar diferentes estructuras de respuesta de la API
          const methodsData = apiResponse.data || apiResponse;

          if (Array.isArray(methodsData)) {
            const dynamicMethods = methodsData.map(method => ({
              value: method.code,
              label: method.name
            }));
            setDeliveryMethods(dynamicMethods);
          } else {
            console.error('API response is not an array:', methodsData);
            throw new Error('Invalid API response format');
          }
        } else {
          console.error('Error cargando métodos de envío:', response.statusText);
          throw new Error('API request failed');
        }
      } catch (error) {
        console.error('Error cargando métodos de envío:', error);
        // Fallback actualizado con datos reales de la BD
        setDeliveryMethods([
          { value: 'recogida_tienda', label: 'Recoge en Bodega' },
          { value: 'domicilio', label: 'Domicilio' },
          { value: 'envio_nacional', label: 'Nacional' },
          { value: 'mensajeria_urbana', label: 'Mensajeria urbana' },
          { value: 'envio_especial', label: 'envio especia' }
        ]);
      }
    };

    if (isOpen) {
      fetchDeliveryMethods();
    }
  }, [isOpen]);

  const paymentMethods = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'cliente_credito', label: 'Cliente a Crédito' },
    { value: 'pago_electronico', label: 'Pago Electrónico' },
    { value: 'contraentrega', label: 'Contraentrega (Solo Medellín)' }
  ];

  // Helper para detectar "Recoge en Bodega"
  const isPickupDelivery = (code) => {
    if (!code) return false;
    const c = String(code).toLowerCase();
    // Acepta códigos comunes y coincidencias por texto
    return ['recogida_tienda', 'recoge_bodega'].includes(c) || c.includes('bodega') || c.includes('recoge');
  };

  // Nuevo helper: detectar entregas locales/domicilio/mensajería
  const isLocalDelivery = (code) => {
    if (!code) return false;
    const c = String(code).toLowerCase();
    const codes = ['domicilio', 'domicilio_local', 'domicilio_ciudad', 'mensajeria_urbana', 'mensajeria_local'];
    return codes.includes(c) || c.includes('domicilio') || c.includes('mensajeria') || c.includes('mensajería');
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSendToWallet = async () => {
    // Validar método de pago y fecha de envío
    if (!formData.payment_method) {
      toast.error('Debe seleccionar un método de pago');
      return;
    }

    // Si es efectivo + domicilio/mensajería local o recoge en bodega => enviar a Logística
    if (formData.payment_method === 'efectivo' && (isPickupDelivery(formData.delivery_method) || isLocalDelivery(formData.delivery_method))) {
      if (!formData.delivery_method) {
        toast.error('Para Efectivo debe seleccionar un método de envío para enviarlo a Logística');
        return;
      }
      if (!formData.shipping_date) {
        toast.error('Debe seleccionar una fecha de envío');
        return;
      }

      setLoading(true);
      try {
        const dataToSend = {
          orderId: order.id,
          payment_method: formData.payment_method,
          delivery_method: formData.delivery_method,
          shipping_date: formData.shipping_date,
          notes: formData.notes,
          action: 'send_to_logistics'
        };

        await onConfirm(dataToSend);
        onClose();
        toast.success('Pedido en efectivo enviado a Logística. El mensajero recibe el dinero y lo entrega a Cartera.');
      } catch (error) {
        console.error('Error enviando efectivo a logística:', error);
        toast.error('Error enviando pedido a logística');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Si es contraentrega, pasa directo a Logística (no a Cartera)
    if (formData.payment_method === 'contraentrega') {
      if (!formData.delivery_method) {
        toast.error('Para Contraentrega debe seleccionar un método de envío para enviarlo a Logística');
        return;
      }
      if (!formData.shipping_date) {
        toast.error('Debe seleccionar una fecha de envío');
        return;
      }

      setLoading(true);
      try {
        const dataToSend = {
          orderId: order.id,
          payment_method: formData.payment_method,
          delivery_method: formData.delivery_method,
          shipping_date: formData.shipping_date,
          notes: formData.notes,
          action: 'send_to_logistics'
        };

        await onConfirm(dataToSend);
        onClose();
        toast.success('Pedido contraentrega enviado a Logística. El mensajero recibe el dinero y lo entrega a Cartera.');
      } catch (error) {
        console.error('Error enviando contraentrega a logística:', error);
        toast.error('Error enviando pedido a logística');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Validaciones específicas para pago electrónico
    if (formData.payment_method === 'pago_electronico') {
      if (!formData.electronic_payment_type) {
        toast.error('Debe seleccionar el tipo de pago electrónico');
        return;
      }
      if (formData.electronic_payment_type === 'otro' && !formData.electronic_payment_notes.trim()) {
        toast.error('Debe especificar qué otro medio electrónico se utilizó');
        return;
      }
    }

    if (!formData.shipping_date) {
      toast.error('Debe seleccionar una fecha de envío');
      return;
    }

    setLoading(true);
    try {
      const dataToSend = {
        orderId: order.id,
        payment_method: formData.payment_method,
        electronic_payment_type: formData.electronic_payment_type,
        electronic_payment_notes: formData.electronic_payment_notes,
        shipping_date: formData.shipping_date,
        notes: formData.notes,
        action: 'send_to_wallet'
      };

      await onConfirm(dataToSend);
      onClose();
      toast.success('Pedido enviado a cartera para validación');
    } catch (error) {
      console.error('Error enviando a cartera:', error);
      toast.error('Error enviando pedido a cartera');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToLogistics = async () => {
    // Validar método de pago, envío y fecha
    if (!formData.payment_method) {
      toast.error('Debe seleccionar un método de pago');
      return;
    }
    if (!formData.delivery_method) {
      toast.error('Debe seleccionar un método de envío');
      return;
    }
    if (!formData.shipping_date) {
      toast.error('Debe seleccionar una fecha de envío');
      return;
    }

    // Reglas de negocio
    if (formData.payment_method === 'transferencia' || formData.payment_method === 'pago_electronico') {
      toast.error('Los pagos por transferencia/electrónicos deben ir a Cartera primero para verificar el abono.');
      return;
    }

    setLoading(true);
    try {
      const dataToSend = {
        orderId: order.id,
        payment_method: formData.payment_method,
        delivery_method: formData.delivery_method,
        shipping_date: formData.shipping_date,
        notes: formData.notes,
        action: 'send_to_logistics'
      };

      await onConfirm(dataToSend);
      onClose();
      toast.success('Pedido enviado a Logística. Logística recibirá el dinero y luego lo cuadrará con Cartera.');
    } catch (error) {
      console.error('Error enviando a logística:', error);
      toast.error('Error enviando pedido a logística');
    } finally {
      setLoading(false);
    }
  };

  // Nueva función para procesamiento automático (solo para admin y facturador)
  const handleProcessOrder = async () => {
    // Validaciones básicas
    if (!formData.payment_method) {
      toast.error('Debe seleccionar un método de pago');
      return;
    }
    if (!formData.delivery_method) {
      toast.error('Debe seleccionar un método de envío');
      return;
    }
    if (!formData.shipping_date) {
      toast.error('Debe seleccionar una fecha de envío');
      return;
    }

    // Validaciones específicas para pago electrónico
    if (formData.payment_method === 'pago_electronico') {
      if (!formData.electronic_payment_type) {
        toast.error('Debe seleccionar el tipo de pago electrónico');
        return;
      }
      if (formData.electronic_payment_type === 'otro' && !formData.electronic_payment_notes.trim()) {
        toast.error('Debe especificar qué otro medio electrónico se utilizó');
        return;
      }
    }

    setLoading(true);
    try {
      // REGLAS DE NEGOCIO AUTOMÁTICAS
      let actionType = '';
      let successMessage = '';

      if (formData.payment_method === 'contraentrega') {
        // Contraentrega => directo a Logística; el mensajero cobra y entrega a Cartera
        actionType = 'send_to_logistics';
        successMessage = 'Pedido contraentrega enviado a Logística. El mensajero recibe el dinero y lo entrega a Cartera.';
      } else if (formData.payment_method === 'efectivo' && (isPickupDelivery(formData.delivery_method) || isLocalDelivery(formData.delivery_method))) {
        // Efectivo + Recoge en Bodega ó Domicilio/Mensajería local => Logística/Mensajero cobra y luego concilia con Cartera
        actionType = 'send_to_logistics';
        successMessage = 'Pedido con pago en efectivo enviado a Logística. El mensajero recibe el dinero y lo entrega a Cartera.';
      } else if (formData.payment_method === 'transferencia' || formData.payment_method === 'pago_electronico') {
        // Transferencia o electrónicos => Cartera valida primero
        actionType = 'send_to_wallet';
        successMessage = `Pedido procesado y enviado a Cartera para validación (${getPaymentMethodLabel(formData.payment_method)})`;
      } else {
        // Otros casos => Cartera
        actionType = 'send_to_wallet';
        successMessage = 'Pedido enviado a Cartera para validación.';
      }

      const dataToSend = {
        orderId: order.id,
        payment_method: formData.payment_method,
        delivery_method: formData.delivery_method,
        electronic_payment_type: formData.electronic_payment_type,
        electronic_payment_notes: formData.electronic_payment_notes,
        shipping_date: formData.shipping_date,
        notes: formData.notes,
        action: actionType,
        auto_processed: true
      };

      await onConfirm(dataToSend);
      onClose();
      toast.success(
        formData.payment_method === 'contraentrega'
          ? 'Pedido contraentrega enviado a Logística. El mensajero recibe el dinero y lo entrega a Cartera.'
          : actionType === 'send_to_logistics'
            ? 'Pedido enviado a Logística. Logística recibirá el dinero y luego lo cuadrará con Cartera.'
            : successMessage
      );
    } catch (error) {
      console.error('Error procesando pedido:', error);
      toast.error('Error procesando el pedido');
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para obtener la etiqueta del método de pago
  const getPaymentMethodLabel = (method) => {
    const labels = {
      'efectivo': 'Efectivo',
      'transferencia': 'Transferencia',
      'cliente_credito': 'Cliente a Crédito',
      'pago_electronico': 'Pago Electrónico',
      'contraentrega': 'Contraentrega'
    };
    return labels[method] || method;
  };

  const getRecommendedAction = () => {
    if (!formData.payment_method) {
      return null;
    }

    // Recomendación basada en reglas de negocio actualizadas
    if (formData.payment_method === 'contraentrega') {
      return {
        action: 'logistics',
        reason: 'Pago contraentrega: pasa directo a Logística. El mensajero recibe el dinero y lo entrega a Cartera.'
      };
    } else if (formData.payment_method === 'efectivo' && (isPickupDelivery(formData.delivery_method) || isLocalDelivery(formData.delivery_method))) {
      return {
        action: 'logistics',
        reason: 'Pago en efectivo + domicilio/mensajería local: enviar a Logística. El mensajero recibe el dinero y lo cuadra con Cartera.'
      };
    } else if (formData.payment_method === 'transferencia' || formData.payment_method === 'pago_electronico') {
      return {
        action: 'wallet',
        reason: 'Transferencia - DEBE ir a Cartera primero para verificar que el dinero esté en el banco'
      };
    } else {
      return {
        action: 'wallet',
        reason: 'Requiere validación de Cartera antes del envío'
      };
    }
  };

  const recommendation = getRecommendedAction();

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Revisar Pedido - {order.order_number}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure los detalles del pedido antes de procesarlo
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
          {/* Información del pedido */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <h3 className="font-medium text-gray-900 mb-2">Información del Pedido</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-gray-600">Cliente:</span>
                <span className="ml-1 font-medium">{order.customer_name}</span>
              </div>
              <div>
                <span className="text-gray-600">Teléfono:</span>
                <span className="ml-1 font-medium">{order.customer_phone}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Dirección:</span>
                <span className="ml-1 font-medium">{order.customer_address}</span>
              </div>
              <div>
                <span className="text-gray-600">Ciudad:</span>
                <span className="ml-1 font-medium">{order.customer_city || 'No especificada'}</span>
              </div>
              <div>
                <span className="text-gray-600">Departamento:</span>
                <span className="ml-1 font-medium">{order.customer_department || 'No especificado'}</span>
              </div>
              <div>
                <span className="text-gray-600">Total:</span>
                <span className="ml-1 font-medium text-green-600">
                  ${order.total_amount?.toLocaleString('es-CO')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Items:</span>
                <span className="ml-1 font-medium">{order.items?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Lista compacta de items del pedido */}
          {order.items && order.items.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <h3 className="font-medium text-red-900 mb-2 flex items-center">
                <Icons.Package className="w-4 h-4 mr-2" />
                Productos del Pedido ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
              </h3>

              {/* Tabla compacta de items */}
              <div className="bg-white rounded border border-red-200 overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-red-100 border-b border-red-200">
                      <tr>
                        <th className="text-left p-2 font-medium text-red-900">Producto</th>
                        <th className="text-center p-2 font-medium text-red-900 w-16">Cant.</th>
                        <th className="text-right p-2 font-medium text-red-900 w-20">Precio Unit.</th>
                        <th className="text-right p-2 font-medium text-red-900 w-24">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, index) => (
                        <tr key={index} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className="p-2">
                            <div className="font-medium text-gray-900 text-xs leading-tight">
                              {item.name || 'Producto sin nombre'}
                            </div>
                            {item.product_code && (
                              <div className="text-gray-500 text-xs mt-0.5">
                                Cód: {item.product_code}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center font-medium">
                            {item.quantity || 1}
                          </td>
                          <td className="p-2 text-right font-medium">
                            ${(item.price || 0).toLocaleString('es-CO')}
                          </td>
                          <td className="p-2 text-right font-semibold text-green-600">
                            ${((item.quantity || 1) * (item.price || 0)).toLocaleString('es-CO')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total compacto */}
                <div className="bg-red-100 border-t border-red-200 px-2 py-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-red-900">
                      Total: {order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)} unidades
                    </span>
                    <span className="font-bold text-green-600">
                      ${order.total_amount?.toLocaleString('es-CO') || '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Observaciones de SIIGO - Solo visible para roles que no sean logistica ni admin */}
          {order.siigo_observations && !['logistica', 'admin'].includes(user?.role) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-amber-900 mb-3 flex items-center">
                <Icons.FileText className="w-4 h-4 mr-2" />
                Observaciones de SIIGO
              </h3>
              <div className="bg-white border border-amber-200 rounded p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {(() => {
                    // Algoritmo simple y directo para formatear observaciones de SIIGO
                    let formattedText = order.siigo_observations;

                    // Lista de campos específicos a identificar y separar
                    const fieldsToSeparate = [
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
                      // Crear un patrón que busque el campo precedido por cualquier caracter que no sea salto de línea
                      const pattern = new RegExp(`([^\\n])${field.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'g');
                      formattedText = formattedText.replace(pattern, `$1\n${field}`);
                    });

                    // Normalizar saltos de línea y espacios
                    formattedText = formattedText
                      .replace(/\r\n/g, '\n')          // Normalizar CRLF a LF
                      .replace(/\r/g, '\n')            // Normalizar CR a LF
                      .replace(/\n+/g, '\n')           // Eliminar saltos múltiples
                      .split('\n')
                      .map(line => line.replace(/\s+/g, ' ').trim())  // Limpiar espacios en cada línea
                      .filter(line => line.length > 0)               // Eliminar líneas vacías
                      .join('\n');

                    return formattedText;
                  })()}
                </pre>
              </div>
              <p className="text-xs text-amber-700 mt-2">
                Estas observaciones fueron extraídas automáticamente de la factura de SIIGO
              </p>
            </div>
          )}

          {/* Notas de la Factura SIIGO - Campo notes existente */}
          {order.notes && order.notes.trim() !== '' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-blue-900 mb-3 flex items-center">
                <Icons.StickyNote className="w-4 h-4 mr-2" />
                Notas de la Factura SIIGO
              </h3>
              <div className="bg-white border border-blue-200 rounded p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {order.notes}
                </pre>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Información importante acordada con el cliente
              </p>
            </div>
          )}

          {/* Mensaje si no hay items */}
          {(!order.items || order.items.length === 0) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <Icons.AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                <div>
                  <h4 className="font-medium text-yellow-800">Sin productos definidos</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Este pedido no tiene productos asociados. Verifique la información del pedido antes de continuar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Formulario de configuración */}
          <div className="space-y-6">
            {/* Método de pago - Dropdown Personalizado */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago *
              </label>
              <CustomDropdown
                value={formData.payment_method}
                onChange={(value) => handleInputChange('payment_method', value)}
                options={paymentMethods}
                placeholder="Seleccionar método de pago"
                required
              />
            </div>

            {/* Método de Envío - Dropdown Personalizado */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Icons.Truck className="w-4 h-4 inline mr-1" />
                Método de Envío *
              </label>
              <CustomDropdown
                value={formData.delivery_method}
                onChange={(value) => handleInputChange('delivery_method', value)}
                options={deliveryMethods}
                placeholder="Seleccionar método de envío"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {deliveryMethods.length > 0
                  ? 'Seleccione el método de envío que se usará para este pedido'
                  : 'Cargando métodos de envío...'
                }
              </p>
            </div>

            {/* Opciones de Pago Electrónico - Solo visible cuando se selecciona pago_electronico */}
            {formData.payment_method === 'pago_electronico' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                  <Icons.CreditCard className="w-4 h-4 mr-2" />
                  Tipo de Pago Electrónico
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleccione el medio de pago electrónico *
                    </label>
                    <select
                      value={formData.electronic_payment_type}
                      onChange={(e) => handleInputChange('electronic_payment_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleccionar medio electrónico</option>
                      <option value="mercadopago">MercadoPago</option>
                      <option value="bold">Bold</option>
                      <option value="otro">Otro medio electrónico</option>
                    </select>
                  </div>

                  {/* Campo de notas para "otro" medio electrónico */}
                  {formData.electronic_payment_type === 'otro' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Especifique el medio electrónico *
                      </label>
                      <input
                        type="text"
                        value={formData.electronic_payment_notes}
                        onChange={(e) => handleInputChange('electronic_payment_notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Nequi, Daviplata, PayU, etc."
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Indique qué otro medio de pago electrónico se utilizó
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 p-3 bg-blue-100 border border-blue-300 rounded">
                  <div className="flex items-start">
                    <Icons.Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5" />
                    <div className="text-xs text-blue-800">
                      <p className="font-medium mb-1">Nota importante:</p>
                      <p>Los pagos electrónicos requieren validación de cartera para verificar que el dinero haya sido recibido correctamente antes de proceder con el envío.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fecha de envío - Siempre visible para programación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Icons.Calendar className="w-4 h-4 mr-2 text-blue-600" />
                Fecha de Envío *
              </label>
              <input
                type="date"
                value={formData.shipping_date}
                onChange={(e) => handleInputChange('shipping_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Esta fecha será crucial para que logística programe el envío
              </p>
            </div>

            {/* Recomendación del sistema */}
            {recommendation && (
              <div className={`p-4 rounded-lg border ${
                recommendation.action === 'wallet'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start">
                  <Icons.Info className={`w-5 h-5 mt-0.5 mr-3 ${
                    recommendation.action === 'wallet' ? 'text-blue-500' : 'text-green-500'
                  }`} />
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">
                      Recomendación del Sistema
                    </h4>
                    <p className="text-sm text-gray-600">
                      {recommendation.reason}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          {/* Botones principales */}
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancelar
            </button>

            {/* Botones dinámicos según el rol del usuario */}
            {['admin', 'facturador'].includes(user?.role) ? (
              // Para admin y facturador: un solo botón que aplica reglas de negocio automáticas
              <button
                onClick={handleProcessOrder}
                disabled={loading || !formData.payment_method || !formData.shipping_date || !formData.delivery_method}
                className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                {loading ? (
                  <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Icons.Zap className="w-4 h-4 mr-2" />
                )}
                Procesar Pedido
              </button>
            ) : (
              // Para otros roles: botones manuales
              <div className="flex space-x-3">
                <button
                  onClick={handleSendToWallet}
                  disabled={loading || !formData.payment_method || !formData.shipping_date}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? (
                    <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Icons.CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Enviar a Cartera
                </button>

                <button
                  onClick={handleSendToLogistics}
                  disabled={loading || !formData.payment_method || !formData.shipping_date || !formData.delivery_method}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {loading ? (
                    <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Icons.Package className="w-4 h-4 mr-2" />
                  )}
                  Enviar a Logística
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderReviewModal;
