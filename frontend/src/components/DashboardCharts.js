import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Colores para los gráficos
const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  secondary: '#6B7280'
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#6B7280', '#8B5CF6'];

// Componente para gráfico de líneas - Evolución de pedidos
export const OrderEvolutionChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando gráfico...</div>
      </div>
    );
  }

  const formattedData = data?.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('es-CO', { 
      month: 'short', 
      day: 'numeric' 
    })
  })) || [];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="date" 
          stroke="#6B7280"
          fontSize={12}
        />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip 
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="count" 
          stroke={COLORS.primary}
          strokeWidth={3}
          dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
          name="Pedidos"
        />
        <Line 
          type="monotone" 
          dataKey="revenue" 
          stroke={COLORS.success}
          strokeWidth={3}
          dot={{ fill: COLORS.success, strokeWidth: 2, r: 4 }}
          name="Ingresos ($)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// Componente para gráfico de barras - Métodos de entrega
export const DeliveryMethodChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando gráfico...</div>
      </div>
    );
  }

  const methodLabels = {
    domicilio: 'Domicilio',
    recogida_tienda: 'Recogida en Tienda',
    envio_nacional: 'Envío Nacional',
    envio_internacional: 'Envío Internacional'
  };

  const formattedData = data?.map(item => ({
    ...item,
    method: methodLabels[item.method] || item.method,
    total_amount: parseFloat(item.total_amount || 0)
  })) || [];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="method" 
          stroke="#6B7280"
          fontSize={12}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip 
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        <Bar 
          dataKey="count" 
          fill={COLORS.primary}
          name="Cantidad"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Componente para gráfico circular - Estados de pedidos
export const OrderStatusChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando gráfico...</div>
      </div>
    );
  }

  const statusLabels = {
    pendiente: 'Pendiente',
    confirmado: 'Confirmado',
    en_preparacion: 'En Preparación',
    listo: 'Listo',
    enviado: 'Enviado',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };

  const formattedData = data?.map((item, index) => ({
    ...item,
    name: statusLabels[item.status] || item.status,
    value: parseInt(item.count),
    color: PIE_COLORS[index % PIE_COLORS.length]
  })) || [];

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null; // No mostrar etiquetas para segmentos muy pequeños
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={formattedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

// Componente para gráfico de área - Ingresos acumulados
export const RevenueAreaChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando gráfico...</div>
      </div>
    );
  }

  const formattedData = data?.map(item => ({
    ...item,
    week: `Sem ${item.week}`,
    revenue: parseFloat(item.revenue || 0)
  })) || [];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="week" 
          stroke="#6B7280"
          fontSize={12}
        />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip 
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          formatter={(value) => [`$${value.toLocaleString()}`, 'Ingresos']}
        />
        <Area 
          type="monotone" 
          dataKey="revenue" 
          stroke={COLORS.success}
          fill={COLORS.success}
          fillOpacity={0.3}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

/**
 * Gráfico de líneas múltiples para tendencias del mensajero
 * Series: assigned, accepted, in_delivery, delivered, failed
 */
export const MessengerTrendsChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando gráfico...</div>
      </div>
    );
  }

  const formattedData = (data || []).map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
    assigned: Number(item.assigned || 0),
    accepted: Number(item.accepted || 0),
    in_delivery: Number(item.in_delivery || 0),
    delivered: Number(item.delivered || 0),
    failed: Number(item.failed || 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        <Line type="monotone" dataKey="assigned" name="Asignados" stroke={COLORS.info} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="accepted" name="Aceptados" stroke={COLORS.secondary} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="in_delivery" name="En ruta" stroke={COLORS.warning} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="delivered" name="Entregados" stroke={COLORS.success} strokeWidth={3} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="failed" name="Fallidos" stroke={COLORS.danger} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

/**
 * Gráfico de barras por método de entrega del mensajero
 */
export const MessengerByMethodChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando gráfico...</div>
      </div>
    );
  }

  const methodLabels = {
    mensajeria_urbana: 'Mensajería urbana',
    mensajeria_local: 'Mensajería local',
    domicilio: 'Domicilio'
  };

  const formattedData = (data || []).map(item => ({
    method: methodLabels[item.delivery_method] || item.delivery_method || 'Otro',
    count: parseInt(item.count || 0),
    total_amount: parseFloat(item.total_amount || 0)
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="method"
          stroke="#6B7280"
          fontSize={12}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        <Bar dataKey="count" name="Entregas" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * Gráfico de barras por hora de entrega del mensajero
 */
export const MessengerByHourChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando gráfico...</div>
      </div>
    );
  }

  const formattedData = (data || []).map(item => ({
    hour: `${String(item.hour).padStart(2, '0')}:00`,
    delivered: parseInt(item.delivered || 0)
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="hour" stroke="#6B7280" fontSize={12} />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        <Bar dataKey="delivered" name="Entregas" fill={COLORS.success} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default {
  OrderEvolutionChart,
  DeliveryMethodChart,
  OrderStatusChart,
  RevenueAreaChart,
  MessengerTrendsChart,
  MessengerByMethodChart,
  MessengerByHourChart
};
