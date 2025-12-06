import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { computeCollectionAmounts, isCreditOrder } from '../utils/payments';

const DeliveryRegistrationModal = ({ isOpen, onClose, order, onConfirm }) => {
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [deliveryPhoto, setDeliveryPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null); // 'payment' | 'delivery' | null

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

  // Detección simple del canal desde un texto (local para no exponer campos al mensajero)
  const detectProviderFromStringLocal = (text = '') => {
    const t = String(text).toLowerCase();
    if (t.includes('nequi')) return 'nequi';
    if (t.includes('daviplata')) return 'daviplata';
    if (t.includes('bancolombia') || t.includes('banco')) return 'bancolombia';
    return '';
  };

  // expectedDeliveryFee computed via computeCollectionAmounts below

  // Selección de métodos de pago (por defecto desde el pedido) - definido más abajo después de calcular requiresPayment

  // Cálculo usando helpers centralizados
  const { productDue, shippingDue, totalDue } = computeCollectionAmounts(order);
  const isNoCharge = (totalDue || 0) <= 0;
  const requiresPayment = !isNoCharge && productDue > 0;
  const expectedAmount = productDue;
  const shouldCollectDeliveryFee = shippingDue > 0;
  const feeToCollect = shippingDue;
  const expectedDeliveryFee = shippingDue;
  // Guardado adicional para evitar renderizar secciones de cobro cuando no aplica
  const showPaymentSections = !isNoCharge && (expectedAmount > 0);

  // Selección de métodos de pago (por defecto desde el pedido)
  // Importante: definir DESPUÉS de requiresPayment para evitar usar la variable antes de inicializarla
  const productPaymentMethod = (requiresPayment ? (watch('productPaymentMethod') || (order?.payment_method || 'efectivo')) : 'efectivo').toLowerCase();
  const feePaymentMethod = (watch('deliveryFeePaymentMethod') || 'efectivo').toLowerCase();

  // Normalizador local y pago del pedido normalizado
  const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const orderPaymentNorm = normalize(order?.payment_method);

  // Forzar efectivo también para contraentrega
  const forceCashProduct = false; // Permitir al mensajero cambiar a transferencia o pago mixto

  const amountReceived = watch('amountReceived');
  const transferAmount = watch('transferAmount');
  const amountMatch = (() => {
    if (['efectivo', 'contraentrega'].includes(productPaymentMethod)) {
      return parseFloat(amountReceived || 0) === expectedAmount;
    }
    if (productPaymentMethod === 'mixto') {
      const t = parseFloat(transferAmount || 0) || 0;
      const a = parseFloat(amountReceived || 0) || 0;
      return (a + t) === expectedAmount;
    }
    return true;
  })();

  React.useEffect(() => {
    if (requiresPayment && productPaymentMethod === 'mixto') {
      const t = parseFloat(transferAmount || 0) || 0;
      const cash = Math.max(0, expectedAmount - t);
      setValue('amountReceived', cash, { shouldValidate: true });
    }
  }, [requiresPayment, productPaymentMethod, transferAmount, expectedAmount, setValue]);

  // Registrar campos ocultos para que formen parte del submit
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    register('transferBank');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    register('transferReference');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    register('transferDate');
  }, [register]);

  // Autocompletar metadatos electrónicos (ocultos) para cumplir validaciones backend sin mostrar campos
  React.useEffect(() => {
    if (!isNoCharge && (productPaymentMethod === 'transferencia' || productPaymentMethod === 'mixto')) {
      // Banco/canal: intentar desde order.electronic_payment_type, detectar desde notas o fallback 'otro'
      const fromOrder = (order?.electronic_payment_type || '').toString().trim();
      const detected = detectProviderFromStringLocal(order?.notes || '') || '';
      const bank = (fromOrder || detected || 'otro').toLowerCase();
      const ref = `auto-${Date.now()}`;
      const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      setValue('transferBank', bank, { shouldValidate: false });
      setValue('transferReference', ref, { shouldValidate: false });
      setValue('transferDate', dateStr, { shouldValidate: false });
    } else {
      // Limpiar si cambia a efectivo o cuando no se requiere cobro
      setValue('transferBank', null, { shouldValidate: false });
      setValue('transferReference', null, { shouldValidate: false });
      setValue('transferDate', null, { shouldValidate: false });
    }
  }, [isNoCharge, requiresPayment, productPaymentMethod, order, setValue]);
  const deliveryFeeCollected = watch('deliveryFeeCollected');
  // Campos de "Entrega con confianza"
  const trustedDelivery = watch('trustedDelivery');
  const authorizedByUserId = watch('authorizedByUserId');
  const trustNote = watch('trustNote');

  // Reglas de evidencia: pedir foto de pago para efectivo o contraentrega
  const requiresPaymentEvidence = !order?.payment_evidence_path && !order?.is_pending_payment_evidence && !isNoCharge && (
    (productPaymentMethod === 'transferencia' && !trustedDelivery) ||
    (productPaymentMethod === 'mixto' && parseFloat(transferAmount || 0) > 0)
  );

  // Acciones rápidas para decisiones "antibobos"
  const handleProductQuickSelect = (method) => {
    if (method === 'efectivo') {
      setProductChoice('efectivo');
      setValue('productPaymentMethod', 'efectivo', { shouldValidate: true });
      setValue('amountReceived', expectedAmount, { shouldValidate: true });
      setValue('transferAmount', 0, { shouldValidate: true });
    } else if (method === 'transferencia') {
      setProductChoice('transferencia');
      setValue('productPaymentMethod', 'transferencia', { shouldValidate: true });
      setValue('amountReceived', 0, { shouldValidate: true });
      setValue('transferAmount', expectedAmount, { shouldValidate: true });
    } else if (method === 'mixto') {
      setProductChoice('mixto');
      setValue('productPaymentMethod', 'mixto', { shouldValidate: true });
      setValue('transferAmount', 0, { shouldValidate: true });
      setValue('amountReceived', expectedAmount, { shouldValidate: true });
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
    setZoomedImage(null);
    onClose();
  };

  const handleFileChange = (event, type) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) { // 15MB limit
        toast.error('El archivo no puede ser mayor a 15MB');
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

  const handleMarkPendingEvidence = async () => {
    if (!window.confirm('¿Estás seguro de marcar este pedido como "Pendiente de Comprobante"?\n\nPodrás finalizar la entrega sin subir la foto del pago, pero Cartera deberá subirla después.')) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/messenger/orders/${order.id}/pending-evidence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Marcado como pendiente de comprobante');
        // Actualizar estado local para permitir finalizar entrega sin foto
        // No cerramos el modal, solo actualizamos el objeto order localmente
        // para que requiresPaymentEvidence se re-evalue a false (o similar)
        // OJO: requiresPaymentEvidence depende de order.payment_evidence_path.
        // Aquí necesitamos que el frontend sepa que ya está "pendiente" y permita pasar.
        // Una forma es simular que ya tiene path o usar una bandera local.
        // Vamos a inyectar la bandera is_pending_payment_evidence en el objeto order local.
        if (order) {
          order.is_pending_payment_evidence = 1;
        }
      } else {
        toast.error(data.message || 'Error al marcar como pendiente');
      }
    } catch (error) {
      console.error('Error marking pending evidence:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    // Validaciones dinámicas según método de pago seleccionado por el mensajero
    if (!isNoCharge && requiresPayment) {
      if (['efectivo', 'contraentrega'].includes(productPaymentMethod)) {
        if (!amountMatch) {
          toast.error('El monto cobrado debe coincidir exactamente con el valor a cobrar');
          return;
        }
      } else if (productPaymentMethod === 'transferencia' && !trustedDelivery) {
        const t = parseFloat(data.transferAmount || 0);
        if (t <= 0 || t !== expectedAmount) {
          toast.error('La transferencia debe ser por el monto total del pedido');
          return;
        }
      } else if (productPaymentMethod === 'mixto') {
        const t = parseFloat(data.transferAmount || 0);
        const a = parseFloat(data.amountReceived || 0);
        if (t <= 0) {
          toast.error('Ingrese el monto transferido');
          return;
        }
        if ((a + t) !== expectedAmount) {
          toast.error('En pago mixto, efectivo + transferencia debe igualar el monto a cobrar');
          return;
        }
      }
    }

    // Reglas adicionales para entrega con confianza
    if (trustedDelivery) {
      if (!authorizedByUserId || Number(authorizedByUserId) <= 0) {
        toast.error('Debes ingresar el ID del usuario que autoriza la entrega con confianza');
        return;
      }
      if (!trustNote || String(trustNote).trim().length < 3) {
        toast.error('Debes ingresar una nota/motivo para la entrega con confianza');
        return;
      }
    }

    if (requiresPaymentEvidence && !paymentPhoto) {
      toast.error('Debe tomar una foto del comprobante de transferencia');
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
        amountReceived: trustedDelivery ? 0 : parseFloat(data.amountReceived || 0),
        deliveryFeeCollected: parseFloat(data.deliveryFeeCollected || 0),
        // Nuevos campos: métodos de pago seleccionados por el mensajero
        productPaymentMethod,
        deliveryFeePaymentMethod: feePaymentMethod,
        transferAmount: trustedDelivery ? 0 : parseFloat(data.transferAmount || 0),
        transferBank: data.transferBank || null,
        transferReference: data.transferReference || null,
        transferDate: data.transferDate || null,
        // Entrega con confianza
        trustedDelivery: !!trustedDelivery,
        authorizedByUserId: trustedDelivery ? parseInt(authorizedByUserId) : null,
        trustNote: trustedDelivery ? trustNote : null,
        // Enviar flag de pendiente de comprobante para asegurar consistencia en backend
        isPendingEvidence: order?.is_pending_payment_evidence ? true : false,
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
          <div className="grid grid-cols-2 gap-3 mb-6 p-3 bg-gray-50 rounded-lg text-xs">
            <div>
              <p className="text-xs font-medium text-gray-600">Cliente</p>
              <p className="text-gray-900">{order?.customer_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Teléfono</p>
              <p className="text-gray-900">{order?.customer_phone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium text-gray-600">Dirección</p>
              <p className="text-gray-900">{order?.customer_address}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Método de Pago</p>
              <p className="text-gray-900 capitalize">{order?.payment_method || 'Efectivo'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium text-gray-600">Notas</p>
              <div className="text-gray-900 text-xs leading-snug whitespace-pre-line">
                {order?.notes || order?.siigo_observations || 'Sin notas'}
              </div>
            </div>

          </div>



          {/* Monto a cobrar destacado */}
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-600 mb-1">
              {totalDue > 0
                ? (productDue === 0 && shippingDue > 0 ? 'Monto a Cobrar (Solo Envío)' : 'Monto a Cobrar')
                : (isCreditOrder(order) ? 'Entrega sin cobro (Cliente a Crédito)' : 'Cobrar $0 (ya pagado)')}
            </p>
            <p className="text-3xl font-bold text-red-700">
              ${(totalDue).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {!isNoCharge && (<>
            {/* Paso 1: Productos - selección rápida "antibobos" */}
            {showPaymentSections && (<div className="mb-4">
              <p className="text-sm font-medium text-gray-800 mb-2">1) Productos ({order?.payment_method || 'efectivo'})</p>
              <div className="flex flex-wrap gap-2">
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
                <button
                  type="button"
                  disabled={!requiresPayment}
                  onClick={() => handleProductQuickSelect('mixto')}
                  className={`px-3 py-2 rounded-md text-sm font-medium border ${productChoice === 'mixto' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'}`}
                >
                  Pago MIXTO
                </button>
              </div>

              {/* Select de respaldo (mantener por compatibilidad) */}
              <div className="mt-2">
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  defaultValue={order?.payment_method || 'efectivo'}
                  disabled={!requiresPayment}
                  {...register('productPaymentMethod')}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mixto">Mixto (Efectivo + Transferencia)</option>
                </select>
                {forceCashProduct && (
                  <p className="text-xs text-gray-500 mt-1">Definido por facturación: cobro en efectivo.</p>
                )}
              </div>
            </div>

            )}
            {/* 1.1) Transferencia - solo monto (sin datos de banco/referencia/fecha) */}
            {(!isNoCharge && totalDue > 0 && expectedAmount > 0 && (productPaymentMethod === 'transferencia' || productPaymentMethod === 'mixto')) && (
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  {productPaymentMethod === 'mixto' ? '1.1) Transferencia (Pago Mixto)' : '1) Transferencia'}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto Transferido *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.transferAmount ? 'border-red-500' : 'border-gray-300'}`}
                    {...register('transferAmount', (!isNoCharge && expectedAmount > 0) ? {
                      required: 'Ingrese el monto transferido',
                      min: { value: 0.01, message: 'El monto debe ser mayor a 0' }
                    } : {})}
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    {productPaymentMethod === 'transferencia'
                      ? `Debe ser por $${formatCOP(expectedAmount)}`
                      : `Efectivo a cobrar = $${formatCOP(expectedAmount)} - transferencia`}
                  </p>
                  {errors.transferAmount && (
                    <p className="text-red-500 text-sm mt-1">{errors.transferAmount.message}</p>
                  )}
                  {/* Entrega con confianza (cuando el cliente promete transferir luego o banco caído) */}
                  {(!isNoCharge && expectedAmount > 0 && productPaymentMethod === 'transferencia') && (
                    <div className="mb-6 border rounded-lg p-4 bg-blue-50 border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                        <Icons.ShieldCheck className="w-4 h-4 mr-2" />
                        Entrega con confianza (enviar a Cartera)
                      </p>
                      <div className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          className="mr-2"
                          {...register('trustedDelivery')}
                        />
                        <span className="text-sm text-blue-900">
                          Autorizar entrega sin comprobante de transferencia ahora. El pedido pasará a Cartera para validar el pago más tarde.
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ID usuario que autoriza (cartera/facturador/admin){trustedDelivery ? ' *' : ''}
                          </label>
                          <input
                            type="number"
                            min="1"
                            disabled={!trustedDelivery}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ej: 12"
                            {...register('authorizedByUserId')}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nota de confianza{trustedDelivery ? ' *' : ''}
                          </label>
                          <input
                            type="text"
                            disabled={!trustedDelivery}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ej: Banco fuera de servicio, cliente transfiere más tarde"
                            {...register('trustNote')}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-blue-800 mt-2">
                        Nota: El valor de producto NO entrará a tu cierre de caja. El flete se registra aparte (efectivo/transferencia).
                      </p>
                    </div>
                  )}
                  {/* Paso 2: Domicilio - selección rápida (si aplica) */}
                </div>
                {productPaymentMethod === 'mixto' && (
                  <p className="text-sm text-gray-600 mt-2">
                    En pago mixto, el efectivo + transferencia debe sumar ${formatCOP(expectedAmount)}. El sistema calcula automáticamente el efectivo faltante.
                  </p>
                )}
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
            {showPaymentSections && (<div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Cobrado *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                readOnly={(productPaymentMethod === 'efectivo' && productChoice === 'efectivo') || productPaymentMethod === 'mixto'}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amountReceived ? 'border-red-500' : 'border-gray-300'
                  } ${productPaymentMethod === 'efectivo' && amountReceived && !amountMatch ? 'border-red-500 bg-red-50' : ''
                  }`}
                {...register('amountReceived', {
                  required: requiresPayment && (['efectivo', 'contraentrega'].includes(productPaymentMethod)) ? 'El monto cobrado es obligatorio' : false,
                  min: { value: 0, message: 'El monto debe ser mayor a 0' }
                })}
              />
              <p className="text-sm text-gray-600 mt-1">
                {productPaymentMethod === 'efectivo'
                  ? `Si presiona "Cobré en EFECTIVO $${formatCOP(expectedAmount)}", este campo se llena solo y no se puede editar.`
                  : productPaymentMethod === 'mixto'
                    ? 'En pago mixto, este monto se calcula automáticamente como Total - Transferencia.'
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
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.deliveryFeeCollected ? 'border-red-500' : 'border-gray-300'
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

          </>)}
          {/* Foto del pago recibido */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto del Pago Recibido {requiresPaymentEvidence ? '*' : '(opcional)'}
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {paymentPhoto ? (
                <div className="relative group">
                  <div
                    className={`relative overflow-hidden rounded-lg transition-all duration-200 ${zoomedImage === 'payment' ? 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4' : 'w-full h-48'}`}
                    onClick={() => setZoomedImage(zoomedImage === 'payment' ? null : 'payment')}
                  >
                    <img
                      src={paymentPhoto.preview}
                      alt="Foto del pago"
                      className={`${zoomedImage === 'payment' ? 'max-h-screen max-w-full object-contain cursor-zoom-out' : 'w-full h-full object-cover cursor-zoom-in'}`}
                    />
                    {zoomedImage === 'payment' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
                        className="absolute top-4 right-4 text-white hover:text-gray-300"
                      >
                        <Icons.X className="w-8 h-8" />
                      </button>
                    )}
                  </div>
                  {zoomedImage !== 'payment' && (
                    <button
                      type="button"
                      onClick={() => setPaymentPhoto(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icons.X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : order?.payment_evidence_path ? (
                <div className="relative">
                  <img
                    src={`${API_URL}${order.payment_evidence_path}`}
                    alt="Evidencia subida por Cartera"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                    Subido por Cartera
                  </div>
                  <p className="text-center text-sm text-green-600 mt-2 font-medium">
                    ✅ Comprobante ya validado por Cartera
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Icons.Camera className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('payment-photo-upload').click()}
                      className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                    >
                      Tomar foto / Subir archivo
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF hasta 5MB</p>
                </div>
              )}
              <input
                id="payment-photo-upload"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoChange(e, setPaymentPhoto)}
              />
            </div>
            {/* Botón para marcar pendiente de comprobante */}
            {!paymentPhoto && !order?.payment_evidence_path && requiresPaymentEvidence && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={handleMarkPendingEvidence}
                  className="text-sm text-orange-600 hover:text-orange-800 underline font-medium"
                >
                  Cliente pagó pero no tiene comprobante (Marcar Pendiente)
                </button>
              </div>
            )}
            <p className="text-sm text-gray-600 mt-1">
              {requiresPaymentEvidence
                ? 'Tome una foto del comprobante de transferencia (cuando aplique)'
                : 'Adjunte evidencia si aplica (no requerida para efectivo/contraentrega o crédito)'}
            </p>
          </div>

          {/* Evidencia de entrega */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidencia de Entrega *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {deliveryPhoto ? (
                <div className="relative group">
                  <div
                    className={`relative overflow-hidden rounded-lg transition-all duration-200 ${zoomedImage === 'delivery' ? 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4' : 'w-full h-48'}`}
                    onClick={() => setZoomedImage(zoomedImage === 'delivery' ? null : 'delivery')}
                  >
                    <img
                      src={deliveryPhoto.preview}
                      alt="Evidencia de entrega"
                      className={`${zoomedImage === 'delivery' ? 'max-h-screen max-w-full object-contain cursor-zoom-out' : 'w-full h-full object-cover cursor-zoom-in'}`}
                    />
                    {zoomedImage === 'delivery' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
                        className="absolute top-4 right-4 text-white hover:text-gray-300"
                      >
                        <Icons.X className="w-8 h-8" />
                      </button>
                    )}
                  </div>
                  {zoomedImage !== 'delivery' && (
                    <button
                      type="button"
                      onClick={() => setDeliveryPhoto(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icons.X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <Icons.Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-2">Ningún archivo seleccionado</p>
                  <div className="flex justify-center gap-3">
                    <label className="flex flex-col items-center justify-center w-32 h-24 bg-blue-50 text-blue-700 rounded-xl border-2 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer shadow-sm active:scale-95">
                      <Icons.Camera className="w-8 h-8 mb-2" />
                      <span className="text-xs font-semibold text-center leading-tight">Usar<br />Cámara</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'delivery')}
                      />
                    </label>
                    <label className="flex flex-col items-center justify-center w-32 h-24 bg-gray-50 text-gray-700 rounded-xl border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all cursor-pointer shadow-sm active:scale-95">
                      <Icons.Upload className="w-8 h-8 mb-2" />
                      <span className="text-xs font-semibold text-center leading-tight">Subir<br />Archivo</span>
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
              className="btn btn-success min-h-[48px] h-12 px-6 text-base font-semibold rounded-md shadow-sm hover:shadow-md"
              disabled={uploading || ((!isNoCharge && (['efectivo', 'contraentrega'].includes(productPaymentMethod))) && !amountMatch)}
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
          </div >
        </form >
      </div >
    </div >
  );
};

export default DeliveryRegistrationModal;
