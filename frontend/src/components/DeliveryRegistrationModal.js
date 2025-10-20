import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const DeliveryRegistrationModal = ({ isOpen, onClose, order, onConfirm }) => {
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [deliveryPhoto, setDeliveryPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setValue
  } = useForm();

  // Estados "antibobos" para decisiones rápidas
  const [productChoice, setProductChoice] = useState(null); // 'efectivo' | 'transferencia' | null
  const [feeChoice, setFeeChoice] = useState(null); // 'efectivo' | 'transferencia' | null

  // Helper para obtener el monto correcto según el endpoint usado
  const getOrderAmount = (order) => {
    // Para mensajeros, el campo se llama 'total'
    return parseFloat(order?.total || order?.total_amount || 0);
  };

  const formatCOP = (n) =>
    (Number(n || 0)).toLocaleString('es-CO', { minimumFractionDigits: 0 });

  const expectedDeliveryFee = Number(order?.delivery_fee || 0);

  // Selección de métodos de pago (por defecto desde el pedido)
  const productPaymentMethod = (watch('productPaymentMethod') || (order?.payment_method || 'efectivo')).toLowerCase();
  const feePaymentMethod = (watch('deliveryFeePaymentMethod') || 'efectivo').toLowerCase();

  // Cálculo robusto del valor a cobrar por productos y si requiere pago
  const total = Number(order?.total_amount ?? order?.total ?? 0);
  const paidAmount = Number(order?.paid_amount ?? order?.amount_paid ?? 0);
  const baseProductAmountRaw = Number(order?.payment_amount ?? order?.siigo_balance ?? 0);
  const baseProductAmount = baseProductAmountRaw > 0 ? baseProductAmountRaw : total;
  const productAmount = Math.max(0, baseProductAmount - paidAmount);
  const requiresPayment =
    productAmount > 0 ||
    order?.requires_payment === true ||
    order?.requires_payment === 1 ||
    order?.requires_payment === '1' ||
    (order?.payment_method || '').toLowerCase().includes('contra') ||
    ['contraentrega', 'por_cobrar'].includes((order?.shipping_payment_method || '').toLowerCase());

  const forceCashProduct = requiresPayment && ((order?.payment_method || '').toLowerCase() === 'efectivo');

  const amountReceived = watch('amountReceived');
  const expectedAmount = productAmount;
  const amountMatch = productPaymentMethod === 'efectivo' ? parseFloat(amountReceived || 0) === expectedAmount : true;
  const shippingPay = (order?.shipping_payment_method || '').toLowerCase();
  const deliveryExempt = order?.delivery_fee_exempt === true || order?.delivery_fee_exempt === 1 || order?.delivery_fee_exempt === '1';

  // Reglas para cobro de domicilio
  const FREE_SHIPPING_THRESHOLD = 150000;
  const qualifiesFreeShipping = total >= FREE_SHIPPING_THRESHOLD;
  const shippingAlreadyPaid = ['contado', 'paid', 'pagado'].includes(shippingPay);
  const shouldCollectDeliveryFee = !shippingAlreadyPaid && !qualifiesFreeShipping && !deliveryExempt && (['contraentrega', 'por_cobrar'].includes(shippingPay) || Boolean(order?.should_collect_delivery_fee));

  const feeToCollect = shouldCollectDeliveryFee ? Number(order?.delivery_fee || 0) : 0;
  const deliveryFeeCollected = watch('deliveryFeeCollected');

  // Acciones rápidas para decisiones "antibobos"
  const handleProductQuickSelect = (method) => {
    if (method === 'efectivo') {
      setProductChoice('efectivo');
      setValue('productPaymentMethod', 'efectivo', { shouldValidate: true });
      setValue('amountReceived', expectedAmount, { shouldValidate: true });
    } else {
      setProductChoice('transferencia');
      setValue('productPaymentMethod', 'transferencia', { shouldValidate: true });
      setValue('amountReceived', 0, { shouldValidate: true });
    }
  };

  const handleFeeQuickSelect = (method) => {
    if (!shouldCollectDeliveryFee) return;
    if (method === 'efectivo') {
      setFeeChoice('efectivo');
      setValue('deliveryFeePaymentMethod', 'efectivo', { shouldValidate: true });
      setValue('deliveryFeeCollected', expectedDeliveryFee, { shouldValidate: true });
    } else {
      setFeeChoice('transferencia');
      setValue('deliveryFeePaymentMethod', 'transferencia', { shouldValidate: true });
      setValue('deliveryFeeCollected', 0, { shouldValidate: true });
    }
  };

  const handleClose = () => {
    reset();
    setPaymentPhoto(null);
    setDeliveryPhoto(null);
    onClose();
  };

  const handleFileChange = (event, type) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('El archivo no puede ser mayor a 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (type === 'payment') {
          setPaymentPhoto({
            file,
            preview: e.target.result
          });
        } else {
          setDeliveryPhoto({
            file,
            preview: e.target.result
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data) => {
    // Validaciones dinámicas según método de pago seleccionado por el mensajero
    if (requiresPayment && productPaymentMethod === 'efectivo' && !amountMatch) {
      toast.error('El monto cobrado debe coincidir exactamente con el valor a cobrar');
      return;
    }

    if (requiresPayment && productPaymentMethod === 'efectivo' && !paymentPhoto) {
      toast.error('Debe tomar una foto del efectivo recibido');
      return;
    }

    if (!deliveryPhoto) {
      toast.error('Debe tomar una foto como evidencia de entrega');
      return;
    }

    if (shouldCollectDeliveryFee && feePaymentMethod === 'efectivo' && (!data.deliveryFeeCollected || parseFloat(data.deliveryFeeCollected) <= 0)) {
      toast.error('Debe ingresar el valor del domicilio cobrado');
      return;
    }

    setUploading(true);
    try {
      const deliveryData = {
        orderId: order.id,
        amountReceived: parseFloat(data.amountReceived || 0),
        deliveryFeeCollected: parseFloat(data.deliveryFeeCollected || 0),
        // Nuevos campos: métodos de pago seleccionados por el mensajero
        productPaymentMethod,
        deliveryFeePaymentMethod: feePaymentMethod,
        paymentPhoto: paymentPhoto?.file,
        deliveryPhoto: deliveryPhoto?.file,
        notes: data.notes
      };

      await onConfirm(deliveryData);
      handleClose();
      toast.success('Entrega registrada exitosamente');
    } catch (error) {
      console.error('Error registrando entrega:', error);
      toast.error('Error al registrar la entrega');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Registrar Entrega - {order?.order_number}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {/* Información del pedido */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-600">Cliente</p>
              <p className="text-gray-900">{order?.customer_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Teléfono</p>
              <p className="text-gray-900">{order?.customer_phone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-medium text-gray-600">Dirección</p>
              <p className="text-gray-900">{order?.customer_address}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Método de Pago</p>
              <p className="text-gray-900 capitalize">{order?.payment_method || 'Efectivo'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Notas</p>
              <p className="text-gray-900">{order?.notes || 'Sin notas'}</p>
            </div>
          </div>

          {/* Monto a cobrar destacado */}
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-600 mb-1">Monto a Cobrar</p>
            <p className="text-3xl font-bold text-red-700">
              ${(expectedAmount + feeToCollect).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Paso 1: Productos - selección rápida "antibobos" */}
          {requiresPayment && (<div className="mb-4">
            <p className="text-sm font-medium text-gray-800 mb-2">1) Productos ({order?.payment_method || 'efectivo'})</p>
            <div className="flex flex-wrap gap-2">
              {forceCashProduct ? (
                <button
                  type="button"
                  disabled={!requiresPayment}
                  onClick={() => handleProductQuickSelect('efectivo')}
                  className={`px-3 py-2 rounded-md text-sm font-medium border ${productChoice === 'efectivo' ? 'bg-green-600 text-white border-green-600' : 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100'}`}
                >
                  Cobré en EFECTIVO ${formatCOP(expectedAmount)}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!requiresPayment}
                    onClick={() => handleProductQuickSelect('efectivo')}
                    className={`px-3 py-2 rounded-md text-sm font-medium border ${productChoice === 'efectivo' ? 'bg-green-600 text-white border-green-600' : 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100'}`}
                  >
                    Cobré en EFECTIVO ${formatCOP(expectedAmount)}
                  </button>
                  <button
                    type="button"
                    disabled={!requiresPayment}
                    onClick={() => handleProductQuickSelect('transferencia')}
                    className={`px-3 py-2 rounded-md text-sm font-medium border ${productChoice === 'transferencia' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'}`}
                  >
                    Pagó por TRANSFERENCIA
                  </button>
                </>
              )}
            </div>

            {/* Select de respaldo (mantener por compatibilidad) */}
            <div className="mt-2">
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                defaultValue={order?.payment_method || 'efectivo'}
                disabled={forceCashProduct || !requiresPayment}
                {...register('productPaymentMethod')}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
              {forceCashProduct && (
                <p className="text-xs text-gray-500 mt-1">Definido por facturación: cobro en efectivo.</p>
              )}
            </div>
          </div>

          )}
          {/* Paso 2: Domicilio - selección rápida (si aplica) */}
          {shouldCollectDeliveryFee && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-800 mb-2">
                2) Domicilio {expectedDeliveryFee ? `(valor: $${formatCOP(expectedDeliveryFee)})` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleFeeQuickSelect('efectivo')}
                  className={`px-3 py-2 rounded-md text-sm font-medium border ${feeChoice === 'efectivo' ? 'bg-orange-600 text-white border-orange-600' : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'}`}
                >
                  Cobré DOMICILIO en EFECTIVO ${formatCOP(expectedDeliveryFee)}
                </button>
                <button
                  type="button"
                  onClick={() => handleFeeQuickSelect('transferencia')}
                  className={`px-3 py-2 rounded-md text-sm font-medium border ${feeChoice === 'transferencia' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'}`}
                >
                  Domicilio por TRANSFERENCIA
                </button>
              </div>

              {/* Select de respaldo (compatibilidad) */}
              <div className="mt-2">
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  defaultValue="efectivo"
                  {...register('deliveryFeePaymentMethod')}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
            </div>
          )}

          {/* Input monto cobrado (se autocompleta con decisiones rápidas) */}
          {requiresPayment && (<div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto Cobrado *
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              readOnly={productPaymentMethod === 'efectivo' && productChoice === 'efectivo'}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.amountReceived ? 'border-red-500' : 'border-gray-300'
              } ${
                productPaymentMethod === 'efectivo' && amountReceived && !amountMatch ? 'border-red-500 bg-red-50' : ''
              }`}
              {...register('amountReceived', {
                required: requiresPayment && productPaymentMethod === 'efectivo' ? 'El monto cobrado es obligatorio' : false,
                min: { value: 0, message: 'El monto debe ser mayor a 0' }
              })}
            />
            <p className="text-sm text-gray-600 mt-1">
              {productPaymentMethod === 'efectivo'
                ? `Si presiona "Cobré en EFECTIVO $${formatCOP(expectedAmount)}", este campo se llena solo y no se puede editar.`
                : 'Si el cliente paga por transferencia, deje este valor en 0.'}
            </p>
            {errors.amountReceived && (
              <p className="text-red-500 text-sm mt-1">{errors.amountReceived.message}</p>
            )}
            {productPaymentMethod === 'efectivo' && amountReceived && !amountMatch && (
              <p className="text-red-500 text-sm mt-1">
                El monto no coincide con el valor a cobrar
              </p>
            )}
          </div>

          )}
          {/* Valor del domicilio (si aplica) */}
          {shouldCollectDeliveryFee && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor del Domicilio *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                defaultValue={order?.delivery_fee || ''}
                readOnly={feePaymentMethod === 'efectivo' && feeChoice === 'efectivo'}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.deliveryFeeCollected ? 'border-red-500' : 'border-gray-300'
                }`}
                {...register('deliveryFeeCollected', {
                  required: feePaymentMethod === 'efectivo' ? 'El valor del domicilio es obligatorio' : false,
                  ...(feePaymentMethod === 'efectivo' ? { min: { value: 0.01, message: 'El valor debe ser mayor a 0' } } : {})
                })}
              />
              <p className="text-sm text-gray-600 mt-1">
                {feePaymentMethod === 'efectivo'
                  ? `Presione "Cobré DOMICILIO en EFECTIVO $${formatCOP(expectedDeliveryFee)}" para autocompletar este valor.`
                  : 'El cliente pagará el domicilio por transferencia (no ingrese valor).'}
              </p>
              {errors.deliveryFeeCollected && (
                <p className="text-red-500 text-sm mt-1">{errors.deliveryFeeCollected.message}</p>
              )}
            </div>
          )}

          {/* Foto del pago recibido */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto del Pago Recibido {requiresPayment && productPaymentMethod === 'efectivo' ? '*' : '(opcional si es transferencia)'}
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {paymentPhoto ? (
                <div className="relative">
                  <img
                    src={paymentPhoto.preview}
                    alt="Foto del pago"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentPhoto(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <Icons.Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-2">Ningún archivo seleccionado</p>
                  <div className="flex justify-center space-x-2">
                    <label className="btn btn-primary cursor-pointer">
                      <Icons.Camera className="w-4 h-4 mr-2" />
                      Foto del Efectivo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'payment')}
                      />
                    </label>
                    <label className="btn btn-secondary cursor-pointer">
                      <Icons.Upload className="w-4 h-4 mr-2" />
                      Seleccionar archivo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'payment')}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {productPaymentMethod === 'efectivo'
                ? 'Tome una foto del dinero en efectivo recibido del cliente'
                : 'Adjunte evidencia si el cliente pagó en efectivo (opcional para transferencias)'}
            </p>
          </div>

          {/* Evidencia de entrega */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidencia de Entrega *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {deliveryPhoto ? (
                <div className="relative">
                  <img
                    src={deliveryPhoto.preview}
                    alt="Evidencia de entrega"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setDeliveryPhoto(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <Icons.Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-2">Ningún archivo seleccionado</p>
                  <div className="flex justify-center space-x-2">
                    <label className="btn btn-primary cursor-pointer">
                      <Icons.Camera className="w-4 h-4 mr-2" />
                      Usar Cámara
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'delivery')}
                      />
                    </label>
                    <label className="btn btn-secondary cursor-pointer">
                      <Icons.Upload className="w-4 h-4 mr-2" />
                      Seleccionar archivo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'delivery')}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Tome una foto o adjunte una imagen como evidencia de entrega
            </p>
          </div>

          {/* Notas adicionales */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas Adicionales
            </label>
            <textarea
              rows={3}
              placeholder="Observaciones sobre la entrega..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('notes')}
            />
          </div>

          {/* Panel recordatorio */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Recordatorio:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Debe registrar el monto exacto recibido del cliente cuando el método sea efectivo</li>
              <li>• Debe tomar una foto como evidencia de entrega</li>
              <li>• Verifique que el monto cobrado coincida con el valor a cobrar</li>
            </ul>
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={uploading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={uploading || (productPaymentMethod === 'efectivo' && !amountMatch)}
            >
              {uploading ? (
                <>
                  <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Icons.Check className="w-4 h-4 mr-2" />
                  Confirmar Entrega
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryRegistrationModal;
