import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';

const openImage = (url) => {
  try {
    const full = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    window.open(full, '_blank', 'noopener');
  } catch (e) {
    // fallback
    window.open(url, '_blank');
  }
};

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleString('es-CO');
}

// Extrae un posible motivo de "Gestión Especial" desde timeline/context/order
function extractSpecialReason(timeline, order) {
  const ctx = timeline?.context || {};
  const candidates = [
    ctx.special_reason,
    ctx.special_notes,
    ctx.special_management?.reason,
    ctx.special_management?.notes,
    ctx.gestion_especial_motivo,
    ctx.gestion_especial_notas,
    ctx.admin_notes,
    ctx.review_notes,
    order?.special_reason,
    order?.special_notes,
    order?.special_management?.reason,
    order?.special_management?.notes,
    order?.gestion_especial_motivo,
    order?.gestion_especial_notas,
    order?.admin_notes,
    order?.review_notes,
    order?.notes,
    ctx.notes,
  ].filter(Boolean);

  if (candidates.length > 0) return String(candidates[0]);

  // Buscar en eventos si existe un evento de gestión especial
  const ev = (timeline?.events || []).find(
    (e) =>
      e?.type === 'gestion_especial' ||
      /gesti[oó]n especial/i.test(e?.title || '') ||
      /gesti[oó]n especial/i.test(e?.details || '')
  );
  return ev?.details || '';
}

