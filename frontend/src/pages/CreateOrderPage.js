import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const CreateOrderPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    getValues
  } = useForm({
    defaultValues: {
      invoiceCode: '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      customerDepartment: '',
      customerCity: '',
      deliveryMethod: 'domicilio_ciudad',
      paymentMethod: 'efectivo',
      deliveryDate: '',
      notes: '',
      items: [{ name: '', quantity: 1, price: 0, description: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedItems = watch('items');
  const watchedDeliveryMethod = watch('deliveryMethod');
  const watchedPaymentMethod = watch('paymentMethod');

  // Calcular total automáticamente
  const calculateTotal = () => {
    return watchedItems.reduce((total, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      return total + (quantity * price);
    }, 0);
  };

  // Generar código de factura automático
  const generateInvoiceCode = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    const code = `FAC-${timestamp}-${random}`;
    setValue('invoiceCode', code);
  };

  // Validaciones de reglas de negocio
  const getBusinessRules = () => {
    const rules = [];
    
    if (watchedDeliveryMethod === 'recoge_bodega') {
      rules.push({
        type: 'info',
        message: 'Recogida en bodega: El cliente debe presentar identificación al recoger'
      });
      if (watchedPaymentMethod !== 'efectivo') {
        rules.push({
          type: 'warning',
          message: 'Recogida en bodega + Pago no efectivo: Requiere verificación de pago antes de entrega'
        });
      }
    }
    
    if (watchedDeliveryMethod === 'domicilio_ciudad' && watchedPaymentMethod === 'efectivo') {
      rules.push({
        type: 'success',
        message: 'Domicilio + Efectivo: Pago contra entrega, pasa directo a logística'
      });
    }
    
    if (watchedDeliveryMethod === 'envio_nacional' && watchedPaymentMethod === 'transferencia') {
      rules.push({
        type: 'warning',
        message: 'Envío nacional + Transferencia: Requiere verificación de pago por cartera'
      });
    }
    
    return rules;
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      
      // Preparar datos del pedido
      const orderData = {
        invoiceCode: data.invoiceCode,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        customerAddress: data.customerAddress,
        customerDepartment: data.customerDepartment,
        customerCity: data.customerCity,
        deliveryMethod: data.deliveryMethod,
        paymentMethod: data.paymentMethod,
        deliveryDate: data.deliveryDate || null,
        notes: data.notes || null,
        items: data.items.filter(item => item.name && item.quantity > 0 && item.price > 0),
        totalAmount: calculateTotal()
      };

      const response = await orderService.createOrder(orderData);
      
      toast.success('Pedido creado exitosamente');
      navigate('/orders');
      
    } catch (error) {
      console.error('Error creando pedido:', error);
      toast.error('Error al crear el pedido');
    } finally {
      setLoading(false);
    }
  };

  const businessRules = getBusinessRules();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Crear Nuevo Pedido</h1>
          <p className="text-gray-600 mt-2">
            Formulario de facturación manual
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="btn btn-secondary"
          >
            <Icons.ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </button>
          
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="btn btn-info"
          >
            <Icons.Eye className="w-4 h-4 mr-2" />
            {showPreview ? 'Ocultar' : 'Vista Previa'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario Principal */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Información de Facturación */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center">
                  <Icons.FileText className="w-5 h-5 mr-2" />
                  Información de Facturación
                </h3>
              </div>
              <div className="card-content space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Factura *
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        className={`flex-1 px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.invoiceCode ? 'border-red-500' : 'border-gray-300'
                        }`}
                        {...register('invoiceCode')}
                      />
                      <button
                        type="button"
                        onClick={generateInvoiceCode}
                        className="px-3 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
                        title="Generar código automático"
                      >
                        <Icons.RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    {errors.invoiceCode && (
                      <p className="text-red-500 text-sm mt-1">{errors.invoiceCode.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha de Entrega
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      {...register('deliveryDate')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Información del Cliente */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center">
                  <Icons.User className="w-5 h-5 mr-2" />
                  Información del Cliente
                </h3>
              </div>
              <div className="card-content space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.customerName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      {...register('customerName', {
                        required: 'El nombre del cliente es obligatorio'
                      })}
                    />
                    {errors.customerName && (
                      <p className="text-red-500 text-sm mt-1">{errors.customerName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.customerPhone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      {...register('customerPhone', {
                        required: 'El teléfono es obligatorio',
                        pattern: {
                          value: /^[0-9+\-\s()]+$/,
                          message: 'Formato de teléfono inválido'
                        }
                      })}
                    />
                    {errors.customerPhone && (
                      <p className="text-red-500 text-sm mt-1">{errors.customerPhone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.customerEmail ? 'border-red-500' : 'border-gray-300'
                      }`}
                      {...register('customerEmail', {
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Email inválido'
                        }
                      })}
                    />
                    {errors.customerEmail && (
                      <p className="text-red-500 text-sm mt-1">{errors.customerEmail.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Departamento *
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.customerDepartment ? 'border-red-500' : 'border-gray-300'
                      }`}
                      {...register('customerDepartment', {
                        required: 'El departamento es obligatorio'
                      })}
                    />
                    {errors.customerDepartment && (
                      <p className="text-red-500 text-sm mt-1">{errors.customerDepartment.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ciudad *
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.customerCity ? 'border-red-500' : 'border-gray-300'
                      }`}
                      {...register('customerCity', {
                        required: 'La ciudad es obligatoria'
                      })}
                    />
                    {errors.customerCity && (
                      <p className="text-red-500 text-sm mt-1">{errors.customerCity.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección *
                  </label>
                  <textarea
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.customerAddress ? 'border-red-500' : 'border-gray-300'
                    }`}
                    {...register('customerAddress', {
                      required: 'La dirección es obligatoria'
                    })}
                  />
                  {errors.customerAddress && (
                    <p className="text-red-500 text-sm mt-1">{errors.customerAddress.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Método de Entrega y Pago */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center">
                  <Icons.Truck className="w-5 h-5 mr-2" />
                  Método de Entrega y Pago
                </h3>
              </div>
              <div className="card-content space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Forma de Entrega *
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      {...register('deliveryMethod', {
                        required: 'Seleccione un método de entrega'
                      })}
                    >
                      <option value="recoge_bodega">Recoge en Bodega</option>
                      <option value="envio_nacional">Envío Nacional</option>
                      <option value="domicilio_ciudad">Domicilio en Ciudad</option>
                    </select>
                    {errors.deliveryMethod && (
                      <p className="text-red-500 text-sm mt-1">{errors.deliveryMethod.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Método de Pago *
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      {...register('paymentMethod', {
                        required: 'Seleccione un método de pago'
                      })}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="cliente_credito">Cliente a Crédito</option>
                      <option value="pago_electronico">Pago Electrónico</option>
                    </select>
                    {errors.paymentMethod && (
                      <p className="text-red-500 text-sm mt-1">{errors.paymentMethod.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Items del Pedido */}
            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h3 className="card-title flex items-center">
                    <Icons.Package className="w-5 h-5 mr-2" />
                    Items del Pedido
                  </h3>
                  <button
                    type="button"
                    onClick={() => append({ name: '', quantity: 1, price: 0, description: '' })}
                    className="btn btn-primary btn-sm"
                  >
                    <Icons.Plus className="w-4 h-4 mr-1" />
                    Agregar Item
                  </button>
                </div>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Item {index + 1}</h4>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Icons.Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre *
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register(`items.${index}.name`, {
                              required: 'El nombre es obligatorio'
                            })}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cantidad *
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register(`items.${index}.quantity`, {
                              required: 'La cantidad es obligatoria',
                              min: { value: 1, message: 'Mínimo 1' }
                            })}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Precio *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register(`items.${index}.price`, {
                              required: 'El precio es obligatorio',
                              min: { value: 0, message: 'Mínimo 0' }
                            })}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Subtotal
                          </label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                            ${((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.price || 0)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descripción
                        </label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          {...register(`items.${index}.description`)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-900">Total del Pedido:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notas Adicionales */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center">
                  <Icons.MessageSquare className="w-5 h-5 mr-2" />
                  Notas Adicionales
                </h3>
              </div>
              <div className="card-content">
                <textarea
                  rows={4}
                  placeholder="Observaciones especiales, instrucciones de entrega, etc..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  {...register('notes')}
                />
              </div>
            </div>
          </div>

          {/* Panel Lateral */}
          <div className="space-y-6">
            {/* Reglas de Negocio */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center">
                  <Icons.Info className="w-5 h-5 mr-2" />
                  Reglas de Negocio
                </h3>
              </div>
              <div className="card-content">
                {businessRules.length > 0 ? (
                  <div className="space-y-3">
                    {businessRules.map((rule, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg text-sm ${
                          rule.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                          rule.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
                          rule.type === 'info' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                          'bg-gray-50 text-gray-800 border border-gray-200'
                        }`}
                      >
                        {rule.message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    Las reglas aparecerán según la configuración seleccionada
                  </p>
                )}
              </div>
            </div>

            {/* Vista Previa */}
            {showPreview && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.Eye className="w-5 h-5 mr-2" />
                    Vista Previa
                  </h3>
                </div>
                <div className="card-content">
                  <div className="space-y-2 text-sm">
                    <div><strong>Cliente:</strong> {watch('customerName') || 'Sin especificar'}</div>
                    <div><strong>Teléfono:</strong> {watch('customerPhone') || 'Sin especificar'}</div>
                    <div><strong>Ciudad:</strong> {watch('customerCity') || 'Sin especificar'}</div>
                    <div><strong>Entrega:</strong> {
                      watch('deliveryMethod') === 'recoge_bodega' ? 'Recoge en Bodega' :
                      watch('deliveryMethod') === 'envio_nacional' ? 'Envío Nacional' :
                      'Domicilio en Ciudad'
                    }</div>
                    <div><strong>Pago:</strong> {
                      watch('paymentMethod') === 'efectivo' ? 'Efectivo' :
                      watch('paymentMethod') === 'transferencia' ? 'Transferencia' :
                      watch('paymentMethod') === 'tarjeta_credito' ? 'Tarjeta de Crédito' :
                      'Pago Electrónico'
                    }</div>
                    <div><strong>Items:</strong> {watchedItems.filter(item => item.name).length}</div>
                    <div><strong>Total:</strong> ${calculateTotal().toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="card">
              <div className="card-content">
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn btn-primary"
                  >
                    {loading ? (
                      <>
                        <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creando Pedido...
                      </>
                    ) : (
                      <>
                        <Icons.Save className="w-4 h-4 mr-2" />
                        Crear Pedido
                      </>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => navigate('/orders')}
                    className="w-full btn btn-secondary"
                  >
                    <Icons.X className="w-4 h-4 mr-2" />
                    Cancelar
                  </button>
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    <strong>Nota:</strong> Una vez creado, el pedido será enviado a cartera para análisis y verificación.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateOrderPage;
