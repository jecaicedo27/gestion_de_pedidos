import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';

// Colores para gráficos
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
];

// Formato de moneda
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
};

// Formato de números
const formatNumber = (value) => {
  return new Intl.NumberFormat('es-CO').format(value || 0);
};

// Helper: formatear correctamente fechas 'YYYY-MM-DD' como fecha local (evita desfase de zona horaria)
const formatYMDLabelES = (s) => {
  try {
    if (!s) return '';
    const str = String(s);
    // tomar solo la parte de fecha si viene con hora
    const ymd = str.includes('T') ? str.split('T')[0] : (str.includes(' ') ? str.split(' ')[0] : str);
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) {
      return new Date(str).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
    }
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
  } catch {
    return String(s);
  }
};

// Componente: Gráfico de envíos diarios
export const DailyShipmentsChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando datos...</div>
      </div>
    );
  }

  if (!data?.chartData?.length) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No hay datos de envíos disponibles
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={[...data.chartData].reverse()}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => formatYMDLabelES(value)}
          />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" tickFormatter={formatCurrency} />
          <Tooltip 
            labelFormatter={(value) => formatYMDLabelES(value)}
            formatter={(value, name) => [
              name === 'revenue' ? formatCurrency(value) : formatNumber(value),
              name === 'shipments' ? 'Envíos' : 
              name === 'revenue' ? 'Ingresos' : 
              'Valor Promedio'
            ]}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="shipments" fill="#3B82F6" name="Envíos" />
          <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Ingresos" />
        </ComposedChart>
      </ResponsiveContainer>
      
      {data.summary && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatNumber(data.summary.totalShipments)}</div>
            <div className="text-gray-500">Total Envíos (30d)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatNumber(data.summary.avgDailyShipments)}</div>
            <div className="text-gray-500">Promedio Diario</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{formatNumber(data.summary.lastWeekShipments)}</div>
            <div className="text-gray-500">Última Semana</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente: Gráfico de principales ciudades de envío
export const TopShippingCitiesChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando datos...</div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No hay datos de ciudades disponibles
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 10)} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={formatNumber} />
          <YAxis dataKey="city" type="category" width={100} />
          <Tooltip 
            formatter={(value, name) => [
              name === 'orderCount' ? formatNumber(value) : 
              name === 'totalRevenue' ? formatCurrency(value) : 
              formatCurrency(value),
              name === 'orderCount' ? 'Pedidos' : 
              name === 'totalRevenue' ? 'Ingresos' : 
              'Valor Promedio'
            ]}
          />
          <Legend />
          <Bar dataKey="orderCount" fill="#3B82F6" name="Pedidos" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Componente: Análisis de mejores clientes
