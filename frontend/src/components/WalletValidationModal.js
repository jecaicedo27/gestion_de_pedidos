import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { walletService } from '../services/api';

const WalletValidationModal = ({ isOpen, onClose, order, onValidate }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customerCredit, setCustomerCredit] = useState(null);
  const [loadingCredit, setLoadingCredit] = useState(false);
  
  // FUNCIONES DE TRADUCCIÓN UNIVERSALES
  const getPaymentMethodLabel = (method) => {
    const labels = {
      'efectivo': 'Efectivo',
      'transferencia': 'Transferencia',
      'tarjeta_credito': 'Tarjeta de Crédito',
      'cliente_credito': 'Cliente a Crédito'
    };
    return labels[method] || 'No Especificado';
  };

  const getDeliveryMethodLabel = (method) => {
    const labels = {
      'domicilio': 'Domicilio',
      'recogida_tienda': 'Recogida en Tienda',
      'envio_nacional': 'Envío Nacional'
    };
    return labels[method] || 'No Especificado';
  };

  const getShippingDateLabel = (order) => {
    if (order?.shipping_date) {
      // Crear fecha local sin problemas de zona horaria
      const dateParts = order.shipping_date.split('-');
      const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      return localDate.toLocaleDateString('es-CO');
    }
    if (order?.delivery_method === 'recogida_tienda') {
      return 'No aplica (recogida en tienda)';
    }
    return 'No especificada';
  };

  const formatAmount = (amount) => {
    const numAmount = parseFloat(amount || 0);
    return numAmount.toLocaleString('es-CO');
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
    
    // Para validación de crédito
    creditApproved: false,
    
    // Notas generales
    validationNotes: '',
    
    // Estado de validación
    validationType: 'approved' // 'approved' o 'rejected'
  });

  // Cargar información de crédito del cliente si el método de pago es cliente_credito
  useEffect(() => {
    if (order?.payment_method === 'cliente_credito' && order?.customer_name) {
      loadCustomerCredit();
    }
  }, [order]);

  const loadCustomerCredit = async () => {
    setLoadingCredit(true);
    try {
      const response = await fetch(`/api/wallet/customer-credit/${encodeURIComponent(order.customer_name)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomerCredit(data.data);
      } else {
        console.error('Error cargando información de crédito');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingCredit(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
    const { payment_method } = order;
    
    if (payment_method === 'transferencia') {
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
        
        // Validación de suma exacta SIN tolerancia para ser más estrictos
        if (totalPaid !== orderTotal) {
          const difference = orderTotal - totalPaid;
          if (difference > 0) {
            toast.error(
              `🚫 VALIDACIÓN FALLIDA: PAGO INSUFICIENTE\n\n` +
              `💰 Monto Transferido: $${transferredAmount.toLocaleString('es-CO')}\n` +
              `💵 Monto Efectivo: $${cashAmount.toLocaleString('es-CO')}\n` +
              `💸 Total Pagado: $${totalPaid.toLocaleString('es-CO')}\n` +
              `🎯 Total Requerido: $${orderTotal.toLocaleString('es-CO')}\n` +
              `❌ FALTANTE: $${difference.toLocaleString('es-CO')}\n\n` +
              `⚠️ IMPORTANTE: Los montos deben sumar EXACTAMENTE el total del pedido.\n` +
              `No se acepta ninguna diferencia.`,
              { duration: 8000 }
            );
          } else {
            const excess = Math.abs(difference);
            toast.error(
              `🚫 VALIDACIÓN FALLIDA: PAGO EXCESIVO\n\n` +
              `💰 Monto Transferido: $${transferredAmount.toLocaleString('es-CO')}\n` +
              `💵 Monto Efectivo: $${cashAmount.toLocaleString('es-CO')}\n` +
              `💸 Total Pagado: $${totalPaid.toLocaleString('es-CO')}\n` +
              `🎯 Total Requerido: $${orderTotal.toLocaleString('es-CO')}\n` +
              `❌ EXCESO: $${excess.toLocaleString('es-CO')}\n\n` +
              `⚠️ IMPORTANTE: Los montos deben sumar EXACTAMENTE el total del pedido.\n` +
              `No se acepta ninguna diferencia.`,
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
        
        if (!formData.cashProofImage) {
          toast.error('❌ COMPROBANTE FALTANTE: Debe subir el comprobante de efectivo');
          return false;
        }
        
        // Validación de datos de transferencia
        if (!formData.paymentReference.trim()) {
          toast.error('❌ REFERENCIA FALTANTE: Debe ingresar la referencia de la transferencia');
          return false;
        }
        
        if (!formData.bankName.trim()) {
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
        
        // Validación de monto exacto SIN tolerancia para ser más estrictos
        if (paymentAmount !== orderTotal) {
          const difference = orderTotal - paymentAmount;
          if (difference > 0) {
            toast.error(
              `🚫 VALIDACIÓN FALLIDA: TRANSFERENCIA INSUFICIENTE\n\n` +
              `💰 Monto Transferido: $${paymentAmount.toLocaleString('es-CO')}\n` +
              `🎯 Total Requerido: $${orderTotal.toLocaleString('es-CO')}\n` +
              `❌ FALTANTE: $${difference.toLocaleString('es-CO')}\n\n` +
              `⚠️ CRÍTICO: El monto transferido debe ser EXACTAMENTE igual al total del pedido.\n` +
              `Verifique el monto y vuelva a ingresarlo correctamente.`,
              { duration: 7000 }
            );
          } else {
            const excess = Math.abs(difference);
            toast.error(
              `🚫 VALIDACIÓN FALLIDA: TRANSFERENCIA EXCESIVA\n\n` +
              `💰 Monto Transferido: $${paymentAmount.toLocaleString('es-CO')}\n` +
              `🎯 Total Requerido: $${orderTotal.toLocaleString('es-CO')}\n` +
              `❌ EXCESO: $${excess.toLocaleString('es-CO')}\n\n` +
              `⚠️ CRÍTICO: El monto transferido debe ser EXACTAMENTE igual al total del pedido.\n` +
              `Verifique el monto y vuelva a ingresarlo correctamente.`,
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
        
        if (!formData.paymentReference.trim()) {
          toast.error('❌ REFERENCIA FALTANTE: Debe ingresar la referencia de la transferencia');
          return false;
        }
        
        if (!formData.bankName.trim()) {
          toast.error('❌ BANCO FALTANTE: Debe seleccionar el banco de origen');
          return false;
        }
      }
    }
    
    if (payment_method === 'efectivo') {
      if (!formData.paymentProofImage) {
        toast.error('Debe subir la imagen del pago en efectivo');
        return false;
      }
    }
    
    if (payment_method === 'cliente_credito') {
      if (!customerCredit) {
        toast.error('No se pudo cargar la información de crédito del cliente');
        return false;
      }
      
      // REMOVIDA LA VALIDACIÓN AUTOMÁTICA DEL CUPO
      // La persona de cartera tiene la decisión final
      const orderAmount = parseFloat(order.total_amount || 0);
      const availableCredit = customerCredit.available_credit;
      
      if (orderAmount > availableCredit) {
        // Solo advertir, no bloquear - la decisión es de cartera
        toast(`⚠️ AVISO: El pedido ($${orderAmount.toLocaleString()}) excede el cupo disponible ($${availableCredit.toLocaleString()}). Usted tiene la decisión final.`, {
          duration: 4000,
          icon: '⚠️',
          style: {
            background: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #F59E0B'
          }
        });
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
    
    // Datos básicos
    formDataToSend.append('orderId', order.id);
    formDataToSend.append('paymentMethod', order.payment_method);
    formDataToSend.append('validationType', validationType);
    formDataToSend.append('validationNotes', formData.validationNotes);
    
    // Solo agregar datos de pago si es aprobación
    if (validationType === 'approved') {
      // Para transferencias
      if (order.payment_method === 'transferencia') {
        formDataToSend.append('paymentType', formData.paymentType);
        
        if (formData.paymentType === 'mixed') {
          // Pago mixto
          formDataToSend.append('transferredAmount', formData.transferredAmount);
          formDataToSend.append('cashAmount', formData.cashAmount);
          
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
      
      // Para efectivo
      if (order.payment_method === 'efectivo') {
        if (formData.paymentProofImage) {
          formDataToSend.append('paymentProofImage', formData.paymentProofImage);
        }
        formDataToSend.append('paymentAmount', formData.paymentAmount || order.total_amount);
        formDataToSend.append('paymentDate', formData.paymentDate);
      }
      
      // Para crédito
      if (order.payment_method === 'cliente_credito') {
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
    switch (order?.payment_method) {
      case 'transferencia':
        return 'Validación de Transferencia';
      case 'efectivo':
        return 'Validación de Pago en Efectivo';
      case 'cliente_credito':
        return 'Validación de Cupo de Crédito';
      default:
        return 'Validación de Pago';
    }
  };

  const canApproveCredit = () => {
    if (!customerCredit || order?.payment_method !== 'cliente_credito') return false;
    return parseFloat(order.total_amount || 0) <= customerCredit.available_credit;
  };

  const getCreditStatus = () => {
    if (!customerCredit || order?.payment_method !== 'cliente_credito') return null;
    const orderAmount = parseFloat(order.total_amount || 0);
    const availableCredit = customerCredit.available_credit;
    return {
      exceedsCredit: orderAmount > availableCredit,
      orderAmount,
      availableCredit
    };
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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

          {/* Formulario según tipo de pago */}
          <div className="space-y-6">
            
            {/* Para Transferencias */}
            {order.payment_method === 'transferencia' && (
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Comprobante de Transferencia *
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
                          ✓ Archivo seleccionado: {formData.paymentProofImage.name}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                      parseFloat(formData.paymentAmount || 0) === parseFloat(order.total_amount || 0)
                        ? 'bg-green-50 border-green-300'
                        : 'bg-red-50 border-red-300'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Validación de Monto</h4>
                        {parseFloat(formData.paymentAmount || 0) === parseFloat(order.total_amount || 0) ? (
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
                            parseFloat(formData.paymentAmount || 0) === parseFloat(order.total_amount || 0)
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            ${formatAmount(formData.paymentAmount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Diferencia:</span>
                          <p className={`font-medium ${
                            parseFloat(formData.paymentAmount || 0) === parseFloat(order.total_amount || 0)
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            ${formatAmount(parseFloat(order.total_amount || 0) - parseFloat(formData.paymentAmount || 0))}
                          </p>
                        </div>
                      </div>
                      {parseFloat(formData.paymentAmount || 0) !== parseFloat(order.total_amount || 0) && (
                        <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                          <Icons.AlertTriangle className="w-4 h-4 inline mr-1" />
                          ⚠️ <strong>ATENCIÓN:</strong> El monto transferido debe ser exactamente igual al total del pedido para poder validar el pago.
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
                            parseFloat(formData.paymentAmount || 0) === parseFloat(order.total_amount || 0) && formData.paymentAmount !== ''
                              ? 'border-green-300 focus:ring-green-500 bg-green-50'
                              : 'border-red-300 focus:ring-red-500 bg-red-50'
                          }`}
                          min="0"
                          step="0.01"
                          placeholder={`Debe ser: ${formatAmount(order.total_amount)}`}
                          required
                        />
                        <div className="min-h-[20px] mt-1">
                          {formData.paymentAmount !== '' && parseFloat(formData.paymentAmount || 0) !== parseFloat(order.total_amount || 0) && (
                            <p className="text-xs text-red-600">
                              ❌ Monto incorrecto. Debe ser exactamente ${formatAmount(order.total_amount)}
                            </p>
                          )}
                          {parseFloat(formData.paymentAmount || 0) === parseFloat(order.total_amount || 0) && formData.paymentAmount !== '' && (
                            <p className="text-xs text-green-600">
                              ✅ Monto correcto
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
                      (formData.transferredAmount + formData.cashAmount) === parseFloat(order.total_amount || 0)
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Validación de Montos</h4>
                        {(formData.transferredAmount + formData.cashAmount) === parseFloat(order.total_amount || 0) ? (
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
                            (formData.transferredAmount + formData.cashAmount) === parseFloat(order.total_amount || 0)
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            ${formatAmount(formData.transferredAmount + formData.cashAmount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Diferencia:</span>
                          <p className={`font-medium ${
                            (formData.transferredAmount + formData.cashAmount) === parseFloat(order.total_amount || 0)
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            ${formatAmount(parseFloat(order.total_amount || 0) - (formData.transferredAmount + formData.cashAmount))}
                          </p>
                        </div>
                      </div>
                      {(formData.transferredAmount + formData.cashAmount) !== parseFloat(order.total_amount || 0) && (
                        <p className="text-xs text-red-600 mt-2">
                          ⚠️ Los montos deben sumar exactamente el total de la factura
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
                          value={formData.cashAmount}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '' : e.target.value;
                            handleInputChange('cashAmount', value);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.01"
                          placeholder="Ingrese el monto en efectivo"
                          required
                        />
                      </div>
                    </div>

                    {/* Comprobante de Transferencia */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Comprobante de Transferencia *
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
                          ✓ Comprobante transferencia: {formData.paymentProofImage.name}
                        </p>
                      )}
                    </div>

                    {/* Comprobante de Efectivo */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Comprobante de Efectivo *
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (!file.type.startsWith('image/')) {
                              toast.error('Solo se permiten archivos de imagen');
                              return;
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('El archivo no puede ser mayor a 5MB');
                              return;
                            }
                            handleInputChange('cashProofImage', file);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      {formData.cashProofImage && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Comprobante efectivo: {formData.cashProofImage.name}
                        </p>
                      )}
                    </div>

                    {/* Detalles de Transferencia */}
                    <div className="grid grid-cols-2 gap-4">
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

                    <div>
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

            {/* Para Efectivo */}
            {order.payment_method === 'efectivo' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen del Pago en Efectivo *
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
                    ✓ Archivo seleccionado: {formData.paymentProofImage.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Suba una foto del dinero recibido o del recibo de pago
                </p>
              </div>
            )}

            {/* Para Cliente a Crédito */}
            {order.payment_method === 'cliente_credito' && (
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
                            ✓ El cliente tiene cupo suficiente para este pedido
                          </span>
                        </div>
                        <p className="text-green-700 text-xs mt-2">
                          💡 Tienes la decisión final: puedes aprobar o rechazar según tu criterio
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
                        <div className="flex items-center">
                          <Icons.AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                          <span className="text-red-800 font-medium">
                            ⚠ El pedido excede el cupo disponible del cliente
                          </span>
                        </div>
                        <p className="text-red-700 text-xs mt-2">
                          💡 La decisión es tuya: puedes rechazarlo por exceso de cupo o aprobarlo bajo tu criterio
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
              disabled={loading}
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
