import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar detalles del pedido
  useEffect(() => {
    const loadOrderDetails = async () => {
      try {
        setLoading(true);
        const response = await orderService.getOrder(id);
        setOrder(response.data);
      } catch (error) {
        console.error('Error cargando detalles del pedido:', error);
        toast.error('Error cargando detalles del pedido');
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadOrderDetails();
    }
  }, [id, navigate]);

  // Obtener color del estado
  const getStatusColor = (status) => {
    const colors = {
      pendiente_por_facturacion: 'bg-yellow-100 text-yellow-800',
      revision_cartera: 'bg-blue-100 text-blue-800',
      en_logistica: 'bg-purple-100 text-purple-800',
      en_empaque: 'bg-orange-100 text-orange-800',
      empacado: 'bg-cyan-100 text-cyan-800',
      en_reparto: 'bg-indigo-100 text-indigo-800',
      entregado_transportadora: 'bg-green-100 text-green-800',
      entregado_cliente: 'bg-green-100 text-green-800',
      cancelado: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Obtener etiqueta del estado
  const getStatusLabel = (status) => {
    const labels = {
      pendiente_por_facturacion: 'Pendiente por Facturación',
      revision_cartera: 'Revisión por Cartera',
      en_logistica: 'En Logística',
      en_empaque: 'En Empaque',
      empacado: 'Empacado',
      en_reparto: 'En Reparto',
      entregado_transportadora: 'Entregado a Transportadora',
      entregado_cliente: 'Entregado a Cliente',
      cancelado: 'Cancelado'
    };
    return labels[status] || status;
  };

  // Obtener etiqueta del método de envío
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

  // Obtener etiqueta del método de pago
  const getPaymentMethodLabel = (method) => {
    const labels = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia Bancaria',
      tarjeta: 'Tarjeta de Crédito/Débito',
      contraentrega: 'Contraentrega',
      credito: 'Crédito'
    };
    return labels[method] || method || 'No especificado';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="text-center">
          <Icons.AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Pedido no encontrado</h2>
          <p className="text-gray-600 mb-4">El pedido que buscas no existe o no tienes permisos para verlo.</p>
          <button
            onClick={() => navigate('/orders')}
            className="btn btn-primary"
          >
            Volver a Pedidos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <Icons.ArrowLeft className="w-5 h-5 mr-2" />
            Volver
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Pedido {order.order_number}
            </h1>
            <p className="text-gray-600 mt-1">
              Creado el {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Estado actual */}
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>

          {/* Descargar factura SIIGO */}
          {order.siigo_public_url && (
            <a
              href={order.siigo_public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <Icons.FileText className="w-4 h-4 mr-2" />
              Descargar Factura
            </a>
          )}

          {/* Editar pedido (solo admin) */}
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate(`/orders/${order.id}/edit`)}
              className="btn btn-primary"
            >
              <Icons.Edit className="w-4 h-4 mr-2" />
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Grid de información */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información del Cliente */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <Icons.User className="w-5 h-5 mr-2" />
              Información del Cliente
            </h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Nombre</label>
                <p className="text-gray-900">{order.customer_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Teléfono</label>
                <p className="text-gray-900">{order.customer_phone}</p>
              </div>
              {order.customer_email && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900">{order.customer_email}</p>
                </div>
              )}
              {order.customer_address && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Dirección</label>
                  <p className="text-gray-900">{order.customer_address}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Información del Pedido */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <Icons.Package className="w-5 h-5 mr-2" />
              Detalles del Pedido
            </h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Número de Pedido</label>
                <p className="text-gray-900 font-mono">{order.order_number}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total</label>
                <p className="text-gray-900 text-xl font-semibold">
                  ${order.total_amount?.toLocaleString('es-CO')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Método de Pago</label>
                <p className="text-gray-900">{getPaymentMethodLabel(order.payment_method)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Método de Envío</label>
                <p className="text-gray-900">{getDeliveryMethodLabel(order.delivery_method)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Información SIIGO */}
        {order.siigo_invoice_number && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold flex items-center">
                <Icons.FileText className="w-5 h-5 mr-2" />
                Información SIIGO
              </h3>
            </div>
            <div className="card-content">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Número de Factura</label>
                  <p className="text-gray-900 font-mono">{order.siigo_invoice_number}</p>
                </div>
                {order.siigo_customer_id && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID Cliente SIIGO</label>
                    <p className="text-gray-900">{order.siigo_customer_id}</p>
                  </div>
                )}
                {order.siigo_observations && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Observaciones</label>
                    <p className="text-gray-900">{order.siigo_observations}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items del Pedido */}
      <div className="card mt-6">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center">
            <Icons.ShoppingCart className="w-5 h-5 mr-2" />
            Items del Pedido ({order.items?.length || 0})
          </h3>
        </div>
        <div className="card-content p-0">
          {order.items && order.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio Unitario
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {item.product_code || item.code || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {item.name || item.product_name || 'Producto sin nombre'}
                        </div>
                        {item.description && (
                          <div className="text-sm text-gray-500">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {/* Usar 'price' que es la columna real en la base de datos */}
                        {item.price && !isNaN(item.price) 
                          ? `$${Number(item.price).toLocaleString('es-CO')}` 
                          : (item.unit_price && !isNaN(item.unit_price) 
                              ? `$${Number(item.unit_price).toLocaleString('es-CO')}` 
                              : 'Precio no disponible')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {/* Calcular total usando 'price' */}
                        {item.quantity && item.price && !isNaN(item.price) && !isNaN(item.quantity)
                          ? `$${(Number(item.quantity) * Number(item.price)).toLocaleString('es-CO')}`
                          : (item.quantity && item.unit_price && !isNaN(item.unit_price) && !isNaN(item.quantity)
                              ? `$${(Number(item.quantity) * Number(item.unit_price)).toLocaleString('es-CO')}`
                              : 'Total no disponible')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      Total del Pedido:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-lg font-bold text-gray-900">
                      ${order.total_amount?.toLocaleString('es-CO')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Icons.ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No hay items en este pedido</p>
            </div>
          )}
        </div>
      </div>

      {/* Notas y Observaciones */}
      {(order.notes || order.delivery_notes || order.siigo_observations) && (
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <Icons.FileText className="w-5 h-5 mr-2" />
              Notas y Observaciones
            </h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {order.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notas del Pedido</label>
                  <p className="text-gray-900 mt-1">{order.notes}</p>
                </div>
              )}
              {order.delivery_notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notas de Entrega</label>
                  <p className="text-gray-900 mt-1">{order.delivery_notes}</p>
                </div>
              )}
              {order.siigo_observations && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Observaciones SIIGO</label>
                  <p className="text-gray-900 mt-1">{order.siigo_observations}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historial de Estados (si está disponible) */}
      {order.status_history && order.status_history.length > 0 && (
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <Icons.Clock className="w-5 h-5 mr-2" />
              Historial de Estados
            </h3>
          </div>
          <div className="card-content">
            <div className="flow-root">
              <ul className="-mb-8">
                {order.status_history.map((history, index) => (
                  <li key={index}>
                    <div className="relative pb-8">
                      {index !== order.status_history.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getStatusColor(history.status)}`}>
                            <Icons.CheckCircle className="w-5 h-5" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Cambió a <span className="font-medium text-gray-900">{getStatusLabel(history.status)}</span>
                            </p>
                            {history.user_name && (
                              <p className="text-sm text-gray-500">por {history.user_name}</p>
                            )}
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            {format(new Date(history.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailPage;
