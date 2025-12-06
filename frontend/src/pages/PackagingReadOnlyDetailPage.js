import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import * as Icons from 'lucide-react';
import { packagingProgressService } from '../services/api';

function ProgressBar({ percent }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
        style={{ width: `${pct}%`, transition: 'width 300ms ease' }}
      />
    </div>
  );
}

function ReadOnlyBadge() {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
      <Icons.Eye className="w-3.5 h-3.5 mr-1" />
      Solo lectura
    </span>
  );
}

export default function PackagingReadOnlyDetailPage() {
  const { orderId } = useParams();
  const [snapshot, setSnapshot] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const refreshTimer = useRef(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [snapResp, listResp] = await Promise.all([
        packagingProgressService.getSnapshot(orderId),
        packagingProgressService.getChecklist(orderId),
      ]);
      // Normalización flexible de respuesta
      const snap = snapResp?.data || snapResp;
      const list = listResp?.data?.checklist || listResp?.data || listResp || [];
      setSnapshot(snap || null);
      setChecklist(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Error cargando checklist read-only:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (socketRef.current) return;
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      try { socket.emit('join-packaging-updates'); } catch {}
    };
    const handleDisconnect = () => setConnected(false);

    const debounceRefresh = () => {
      try { if (refreshTimer.current) clearTimeout(refreshTimer.current); } catch {}
      refreshTimer.current = setTimeout(() => {
        loadData();
      }, 400);
    };

    const handlePackagingProgress = (payload) => {
      if (!payload) return;
      const pid = String(payload.orderId || payload.id || '');
      if (String(pid) === String(orderId)) {
        // Si el pedido salió del estado de empaque, igual refrescamos para reflejar 100% o cambios
        debounceRefresh();
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('packaging-progress', handlePackagingProgress);

    return () => {
      try {
        socket.off('packaging-progress', handlePackagingProgress);
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.disconnect();
      } catch {}
      socketRef.current = null;
      try { if (refreshTimer.current) clearTimeout(refreshTimer.current); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const totals = useMemo(() => {
    if (!snapshot) return { total: 0, verified: 0, progress: 0 };
    const total = Number(snapshot.total_items || 0);
    const verified = Number(snapshot.verified_items || 0);
    const progress = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, progress };
  }, [snapshot]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold flex items-center">
            <Icons.ClipboardList className="w-5 h-5 mr-2 text-blue-600" />
            Checklist de Empaque
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Vista detallada en tiempo real del pedido en empaque. <ReadOnlyBadge />
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <div className={`inline-flex items-center px-2 py-1 rounded-md ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {connected ? <Icons.Wifi className="w-4 h-4 mr-1" /> : <Icons.WifiOff className="w-4 h-4 mr-1" />}
            {connected ? 'Tiempo real activo' : 'Sin conexión tiempo real'}
          </div>
          <Link to="/packaging-progress" className="inline-flex items-center px-2 py-1 rounded-md border bg-white hover:bg-gray-50">
            <Icons.Activity className="w-4 h-4 mr-1" /> Progreso
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 mb-4 sticky top-16 z-10">
        {loading ? (
          <div className="flex items-center text-gray-600">
            <Icons.Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
          </div>
        ) : !snapshot ? (
          <div className="text-gray-600">No se encontró información del pedido #{orderId}.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500">Pedido</div>
                <div className="font-semibold">#{snapshot.order_number || snapshot.orderId}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Estado</div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-blue-50 text-blue-700 border-blue-200">
                  {String(snapshot.status || '').replaceAll('_', ' ')}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500">Progreso</div>
                <div className="font-semibold text-lg md:text-xl">{totals.verified}/{totals.total} items</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Empacador</div>
                <div className="truncate max-w-[200px]">{snapshot.packaging_locked_by || '-'}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center space-x-2">
              <ProgressBar percent={totals.progress} />
              <div className="w-14 text-right tabular-nums text-xl font-bold">{totals.progress}%</div>
            </div>
          </>
        )}
      </div>

      {/* Lista de productos (solo lectura) */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Productos del pedido
          </div>
          <div className="text-xs text-gray-400">
            {loading ? 'Cargando...' : `Total: ${checklist.length}`}
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600 flex items-center">
            <Icons.Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando checklist...
          </div>
        ) : checklist.length === 0 ? (
          <div className="p-6 text-gray-500">
            No hay items para mostrar.
          </div>
        ) : (
          <div className="divide-y">
            {checklist.map((item) => {
              const reqQty = Math.floor(parseFloat(item.required_quantity) || 0);
              const scanned = Number(item.scanned_count || 0);
              const required = Number(item.required_scans || reqQty || 0);
              const isOk = !!item.is_verified;

              return (
                <div key={item.id} className={`p-4 hover:bg-gray-50 ${isOk ? '' : 'bg-red-50/60 border-l-4 border-red-400'}`}>
                  <div className="flex items-start justify-between">
                    <div className="pr-3 min-w-0">
                      <div className="flex items-center space-x-2">
                        {isOk ? (
                          <Icons.CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Icons.AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        <h4 className={`font-medium ${isOk ? 'text-green-800' : 'text-red-900'}`}>
                          {item.item_name}
                        </h4>
                        <span className={`px-2 py-0.5 text-[11px] rounded ${isOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {reqQty}x
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span>📦 {item.required_unit || 'unidad'}</span>
                        {item.required_weight && <span>⚖️ {item.required_weight}kg</span>}
                        {item.required_flavor && <span>🎨 {item.required_flavor}</span>}
                        {item.product_code && (
                          <span className="bg-blue-100 text-blue-800 border border-blue-200 rounded px-1">CÓDIGO: <span className="font-mono">{item.product_code}</span></span>
                        )}
                        {item.barcode && (
                          <span className="bg-gray-100 text-gray-800 border border-gray-200 rounded px-1">📊 <span className="font-mono">{item.barcode}</span></span>
                        )}
                      </div>

                      <div className="mt-2 text-sm md:text-base text-gray-700">
                        {typeof item.scan_progress === 'string'
                          ? `Progreso: ${item.scan_progress}`
                          : `Progreso: ${scanned}/${required || reqQty}`}
                      </div>

                      {item.verification_notes && (
                        <div className="mt-2 text-xs text-gray-600">
                          Notas: {item.verification_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {isOk ? (
                        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          <Icons.BadgeCheck className="w-3.5 h-3.5 mr-1" /> Verificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
                          <Icons.AlertCircle className="w-3.5 h-3.5 mr-1" /> Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
