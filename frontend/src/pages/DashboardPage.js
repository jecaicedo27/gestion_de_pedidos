import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/api';
import StatCard from '../components/StatCard';
import DashboardCard from '../components/DashboardCard';
import DashboardAlerts from '../components/DashboardAlerts';
import {
  OrderEvolutionChart,
  DeliveryMethodChart,
  OrderStatusChart,
  RevenueAreaChart
} from '../components/DashboardCharts';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const { user, getRoleName } = useAuth();
  const navigate = useNavigate();
  
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh cada 5 minutos
    const interval = setInterval(() => {
      loadDashboardData();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

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
            onClick={() => loadDashboardData(true)}
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

      {/* Métricas financieras */}
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

      {/* Alertas inteligentes */}
      {alerts && alerts.length > 0 && (
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

      {/* Gráficos interactivos */}
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

      {/* Panel de rendimiento (solo para admin y logística) */}
      {['admin', 'logistica'].includes(user?.role) && performance?.messengerPerformance?.length > 0 && (
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
