import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const LogisticsModal = ({ isOpen, onClose, order, onProcess }) => {
  const [formData, setFormData] = useState({
    shippingMethod: '',
    transportCompany: '',
    trackingNumber: '',
    shippingDate: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  // Función para extraer datos del destinatario desde las observaciones y notas de SIIGO
  const extractRecipientData = (observations, notes) => {
    const data = {};
    
    // Función para procesar texto línea por línea
    const processText = (text) => {
      if (!text) return;
      
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Patrones mejorados para capturar datos del destinatario
        if (trimmedLine.match(/NOMBRE.*:/i)) {
          const nameMatch = trimmedLine.split(':')[1]?.trim();
          if (nameMatch && !data.name) data.name = nameMatch;
        } else if (trimmedLine.match(/TELÉFONO.*:/i) || trimmedLine.match(/TELEFONO.*:/i)) {
          const phoneMatch = trimmedLine.split(':')[1]?.trim();
          if (phoneMatch && !data.phone) data.phone = phoneMatch;
        } else if (trimmedLine.match(/DIRECCIÓN.*:/i) || trimmedLine.match(/DIRECCION.*:/i)) {
          const addressMatch = trimmedLine.split(':')[1]?.trim();
          if (addressMatch && !data.address) data.address = addressMatch;
        } else if (trimmedLine.match(/CIUDAD.*:/i)) {
          const cityMatch = trimmedLine.split(':')[1]?.trim();
          if (cityMatch && !data.city) data.city = cityMatch;
        } else if (trimmedLine.match(/DEPARTAMENTO.*:/i)) {
          const departmentMatch = trimmedLine.split(':')[1]?.trim();
          if (departmentMatch && !data.department) data.department = departmentMatch;
        } else if (trimmedLine.match(/NIT.*:/i)) {
          const nitMatch = trimmedLine.split(':')[1]?.trim();
          if (nitMatch && !data.nit) data.nit = nitMatch;
        } else if (trimmedLine.match(/FORMA DE PAGO.*:/i) || trimmedLine.match(/MÉTODO DE PAGO.*:/i) || trimmedLine.match(/METODO DE PAGO.*:/i)) {
          const paymentMatch = trimmedLine.split(':')[1]?.trim();
          if (paymentMatch && !data.paymentMethod) data.paymentMethod = paymentMatch;
        }
        
        // Patrones adicionales para capturar información más flexible
        if (trimmedLine.match(/Nombre.*:/i) && !data.name) {
          const nameMatch = trimmedLine.split(':')[1]?.trim();
          if (nameMatch) data.name = nameMatch;
        }
        if (trimmedLine.match(/Tel.*:/i) && !data.phone) {
          const phoneMatch = trimmedLine.split(':')[1]?.trim();
          if (phoneMatch) data.phone = phoneMatch;
        }
      }
    };

    // Priorizar observaciones de SIIGO sobre notas tradicionales
    if (observations) {
      processText(observations);
    }
    
    // Si no hay datos suficientes en observaciones, buscar en notas tradicionales
    if (notes && (!data.name || !data.phone || !data.address)) {
      processText(notes);
    }

    // Solo retornar si tenemos datos mínimos del destinatario
    if (data.name || data.phone || data.address) {
      return data;
    }

    return null;
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
        notes: order.notes || ''
      }));
    } else {
      setExtractedData(null);
      // Reset form cuando no hay pedido
      setFormData({
        shippingMethod: '',
        transportCompany: '',
        trackingNumber: '',
        notes: ''
      });
    }
  }, [order]);

  // Opciones de método de envío - Sincronizadas con OrderReviewModal
  const shippingMethods = [
    { value: 'recoge_bodega', label: 'Recoge en Bodega' },
    { value: 'domicilio', label: 'Domicilio' },
    { value: 'nacional', label: 'Nacional' },
    { value: 'mensajeria_urbana', label: 'Mensajería Urbana' }
  ];

  // Transportadoras disponibles
  const transportCompanies = [
    'Servientrega',
    'Coordinadora',
    'TCC',
    'Envía',
    'Inter Rapidísimo',
    'Deprisa',
    'Mensajería Local'
  ];

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Procesar Envío - Pedido {order?.order_number}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Cliente: {order?.customer_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Información del pedido */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Información del Pedido</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Cliente:</span>
                  <p className="font-medium">{order?.customer_name}</p>
                </div>
                <div>
                  <span className="text-gray-600">Teléfono:</span>
                  <p className="font-medium">{order?.customer_phone}</p>
                </div>
                <div>
                  <span className="text-gray-600">Dirección:</span>
                  <p className="font-medium">{order?.customer_address}</p>
                </div>
                <div>
                  <span className="text-gray-600">Ciudad:</span>
                  <p className="font-medium">{order?.customer_city}, {order?.customer_department}</p>
                </div>
                <div>
                  <span className="text-gray-600">Total:</span>
                  <p className="font-medium">${order?.total_amount?.toLocaleString('es-CO')}</p>
                </div>
                <div>
                  <span className="text-gray-600">Items:</span>
                  <p className="font-medium">{order?.items?.length || 0} productos</p>
                </div>
              </div>

              {/* Link para descargar factura de SIIGO */}
              {order?.siigo_public_url && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Icons.FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Factura Original SIIGO</p>
                        <p className="text-xs text-blue-700">Descarga la factura oficial para imprimir</p>
                      </div>
                    </div>
                    <a
                      href={order.siigo_public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors"
                    >
                      <Icons.Download className="w-4 h-4" />
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

            {/* Observaciones de SIIGO */}
            {order?.siigo_observations && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium text-amber-900 mb-2 flex items-center">
                  <Icons.FileText className="w-4 h-4 mr-2" />
                  Observaciones de SIIGO
                </h3>
                <p className="text-sm text-amber-800 mb-2">
                  <strong>Información extraída automáticamente de la factura:</strong>
                </p>
                <div className="bg-white border border-amber-200 rounded p-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {order.siigo_observations}
                  </pre>
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  🏷️ Estas observaciones contienen información adicional importante sobre el pedido, 
                  requisitos especiales de entrega, y notas del cliente.
                </p>
              </div>
            )}

            {/* Notas de la Factura SIIGO */}
            {order?.notes && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Icons.FileText className="w-4 h-4 mr-2" />
                  Notas de la Factura SIIGO
                </h3>
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Información importante acordada con el cliente:</strong>
                </p>
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  💡 Esta información puede contener detalles sobre el método de envío, dirección especial, 
                  horarios de entrega u otras instrucciones importantes del cliente.
                </p>
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
                </div>
                <div className="mt-3 p-2 bg-green-100 rounded border border-green-300">
                  <p className="text-xs text-green-700">
                    ✅ <strong>Datos extraídos automáticamente</strong> - Estos datos se usarán para generar la guía de envío
                  </p>
                </div>
              </div>
            )}

            {/* Método de envío */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Envío *
              </label>
              <select
                value={formData.shippingMethod}
                onChange={(e) => handleInputChange('shippingMethod', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar método de envío</option>
                {shippingMethods.map(method => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Transportadora */}
            {formData.shippingMethod && formData.shippingMethod !== 'recoge_bodega' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transportadora
                </label>
                <select
                  value={formData.transportCompany}
                  onChange={(e) => handleInputChange('transportCompany', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar transportadora</option>
                  {transportCompanies.map(company => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Número de guía */}
            {formData.transportCompany && (
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

            {/* Notas adicionales */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas Adicionales
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Instrucciones especiales, observaciones..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

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
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Total del Pedido:</td>
                        <td className="px-4 py-2 border-b">${order?.total_amount?.toLocaleString('es-CO')}</td>
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
                        <td className="px-4 py-2 border-b">Perlas Explosivas</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Dirección:</td>
                        <td className="px-4 py-2 border-b">Calle 50 # 31-46, Medellín, Colombia</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700 border-b border-r">Teléfono:</td>
                        <td className="px-4 py-2 border-b">+57 310 524 4298</td>
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
          <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
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