export const TopCustomersTable = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando datos...</div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No hay datos de clientes disponibles
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pedidos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Gastado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Promedio
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Última Compra
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.slice(0, 15).map((customer, index) => (
            <tr key={customer.document} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {customer.name}
                </div>
                <div className="text-sm text-gray-500">
                  {customer.document}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  customer.customerType === 'VIP' ? 'bg-purple-100 text-purple-800' :
                  customer.customerType === 'Frecuente' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {customer.customerType}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatNumber(customer.orderCount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {formatCurrency(customer.totalSpent)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(customer.avgOrderValue)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatYMDLabelES(String(customer.lastOrderDate || '').slice(0, 10))}
                <div className="text-xs text-gray-400">
                  hace {customer.daysSinceLastOrder} días
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Componente: Análisis de recompras de clientes
export const CustomerRepeatPurchasesChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando datos...</div>
      </div>
    );
  }

  if (!data?.distribution?.length) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No hay datos de recompras disponibles
      </div>
    );
  }

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.distribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ frequency, percentage }) => `${frequency}: ${percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="customerCount"
            >
              {data.distribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatNumber(value), 'Clientes']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {data.summary && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatNumber(data.summary.totalCustomers)}</div>
            <div className="text-gray-500">Total Clientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatNumber(data.summary.repeatCustomers)}</div>
            <div className="text-gray-500">Clientes Repetitivos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{data.summary.repeatRate}%</div>
            <div className="text-gray-500">Tasa de Recompra</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente: Nuevos clientes diarios
export const NewCustomersDailyChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando datos...</div>
      </div>
    );
  }

  if (!data?.chartData?.length) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No hay datos de nuevos clientes disponibles
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data.chartData].reverse()}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => formatYMDLabelES(value)}
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(value) => formatYMDLabelES(value)}
            formatter={(value) => [formatNumber(value), 'Nuevos Clientes']}
          />
          <Area 
            type="monotone" 
            dataKey="newCustomers" 
            stroke="#10B981" 
            fill="#10B981" 
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
      
      {data.summary && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatNumber(data.summary.totalNewCustomers)}</div>
            <div className="text-gray-500">Nuevos (30d)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatNumber(data.summary.avgDailyNew)}</div>
            <div className="text-gray-500">Promedio Diario</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{formatNumber(data.summary.lastWeekNew)}</div>
            <div className="text-gray-500">Última Semana</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente: Clientes perdidos
export const LostCustomersAnalysis = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando datos...</div>
      </div>
    );
  }

  if (!data?.byRiskLevel || Object.keys(data.byRiskLevel).length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No hay datos de clientes perdidos disponibles
      </div>
    );
  }

  const riskLevels = Object.entries(data.byRiskLevel).filter(([_, customers]) => customers.length > 0);

  return (
    <div>
      <div className="space-y-4">
        {riskLevels.map(([riskLevel, customers]) => (
          <div key={riskLevel}>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`font-medium ${
                riskLevel === 'Muy perdido' ? 'text-red-600' :
                riskLevel === 'En riesgo alto' ? 'text-orange-600' :
                riskLevel === 'En riesgo medio' ? 'text-yellow-600' :
                'text-blue-600'
              }`}>
                {riskLevel} ({customers.length} clientes)
              </h4>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              {customers.slice(0, 5).map((customer) => (
                <div key={customer.document} className="flex justify-between items-center py-1 text-sm">
                  <div>
                    <span className="font-medium">{customer.name}</span>
                    <span className="text-gray-500 ml-2">({customer.totalOrders} pedidos)</span>
                  </div>
                  <div className="text-right">
                    <div>{formatCurrency(customer.totalSpent)}</div>
                    <div className="text-xs text-gray-500">hace {customer.daysSinceLastOrder} días</div>
                  </div>
                </div>
              ))}
              {customers.length > 5 && (
                <div className="text-xs text-gray-500 mt-2">
                  ... y {customers.length - 5} clientes más
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {data.summary && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{formatNumber(data.summary.totalLostCustomers)}</div>
            <div className="text-gray-500">Clientes en Riesgo</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(data.summary.potentialLostRevenue)}</div>
            <div className="text-gray-500">Ingresos en Riesgo</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente: Tendencias de ventas semanales
export const SalesTrendsChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando datos...</div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No hay datos de tendencias disponibles
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="weekStart" 
            tickFormatter={(value) => formatYMDLabelES(value)}
          />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" tickFormatter={formatCurrency} />
          <Tooltip 
            labelFormatter={(value) => `Semana del ${formatYMDLabelES(value)}`}
            formatter={(value, name) => [
              name === 'totalRevenue' ? formatCurrency(value) : formatNumber(value),
              name === 'orderCount' ? 'Pedidos' : 
              name === 'totalRevenue' ? 'Ingresos' : 
              name === 'uniqueCustomers' ? 'Clientes Únicos' :
              'Valor Promedio'
            ]}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="orderCount" fill="#3B82F6" name="Pedidos" />
          <Line yAxisId="right" type="monotone" dataKey="totalRevenue" stroke="#10B981" strokeWidth={2} name="Ingresos" />
          <Line yAxisId="left" type="monotone" dataKey="uniqueCustomers" stroke="#F59E0B" strokeWidth={2} name="Clientes Únicos" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// Componente: Rendimiento de productos
export const ProductPerformanceTable = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando datos...</div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No hay datos de productos disponibles
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Producto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pedidos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cantidad
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ingresos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio Promedio
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.slice(0, 15).map((product, index) => (
            <tr key={product.productCode} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {product.productName}
                </div>
                <div className="text-sm text-gray-500">
                  {product.productCode}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatNumber(product.orderCount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatNumber(product.totalQuantity)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {formatCurrency(product.totalRevenue)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(product.avgPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
