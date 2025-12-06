import React, { useEffect, useRef, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { packagingProgressService } from '../services/api';
import * as Icons from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_IN_PACKAGING = new Set(['en_empaque', 'en_preparacion']);

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

export default function PackagingProgressPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  const normalizeFromListRow = (r) => {
    const total = Number(r.item_count || r.total_items || 0);
    const verified = Number(r.verified_items || 0);
    const progress_pct = total > 0 ? Math.round((verified / total) * 100) : 0;
    return {
      id: r.id || r.orderId,
      order_number: r.order_number,
      customer_name: r.customer_name || '-',
      status: r.status,
      packaging_status: r.packaging_status,
      packaging_locked_by: r.packaging_locked_by || null,
      packaging_lock_user_id: r.packaging_lock_user_id || null,
      packaging_lock_expires_at: r.packaging_lock_expires_at || null,
      total_items: total,
      verified_items: verified,
      pending_items: Math.max(0, total - verified),
      progress_pct,
      created_at: r.created_at,
      started: !!r.started,
    };
  };

  const normalizeFromSnapshot = (s) => {
    const total = Number(s.total_items || 0);
    const verified = Number(s.verified_items || 0);
    const progress_pct = total > 0 ? Math.round((verified / total) * 100) : 0;
    return {
      id: s.orderId,
      order_number: s.order_number,
      customer_name: '-', // snapshot no incluye cliente; se mantiene del estado si existe
      status: s.status,
      packaging_status: s.packaging_status,
      packaging_locked_by: s.packaging_locked_by || null,
      packaging_lock_user_id: s.packaging_lock_user_id || null,
      packaging_lock_expires_at: s.packaging_lock_expires_at || null,
      total_items: total,
      verified_items: verified,
      pending_items: Math.max(0, total - verified),
      progress_pct,
    };
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const resp = await packagingProgressService.getList();
      // Normalizar a lista
      const list = Array.isArray(resp?.data)
        ? resp.data
        : Array.isArray(resp?.data?.data)
        ? resp.data.data
        : Array.isArray(resp)
        ? resp
        : Array.isArray(resp?.orders)
        ? resp.orders
        : [];
      const mapped = list.map(normalizeFromListRow);
      setRows(mapped);
    } catch (e) {
      console.error('Error cargando progreso de empaque:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

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
      // También suscribir a cambios de estado para remover/añadir si cambia fuera del módulo de empaque
      try { socket.emit('join-orders-updates'); } catch {}
    };
    const handleDisconnect = () => setConnected(false);

    const handlePackagingProgress = (payload) => {
      try {
        const snap = normalizeFromSnapshot(payload || {});
        // Si el pedido ya no está en empaque, quitarlo
        if (!STATUS_IN_PACKAGING.has(String(snap.status || '').toLowerCase())) {
          setRows((prev) => prev.filter((r) => r.id !== snap.id));
          return;
        }
        // Upsert
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.id === snap.id);
          if (idx === -1) {
            return [{ ...snap }, ...prev];
          }
          const current = prev[idx];
          return [
            ...prev.slice(0, idx),
            { ...current, ...snap, customer_name: current.customer_name || snap.customer_name || '-' },
            ...prev.slice(idx + 1),
          ];
        });
      } catch (e) {
        console.warn('Error manejando packaging-progress:', e);
      }
    };

    const handleOrderStatusChanged = (payload) => {
      try {
        const id = payload?.orderId;
        const toStatus = String(payload?.to_status || '').toLowerCase();
        if (!id) return;
        // Si se movió fuera de empaque, remover
        if (!STATUS_IN_PACKAGING.has(toStatus)) {
          setRows((prev) => prev.filter((r) => r.id !== id));
        }
      } catch (_) {}
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('packaging-progress', handlePackagingProgress);
    socket.on('order-status-changed', handleOrderStatusChanged);

    return () => {
      try {
        socket.off('packaging-progress', handlePackagingProgress);
        socket.off('order-status-changed', handleOrderStatusChanged);
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, []);

  const empty = !loading && rows.length === 0;

  const summary = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.progress_pct >= 100).length;
    const inProgress = rows.filter((r) => r.progress_pct > 0 && r.progress_pct < 100).length;
    const notStarted = total - completed - inProgress;
    return { total, completed, inProgress, notStarted };
  }, [rows]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold flex items-center">
            <Icons.Activity className="w-5 h-5 mr-2 text-blue-600" />
            Progreso de Empaque
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Vista en tiempo real del avance de los pedidos en empaque. <ReadOnlyBadge />
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <div className={`inline-flex items-center px-2 py-1 rounded-md ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {connected ? <Icons.Wifi className="w-4 h-4 mr-1" /> : <Icons.WifiOff className="w-4 h-4 mr-1" />}
            {connected ? 'Tiempo real activo' : 'Sin conexión tiempo real'}
          </div>
        </div>
      </div>

      {/* Resumen simple */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">Pedidos en Empaque</div>
          <div className="text-lg font-semibold">{summary.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">Completados</div>
          <div className="text-lg font-semibold text-green-600">{summary.completed}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">En Progreso</div>
          <div className="text-lg font-semibold text-blue-600">{summary.inProgress}</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">No Iniciados</div>
          <div className="text-lg font-semibold text-yellow-600">{summary.notStarted}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando pedidos con estado: <span className="font-medium">en_empaque</span> / <span className="font-medium">en_preparacion</span>
          </div>
          <div className="text-xs text-gray-400">
            {loading ? 'Cargando...' : `Total: ${rows.length}`}
          </div>
        </div>

        {empty ? (
          <div className="p-8 text-center text-gray-500">
            <Icons.Box className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            No hay pedidos en proceso de empaque.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left">Pedido</th>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-left w-64">Progreso</th>
                  <th className="px-4 py-2 text-left">Verificados</th>
                  <th className="px-4 py-2 text-left">Empaquetador</th>
                  <th className="px-4 py-2 text-left">Bloqueo</th>
                  <th className="px-4 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">#{r.order_number || r.id}</div>
                      <div className="text-xs text-gray-500">ID: {r.id}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="truncate max-w-[240px]">{r.customer_name || '-'}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border
                        ${String(r.status).toLowerCase() === 'en_preparacion' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-700 border-blue-200'}
                      `}>
                        {String(r.status || '').replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2 w-64">
                      <div className="flex items-center space-x-2">
                        <ProgressBar percent={r.progress_pct} />
                        <div className="w-14 text-right tabular-nums text-xl font-bold">{r.progress_pct}%</div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="tabular-nums">
                        {r.verified_items}/{r.total_items}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="truncate max-w-[160px]">{r.packaging_locked_by || '-'}</div>
                    </td>
                    <td className="px-4 py-2">
                      {r.packaging_lock_user_id ? (
                        <span className="inline-flex items-center text-xs text-red-600">
                          <Icons.Lock className="w-3.5 h-3.5 mr-1" />
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-gray-500">
                          <Icons.Unlock className="w-3.5 h-3.5 mr-1" />
                          Libre
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/packaging-readonly/${r.id}`}
                        className="inline-flex items-center px-2 py-1 text-xs rounded-md border bg-white hover:bg-gray-50"
                        title="Ver checklist (solo lectura)"
                      >
                        <Icons.Eye className="w-3.5 h-3.5 mr-1" />
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
