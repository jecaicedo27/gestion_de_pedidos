import React from 'react';
import * as Icons from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const DeliveryConfirmationModal = ({ isOpen, onClose, order, onConfirmStart }) => {
  if (!isOpen || !order) return null;

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Cliente:</p>
                <p className="text-gray-900">{order.customer_name || order.client_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Teléfono:</p>
                <p className="text-gray-900">{order.customer_phone || order.client_phone}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-gray-700">Dirección:</p>
                <p className="text-gray-900 font-medium">
                  {order.shipping_address || order.delivery_address || 'No especificada'}
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
            </div>
          </div>

          {/* MONTO A COBRAR - SECCIÓN PRINCIPAL */}
          <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-lg p-6">
            <h3 className="font-bold text-red-900 mb-4 flex items-center text-xl">
              <Icons.DollarSign className="w-6 h-6 mr-2" />
              💰 MONTO A COBRAR AL CLIENTE
            </h3>
            
            <div className="space-y-4">
              {/* Cálculo del monto a cobrar */}
              {(() => {
                const shouldCollectProduct = order.payment_method === 'efectivo' || 
                                           order.payment_method === 'contraentrega' ||
                                           order.payment_method === 'cash' ||
                                           !order.payment_method ||
                                           order.payment_method === 'contado';
                
                const shouldCollectShipping = order.shipping_payment_method === 'pending' ||
                                             order.shipping_payment_method === 'por_cobrar' ||
                                             order.shipping_payment_method === 'unpaid' ||
                                             !order.shipping_payment_method;
                
                const productAmount = shouldCollectProduct ? getOrderAmount(order) : 0;
                const shippingAmount = shouldCollectShipping ? parseFloat(order.shipping_cost || 0) : 0;
                const totalToCollect = productAmount + shippingAmount;

                return (
                  <>
                    <div className="bg-white rounded-lg p-4 border-2 border-red-300">
                      <div className="text-center mb-4">
                        <p className="text-4xl font-bold text-red-600 mb-2">
                          ${totalToCollect.toLocaleString('es-CO')}
                        </p>
                        <p className="text-lg font-semibold text-red-800">
                          {totalToCollect > 0 ? 'COBRAR AL CLIENTE' : 'NO COBRAR - YA PAGADO'}
                        </p>
                      </div>
                      
                      {totalToCollect > 0 && (
                        <div className="border-t pt-3 space-y-2">
                          {productAmount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">Valor productos:</span>
                              <span className="font-semibold text-red-600">
                                ${productAmount.toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                          {shippingAmount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">Costo envío:</span>
                              <span className="font-semibold text-red-600">
                                ${shippingAmount.toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span>TOTAL A COBRAR:</span>
                            <span className="text-red-600">
                              ${totalToCollect.toLocaleString('es-CO')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Instrucciones de cobro */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <h4 className="font-semibold text-yellow-800 mb-2 flex items-center">
                        <Icons.AlertTriangle className="w-4 h-4 mr-1" />
                        Instrucciones de Cobro:
                      </h4>
                      <div className="text-sm text-yellow-700 space-y-1">
                        {totalToCollect > 0 ? (
                          <>
                            <p>• Cobrar exactamente ${totalToCollect.toLocaleString('es-CO')} al cliente</p>
                            <p>• Aceptar solo efectivo o transferencia confirmada</p>
                            <p>• Verificar billetes y dar vueltos si es necesario</p>
                            <p>• Solicitar recibo o comprobante de transferencia</p>
                          </>
                        ) : (
                          <>
                            <p>• ✅ Este pedido YA ESTÁ PAGADO</p>
                            <p>• NO cobrar nada al cliente</p>
                            <p>• Solo entregar los productos</p>
                          </>
                        )}
                      </div>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-600">
                  ${getOrderAmount(order).toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-gray-500">Valor Total</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">
                  {order.items?.length || 0}
                </p>
                <p className="text-xs text-gray-500">Items</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-lg font-bold text-purple-600">
                  {order.payment_method === 'credit' ? 'Crédito' : 'Contado'}
                </p>
                <p className="text-xs text-gray-500">Pago</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-lg font-bold text-orange-600">
                  {order.shipping_payment_method === 'paid' ? 'Pagado' : 'Por Cobrar'}
                </p>
                <p className="text-xs text-gray-500">Flete</p>
              </div>
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
                        {item.quantity} x ${item.unit_price?.toLocaleString('es-CO')}
                      </p>
                      <p className="text-sm font-semibold text-blue-600">
                        ${(item.quantity * item.unit_price)?.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advertencia */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Icons.Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900">Antes de iniciar la entrega:</h4>
                <ul className="mt-2 text-sm text-blue-800 space-y-1">
                  <li>• Verifica que tienes todos los productos del pedido</li>
                  <li>• Confirma la dirección de entrega</li>
                  <li>• Asegúrate de tener contacto directo con el cliente</li>
                  <li>• Ten listo el método de pago si es necesario cobrar</li>
                </ul>
              </div>
            </div>
          </div>
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
