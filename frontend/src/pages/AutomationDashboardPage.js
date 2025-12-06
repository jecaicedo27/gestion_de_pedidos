import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Play, Pause, RotateCcw, Save, Plus, Zap, List, Activity, Server, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { io } from 'socket.io-client';

const Section = ({ title, icon: Icon, children, actions }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        {Icon ? <Icon className="w-4 h-4 text-blue-600" /> : null}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="flex items-center space-x-2">{actions}</div>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const ServiceCard = ({ name, data, onStart, onStop, onRestart, onSaveConfig }) => {
  const [interval, setIntervalVal] = useState(data.intervalMinutes || 5);
  useEffect(() => setIntervalVal(data.intervalMinutes || 5), [data.intervalMinutes]);

  const stats = data.stats || {};

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Server className={`w-4 h-4 ${data.running ? 'text-green-600' : 'text-gray-400'}`} />
          <span className="text-sm font-semibold">{name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${data.running ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {data.running ? 'Running' : 'Stopped'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={onStart} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex items-center">
            <Play className="w-3 h-3 mr-1" /> Start
          </button>
          <button onClick={onStop} className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs flex items-center">
            <Pause className="w-3 h-3 mr-1" /> Stop
          </button>
          <button onClick={onRestart} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center">
            <RotateCcw className="w-3 h-3 mr-1" /> Restart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500">Intervalo (min)</div>
          <div className="flex items-center space-x-2 mt-1">
            <input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setIntervalVal(parseInt(e.target.value || '1', 10))}
              className="w-20 px-2 py-1 text-sm border rounded"
            />
            <button
              onClick={() => onSaveConfig({ intervalMinutes: interval })}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs flex items-center"
            >
              <Save className="w-3 h-3 mr-1" /> Guardar
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500">Métricas</div>
          <div className="mt-1 text-xs text-gray-800 space-y-1">
            {Object.keys(stats).length === 0 ? (
              <div className="text-gray-400">Sin datos</div>
            ) : (
              Object.entries(stats).slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium">{String(v ?? '')}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500">Flags</div>
          <div className="mt-1 text-xs text-gray-800 space-y-1">
            {'webhooksConfigured' in data ? (
              <div className="flex justify-between">
                <span className="text-gray-500">Webhooks</span>
                <span className={`font-medium ${data.webhooksConfigured ? 'text-green-700' : 'text-gray-600'}`}>
                  {data.webhooksConfigured ? 'OK' : 'No'}
                </span>
              </div>
            ) : (
              <div className="text-gray-400">N/A</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AutomationDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [subs, setSubs] = useState([]);
  const [topicsInput, setTopicsInput] = useState('public.siigoapi.products.stock.update');
  const [logs, setLogs] = useState([]);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/monitor/status');
      if (res.data.success) {
        setStatus(res.data.data);
        setLogs((res.data.data.logs?.webhook_logs) || []);
      }
    } catch (e) {
      toast.error('Error cargando estado de servicios');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await api.get('/monitor/webhooks');
      if (res.data.success) {
        setSubs(res.data.data.subscriptions || []);
      }
    } catch (e) {
      toast.error('Error cargando suscripciones');
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadWebhooks();

    // Suscripción Socket.IO (opcional, listar futuros eventos)
    const socket = io('/', {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    // Futuro: socket.on('system-monitor', handler)
    return () => {
      try { socket.disconnect(); } catch {}
    };
  }, [loadStatus, loadWebhooks]);

  const action = async (path, body, okMsg) => {
    try {
      const res = await api.post(path, body || {});
      if (res.data.success) {
        toast.success(okMsg || 'Acción ejecutada');
        await loadStatus();
        await loadWebhooks();
      } else {
        toast.error(res.data.message || 'Acción falló');
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Error en la acción');
    }
  };

  const subscribeTopics = async () => {
    const topics = topicsInput.split(',').map(s => s.trim()).filter(Boolean);
    for (const t of topics) {
      await action('/monitor/webhooks/subscribe', { topic: t }, `Suscrito a ${t}`);
    }
  };

  const testWebhook = async () => {
    const topic = topicsInput.split(',').map(s => s.trim()).filter(Boolean)[0] || 'public.siigoapi.products.stock.update';
    await action('/monitor/test/webhook', { topic }, `Test webhook enviado (${topic})`);
  };

  if (loading && !status) {
    return (
      <div className="p-4">
        <div className="flex items-center text-gray-600">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Cargando dashboard de automatización...
        </div>
      </div>
    );
  }

  const services = status?.services || {};
  const stockSync = services.stockSync || { running: false, intervalMinutes: 5, stats: {} };
  const siigoUpdate = services.siigoUpdate || { running: false, intervalMinutes: 10, stats: {} };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-blue-700" />
          <h1 className="text-lg font-bold text-gray-900">Automatización y Listeners</h1>
        </div>
        <button onClick={loadStatus} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center">
          <RefreshCw className="w-4 h-4 mr-1" /> Refrescar
        </button>
      </div>

      <Section title="Servicios" icon={Activity}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ServiceCard
            name="StockSyncService"
            data={stockSync}
            onStart={() => action('/monitor/service/stocksync/start', null, 'StockSync iniciado')}
            onStop={() => action('/monitor/service/stocksync/stop', null, 'StockSync detenido')}
            onRestart={() => action('/monitor/service/stocksync/restart', null, 'StockSync reiniciado')}
            onSaveConfig={(cfg) => action('/monitor/service/stocksync/config', cfg, 'Configuración aplicada')}
          />
          <ServiceCard
            name="SiigoUpdateService"
            data={siigoUpdate}
            onStart={() => action('/monitor/service/siigoupdate/start', null, 'SiigoUpdate iniciado')}
            onStop={() => action('/monitor/service/siigoupdate/stop', null, 'SiigoUpdate detenido')}
            onRestart={() => action('/monitor/service/siigoupdate/restart', null, 'SiigoUpdate reiniciado')}
            onSaveConfig={(cfg) => action('/monitor/service/siigoupdate/config', cfg, 'Configuración aplicada')}
          />
        </div>
      </Section>

      <Section
        title="Webhooks SIIGO"
        icon={Zap}
        actions={
          <>
            <button onClick={subscribeTopics} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex items-center">
              <Plus className="w-3 h-3 mr-1" /> Suscribir
            </button>
            <button onClick={testWebhook} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs flex items-center">
              <Zap className="w-3 h-3 mr-1" /> Test webhook
            </button>
          </>
        }
      >
        <div className="mb-3">
          <label className="text-xs text-gray-600">Topics (separados por coma)</label>
          <input
            type="text"
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            placeholder="public.siigoapi.products.create, public.siigoapi.customers.update"
            value={topicsInput}
            onChange={(e) => setTopicsInput(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">Webhook ID</th>
                <th className="py-2 pr-4">Topic</th>
                <th className="py-2 pr-4">URL</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2 pr-4">Company</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-gray-400">Sin suscripciones en BD</td>
                </tr>
              ) : subs.map((s) => (
                <tr key={`${s.webhook_id}-${s.topic}`} className="border-t">
                  <td className="py-2 pr-4">{s.webhook_id}</td>
                  <td className="py-2 pr-4">{s.topic}</td>
                  <td className="py-2 pr-4">{s.url}</td>
                  <td className="py-2 pr-4">{s.active ? 'Sí' : 'No'}</td>
                  <td className="py-2 pr-4">{s.company_key || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Logs recientes" icon={List}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Topic</th>
                <th className="py-2 pr-4">Processed</th>
                <th className="py-2 pr-4">Error</th>
                <th className="py-2 pr-4">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-gray-400">Sin registros</td>
                </tr>
              ) : logs.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2 pr-4">{l.id}</td>
                  <td className="py-2 pr-4">{l.topic}</td>
                  <td className="py-2 pr-4">{l.processed ? 'Sí' : 'No'}</td>
                  <td className="py-2 pr-4">{l.error_message || '-'}</td>
                  <td className="py-2 pr-4">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

export default AutomationDashboardPage;
