import React, { useMemo, useState } from 'react';
import { postventaService, handleApiError } from '../services/api';
import toast from 'react-hot-toast';

const Section = ({ title, children, actions = null }) => (
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

const KeyValue = ({ label, value }) => (
  <div className="flex items-center justify-between py-1 text-sm">
    <span className="text-gray-500">{label}</span>
    <span className="text-gray-900 font-medium">{value ?? '-'}</span>
  </div>
);

const List = ({ items = [], empty = 'Sin registros', render }) => {
  if (!items?.length) return <div className="text-sm text-gray-500">{empty}</div>;
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((it, idx) => (
        <li key={idx} className="py-2">{render(it)}</li>
      ))}
    </ul>
  );
};

export default function PostventaPage() {
  // Estado base (IDs)
  const customer = useForm({ id: '1' });
  const order = useForm({ id: '116', number: 'ORD-116' });

  // Estado Customer360
  const [c360, setC360] = useState(null);
  const [c360Loading, setC360Loading] = useState(false);

  // Estado Mensajería/Consent
  const consent = useForm({ channel: 'whatsapp', scope: 'transaccional', optIn: 'true' });
  const message = useForm({ channel: 'whatsapp', scope: 'transaccional', content: 'Hola {{first_name}}, gracias por tu compra. ¿Cómo te fue con la entrega?', first_name: 'Cliente' });
  const [msgLoading, setMsgLoading] = useState(false);
  const [consLoading, setConsLoading] = useState(false);

  // Estado RFM
  const [rfm, setRfm] = useState(null);
  const [rfmLoading, setRfmLoading] = useState(false);

  // Estado Journeys
  const [journeyLoading, setJourneyLoading] = useState(false);

  const canSend = useMemo(() => !!customer.values.id && !!message.values.content, [customer.values.id, message.values.content]);

  // Actions
  const loadC360 = async () => {
    if (!customer.values.id) return toast.error('Ingresa customerId');
    try {
      setC360Loading(true);
      const resp = await postventaService.getCustomer360(customer.values.id);
      setC360(resp?.data || null);
    } catch (e) {
      toast.error(handleApiError(e, 'No fue posible cargar Customer 360'));
    } finally {
      setC360Loading(false);
    }
  };

  const doSetConsent = async () => {
    if (!customer.values.id) return toast.error('Ingresa customerId');
    try {
      setConsLoading(true);
      const resp = await postventaService.setConsent({
        customerId: Number(customer.values.id),
        channel: consent.values.channel,
        scope: consent.values.scope,
        optIn: String(consent.values.optIn) === 'true',
        source: 'ui'
      });
      if (resp?.success) toast.success('Consentimiento actualizado');
    } catch (e) {
      toast.error(handleApiError(e, 'No fue posible actualizar el consentimiento'));
    } finally {
      setConsLoading(false);
    }
  };

  const doSendMessage = async () => {
    if (!customer.values.id) return toast.error('Ingresa customerId');
    try {
      setMsgLoading(true);
      const resp = await postventaService.sendMessage({
        customerId: Number(customer.values.id),
        orderId: order.values.id ? Number(order.values.id) : null,
        channel: message.values.channel,
        content: message.values.content,
        variables: { first_name: message.values.first_name || 'Cliente' },
        scope: message.values.scope
      });
      if (resp?.success) toast.success('Mensaje enviado (stub)');
    } catch (e) {
      toast.error(handleApiError(e, 'No fue posible enviar el mensaje'));
    } finally {
      setMsgLoading(false);
    }
  };

  const doRfmRecompute = async () => {
    if (!customer.values.id) return toast.error('Ingresa customerId');
    try {
      setRfmLoading(true);
      const r1 = await postventaService.rfmRecompute({ customerId: Number(customer.values.id) });
      const r2 = await postventaService.getRfmProfile(Number(customer.values.id));
      setRfm(r2?.data || null);
      if (r1?.success) toast.success('RFM recalculado');
    } catch (e) {
      toast.error(handleApiError(e, 'No fue posible calcular RFM'));
    } finally {
      setRfmLoading(false);
    }
  };

  const doJourneyActivate = async () => {
    try {
      setJourneyLoading(true);
      const r = await postventaService.journeysActivate({ name: 'post_entrega_v1' });
      if (r?.success) toast.success('Journey activado');
    } catch (e) {
      toast.error(handleApiError(e, 'No fue posible activar journey'));
    } finally {
      setJourneyLoading(false);
    }
  };

  const doJourneyPause = async () => {
    try {
      setJourneyLoading(true);
      const r = await postventaService.journeysPause({ name: 'post_entrega_v1' });
      if (r?.success) toast.success('Journey pausado');
    } catch (e) {
      toast.error(handleApiError(e, 'No fue posible pausar journey'));
    } finally {
      setJourneyLoading(false);
    }
  };

  const doJourneyTestDelivered = async () => {
    if (!order.values.id) return toast.error('Ingresa orderId');
    try {
      setJourneyLoading(true);
      const r = await postventaService.journeysTestDelivered({
        orderId: Number(order.values.id),
        customerId: customer.values.id ? Number(customer.values.id) : null,
        orderNumber: order.values.number || null
      });
      if (r?.success) toast.success('Simulación enviada');
    } catch (e) {
      toast.error(handleApiError(e, 'No fue posible simular delivered'));
    } finally {
      setJourneyLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-0">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Postventa</h1>
        <p className="text-sm text-gray-500">Customer 360, Mensajería/Consentimientos, RFM y Journeys</p>
      </div>

      {/* Identificadores base */}
      <Section title="Identificadores">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Customer ID">
            <input name="id" value={customer.values.id} onChange={customer.onChange} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="1" />
          </Field>
          <Field label="Order ID (opcional)">
            <input name="id" value={order.values.id} onChange={(e) => order.set({ id: e.target.value })} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="116" />
          </Field>
          <Field label="Order Number (opcional)">
            <input name="number" value={order.values.number} onChange={order.onChange} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="ORD-116" />
          </Field>
        </div>
      </Section>

      {/* Customer 360 */}
      <Section
        title="Customer 360"
        actions={
          <button onClick={loadC360} disabled={c360Loading || !customer.values.id} className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">
            {c360Loading ? 'Cargando...' : 'Cargar 360'}
          </button>
        }
      >
        {c360 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-md p-3">
              <h3 className="font-semibold mb-2">Pedidos</h3>
              <KeyValue label="Total" value={c360?.orders?.summary?.orders_count} />
              <KeyValue label="Total gastado" value={c360?.orders?.summary?.total_spent} />
              <KeyValue label="Último pedido" value={c360?.orders?.summary?.last_order_at} />
            </div>
            <div className="border rounded-md p-3">
              <h3 className="font-semibold mb-2">Tickets</h3>
              <KeyValue label="Total" value={c360?.tickets?.summary?.tickets_total} />
              <KeyValue label="Abiertos" value={c360?.tickets?.summary?.tickets_open} />
              <List items={c360?.tickets?.recent || []} empty="Sin tickets" render={(t) => (
                <div className="flex items-center justify-between text-sm">
                  <span>#{t.id} • {t.category} • {t.status}</span>
                  <span className="text-gray-500">{t.priority}</span>
                </div>
              )} />
            </div>
            <div className="border rounded-md p-3">
              <h3 className="font-semibold mb-2">Encuestas</h3>
              <KeyValue label="Total" value={c360?.surveys?.summary?.surveys_total} />
              <KeyValue label="NPS" value={c360?.surveys?.summary?.avg_nps} />
              <KeyValue label="CSAT" value={c360?.surveys?.summary?.avg_csat} />
              <List items={c360?.surveys?.recent || []} empty="Sin encuestas" render={(s) => (
                <div className="text-sm">
                  <div>NPS: {s.nps} • CSAT: {s.csat} {s.comment ? '• ' + s.comment : ''}</div>
                  <div className="text-gray-500">{s.responded_at || s.sent_at}</div>
                </div>
              )} />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Ingresa un Customer ID y pulsa "Cargar 360".</div>
        )}
      </Section>

      {/* Mensajería y Consentimientos */}
      <Section
        title="Mensajería y Consentimientos"
        actions={(
          <>
            <button onClick={doSetConsent} disabled={consLoading || !customer.values.id} className="px-3 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50">
              {consLoading ? 'Guardando...' : 'Guardar Consentimiento'}
            </button>
            <button onClick={doSendMessage} disabled={msgLoading || !canSend} className="px-3 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50">
              {msgLoading ? 'Enviando...' : 'Enviar Mensaje'}
            </button>
          </>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-medium mb-2">Consentimiento</h4>
            <Field label="Canal">
              <select name="channel" value={consent.values.channel} onChange={consent.onChange} className="mt-1 w-full border rounded-md px-3 py-2">
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </Field>
            <Field label="Scope">
              <select name="scope" value={consent.values.scope} onChange={consent.onChange} className="mt-1 w-full border rounded-md px-3 py-2">
                <option value="transaccional">Transaccional</option>
                <option value="marketing">Marketing</option>
              </select>
            </Field>
            <Field label="Opt-in">
              <select name="optIn" value={consent.values.optIn} onChange={consent.onChange} className="mt-1 w-full border rounded-md px-3 py-2">
                <option value="true">Sí (opt-in)</option>
                <option value="false">No (opt-out)</option>
              </select>
            </Field>
          </div>
          <div className="md:col-span-2">
            <h4 className="font-medium mb-2">Mensaje</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Canal">
                <select name="channel" value={message.values.channel} onChange={message.onChange} className="mt-1 w-full border rounded-md px-3 py-2">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </Field>
              <Field label="Scope">
                <select name="scope" value={message.values.scope} onChange={message.onChange} className="mt-1 w-full border rounded-md px-3 py-2">
                  <option value="transaccional">Transaccional</option>
                  <option value="marketing">Marketing</option>
                </select>
              </Field>
              <Field label="first_name (variable)">
                <input name="first_name" value={message.values.first_name} onChange={message.onChange} className="mt-1 w-full border rounded-md px-3 py-2" />
              </Field>
            </div>
            <Field label="Contenido">
              <textarea name="content" value={message.values.content} onChange={message.onChange} rows={3} className="mt-1 w-full border rounded-md px-3 py-2" />
            </Field>
            <p className="text-xs text-gray-500">Variables disponibles: {'{{first_name}}'}</p>
          </div>
        </div>
      </Section>

      {/* RFM */}
      <Section
        title="Segmentación RFM"
        actions={(
          <button onClick={doRfmRecompute} disabled={rfmLoading || !customer.values.id} className="px-3 py-2 bg-sky-600 text-white rounded-md disabled:opacity-50">
            {rfmLoading ? 'Procesando...' : 'Recalcular y Ver Perfil'}
          </button>
        )}
      >
        {rfm ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-md p-3">
              <KeyValue label="Recency" value={rfm.rfm_recency} />
              <KeyValue label="Frequency" value={rfm.rfm_frequency} />
              <KeyValue label="Monetary" value={rfm.rfm_monetary} />
            </div>
            <div className="border rounded-md p-3">
              <KeyValue label="Segmento" value={rfm.rfm_segment} />
              <KeyValue label="Value Score" value={rfm.value_score} />
              <KeyValue label="Risk Score" value={rfm.risk_score} />
            </div>
            <div className="border rounded-md p-3">
              <KeyValue label="Ticket Promedio" value={rfm.avg_order_value} />
              <KeyValue label="Último Pedido" value={rfm.last_order_at} />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Recalcula para ver el perfil RFM.</div>
        )}
      </Section>

      {/* Journeys */}
      <Section
        title="Journey Post-Entrega v1"
        actions={(
          <>
            <button onClick={doJourneyActivate} disabled={journeyLoading} className="px-3 py-2 bg-green-600 text-white rounded-md disabled:opacity-50">Activar</button>
            <button onClick={doJourneyPause} disabled={journeyLoading} className="px-3 py-2 bg-yellow-600 text-white rounded-md disabled:opacity-50">Pausar</button>
            <button onClick={doJourneyTestDelivered} disabled={journeyLoading || !order.values.id} className="px-3 py-2 bg-purple-600 text-white rounded-md disabled:opacity-50">Simular Delivered</button>
          </>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Order ID">
            <input name="id" value={order.values.id} onChange={(e) => order.set({ id: e.target.value })} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="116" />
          </Field>
          <Field label="Order Number">
            <input name="number" value={order.values.number} onChange={order.onChange} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="ORD-116" />
          </Field>
        </div>
        <p className="text-xs text-gray-500 mt-2">El journey envía agradecimiento (stub) y la encuesta la maneja automáticamente el backend.</p>
      </Section>
    </div>
  );
}
