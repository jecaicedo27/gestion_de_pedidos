import React, { useEffect, useMemo, useState } from 'react';
import { packagingEvidenceService, formatQueryParams } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';

const Thumbnail = ({ src, alt, onClick, caption }) => (
  <div className="w-24 flex flex-col items-center">
    <button
      onClick={onClick}
      className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
      title="Ver imagen"
    >
      <img
        src={src}
        alt={alt || 'evidencia'}
        className="w-24 h-24 object-cover rounded-md border border-gray-200 hover:opacity-90"
        loading="lazy"
      />
    </button>
    <div className="mt-1 text-[10px] leading-tight text-gray-500 text-center">
      {caption || ''}
    </div>
  </div>
);

const Lightbox = ({ photo, allPhotos, onClose, onNavigate }) => {
  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') onNavigate(-1);
      else if (e.key === 'ArrowRight') onNavigate(1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onNavigate, onClose]);

  if (!photo) return null;

  const currentIndex = allPhotos.findIndex(p => p.id === photo.id);
  const total = allPhotos.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-95"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Navigation Left */}
      {total > 1 && (
        <button
          className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-4 focus:outline-none z-[70]"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(-1);
          }}
        >
          <Icons.ChevronLeft className="w-12 h-12" />
        </button>
      )}

      <div className="bg-black w-full h-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header (Buttons only) */}
        <div className="flex items-center justify-end px-4 py-3 absolute top-0 left-0 right-0 z-[65] pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            {total > 1 && (
              <span className="text-gray-400 text-sm font-medium bg-black/50 px-2 py-1 rounded">
                {currentIndex + 1} / {total}
              </span>
            )}
            <button
              onClick={() => window.open(photo.url, '_blank')}
              className="p-2 text-white hover:text-blue-400 transition-colors bg-black/50 rounded-full"
              title="Abrir original"
            >
              <Icons.ExternalLink className="w-6 h-6" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white hover:text-red-400 transition-colors bg-black/50 rounded-full"
              aria-label="Cerrar"
            >
              <Icons.X className="w-8 h-8" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 relative overflow-hidden">
          {/* Info above image */}
          <div className="text-center mb-2 z-10 shrink-0 pt-8">
            <div className="text-2xl font-bold text-yellow-400 drop-shadow-md">
              {photo.invoice_label || 'Factura'}
            </div>
            <div className="text-sm text-gray-300">
              Pedido #{photo.order_number} {photo.customer_name ? `• ${photo.customer_name}` : ''}
            </div>
          </div>

          <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
            <img
              src={photo.url}
              alt="evidencia"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>

        {/* Footer Date */}
        <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
          <span className="bg-black/60 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
            {photo.taken_at ? new Date(photo.taken_at).toLocaleString('es-CO') : ''}
          </span>
        </div>
      </div>

      {/* Navigation Right */}
      {total > 1 && (
        <button
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-4 focus:outline-none z-[70]"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(1);
          }}
        >
          <Icons.ChevronRight className="w-12 h-12" />
        </button>
      )}
    </div>
  );
};

