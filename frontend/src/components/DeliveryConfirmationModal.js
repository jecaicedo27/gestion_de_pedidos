import React from 'react';
import * as Icons from 'lucide-react';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import { computeCollectionAmounts, isCreditOrder } from '../utils/payments';

const DeliveryConfirmationModal = ({ isOpen, onClose, order, onConfirmStart }) => {

  const handleStartDelivery = () => {
    onConfirmStart(order.id);
    onClose();
  };

  // Helper para obtener el monto correcto según el endpoint usado
  const getOrderAmount = (order) => {
    // Para mensajeros, el campo se llama 'total'
    return parseFloat(order.total || order.total_amount || 0);
  };

  const getDeliveryMethodLabel = (method) => {
    const labels = {
      domicilio_ciudad: 'Domicilio Ciudad',
      domicilio_nacional: 'Domicilio Nacional',
      recogida_tienda: 'Recogida en Tienda',
      envio_nacional: 'Envío Nacional',
      envio_internacional: 'Envío Internacional',
      contraentrega: 'Contraentrega'
    };
    return labels[method] || method || 'No especificado';
  };

  const getPaymentMethodLabel = (method) => {
    const map = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      cliente_credito: 'Crédito',
      pago_electronico: 'Pago Electrónico',
      contraentrega: 'Contraentrega',
      publicidad: 'Publicidad',
      reposicion: 'Reposición'
    };
    const key = (method || '').toLowerCase();
    return map[key] || method || 'No especificado';
  };

  const getShippingPaymentLabel = (method) => {
    const map = {
      contado: 'Pagado',
      paid: 'Pagado',
      pagado: 'Pagado',
      contraentrega: 'Por Cobrar (Contraentrega)',
      por_cobrar: 'Por Cobrar'
    };
    const key = (method || '').toLowerCase();
    return map[key] || method || 'No especificado';
  };

  // Helper robusto para dirección: toma el primer campo no vacío y filtra placeholders
  const getOrderAddress = (o) => {
    const toText = (v) => {
      if (v == null) return '';
      const s = String(v).trim();
      const low = s.toLowerCase();
      if (!s || ['undefined','null','n/a','na','sin direccion','sin dirección','no aplica'].includes(low)) return '';
      return s;
    };
    const candidates = [
      o?.shipping_address,
      o?.delivery_address,
      o?.customer_address,
      o?.address,
      o?.customerAddress,
      o?.shippingAddress,
      o?.deliveryAddress
    ];
    for (const c of candidates) {
      const s = toText(c);
      if (s) return s;
    }
    return '';
  };

  // Normaliza método de pago cuando no viene:
  // 1) Si el envío es contraentrega/por_cobrar, mostrar "contraentrega"
  // 2) Si hay payment_amount o siigo_balance, asumir "contraentrega"
  const normalizedShippingPay = (order?.shipping_payment_method || '').toLowerCase();
  const normalizedPaymentMethod = order?.payment_method
    || (['contraentrega', 'por_cobrar'].includes(normalizedShippingPay) ? 'contraentrega' : null)
    || ((Number(order?.payment_amount ?? 0) > 0 || Number(order?.siigo_balance ?? 0) > 0) ? 'contraentrega' : null)
    || (((Number(order?.total_amount ?? order?.total ?? 0) - Number(order?.paid_amount ?? order?.amount_paid ?? 0)) > 0) ? 'contraentrega' : null);

  const itemsCount = Array.isArray(order?.items) ? order.items.length : (order?.items_count ?? order?.itemsCount ?? 0);
  const amountsBase = computeCollectionAmounts(order);

  // Fallback defensivo (ajustado):
  // SOLO aplicar cuando exista un saldo explícito de pago mixto (payment_amount/siigo_balance > 0).
  // Evita forzar cobros por "total - pagado" cuando el método es transferencia y no se requiere pago.
  const safeAmounts = (() => {
    const paid = Number(order?.paid_amount ?? order?.amount_paid ?? 0);
    const paymentAmt = Number(order?.payment_amount ?? order?.siigo_balance ?? 0);

    if (!isCreditOrder(order) && amountsBase.totalDue === 0 && paymentAmt > 0) {
      const productDue = Math.max(paymentAmt - paid, 0);
      const shippingDue = amountsBase.shippingDue;
      return { productDue, shippingDue, totalDue: productDue + shippingDue };
    }
    return amountsBase;
  })();




  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Icons.Navigation className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Confirmar Inicio de Entrega
              </h2>
              <p className="text-sm text-gray-500">
                Pedido {order.order_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Información del Cliente y Dirección */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
              <Icons.MapPin className="w-4 h-4 mr-2" />
              Información de Entrega
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Cliente:</p>
                <p className="text-gray-900">{order.customer_name || order.client_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Teléfono:</p>
                <p className="text-gray-900">{order.customer_phone || order.client_phone}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-700">Dirección:</p>
                <p className="text-gray-900 font-medium">
                  {getOrderAddress(order) || 'No especificada'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Método de Envío:</p>
                <p className="text-gray-900">{getDeliveryMethodLabel(order.delivery_method)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Fecha de Envío:</p>
                <p className="text-gray-900">
                  {order.shipping_date
                    ? format(new Date(order.shipping_date), 'dd/MM/yyyy', { locale: es })
                    : 'No especificada'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Método de Pago:</p>
                <p className="text-gray-900">{getPaymentMethodLabel(normalizedPaymentMethod)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Pago del Envío:</p>
                <p className="text-gray-900">{getShippingPaymentLabel(order.shipping_payment_method)}</p>
              </div>
            </div>
          </div>

          {/* MONTO A COBRAR - SECCIÓN PRINCIPAL */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-bold text-red-900 mb-3 flex items-center text-lg">
              {safeAmounts.totalDue === 0 ? (
                <>
                  <Icons.CheckCircle className="w-6 h-6 mr-2" />
                  {isCreditOrder(order) ? 'Entrega sin cobro (Cliente a Crédito)' : 'Entrega sin cobro'}
                </>
              ) : (
                <>
                  <Icons.DollarSign className="w-6 h-6 mr-2" />
                  Monto a Cobrar al Cliente
                </>
              )}
            </h3>

            <div className="space-y-4">
              {/* Cálculo del monto a cobrar */}
              {(() => {
                const { productDue, shippingDue, totalDue } = safeAmounts;

                return (
                  <>
                    <div className="bg-white rounded-lg p-4 border-2 border-red-300">
                      <div className="text-center mb-4">
                        <p className="text-3xl font-bold text-red-600 mb-2">
                          ${totalDue.toLocaleString('es-CO')}
                        </p>
                        <p className="text-lg font-semibold text-red-800">
                          {totalDue > 0
                            ? 'COBRAR AL CLIENTE'
                            : (isCreditOrder(order) ? 'NO COBRAR - PEDIDO A CRÉDITO' : 'NO COBRAR - YA PAGADO')}
                        </p>
                      </div>

                      {totalDue > 0 && (
                        <div className="border-t pt-3 space-y-2">
                          {productDue > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">Valor productos:</span>
                              <span className="font-semibold text-red-600">
                                ${productDue.toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                          {shippingDue > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">Costo envío:</span>
                              <span className="font-semibold text-red-600">
                                ${shippingDue.toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span>TOTAL A COBRAR:</span>
                            <span className="text-red-600">
                              ${totalDue.toLocaleString('es-CO')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    
                  </>
                );
              })()}
            </div>

          </div>

          {/* Información del Pedido */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Icons.Package className="w-4 h-4 mr-2" />
              Resumen del Pedido
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div className="bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-600">
                  ${getOrderAmount(order).toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-gray-500">Valor Total</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">
                  {itemsCount}
                </p>
                <p className="text-xs text-gray-500">Items</p>
              </div>
              {(() => {
                const { totalDue } = safeAmounts;
                return (
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-2xl font-bold text-red-600">
                      ${totalDue.toLocaleString('es-CO')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {totalDue > 0 ? 'A Cobrar' : (isCreditOrder(order) ? 'Sin Cobro (Crédito)' : 'Sin Cobro')}
                    </p>
                  </div>
                );
              })()}
              {(() => {
                const { productDue } = safeAmounts;
                return (
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-2xl font-bold text-purple-600">
                      ${productDue.toLocaleString('es-CO')}
                    </p>
                    <p className="text-xs text-purple-600 font-semibold">
                      {getPaymentMethodLabel(normalizedPaymentMethod || order.payment_method)}
                    </p>
                    <p className="text-xs text-gray-500">Pago Productos</p>
                  </div>
                );
              })()}
              {(() => {
                const { shippingDue } = safeAmounts;
                return (
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-2xl font-bold text-orange-600">
                      ${shippingDue.toLocaleString('es-CO')}
                    </p>
                    <p className="text-xs text-orange-600 font-semibold">
                      {getShippingPaymentLabel(order.shipping_payment_method)}
                    </p>
                    <p className="text-xs text-gray-500">Pago Envío</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Información Adicional */}
          {(order.delivery_notes || order.special_instructions) && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2 flex items-center">
                <Icons.AlertCircle className="w-4 h-4 mr-2" />
                Notas Importantes
              </h3>
              <div className="space-y-2">
                {order.delivery_notes && (
                  <p className="text-sm text-yellow-800">
                    <strong>Notas de entrega:</strong> {order.delivery_notes}
                  </p>
                )}
                {order.special_instructions && (
                  <p className="text-sm text-yellow-800">
                    <strong>Instrucciones especiales:</strong> {order.special_instructions}
                  </p>
                )}
              </div>
            </div>
          )}

          

          {/* Productos */}
          {order.items && order.items.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <h3 className="font-semibold text-gray-900 p-4 border-b bg-gray-50 flex items-center">
                <Icons.ShoppingCart className="w-4 h-4 mr-2" />
                Productos a Entregar ({order.items.length} items)
              </h3>
              <div className="max-h-48 overflow-y-auto">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {item.product_name || item.name}
                      </h4>
                      {item.product_code && (
                        <p className="text-sm text-gray-500">
                          Código: {item.product_code}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {item.quantity} x ${((item.unit_price ?? item.price ?? 0)).toLocaleString('es-CO')}
                      </p>
                      <p className="text-sm font-semibold text-blue-600">
                        ${(item.quantity * (item.unit_price ?? item.price ?? 0))?.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleStartDelivery}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Icons.Navigation className="w-4 h-4" />
            <span>Iniciar Entrega</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryConfirmationModal;
