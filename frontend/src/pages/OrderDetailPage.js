import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService, packagingProgressService, carteraService } from '../services/api';
import * as Icons from 'lucide-react';
import ReasonModal from '../components/ReasonModal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  const focus = searchParams.get('focus');
  const itemsRef = useRef(null);
  const [highlightPacking, setHighlightPacking] = useState(false);
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [packSnap, setPackSnap] = useState(null);
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState(null);

  // Devolver a Facturación (Cartera/Admin)
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  // Cancelación por cliente
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

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

  // Cargar snapshot de empaque (solo lectura) si el pedido está en empaque
  useEffect(() => {
    const fetchSnapshot = async () => {
      if (!order || loading) return;
      const status = String(order.status || '').toLowerCase();
      if (status !== 'en_empaque' && status !== 'en_preparacion') {
        setPackSnap(null);
        return;
      }
      try {
        setPackLoading(true);
        setPackError(null);
        const resp = await packagingProgressService.getSnapshot(order.id);
        // backend responde { success, data }
        const snap = resp?.data ?? resp ?? null;
        setPackSnap(snap);
      } catch (e) {
        // Silencioso si 403 (rol sin permiso) u otros
        setPackError(e?.response?.data?.message || null);
      } finally {
        setPackLoading(false);
      }
    };
    fetchSnapshot();
  }, [order, loading]);

  // Enfocar sección de empaque (items) cuando se llega desde /packaging-progress
  useEffect(() => {
    if (!loading && order && String(focus || '').toLowerCase() === 'packing' && itemsRef.current) {
      try {
        itemsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {}
      setHighlightPacking(true);
      const t = setTimeout(() => setHighlightPacking(false), 2000);
      return () => clearTimeout(t);
    }
  }, [loading, order, focus]);

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
      credito: 'Crédito',
      publicidad: 'Publicidad',
      reposicion: 'Reposición'
    };
    return labels[method] || method || 'No especificado';
  };

  // Barra de progreso compacta para empaque
  const SmallProgressBar = ({ percent }) => {
    const pct = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
    const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-yellow-500';
    return (
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className={`h-2 ${color}`} style={{ width: `${pct}%`, transition: 'width 300ms ease' }} />
      </div>
    );
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
            onClick={() => { if (from === 'packaging-progress') navigate('/packaging-progress'); else navigate(-1); }}
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

          {/* Cliente canceló pedido (Admin/Facturación) */}
          {(user?.role === 'facturador' || user?.role === 'admin') && ['en_preparacion','en_empaque','empacado','listo','listo_para_entrega','listo_para_recoger','en_logistica','en_reparto'].includes(String(order.status || '').toLowerCase()) && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
              title="Marcar pedido como cancelado por cliente"
              disabled={cancelLoading}
            >
              <Icons.XCircle className="w-4 h-4 mr-2" />
              Cliente canceló pedido
            </button>
          )}

          {/* Enterado (Logística) para cancelación */}
          {user?.role === 'logistica' && String(order.status || '').toLowerCase() === 'cancelado' && !order.cancellation_logistics_ack_at && (
            <button
              onClick={async () => {
                try {
                  const resp = await orderService.logisticsAckCancel(order.id);
                  toast.success(resp?.message || 'Enterado registrado');
                  setOrder(prev => ({ ...prev, cancellation_logistics_ack_at: new Date().toISOString() }));
                } catch (e) {
                  toast.error(e?.response?.data?.message || 'No se pudo registrar el enterado');
                }
              }}
              className="inline-flex items-center px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-800 text-white"
              title="Marcar enterado de cancelación"
            >
              <Icons.Check className="w-4 h-4 mr-2" />
              Enterado
            </button>
          )}

          {/* Devolver a Facturación (solo Cartera/Admin cuando está en revisión de cartera) */}
          {(user?.role === 'cartera' || user?.role === 'admin') && String(order.status || '').toLowerCase() === 'revision_cartera' && (
            <button
              onClick={() => setShowReturnModal(true)}
              className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
              title="Devolver pedido a Facturación para corrección"
            >
              <Icons.RotateCcw className="w-4 h-4 mr-2" />
              Devolver a Facturación
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

      {/* Detalle de Empaque (solo lectura) */}
      {(packLoading || packSnap) && (
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <Icons.Package className="w-5 h-5 mr-2" />
              Detalle de Empaque
            </h3>
          </div>
          <div className="card-content">
            {packLoading ? (
              <div className="text-sm text-gray-500">Cargando progreso de empaque…</div>
            ) : packSnap ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Estado</div>
                  <div className="text-sm font-medium">
                    {String(order.status || '').replaceAll('_', ' ')}
                  </div>
                  {packSnap.packaging_status && (
                    <div className="text-xs text-gray-500">
                      Packaging: {String(packSnap.packaging_status).replaceAll('_', ' ')}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-gray-500 mb-1">Progreso</div>
                  <div className="flex items-center gap-2">
                    <SmallProgressBar percent={packSnap.progress_pct} />
                    <div className="w-12 text-right tabular-nums text-sm">{packSnap.progress_pct}%</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Verificados: <span className="font-medium">{packSnap.verified_items}</span> / {packSnap.total_items}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Bloqueo</div>
                  {packSnap.packaging_lock_user_id ? (
                    <div className="text-sm text-red-600 inline-flex items-center">
                      <Icons.Lock className="w-4 h-4 mr-1" />
                      {packSnap.packaging_locked_by || 'Bloqueado'}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 inline-flex items-center">
                      <Icons.Unlock className="w-4 h-4 mr-1" />
                      Libre
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Sin información de empaque.</div>
            )}
            {packError && <div className="text-xs text-red-600 mt-2">{packError}</div>}
          </div>
        </div>
      )}

      {/* Items del Pedido */}
      <div ref={itemsRef} className={`card mt-6 ${highlightPacking ? 'ring-2 ring-blue-400' : ''}`}>
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

      {/* Observaciones (unificadas, sin duplicados) */}
      {(() => {
        const s1 = (order.siigo_observations || '').toString().trim();
        const s2 = (order.notes || '').toString().trim();
        const s3 = (order.delivery_notes || '').toString().trim();
        const primary = s1 || s2 || s3;
        if (!primary) return null;
        return (
          <div className="card mt-6">
            <div className="card-header">
              <h3 className="text-lg font-semibold flex items-center">
                <Icons.FileText className="w-5 h-5 mr-2" />
                Observaciones
              </h3>
            </div>
            <div className="card-content">
              <p className="text-gray-900 whitespace-pre-line">{primary}</p>
            </div>
          </div>
        );
      })()}

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
      {/* Reason Modal: Devolver a Facturación */}
      <ReasonModal
        isOpen={showReturnModal}
        onClose={() => !returnLoading && setShowReturnModal(false)}
        order={order}
        mode="return"
        loading={returnLoading}
        onConfirm={async ({ reason }) => {
          try {
            setReturnLoading(true);
            const resp = await carteraService.returnToBilling(order.id, reason);
            if (resp?.success) {
              toast.success('Pedido devuelto a Facturación');
            } else {
              toast.success('Pedido devuelto a Facturación');
            }
            // Volver a la vista anterior (el pedido saldrá de la vista de Cartera)
            navigate(-1);
          } catch (e) {
            // El interceptor ya muestra toast de error; agregar uno defensivo
            toast.error(e?.response?.data?.message || 'No se pudo devolver el pedido');
          } finally {
            setReturnLoading(false);
            setShowReturnModal(false);
          }
        }}
      />

      {/* Reason Modal: Cliente canceló pedido */}
      <ReasonModal
        isOpen={showCancelModal}
        onClose={() => !cancelLoading && setShowCancelModal(false)}
        order={order}
        mode="reason"
        loading={cancelLoading}
        onConfirm={async ({ reason }) => {
          try {
            setCancelLoading(true);
            const resp = await orderService.cancelByCustomer(order.id, { reason });
            if (resp?.success) {
              toast.success('Pedido cancelado por cliente');
            } else {
              toast.success('Pedido cancelado');
            }
            // Salir a la vista anterior; el pedido ya no debe estar en colas operativas
            navigate(-1);
          } catch (e) {
            toast.error(e?.response?.data?.message || 'No se pudo cancelar el pedido');
          } finally {
            setCancelLoading(false);
            setShowCancelModal(false);
          }
        }}
      />
    </div>
  );
};

export default OrderDetailPage;