const EvidenceGalleryPage = () => {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState({
    product_name: '',
    barcode: '',
    order_number: '',
    status: '',
    from: '',
    to: ''
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalOrders: 0, totalPhotos: 0 });
  const [loading, setLoading] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null); // { direction: 1 | -1 }

  const allPhotos = useMemo(() => {
    return rows.flatMap(row => {
      const photos = row.photos || [];
      const order = row.order || {};

      // Calculate invoice label
      const _suffix = String(order.order_number || '').split('-').pop();
      const invoiceLabel = order.siigo_invoice_number || (/^\d+$/.test(_suffix || '') ? `PEC ${_suffix}` : null);
      const finalInvoiceLabel = invoiceLabel || (_suffix ? `PEC ${_suffix}` : 'Factura');

      return photos.map(p => ({
        ...p,
        order_number: order.order_number,
        order_id: order.id,
        invoice_label: finalInvoiceLabel,
        customer_name: order.customer_name
      }));
    });
  }, [rows]);

  // Handle pending navigation after rows update
  useEffect(() => {
    if (pendingNavigation && allPhotos.length > 0 && meta.page === pendingNavigation.targetPage) {
      if (pendingNavigation.direction === 1) {
        // Came from previous page -> go to first photo
        setCurrentPhoto(allPhotos[0]);
      } else {
        // Came from next page -> go to last photo
        setCurrentPhoto(allPhotos[allPhotos.length - 1]);
      }
      setPendingNavigation(null);
    }
  }, [allPhotos, pendingNavigation, meta.page]);

  const handleNavigate = async (direction) => {
    if (!currentPhoto) return;
    const currentIndex = allPhotos.findIndex(p => p.id === currentPhoto.id);
    if (currentIndex === -1) return;

    // Check boundaries
    if (direction === 1 && currentIndex === allPhotos.length - 1) {
      // End of current page
      const totalPages = Math.ceil((meta.totalOrders || 0) / (meta.pageSize || 1));
      if (meta.page < totalPages) {
        const newPage = meta.page + 1;
        setPendingNavigation({ direction: 1, targetPage: newPage });
        setPage(newPage);
        await loadData({ page: newPage });
      }
    } else if (direction === -1 && currentIndex === 0) {
      // Start of current page
      if (meta.page > 1) {
        const newPage = meta.page - 1;
        setPendingNavigation({ direction: -1, targetPage: newPage });
        setPage(newPage);
        await loadData({ page: newPage });
      }
    } else {
      // Normal navigation within page
      const nextIndex = (currentIndex + direction + allPhotos.length) % allPhotos.length;
      setCurrentPhoto(allPhotos[nextIndex]);
    }
  };

  const canView = useMemo(() => {
    // Permitir a roles de empaque, logística, cartera, facturación y admin
    return hasPermission(['admin', 'logistica', 'empaque', 'empacador', 'packaging', 'cartera', 'facturador']);
  }, [hasPermission]);

  // Formatear siempre en zona horaria Bogotá para evitar confusión si el navegador está en otra zona
  const formatBogota = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    } catch {
      return new Date(d).toLocaleString();
    }
  };

  const loadData = async (opts = {}) => {
    setLoading(true);
    try {
      // Normalizar fechas: enviar solo 'YYYY-MM-DD' (día local) sin horas
      const normalizeDate = (d) => {
        if (!d) return undefined;
        return String(d).slice(0, 10); // YYYY-MM-DD
      };

      const params = formatQueryParams({
        ...filters,
        from: normalizeDate(filters.from),
        to: normalizeDate(filters.to),
        page: opts.page ?? page,
        pageSize
      });
      const resp = await packagingEvidenceService.gallery(params);
      // resp esperado: { success, data: [...], meta: { page, pageSize, totalOrders, totalPhotos } }
      const data = Array.isArray(resp?.data) ? resp.data : [];
      setRows(data);
      setMeta(resp?.meta || { page, pageSize, totalOrders: 0, totalPhotos: 0 });
    } catch (e) {
      // toast manejado por interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadData({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const onInput = (e) => {
    const { name, value } = e.target;
    setFilters((f) => ({ ...f, [name]: value }));
  };

  const onSearch = async () => {
    setPage(1);
    await loadData({ page: 1 });
  };

  const onClear = async () => {
    setFilters({ product_name: '', barcode: '', order_number: '', status: '', from: '', to: '' });
    setPage(1);
    await loadData({ page: 1 });
  };

  const onPrev = async () => {
    if (meta.page > 1) {
      const newPage = meta.page - 1;
      setPage(newPage);
      await loadData({ page: newPage });
    }
  };

  const onNext = async () => {
    const totalPages = Math.ceil((meta.totalOrders || 0) / (meta.pageSize || 1));
    if (meta.page < totalPages) {
      const newPage = meta.page + 1;
      setPage(newPage);
      await loadData({ page: newPage });
    }
  };

  if (!canView) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md p-4">
          No tienes permisos para ver la Galería de Evidencias.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center">
          <Icons.Image className="w-6 h-6 mr-2 text-gray-700" />
          Galería de Evidencias de Empaque
        </h1>
        <div className="text-sm text-gray-500">
          {meta?.totalOrders || 0} pedidos • {meta?.totalPhotos || 0} fotos
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Producto (nombre)</label>
            <input
              type="text"
              name="product_name"
              value={filters.product_name}
              onChange={onInput}
              placeholder="Ej: Liquipop 1100gr"
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Código de barras</label>
            <input
              type="text"
              name="barcode"
              value={filters.barcode}
              onChange={onInput}
              placeholder="Escanéalo o pégalo"
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nº Pedido</label>
            <input
              type="text"
              name="order_number"
              value={filters.order_number}
              onChange={onInput}
              placeholder="Ej: 15021"
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Estado del pedido</label>
            <select
              name="status"
              value={filters.status}
              onChange={onInput}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="en_preparacion">En preparación</option>
              <option value="en_empaque">En empaque</option>
              <option value="listo_para_entrega">Listo para entrega</option>
              <option value="en_logistica">En logística</option>
              <option value="entregado">Entregado</option>
              <option value="devuelto">Devuelto</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              name="from"
              value={filters.from}
              onChange={onInput}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              name="to"
              value={filters.to}
              onChange={onInput}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSearch}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md disabled:opacity-60"
            disabled={loading}
          >
            <Icons.Search className="w-4 h-4 mr-2" />
            Buscar
          </button>
          <button
            onClick={onClear}
            className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm rounded-md disabled:opacity-60"
            disabled={loading}
          >
            <Icons.Eraser className="w-4 h-4 mr-2" />
            Limpiar
          </button>
        </div>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Página {meta.page || 1} de {Math.max(1, Math.ceil((meta.totalOrders || 0) / (meta.pageSize || 1)))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={loading || (meta.page || 1) <= 1}
            className="inline-flex items-center px-3 py-1.5 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <Icons.ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </button>
          <button
            onClick={onNext}
            disabled={
              loading ||
              (meta.page || 1) >= Math.ceil((meta.totalOrders || 0) / (meta.pageSize || 1))
            }
            className="inline-flex items-center px-3 py-1.5 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Siguiente
            <Icons.ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {/* Resultados */}
      <div className="space-y-4">
        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Cargando evidencias...
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Sin resultados con los filtros actuales.
          </div>
        )}
        {!loading &&
          rows.map((row) => {
            const order = row.order;
            const photos = row.photos || [];
            const items = row.items || [];
            // Etiqueta de factura: usar siigo_invoice_number si viene del backend; si no, derivar "PEC {sufijo}"
            const _suffix = String(order?.order_number || '').split('-').pop();
            const invoiceLabel =
              order?.siigo_invoice_number ||
              (/^\d+$/.test(_suffix || '') ? `PEC ${_suffix}` : null);
            const finalInvoiceLabel = invoiceLabel || (_suffix ? `PEC ${_suffix}` : 'Factura');
            return (
              <div key={order.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Pedido</span>
                    <Link
                      to={`/orders/${order.id}`}
                      className={`${(!photos || photos.length === 0)
                        ? 'text-red-700 underline decoration-red-600 decoration-4 underline-offset-4'
                        : 'text-blue-600 hover:underline'} font-semibold`}
                      title={(!photos || photos.length === 0)
                        ? 'Pedido sin fotos en el rango seleccionado'
                        : 'Ver detalle del pedido'}
                    >
                      #{order.order_number}
                    </Link>
                    <span
                      className={`${(!photos || photos.length === 0)
                        ? 'bg-red-600 text-white border-red-700'
                        : 'bg-gray-100 text-gray-700 border-gray-200'} text-xs px-2 py-0.5 rounded-full border`}
                      title="Número de factura"
                    >
                      {finalInvoiceLabel}
                    </span>
                    {row.has_product_match && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Coincidencia de producto
                      </span>
                    )}
                    {(!photos || photos.length === 0) && (
                      <span
                        className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200"
                        title="Este pedido no tiene fotos registradas en el rango seleccionado"
                      >
                        Sin fotos
                      </span>
                    )}
                  </div>
                  <div
                    className="text-xs text-gray-500"
                    title={`Zona horaria: Bogotá`}
                  >
                    <div className="flex items-center gap-2">
                      <span>Cliente: {order.customer_name || '—'}</span>
                      <span>·</span>
                      <span>Factura:</span>
                      <span
                        className={`${(!photos || photos.length === 0)
                          ? 'bg-red-600 text-white border-red-700'
                          : 'bg-gray-100 text-gray-700 border-gray-200'} text-[10px] px-2 py-0.5 rounded-full border`}
                        title="Número de factura"
                      >
                        {finalInvoiceLabel}
                      </span>
                      <span className="text-gray-400">
                        ({order.siigo_invoice_created_at
                          ? new Date(order.siigo_invoice_created_at).toLocaleDateString('es-CO', { timeZone: 'UTC' })
                          : formatBogota(order.created_at)
                        })
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items relevantes (si hay filtro activo) */}
                {(filters.product_name || filters.barcode) && items.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Items del pedido</div>
                    <div className="flex flex-wrap gap-2">
                      {items.map((it) => (
                        <span
                          key={it.id}
                          className={`text-xs px-2 py-1 rounded-full border ${it.matches_filter
                            ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                            }`}
                          title={it.name}
                        >
                          {it.name} × {it.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thumbnails */}
                <div className="flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <Thumbnail
                      key={p.id}
                      src={p.url}
                      alt={p.description}
                      onClick={() => setCurrentPhoto({ ...p, order_number: order.order_number, order_id: order.id })}
                      caption={formatBogota(p.taken_at || p.created_at)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {/* Lightbox */}
      <Lightbox
        photo={currentPhoto}
        allPhotos={allPhotos}
        onClose={() => setCurrentPhoto(null)}
        onNavigate={handleNavigate}
      />
    </div>
  );
};

export default EvidenceGalleryPage;
