import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService, analyticsService, messengerService } from '../services/api';
import StatCard from '../components/StatCard';
import DashboardCard from '../components/DashboardCard';
import DashboardAlerts from '../components/DashboardAlerts';
import {
  OrderEvolutionChart,
  DeliveryMethodChart,
  OrderStatusChart,
  RevenueAreaChart,
  MessengerTrendsChart,
  MessengerByMethodChart,
  MessengerByHourChart
} from '../components/DashboardCharts';
import {
  DailyShipmentsChart,
  TopShippingCitiesChart,
  TopCustomersTable,
  CustomerRepeatPurchasesChart,
  NewCustomersDailyChart,
  LostCustomersAnalysis,
  SalesTrendsChart,
  ProductPerformanceTable
} from '../components/AdvancedDashboardCharts';
import ColombiaHeatMap from '../components/ColombiaHeatMap';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const { user, getRoleName } = useAuth();
  const navigate = useNavigate();
  
  const isMessenger = user?.role === 'mensajero';
  const isPrivileged = ['admin', 'logistica', 'cartera'].includes(user?.role);
  
  const [dashboardData, setDashboardData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado para vista de Mensajero
  const [cashSummary, setCashSummary] = useState(null);
  const [messengerStats, setMessengerStats] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesPagination, setDeliveriesPagination] = useState({ page: 1, page_size: 10, total: 0, pages: 0 });
  const [messengerLoading, setMessengerLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const messengerSectionRef = useRef(null);

  // Helpers y cargas de datos para Mensajero
  const buildRangeParams = () => {
    const params = {};
    if (dateRange.from) {
      params.from = new Date(`${dateRange.from}T00:00:00`).toISOString();
    }
    if (dateRange.to) {
      params.to = new Date(`${dateRange.to}T23:59:59`).toISOString();
    }
    return params;
  };

  const loadMessengerData = async () => {
    try {
      setMessengerLoading(true);
      const params = buildRangeParams();
      const res = await messengerService.getCashSummary(params);
      setCashSummary(res.data);
    } catch (e) {
      console.error('Error cargando resumen de mensajero:', e);
      toast.error('Error cargando resumen de caja');
    } finally {
      setMessengerLoading(false);
    }
  };

  const loadDeliveries = async (page = 1) => {
    try {
      setMessengerLoading(true);
      const params = { ...buildRangeParams(), page, page_size: deliveriesPagination.page_size };
      const res = await messengerService.getDeliveries(params);
      setDeliveries(res.data?.results || []);
      setDeliveriesPagination(res.data?.pagination || { page, page_size: deliveriesPagination.page_size, total: 0, pages: 0 });
    } catch (e) {
      console.error('Error cargando historial de entregas:', e);
      toast.error('Error cargando historial de entregas');
    } finally {
      setMessengerLoading(false);
    }
  };

  // Estadísticas del mensajero
  const loadMessengerStats = async () => {
    try {
      setMessengerLoading(true);
      const params = buildRangeParams();
      const res = await messengerService.getStats(params);
      setMessengerStats(res.data || null);
    } catch (e) {
      console.error('Error cargando estadísticas del mensajero:', e);
      toast.error('Error cargando estadísticas del mensajero');
    } finally {
      setMessengerLoading(false);
    }
  };

  // Cargar datos del dashboard
  const loadDashboardData = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) {
        setRefreshing(true);
      }
      
      const response = await orderService.getDashboardStats();
      setDashboardData(response.data);
      
      if (showRefreshToast) {
        toast.success('Dashboard actualizado');
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      toast.error('Error cargando datos del dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Cargar datos de analytics avanzados
  const loadAnalyticsData = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) {
        setRefreshing(true);
      }
      
      const response = await analyticsService.getAdvancedDashboard();
      setAnalyticsData(response.data);
      
      if (showRefreshToast) {
        toast.success('Analytics actualizados');
      }
    } catch (error) {
      console.error('Error cargando analytics:', error);
      toast.error('Error cargando datos de analytics');
    } finally {
      setAnalyticsLoading(false);
      if (showRefreshToast) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    // Redirección segura: si admin/logística abre /dashboard?view=mensajero, enviar a /orders?view=mensajero
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'mensajero' && ['admin','logistica'].includes(user?.role)) {
      navigate('/orders?view=mensajero', { replace: true });
      return;
    }

    loadDashboardData();

    // Cargar analytics para roles autorizados (admin, logística, cartera)
    if (isPrivileged) {
      loadAnalyticsData();
    }

    // Cargar datos del mensajero
    if (user?.role === 'mensajero') {
      loadMessengerData();
      loadDeliveries(1);
      loadMessengerStats();

      // Si viene desde la navegación "Vista de Mensajero", hacer scroll a la sección
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'mensajero' && messengerSectionRef.current) {
        messengerSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // Auto-refresh cada 5 minutos
    const interval = setInterval(() => {
      loadDashboardData();
      if (isPrivileged) {
        loadAnalyticsData();
      }
      if (user?.role === 'mensajero') {
        loadMessengerData();
        loadDeliveries(1);
        loadMessengerStats();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.role]);

  // Manejar click en tarjetas de estado
  const handleStatusCardClick = (status) => {
    navigate(`/orders?status=${status}`);
  };

  // Formatear números para mostrar
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('es-CO').format(number || 0);
  };

  // Badges compactos para que el mensajero vea rápido qué se cobró en efectivo o por transferencia
  const badgeClass = (variant) =>
    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ' +
    (variant === 'cash'
      ? 'bg-green-50 text-green-700 border-green-200'
      : variant === 'transfer'
      ? 'bg-sky-50 text-sky-700 border-sky-200'
      : 'bg-gray-50 text-gray-700 border-gray-200');

  const renderCobro = (d) => {
    const pm = (d.payment_method || '').toLowerCase();
    const prodIsTransfer = pm === 'transferencia' || Number(d.payment_collected || 0) === 0;

    const prodBadge = prodIsTransfer ? (
      <span className={badgeClass('transfer')}>
        <Icons.ArrowLeftRight className="w-3 h-3 mr-1" />
        Prod: Transferencia
      </span>
    ) : (
      <span className={badgeClass('cash')}>
        <Icons.Banknote className="w-3 h-3 mr-1" />
        Prod: {formatCurrency(d.payment_collected)}
      </span>
    );

    // Si más adelante guardamos delivery_fee_payment_method, podemos usarlo aquí.
    const domiIsCash = Number(d.delivery_fee_collected || 0) > 0;
    const domiBadge = domiIsCash ? (
      <span className={badgeClass('cash')}>
        <Icons.Banknote className="w-3 h-3 mr-1" />
        Domi: {formatCurrency(d.delivery_fee_collected)}
      </span>
    ) : (
      <span className={badgeClass('transfer')}>
        <Icons.ArrowLeftRight className="w-3 h-3 mr-1" />
        Domi: Transferencia
      </span>
    );

    return (
      <div className="flex flex-col gap-1">
        {prodBadge}
        {domiBadge}
      </div>
    );
  };

  // Obtener etiquetas de estado en español
  const getStatusLabel = (status) => {
    const labels = {
      pendiente: 'Pendientes',
      confirmado: 'Confirmados',
      en_preparacion: 'En Preparación',
      listo: 'Listos',
      enviado: 'Enviados',
      entregado: 'Entregados',
      cancelado: 'Cancelados'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-96"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { statusStats, financialMetrics, charts, performance, alerts } = dashboardData || {};

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-gray-600">
            Bienvenido, {user?.full_name} ({getRoleName(user?.role)})
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadDashboardData(true);
              if (isPrivileged) {
                loadAnalyticsData(true);
              }
            }}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            <Icons.RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/orders/create')}
              className="btn btn-primary"
            >
              <Icons.Plus className="w-4 h-4 mr-2" />
              Nuevo Pedido
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-6 mb-8">
        <StatCard
          title="Total Pedidos"
          value={formatNumber(dashboardData?.totalOrders || 0)}
          subtitle="Registrados"
          icon="FileText"
          color="blue"
          clickable={true}
          onClick={() => navigate('/orders')}
          loading={loading}
        />
        
        <StatCard
          title="Pendientes Facturación"
          value={formatNumber(dashboardData?.pendingBilling || 0)}
          subtitle="Por verificar"
          icon="Receipt"
          color="orange"
          clickable={true}
          onClick={() => handleStatusCardClick('pendiente_facturacion')}
          loading={loading}
        />
        
        <StatCard
          title="Pendientes Cartera"
          value={formatNumber(dashboardData?.pendingPayment || 0)}
          subtitle="Por verificar"
          icon="Folder"
          color="yellow"
          clickable={true}
          onClick={() => handleStatusCardClick('revision_cartera')}
          loading={loading}
        />
        
        <StatCard
          title="Pendientes Logística"
          value={formatNumber(dashboardData?.pendingLogistics || 0)}
          subtitle="Por asignar"
          icon="Package"
          color="cyan"
          clickable={true}
          onClick={() => handleStatusCardClick('en_logistica')}
          loading={loading}
        />
        
        <StatCard
          title="Pendientes Empaque"
          value={formatNumber(dashboardData?.pendingPackaging || 0)}
          subtitle="En verificación"
          icon="Box"
          color="purple"
          clickable={true}
          onClick={() => handleStatusCardClick('en_empaque')}
          loading={loading}
        />
        
        <StatCard
          title="Sala de Entrega"
          value={formatNumber(dashboardData?.readyForDelivery || 0)}
          subtitle="Listos para entregar"
          icon="Home"
          color="cyan"
          clickable={true}
          onClick={() => handleStatusCardClick('listo_para_entrega')}
          loading={loading}
        />
        
        <StatCard
          title="Pendientes Entrega"
          value={formatNumber(dashboardData?.pendingDelivery || 0)}
          subtitle="Con mensajero"
          icon="Truck"
          color="orange"
          clickable={true}
          onClick={() => handleStatusCardClick('en_reparto')}
          loading={loading}
        />
        
        <StatCard
          title="Entregados"
          value={formatNumber(dashboardData?.delivered || 0)}
          subtitle="Completados"
          icon="CheckCircle"
          color="green"
          clickable={true}
          onClick={() => handleStatusCardClick('entregado')}
          loading={loading}
        />
      </div>

      {/* Métricas financieras (solo roles autorizados) */}
      {isPrivileged && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DashboardCard
          title="Ingresos Hoy"
          value={formatCurrency(financialMetrics?.todayRevenue)}
          subtitle="Monto facturado del día"
          icon="DollarSign"
          color="success"
        />
        
        <DashboardCard
          title="Dinero en Tránsito"
          value={formatCurrency(financialMetrics?.moneyInTransit)}
          subtitle="Pendiente con mensajeros"
          icon="Truck"
          color="warning"
        />
        
        <DashboardCard
          title="Promedio de Pedido"
          value={formatCurrency(financialMetrics?.averageOrderValue)}
          subtitle="Últimos 30 días"
          icon="TrendingUp"
          color="info"
        />
      </div>
      )}

      {/* Alertas inteligentes - solo roles autorizados */}
      {isPrivileged && alerts && alerts.length > 0 && (
        <div className="mb-8">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center">
                <Icons.Bell className="w-5 h-5 mr-2" />
                Alertas Inteligentes
              </h3>
            </div>
            <div className="card-content">
              <DashboardAlerts alerts={alerts} loading={loading} />
            </div>
          </div>
        </div>
      )}

      {/* Gráficos interactivos (solo roles autorizados) */}
      {isPrivileged && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Evolución de pedidos */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center">
              <Icons.TrendingUp className="w-5 h-5 mr-2" />
              Evolución de Pedidos
            </h3>
            <p className="text-sm text-gray-600">Últimos 14 días</p>
          </div>
          <div className="card-content">
            <OrderEvolutionChart 
              data={charts?.dailyEvolution} 
              loading={loading} 
            />
          </div>
        </div>

        {/* Estados de pedidos */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center">
              <Icons.PieChart className="w-5 h-5 mr-2" />
              Distribución por Estados
            </h3>
          </div>
          <div className="card-content">
            <OrderStatusChart 
              data={statusStats} 
              loading={loading} 
            />
          </div>
        </div>

        {/* Métodos de entrega */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center">
              <Icons.Package className="w-5 h-5 mr-2" />
              Pedidos por Método de Entrega
            </h3>
          </div>
          <div className="card-content">
            <DeliveryMethodChart 
              data={charts?.deliveryMethodStats} 
              loading={loading} 
            />
          </div>
        </div>

        {/* Ingresos acumulados */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center">
              <Icons.BarChart3 className="w-5 h-5 mr-2" />
              Ingresos Acumulados
            </h3>
            <p className="text-sm text-gray-600">Últimas 8 semanas</p>
          </div>
          <div className="card-content">
            <RevenueAreaChart 
              data={charts?.weeklyRevenue} 
              loading={loading} 
            />
          </div>
        </div>
      </div>
      )}

      {/* Vista específica para Mensajero */}
      {user?.role === 'mensajero' && (
        <div ref={messengerSectionRef} className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
              <Icons.Wallet className="w-6 h-6 mr-2" />
              Resumen de Dinero Recaudado
            </h2>
            <p className="text-gray-600">Filtra por rango de fechas para ver totales y entregas</p>
          </div>

          <div className="flex items-end space-x-4 mb-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Desde</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Hasta</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="input"
              />
            </div>
            <button
              onClick={() => { loadMessengerData(); loadDeliveries(1); loadMessengerStats(); }}
              className="btn btn-primary"
              disabled={messengerLoading}
            >
              <Icons.Filter className="w-4 h-4 mr-2" />
              Aplicar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <DashboardCard
              title="Entregas en el Rango"
              value={formatNumber(cashSummary?.totals?.delivered_count || 0)}
              subtitle="Pedidos entregados"
              icon="CheckCircle"
              color="success"
            />
            <DashboardCard
              title="Dinero Recolectado"
              value={formatCurrency(cashSummary?.totals?.total_payment_collected || 0)}
              subtitle="Pagos recogidos"
              icon="DollarSign"
              color="info"
            />
            <DashboardCard
              title="Flete Recaudado"
              value={formatCurrency(cashSummary?.totals?.total_delivery_fees || 0)}
              subtitle="Fletes cobrados"
              icon="Truck"
              color="warning"
            />
          </div>

          {/* Estadísticas del Mensajero */}
          {messengerStats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <DashboardCard
                  title="Asignados Hoy"
                  value={formatNumber(messengerStats.summary?.assignedToday || 0)}
                  subtitle="Pedidos asignados"
                  icon="UserPlus"
                  color="info"
                />
                <DashboardCard
                  title="Aceptados Hoy"
                  value={formatNumber(messengerStats.summary?.acceptedToday || 0)}
                  subtitle="Pedidos aceptados"
                  icon="ThumbsUp"
                  color="blue"
                />
                <DashboardCard
                  title="En Ruta Hoy"
                  value={formatNumber(messengerStats.summary?.inDeliveryToday || 0)}
                  subtitle="Entregas en curso"
                  icon="Truck"
                  color="warning"
                />
                <DashboardCard
                  title="Entregados Hoy"
                  value={formatNumber(messengerStats.summary?.deliveredToday || 0)}
                  subtitle="Completados"
                  icon="CheckCircle"
                  color="success"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title flex items-center">
                      <Icons.LineChart className="w-5 h-5 mr-2" />
                      Tendencia de entregas (rango)
                    </h3>
                  </div>
                  <div className="card-content">
                    <MessengerTrendsChart data={messengerStats.trends?.daily || []} loading={messengerLoading} />
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title flex items-center">
                      <Icons.BarChart2 className="w-5 h-5 mr-2" />
                      Entregas por Método
                    </h3>
                  </div>
                  <div className="card-content">
                    <MessengerByMethodChart data={messengerStats.byMethod || []} loading={messengerLoading} />
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title flex items-center">
                      <Icons.Clock className="w-5 h-5 mr-2" />
                      Entregas por Hora
                    </h3>
                  </div>
                  <div className="card-content">
                    <MessengerByHourChart data={messengerStats.byHour || []} loading={messengerLoading} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DashboardCard
                    title="Tasa de éxito (7d)"
                    value={`${Math.round((messengerStats.performance?.successRate7d || 0) * 100)}%`}
                    subtitle="Entregados / (Entregados + Fallidos)"
                    icon="TrendingUp"
                    color="success"
                  />
                  <DashboardCard
                    title="Tasa de éxito (30d)"
                    value={`${Math.round((messengerStats.performance?.successRate30d || 0) * 100)}%`}
                    subtitle="Entregados / (Entregados + Fallidos)"
                    icon="TrendingUp"
                    color="success"
                  />
                  <DashboardCard
                    title="Tiempo prom. entrega (7d)"
                    value={`${messengerStats.performance?.avgDeliveryMinutes7d ?? '-'} min`}
                    subtitle="Desde aceptado/en ruta hasta entregado"
                    icon="Timer"
                    color="purple"
                  />
                  <DashboardCard
                    title="Tiempo prom. entrega (30d)"
                    value={`${messengerStats.performance?.avgDeliveryMinutes30d ?? '-'} min`}
                    subtitle="Desde aceptado/en ruta hasta entregado"
                    icon="Timer"
                    color="purple"
                  />
                </div>
              </div>
            </>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center">
                <Icons.History className="w-5 h-5 mr-2" />
                Historial de Pedidos Entregados
              </h3>
            </div>
            <div className="card-content">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dirección</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recaudado</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Flete</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cobro</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha Entrega</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(deliveries || []).length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-4 py-6 text-center text-gray-500">
                          {messengerLoading ? 'Cargando...' : 'No hay entregas en el rango seleccionado'}
                        </td>
                      </tr>
                    ) : (
                      deliveries.map((d) => (
                        <tr key={d.id}>
                          <td className="px-4 py-2 text-sm text-gray-700">{d.order_number || d.id}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{d.customer_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{d.customer_phone}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{d.customer_address}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(d.total_amount)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(d.payment_collected)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(d.delivery_fee_collected)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{renderCobro(d)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{d.payment_method || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {d.delivered_at ? new Date(d.delivered_at).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-600">
                  Página {deliveriesPagination.page} de {deliveriesPagination.pages} — {deliveriesPagination.total} registros
                </p>
                <div className="space-x-2">
                  <button
                    className="btn btn-secondary"
                    disabled={deliveriesPagination.page <= 1 || messengerLoading}
                    onClick={() => loadDeliveries(deliveriesPagination.page - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={deliveriesPagination.page >= deliveriesPagination.pages || messengerLoading}
                    onClick={() => loadDeliveries(deliveriesPagination.page + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Profesional Avanzado - Solo roles autorizados */}
      {isPrivileged && (
        <>
          {/* Analytics Avanzados */}
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                <Icons.BarChart3 className="w-6 h-6 mr-2" />
                Dashboard Profesional - Reportes Gerenciales
              </h2>
              <p className="text-gray-600">Análisis avanzado para la toma de decisiones estratégicas</p>
            </div>

            {/* Primera fila: Envíos y Ciudades */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.TrendingUp className="w-5 h-5 mr-2" />
                    Envíos Diarios
                  </h3>
                  <p className="text-sm text-gray-600">Número de envíos y gráfica - Últimos 30 días</p>
                </div>
                <div className="card-content">
                  <DailyShipmentsChart data={analyticsData?.dailyShipments} loading={analyticsLoading} />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.MapPin className="w-5 h-5 mr-2" />
                    Ciudades con Más Envíos
                  </h3>
                  <p className="text-sm text-gray-600">Top destinos de envío</p>
                </div>
                <div className="card-content">
                  <TopShippingCitiesChart data={analyticsData?.topShippingCities} loading={analyticsLoading} />
                </div>
              </div>
            </div>

            {/* Segunda fila: Clientes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.Users className="w-5 h-5 mr-2" />
                    Mejores Clientes
                  </h3>
                  <p className="text-sm text-gray-600">Clientes que más compran</p>
                </div>
                <div className="card-content">
                  <TopCustomersTable data={analyticsData?.topCustomers} loading={analyticsLoading} />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.Repeat className="w-5 h-5 mr-2" />
                    Recompras de Clientes
                  </h3>
                  <p className="text-sm text-gray-600">Análisis de fidelidad y repetición</p>
                </div>
                <div className="card-content">
                  <CustomerRepeatPurchasesChart data={analyticsData?.customerRepeatPurchases} loading={analyticsLoading} />
                </div>
              </div>
            </div>

            {/* Tercera fila: Análisis de Clientes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.UserPlus className="w-5 h-5 mr-2" />
                    Nuevos Clientes Diarios
                  </h3>
                  <p className="text-sm text-gray-600">Crecimiento de la base de clientes</p>
                </div>
                <div className="card-content">
                  <NewCustomersDailyChart data={analyticsData?.newCustomersDaily} loading={analyticsLoading} />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.AlertTriangle className="w-5 h-5 mr-2" />
                    Clientes Perdidos
                  </h3>
                  <p className="text-sm text-gray-600">Clientes en riesgo de abandono</p>
                </div>
                <div className="card-content">
                  <LostCustomersAnalysis data={analyticsData?.lostCustomers} loading={analyticsLoading} />
                </div>
              </div>
            </div>

            {/* Cuarta fila: Tendencias y Productos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.AreaChart className="w-5 h-5 mr-2" />
                    Tendencias de Ventas
                  </h3>
                  <p className="text-sm text-gray-600">Análisis semanal de ventas - Últimas 12 semanas</p>
                </div>
                <div className="card-content">
                  <SalesTrendsChart data={analyticsData?.salesTrends} loading={analyticsLoading} />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.Package2 className="w-5 h-5 mr-2" />
                    Rendimiento de Productos
                  </h3>
                  <p className="text-sm text-gray-600">Productos más vendidos - Últimos 60 días</p>
                </div>
                <div className="card-content">
                  <ProductPerformanceTable data={analyticsData?.productPerformance} loading={analyticsLoading} />
                </div>
              </div>
            </div>

            {/* Quinta fila: Mapa de Calor de Colombia */}
            <div className="mb-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center">
                    <Icons.Map className="w-5 h-5 mr-2" />
                    Mapa de Calor - Distribución de Ventas por Ciudad
                  </h3>
                  <p className="text-sm text-gray-600">
                    Visualización geográfica de ventas en Colombia - Zonas de alta, media y baja performance
                  </p>
                </div>
                <div className="card-content">
                  <ColombiaHeatMap />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Panel de rendimiento (solo roles autorizados) */}
      {isPrivileged && performance?.messengerPerformance?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center">
              <Icons.Users className="w-5 h-5 mr-2" />
              Rendimiento por Mensajero
            </h3>
            <p className="text-sm text-gray-600">Últimos 30 días</p>
          </div>
          <div className="card-content">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mensajero
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Asignados
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entregados
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Eficiencia
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {performance.messengerPerformance.map((messenger, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {messenger.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {messenger.assigned_orders}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {messenger.delivered_orders}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${messenger.efficiency}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {messenger.efficiency}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Acciones rápidas contextuales */}
      <div className="mt-8">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center">
              <Icons.Zap className="w-5 h-5 mr-2" />
              Acciones Rápidas
            </h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => navigate('/orders?status=pendiente')}
                    className="flex items-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
                  >
                    <Icons.Clock className="w-6 h-6 text-yellow-600 mr-3" />
                    <div className="text-left">
                      <p className="font-medium text-yellow-800">Procesar Pendientes</p>
                      <p className="text-sm text-yellow-600">Revisar pedidos pendientes</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/users')}
                    className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Icons.Users className="w-6 h-6 text-blue-600 mr-3" />
                    <div className="text-left">
                      <p className="font-medium text-blue-800">Gestionar Usuarios</p>
                      <p className="text-sm text-blue-600">Administrar equipo</p>
                    </div>
                  </button>
                </>
              )}
              
              <button
                onClick={() => navigate('/orders')}
                className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Icons.Package className="w-6 h-6 text-green-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-green-800">Ver Todos los Pedidos</p>
                  <p className="text-sm text-green-600">Lista completa</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