const EventItem = ({ event, onPreview }) => (
  <div className="relative pl-6 pb-4">
    <div className="absolute left-0 top-1 w-3 h-3 bg-blue-500 rounded-full"></div>
    <div className="text-xs text-gray-500">{formatDateTime(event.at)}</div>
    <div className="text-sm font-medium text-gray-900">{event.title}</div>
    {event.details && (
      <div className="text-xs text-gray-600 whitespace-pre-wrap">{event.details}</div>
    )}
    {Array.isArray(event.attachments) && event.attachments.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-2">
        {event.attachments.map((att, idx) => (
          <button
            key={idx}
            onClick={() => onPreview(att)}
            title={att.label || 'Ver adjunto'}
            className="relative border rounded overflow-hidden hover:shadow focus:outline-none"
          >
            <img
              src={att.url}
              alt={att.label || 'adjunto'}
              className="w-24 h-24 object-cover"
              onError={(e) => { e.currentTarget.style.opacity = 0.4; }}
            />
            <span className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-[10px] text-white px-1 py-0.5 truncate">
              {att.source || 'adjunto'}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);

const OrderTimelineModal = ({ isOpen, onClose, order }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [preview, setPreview] = useState(null); // { url, label, source }

  const [isZoomed, setIsZoomed] = useState(false);

  const handlePreviewAttachment = (att) => {
    if (!att) return;
    setPreview(att);
    setIsZoomed(false);
  };

  // Keyboard navigation for preview
  useEffect(() => {
    if (!preview || attachments.length <= 1) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        const currentIndex = attachments.findIndex(a => a.url === preview.url);
        if (currentIndex !== -1) {
          const prevIndex = (currentIndex - 1 + attachments.length) % attachments.length;
          setPreview(attachments[prevIndex]);
          setIsZoomed(false);
        }
      } else if (e.key === 'ArrowRight') {
        const currentIndex = attachments.findIndex(a => a.url === preview.url);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % attachments.length;
          setPreview(attachments[nextIndex]);
          setIsZoomed(false);
        }
      } else if (e.key === 'Escape') {
        setPreview(null);
        setIsZoomed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview, attachments]);

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!isOpen || !order?.id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/orders/${order.id}/timeline`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Error ${res.status}`);
        }
        const data = await res.json();
        setTimeline(data.data);

        // Aggregate all attachments for navigation
        const allAttachments = [];
        const seenUrls = new Set();

        // Helper to add
        const add = (list) => {
          if (!Array.isArray(list)) return;
          list.forEach(att => {
            if (att && att.url && !seenUrls.has(att.url)) {
              seenUrls.add(att.url);
              allAttachments.push(att);
            }
          });
        };

        // 1. Top level attachments
        add(data.data?.attachments);

        // 2. Event attachments
        if (Array.isArray(data.data?.events)) {
          data.data.events.forEach(ev => {
            add(ev.attachments);
          });
        }

        setAttachments(allAttachments);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [isOpen, order?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center space-x-2">
            <Icons.History className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Línea de tiempo del pedido</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="text-center text-gray-500 py-8">Cargando...</div>
          )}

          {error && (
            <div className="text-center text-red-600 py-4">{error}</div>
          )}

          {timeline && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Pedido:</span> <span className="font-medium">{timeline.context?.order_number}</span></div>
                  <div><span className="text-gray-500">Cliente:</span> <span className="font-medium">{timeline.context?.customer_name}</span></div>
                  <div><span className="text-gray-500">Método de Entrega:</span> <span className="font-medium">{timeline.context?.delivery_method}</span></div>
                  {timeline.context?.carrier_name && (
                    <div><span className="text-gray-500">Transportadora:</span> <span className="font-medium">{timeline.context?.carrier_name}</span></div>
                  )}
                  <div><span className="text-gray-500">Método de Pago:</span> <span className="font-medium">{timeline.context?.payment_method}</span></div>
                  <div><span className="text-gray-500">Monto:</span> <span className="font-medium">${Number(timeline.context?.total_amount || 0).toLocaleString('es-CO')}</span></div>
                </div>

                {/* Indicador de Servicio */}
                {timeline.context?.is_service === 1 && (
                  <div className="mb-4 p-3 rounded border border-blue-300 bg-blue-50 text-blue-800">
                    <div className="flex items-center gap-2">
                      <Icons.Briefcase className="w-4 h-4" />
                      <span className="font-semibold">Pedido de Servicio</span>
                    </div>
                    <div className="mt-1 text-xs md:text-sm">
                      Este pedido fue procesado como un servicio (sin logística).
                    </div>
                  </div>
                )}
                {/* Motivo de Gestión Especial */}
                {(() => {
                  const status = timeline?.context?.status || order?.status;
                  const reason = extractSpecialReason(timeline, order);
                  if (status === 'gestion_especial' && reason) {
                    return (
                      <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-800">
                        <div className="flex items-center gap-2">
                          <Icons.AlertCircle className="w-4 h-4" />
                          <span className="font-semibold">Gestión Especial</span>
                        </div>
                        <div className="mt-1 text-xs md:text-sm whitespace-pre-wrap">
                          {reason}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="border-l-2 border-blue-200 pl-2">
                  {timeline.events?.length ? (
                    timeline.events.map((ev, idx) => (
                      <EventItem key={idx} event={ev} onPreview={handlePreviewAttachment} />
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">Sin eventos</div>
                  )}
                </div>
              </div>
              <div className="md:col-span-1">
                <div className="flex items-center mb-2">
                  <Icons.Image className="w-4 h-4 text-blue-600 mr-2" />
                  <h4 className="text-sm font-semibold text-gray-900">Adjuntos del Pedido</h4>
                </div>
                {attachments.length === 0 ? (
                  <div className="text-xs text-gray-500">Sin imágenes</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {attachments.map((att, idx) => (
                      <button key={idx} onClick={() => handlePreviewAttachment(att)} className="relative border rounded overflow-hidden hover:shadow focus:outline-none" title={att.label || 'Ver imagen'}>
                        <img src={att.url} alt={att.label || 'adjunto'} className="w-full h-20 object-cover" onError={(e) => { e.currentTarget.style.opacity = 0.4; }} />
                        <span className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-[10px] text-white px-1 py-0.5 truncate">
                          {att.source || ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-[11px] text-gray-500">
                  Clic en una miniatura para verla en un modal.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal de previsualización de adjunto */}
        {preview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-80" onClick={(e) => {
            // Close if clicking outside the content
            if (e.target === e.currentTarget) setPreview(null);
          }}>
            {/* Navigation Buttons (Left) */}
            {attachments.length > 1 && (
              <button
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-2 focus:outline-none z-[70]"
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = attachments.findIndex(a => a.url === preview.url);
                  if (currentIndex !== -1) {
                    const prevIndex = (currentIndex - 1 + attachments.length) % attachments.length;
                    setPreview(attachments[prevIndex]);
                  }
                }}
              >
                <Icons.ChevronLeft className="w-10 h-10" />
              </button>
            )}

            <div className="bg-white rounded-lg shadow-lg max-w-[95vw] w-auto overflow-hidden flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <div className="text-sm font-semibold truncate pr-2">
                  {preview.label || 'Adjunto'}
                  {attachments.length > 1 && (
                    <span className="text-gray-500 font-normal ml-2">
                      ({attachments.findIndex(a => a.url === preview.url) + 1} / {attachments.length})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openImage(preview.url)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">Abrir en pestaña</button>
                  <button onClick={() => setPreview(null)} className="p-1 text-gray-600 hover:text-gray-900" aria-label="Cerrar">
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-0 overflow-auto flex items-center justify-center bg-gray-100 min-h-[200px] relative" style={{ cursor: isZoomed ? 'zoom-out' : 'zoom-in' }} onClick={() => setIsZoomed(!isZoomed)}>
                <img
                  src={preview.url}
                  alt={preview.label || 'adjunto'}
                  className={`w-auto max-w-none transition-all duration-200 ${isZoomed ? '' : 'max-h-[85vh]'}`}
                  style={{ minWidth: isZoomed ? 'auto' : 'min(100%, 400px)', width: isZoomed ? 'auto' : 'auto' }}
                />
              </div>
            </div>

            {/* Navigation Buttons (Right) */}
            {attachments.length > 1 && (
              <button
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-2 focus:outline-none z-[70]"
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = attachments.findIndex(a => a.url === preview.url);
                  if (currentIndex !== -1) {
                    const nextIndex = (currentIndex + 1) % attachments.length;
                    setPreview(attachments[nextIndex]);
                  }
                }}
              >
                <Icons.ChevronRight className="w-10 h-10" />
              </button>
            )}
          </div>
        )}

        <div className="px-4 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default OrderTimelineModal;
