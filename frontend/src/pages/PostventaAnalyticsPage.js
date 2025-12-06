import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { postventaAnalyticsService, handleApiError } from '../services/api';

const Section = ({ title, actions = null, children }) => (
  <div className="bg-white rounded-lg shadow p-4 mb-6">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center space-x-2">{actions}</div>
    </div>
    <div>{children}</div>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block text-sm mb-2">
    <span className="text-gray-700">{label}</span>
    {children}
  </label>
);

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };
  const set = (patch) => setValues((v) => ({ ...v, ...(typeof patch === 'function' ? patch(v) : patch) }));
  return { values, onChange, set };
}

const Empty = ({ text = 'Sin datos' }) => (
  <div className="text-sm text-gray-500">{text}</div>
);

const SimpleTable = ({ columns = [], rows = [] }) => {
  if (!rows || rows.length === 0) return <Empty />;
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600 border-b">
            {columns.map((c) => (
              <th key={c.key} className="py-2 pr-4">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-b last:border-b-0">
              {columns.map((c) => (
                <td key={c.key} className="py-2 pr-4 whitespace-nowrap">
                  {typeof c.render === 'function' ? c.render(r[c.key], r) : (r[c.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function PostventaAnalyticsPage() {
  // Filtros base
  const todayISO = new Date().toISOString().slice(0, 10);
  const monthAgoISO = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const filters = useForm({ from: monthAgoISO, to: todayISO, groupBy: 'day', by: 'channel' });

  // Estados de datos
  const [loading, setLoading] = useState(false);
  const [npsSummary, setNpsSummary] = useState([]);
  const [npsComments, setNpsComments] = useState([]);
  const [responseRate, setResponseRate] = useState([]);
  const [churnRisk, setChurnRisk] = useState({ distribution: {}, topHigh: [] });
  const [loyalty, setLoyalty] = useState({ levels: [], totals: {}, topBalances: [], reasons: [] });
  const [referrals, setReferrals] = useState({ states: [], totals: {}, latest: [] });

  const loadAll = async () => {
    try {
      setLoading(true);
      const { from, to, groupBy, by } = filters.values;

      const [npsS, npsC, respR, churnR, loy, ref] = await Promise.all([
        postventaAnalyticsService.npsSummary({ from, to, groupBy, by }),
        postventaAnalyticsService.npsComments({ from, to, limit: 10 }),
        postventaAnalyticsService.responseRate({ from, to, by }),
        postventaAnalyticsService.churnRisk(),
        postventaAnalyticsService.loyalty(),
        postventaAnalyticsService.referrals()
      ]);

      setNpsSummary(npsS?.data || []);
      setNpsComments(npsC?.data || []);
      setResponseRate(respR?.data || []);
      setChurnRisk(churnR?.data || { distribution: {}, topHigh: [] });
      setLoyalty(loy?.data || { levels: [], totals: {}, topBalances: [], reasons: [] });
      setReferrals(ref?.data || { states: [], totals: {}, latest: [] });
    } catch (e) {
      toast.error(handleApiError(e, 'No fue posible cargar Analytics Postventa'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carga inicial
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-0">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Postventa</h1>
        <p className="text-sm text-gray-500">NPS/CSAT, Tasa de respuesta, Riesgo de Churn, Loyalty y Referidos</p>
      </div>

      {/* Filtros */}
      <Section
        title="Filtros"
        actions={
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Aplicar'}
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Field label="Desde (YYYY-MM-DD)">
            <input
              name="from"
              type="date"
              value={filters.values.from}
              onChange={filters.onChange}
              className="mt-1 w-full border rounded-md px-3 py-2"
            />
          </Field>
          <Field label="Hasta (YYYY-MM-DD)">
            <input
              name="to"
              type="date"
              value={filters.values.to}
              onChange={filters.onChange}
              className="mt-1 w-full border rounded-md px-3 py-2"
            />
          </Field>
          <Field label="Agrupar por">
            <select
              name="groupBy"
              value={filters.values.groupBy}
              onChange={filters.onChange}
              className="mt-1 w-full border rounded-md px-3 py-2"
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </Field>
          <Field label="Desglose">
            <select
              name="by"
              value={filters.values.by}
              onChange={filters.onChange}
              className="mt-1 w-full border rounded-md px-3 py-2"
            >
              <option value="">Ninguno</option>
              <option value="channel">Canal</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button
              onClick={loadAll}
              disabled={loading}
              className="w-full px-3 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </Section>

      {/* NPS/CSAT/CES */}
      <Section title="NPS / CSAT / CES (resumen)">
        <SimpleTable
          columns={[
            { key: 'grp', title: 'Grupo' },
            { key: 'channel', title: 'Canal' },
            { key: 'sent', title: 'Enviadas' },
            { key: 'responses', title: 'Respuestas' },
            { key: 'avg_nps', title: 'NPS prom' },
            { key: 'avg_csat', title: 'CSAT prom' },
            { key: 'avg_ces', title: 'CES prom' }
          ]}
          rows={Array.isArray(npsSummary) ? npsSummary : []}
        />
      </Section>

      <Section title="Comentarios recientes (UGC)">
        {npsComments && npsComments.length ? (
          <ul className="divide-y divide-gray-100">
            {npsComments.map((c) => (
              <li key={c.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-gray-800">NPS: {c.nps ?? '-'} • CSAT: {c.csat ?? '-'} • Canal: {c.channel}</div>
                  <div className="text-gray-500">{c.responded_at || c.sent_at || ''}</div>
                </div>
                {c.comment ? <div className="text-gray-700 mt-1">{c.comment}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="Sin comentarios en el rango seleccionado" />
        )}
      </Section>

      {/* Tasa de respuesta */}
      <Section title="Tasa de respuesta">
        <SimpleTable
          columns={[
            { key: 'grp', title: 'Grupo' },
            { key: 'sent', title: 'Enviadas' },
            { key: 'responses', title: 'Respondidas' },
            { key: 'response_rate', title: 'Tasa %' }
          ]}
          rows={Array.isArray(responseRate) ? responseRate : []}
        />
      </Section>

      {/* Churn Risk */}
      <Section title="Riesgo de Churn">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="border rounded-md p-3">
            <h4 className="font-semibold mb-2">Distribución (conteo)</h4>
            <ul className="space-y-1">
              <li>0-19: {churnRisk?.distribution?.b_0_19 ?? 0}</li>
              <li>20-39: {churnRisk?.distribution?.b_20_39 ?? 0}</li>
              <li>40-59: {churnRisk?.distribution?.b_40_59 ?? 0}</li>
              <li>60-79: {churnRisk?.distribution?.b_60_79 ?? 0}</li>
              <li>80-100: {churnRisk?.distribution?.b_80_100 ?? 0}</li>
              <li>Promedio: {churnRisk?.distribution?.avg_score ?? '-'}</li>
            </ul>
          </div>
          <div className="md:col-span-2 border rounded-md p-3">
            <h4 className="font-semibold mb-2">Top alto riesgo</h4>
            {Array.isArray(churnRisk?.topHigh) && churnRisk.topHigh.length ? (
              <SimpleTable
                columns={[
                  { key: 'customer_id', title: 'Cliente' },
                  { key: 'score', title: 'Score' },
                  { key: 'rfm_segment', title: 'Segmento' },
                  { key: 'value_score', title: 'Valor' },
                  { key: 'risk_score', title: 'Riesgo' },
                  { key: 'updated_at', title: 'Actualizado' }
                ]}
                rows={churnRisk.topHigh}
              />
            ) : (
              <Empty text="Sin clientes en alto riesgo aún" />
            )}
          </div>
        </div>
      </Section>

      {/* Loyalty */}
      <Section title="Loyalty (Puntos)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="border rounded-md p-3">
            <h4 className="font-semibold mb-2">Niveles</h4>
            <SimpleTable
              columns={[
                { key: 'level', title: 'Nivel' },
                { key: 'customers', title: 'Clientes' }
              ]}
              rows={loyalty?.levels || []}
            />
          </div>
          <div className="border rounded-md p-3">
            <h4 className="font-semibold mb-2">Resumen</h4>
            <ul className="space-y-1">
              <li>Total puntos: {loyalty?.totals?.total_points ?? 0}</li>
              <li>Saldo promedio: {loyalty?.totals?.avg_balance ?? 0}</li>
            </ul>
          </div>
          <div className="border rounded-md p-3">
            <h4 className="font-semibold mb-2">Motivos (movimientos)</h4>
            <SimpleTable
              columns={[
                { key: 'reason', title: 'Motivo' },
                { key: 'movements', title: 'Movs' },
                { key: 'total_points', title: 'Puntos' }
              ]}
              rows={loyalty?.reasons || []}
            />
          </div>
        </div>
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Top saldos</h4>
          <SimpleTable
            columns={[
              { key: 'customer_id', title: 'Cliente' },
              { key: 'balance', title: 'Saldo' },
              { key: 'level', title: 'Nivel' }
            ]}
            rows={loyalty?.topBalances || []}
          />
        </div>
      </Section>

      {/* Referidos */}
      <Section title="Referidos">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="border rounded-md p-3">
            <h4 className="font-semibold mb-2">Estados</h4>
            <SimpleTable
              columns={[
                { key: 'state', title: 'Estado' },
                { key: 'count', title: 'Cantidad' }
              ]}
              rows={referrals?.states || []}
            />
          </div>
          <div className="border rounded-md p-3">
            <h4 className="font-semibold mb-2">Resumen</h4>
            <ul className="space-y-1">
              <li>Total referidos: {referrals?.totals?.total ?? 0}</li>
              <li>Puntos recompensa: {referrals?.totals?.total_reward_points ?? 0}</li>
            </ul>
          </div>
          <div className="border rounded-md p-3 md:col-span-1">
            <h4 className="font-semibold mb-2">Últimos</h4>
            <SimpleTable
              columns={[
                { key: 'id', title: 'ID' },
                { key: 'referrer_customer_id', title: 'Referrer' },
                { key: 'referred_customer_id', title: 'Referred' },
                { key: 'state', title: 'Estado' }
              ]}
              rows={referrals?.latest || []}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
