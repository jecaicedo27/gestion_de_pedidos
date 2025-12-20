import React, { useState, useEffect } from 'react';
import adminService from '../services/adminService';
import { TrendingUp, Users, DollarSign, Target, AlertCircle, Award, Activity, ChevronDown, ChevronUp, Package, ChevronRight, ArrowUp, ArrowDown, BarChart2, Layers } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts';
import ClusterCustomerModal from '../components/ClusterCustomerModal';
import ProfitabilityTrendChart from '../components/ProfitabilityTrendChart';
import CategoryPieChart from '../components/CategoryPieChart';
import SalesTrendChart from '../components/SalesTrendChart';
import CategoryTrendChart from '../components/CategoryTrendChart';
import CategoryProfitabilityChart from '../components/CategoryProfitabilityChart';
import InventoryValueChart from '../components/InventoryValueChart';
import InventoryTurnoverChart from '../components/InventoryTurnoverChart';

const ExecutiveDashboardPage = () => {
    const [stats, setStats] = useState(null);
    const [advancedStats, setAdvancedStats] = useState(null);
    const [shippingStats, setShippingStats] = useState(null);
    const [showShippingDetails, setShowShippingDetails] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedCities, setExpandedCities] = useState([]);
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // Default to current month YYYY-MM
    const [inventoryValue, setInventoryValue] = useState(0);
    const [clusterModal, setClusterModal] = useState({ isOpen: false, cluster: null, customers: [], loading: false });

    // Sorting State
    const [sortConfig, setSortConfig] = useState({
        customer: { key: 'total_profit', direction: 'desc' },
        product: { key: 'total_profit', direction: 'desc' },
        city: { key: 'total_profit', direction: 'desc' }
    });

    const handleSort = (table, key) => {
        setSortConfig(prev => ({
            ...prev,
            [table]: {
                key,
                direction: prev[table].key === key && prev[table].direction === 'desc' ? 'asc' : 'desc'
            }
        }));
    };

    const getSortedData = (data, table) => {
        if (!data) return [];
        const { key, direction } = sortConfig[table];
        return [...data].sort((a, b) => { // Create a copy to avoid mutating original
            const aValue = parseFloat(a[key] || 0);
            const bValue = parseFloat(b[key] || 0);
            if (direction === 'asc') return aValue - bValue;
            return bValue - aValue;
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Calculate start and end dates based on selectedMonth
                const [year, month] = selectedMonth.split('-');
                const startDate = `${year}-${month}-01`;
                const endDate = new Date(year, month, 0).toISOString().slice(0, 10) + ' 23:59:59';

                console.log(`📅 Fetching data for: ${startDate} to ${endDate}`);

                const [basicData, advancedData] = await Promise.all([
                    adminService.getExecutiveStats({ startDate, endDate }),
                    adminService.getAdvancedStats({ startDate, endDate })
                ]);

                if (basicData.success) setStats(basicData);
                if (advancedData.success) {
                    console.log('🔍 Advanced Stats Data:', advancedData);
                    console.log('📊 Profit by Customer:', advancedData.data?.profitByCustomer);
                    console.log('📦 Profit by Product:', advancedData.data?.profitByProduct);
                    console.log('🏙️ Profit by City:', advancedData.data?.profitByCity);
                    setAdvancedStats(advancedData);
                    setAdvancedStats(advancedData);
                }

                // Fetch Shipping Stats separate to not block main load if it fails, but here we do parallel for simplicity
                const shippingData = await adminService.getShippingStats({ startDate, endDate });
                if (shippingData.success) {
                    setShippingStats(shippingData.data);
                }

                // Fetch Inventory Value History for Card
                const inventoryRes = await adminService.getInventoryValueHistory();
                if (inventoryRes.success && inventoryRes.data.length > 0) {
                    setInventoryValue(inventoryRes.data[inventoryRes.data.length - 1].value);
                }

            } catch (error) {
                console.error("Error loading dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedMonth]); // Refetch when month changes

    const fetchClusterCustomers = async (clusterType) => {
        setClusterModal({ isOpen: true, cluster: clusterType, customers: [], loading: true });
        try {
            const [year, month] = selectedMonth.split('-');
            const startDate = `${year}-${month}-01`;
            const endDate = new Date(year, month, 0).toISOString().slice(0, 10) + ' 23:59:59';

            const response = await adminService.getClusterCustomers(clusterType, { startDate, endDate });
            setClusterModal({ isOpen: true, cluster: clusterType, customers: response.customers, loading: false });
        } catch (error) {
            console.error('Error fetching cluster customers:', error);
            setClusterModal({ isOpen: true, cluster: clusterType, customers: [], loading: false });
        }
    };


    if (loading) return <div className="p-8 text-center">Cargando tablero gerencial...</div>;
    if (!stats || !stats.kpis || !stats.targets) return <div className="p-8 text-center text-red-500">Error: Datos incompletos.</div>;

    const { kpis, targets, productMix = [], strategies = [] } = stats;

    // Helper para formato moneda
    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(val) || 0);
    const formatPercent = (val) => `${Number(val || 0).toFixed(1)}%`;

    const getMonthName = (dateStr) => {
        if (!dateStr) return '';
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return monthNames[parseInt(dateStr.split('-')[1], 10) - 1];
    };

    // Calcular porcentajes de meta
    const salesProgress = targets.sales ? Math.min((kpis.projectedSales / targets.sales) * 100, 100) : 0;
    const profitProgress = targets.profit ? Math.min((kpis.estimatedGrossProfit / targets.profit) * 100, 100) : 0;

    const currentMonthName = getMonthName(selectedMonth).toUpperCase();

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Dashboard Ejecutivo</h1>
                    <p className="text-gray-600">Visión general y estrategia</p>
                </div>
                <div>
                    <input
                        type="month"
                        className="bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                </div>
            </div>

            {/* 1. Top Level KPIs - Financial Health */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {/* Ventas Actuales */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">VENTA DEL MES {currentMonthName}</p>
                            <h2 className="text-4xl font-bold text-gray-800 mt-1">{formatCurrency(kpis.currentMonthSales)}</h2>
                            <p className="text-xs text-green-600 font-medium mt-1">Valor antes de IVA</p>
                            <p className="text-xs text-gray-500 mt-2">Valor con IVA: {formatCurrency(kpis.currentMonthSales * 1.19)}</p>
                        </div>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                            <TrendingUp size={28} />
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="bg-indigo-600 h-3 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">Acumulado del mes hasta hoy</p>
                </div>

                {/* Meta de Ventas (Proyección) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Proyección Cierre</p>
                            <h2 className="text-4xl font-bold text-gray-800 mt-1">{formatCurrency(kpis.projectedSales)}</h2>
                            <p className="text-xs text-blue-600 font-medium mt-1">Valor antes de IVA</p>
                            <p className="text-xs text-gray-500 mt-2">Valor con IVA: {formatCurrency(kpis.projectedSales * 1.19)}</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <Target size={28} />
                        </div>
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                        <span className="text-gray-500">Meta: {formatCurrency(targets.sales)}</span>
                        <span className="font-bold text-blue-600">{salesProgress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="bg-blue-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${salesProgress}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">Basado en velocidad diaria de {formatCurrency(kpis.dailySalesVelocity)}</p>
                </div>

                {/* Ganancia Real (Acumulada) */}
                {/* Ganancia Real (Acumulada) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Ganancia Real</p>
                            <h2 className="text-4xl font-bold text-gray-800 mt-1">{formatCurrency(kpis.currentGrossProfit || 0)}</h2>
                            <p className="text-xs text-green-600 font-medium mt-1">Utilidad Neta</p>
                        </div>
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                            <DollarSign size={28} />
                        </div>
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                        <span className="text-gray-500">Margen Real Hoy: {kpis.currentMarginPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 mb-4">
                        <div className="bg-green-600 h-3 rounded-full" style={{ width: '100%' }}></div>
                    </div>

                    {/* IVA Provision Section */}
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-orange-700 uppercase">Aprovisionamiento IVA (Est. Neto)</span>
                            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">Guardar</span>
                        </div>
                        <p className="text-xl font-bold text-gray-800">
                            {formatCurrency((kpis.currentGrossProfit || 0) * 0.19)}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                            Calculado sobre utilidad (IVA Venta - IVA Compra estimado).
                        </p>
                    </div>

                    {/* Inventory Replenishment Section */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 mt-3">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-blue-700 uppercase">Fondo Reposición Inventario</span>
                            <Package size={14} className="text-blue-600" />
                        </div>
                        <p className="text-xl font-bold text-gray-800">
                            {formatCurrency(kpis.inventoryFund || 0)}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                            Recaudo necesario para pagar a proveedores (Costo de Ventas).
                        </p>
                    </div>

                    {/* Total Inventory Value Card */}
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 mt-3">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-indigo-700 uppercase">Valor Inventario (Activos)</span>
                            <Layers size={14} className="text-indigo-600" />
                        </div>
                        <p className="text-xl font-bold text-gray-800">
                            {formatCurrency(inventoryValue || 0)}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                            Capital total acumulado en bodega hoy.
                        </p>
                    </div>

                    <p className="text-xs text-gray-400 mt-4">Acumulado real hasta la fecha</p>
                </div>

                {/* Meta de Ganancias (Proyección) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Ganancia Proyectada</p>
                            <h2 className="text-4xl font-bold text-gray-800 mt-1">{formatCurrency(kpis.estimatedGrossProfit)}</h2>
                            <p className="text-xs text-teal-600 font-medium mt-1">Utilidad Neta</p>
                        </div>
                        <div className="p-3 bg-teal-50 text-teal-600 rounded-lg">
                            <BarChart2 size={28} />
                        </div>
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                        <span className="text-gray-500">Meta: {formatCurrency(targets.profit)}</span>
                        <span className="font-bold text-teal-600">{profitProgress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="bg-teal-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${profitProgress}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">Calculado con margen real del {kpis.currentMarginPercent}%</p>
                </div>
            </div>

            {/* 1.5. Tendencia de Ventas */}
            <SalesTrendChart selectedMonth={selectedMonth} />

            {/* 1.6. Tendencia de Rentabilidad */}
            <ProfitabilityTrendChart selectedMonth={selectedMonth} />



            {/* 1.6. Inventario (Valor y Rotación) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 mb-8">
                <InventoryValueChart />
                <InventoryTurnoverChart />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-full mr-4">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Clientes Activos (Mes)</p>
                        <p className="text-2xl font-bold text-gray-800">{kpis.activeCustomers}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-full mr-4">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Tasa de Retención</p>
                        <p className="text-2xl font-bold text-gray-800">{formatPercent(kpis.retentionRate)}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-3 bg-teal-50 text-teal-600 rounded-full mr-4">
                        <Award size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Ticket Promedio (AOV)</p>
                        <p className="text-2xl font-bold text-gray-800">{formatCurrency(kpis.aov)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* 3. Product Strategy (Mix) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Rentabilidad por Categoría</h3>
                    <div className="space-y-4">
                        {productMix?.map((cat, idx) => {
                            const totalSales = productMix?.reduce((acc, curr) => acc + Number(curr.sales_value), 0) || 0;
                            const percent = totalSales > 0 ? (Number(cat.sales_value) / totalSales) * 100 : 0;
                            const profit = Number(cat.total_profit || 0);
                            const margin = Number(cat.sales_value) > 0 ? (profit / Number(cat.sales_value)) * 100 : 0;
                            const isExpanded = expandedCategory === idx;

                            // Asignar colores por marca
                            let colorClass = 'bg-gray-400';
                            if (cat.category_group === 'Liquipops') colorClass = 'bg-pink-500';
                            if (cat.category_group === 'Geniality') colorClass = 'bg-purple-500';
                            if (cat.category_group === 'Skarcha') colorClass = 'bg-orange-500';
                            if (cat.category_group === 'Yexis') colorClass = 'bg-yellow-500';
                            if (cat.category_group === 'Perlas Explosivas') colorClass = 'bg-red-500';
                            if (cat.category_group === 'Base Cítrica') colorClass = 'bg-lime-500';
                            if (cat.category_group === 'Insumos') colorClass = 'bg-blue-400';

                            return (
                                <div key={idx} className="border-b border-gray-100 pb-2 last:border-0">
                                    <div
                                        className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                                        onClick={() => setExpandedCategory(isExpanded ? null : idx)}
                                    >
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium text-gray-700 flex items-center">
                                                    {isExpanded ? <ChevronUp size={14} className="mr-1 text-gray-400" /> : <ChevronDown size={14} className="mr-1 text-gray-400" />}
                                                    {cat.category_group}
                                                </span>
                                                <span className="text-gray-500">{percent.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                                                <div
                                                    className={`h-2 rounded-full ${colorClass}`}
                                                    style={{ width: `${percent}%` }}
                                                ></div>
                                            </div>

                                            <div className="flex justify-between items-end">
                                                <div className="text-xs">
                                                    <p className="text-gray-400">Ventas</p>
                                                    <p className="font-medium text-gray-700">{formatCurrency(Number(cat.sales_value))}</p>
                                                </div>
                                                <div className="text-xs text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <span className="text-gray-400">Margen: {margin.toFixed(1)}%</span>
                                                        <span className="font-bold text-green-600 bg-green-50 px-1 rounded">{formatCurrency(profit)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dropdown de Productos */}
                                    {isExpanded && cat.products && (
                                        <div className="mt-2 pl-4 pr-2 space-y-2 bg-gray-50 p-3 rounded-lg max-h-96 overflow-y-auto">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-2 sticky top-0 bg-gray-50 pb-1 border-b border-gray-200">Detalle de Productos ({cat.products.length})</p>
                                            {cat.products.map((prod, pIdx) => {
                                                const prodPercent = (prod.sales / Number(cat.sales_value)) * 100;
                                                return (
                                                    <div key={pIdx} className="text-xs">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="text-gray-600 truncate w-3/4" title={prod.name}>{prod.name}</span>
                                                            <span className="text-gray-500">{prodPercent.toFixed(0)}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                            <div
                                                                className={`h-1.5 rounded-full ${colorClass} opacity-70`}
                                                                style={{ width: `${prodPercent}%` }}
                                                            ></div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 text-right mt-0.5">{formatCurrency(prod.sales)}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 4. Strategic Advisor Replaced by Pie Chart */}
                <div className="lg:col-span-2 h-full flex flex-col gap-6">
                    <CategoryPieChart selectedMonth={selectedMonth} />
                </div>
            </div>

            {/* 7. Category Trends (Sales & Profitability) */}
            <div className="flex flex-col gap-8 mb-8">
                <CategoryTrendChart selectedMonth={selectedMonth} />
                <CategoryProfitabilityChart selectedMonth={selectedMonth} />
            </div>

            {/* Strategies moved below if needed, or removed */}
            {strategies && strategies.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
                    <div className="flex items-center mb-4">
                        <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg mr-3">
                            <TrendingUp size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Recomendaciones Estratégicas (IA)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {strategies.map((strat, idx) => (
                            <div key={idx} className="flex items-start p-4 bg-gray-50 rounded-lg border-l-4 border-yellow-400">
                                <AlertCircle className="text-yellow-500 mt-1 mr-3 flex-shrink-0" size={20} />
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-1">{strat.title}</h4>
                                    <p className="text-gray-600 text-xs">{strat.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 5. Advanced Growth Metrics */}
            {
                advancedStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Churn Risk */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center">
                                <AlertCircle size={20} className="mr-2" />
                                Riesgo de Fuga (Top 10)
                            </h3>
                            <div className="overflow-y-auto max-h-64">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="pb-2">Cliente</th>
                                            <th className="pb-2 text-right">Última Compra</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {advancedStats.data.churnRisk?.map((client, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-2">
                                                    <p className="font-medium text-gray-800">{client.name}</p>
                                                    <p className="text-xs text-gray-500">{client.phone}</p>
                                                </td>
                                                <td className="py-2 text-right text-gray-600">
                                                    {new Date(client.last_purchase_date).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Cross-Sell Opportunity */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-blue-600 mb-4 flex items-center">
                                <Target size={20} className="mr-2" />
                                Oportunidad Cross-Sell
                            </h3>
                            <p className="text-xs text-gray-500 mb-3">Compran mucho (&gt;1M) pero NO Perlas</p>
                            <div className="overflow-y-auto max-h-64">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="pb-2">Cliente</th>
                                            <th className="pb-2 text-right">Ventas Periodo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {advancedStats.data.crossSell?.map((client, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-2">
                                                    <p className="font-medium text-gray-800">{client.name}</p>
                                                    <p className="text-xs text-gray-500">{client.phone}</p>
                                                </td>
                                                <td className="py-2 text-right font-bold text-gray-800">
                                                    {formatCurrency(Number(client.total_spent_period))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Top Cities */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-purple-600 flex items-center">
                                    <TrendingUp size={20} className="mr-2" />
                                    Top Ciudades ({currentMonthName})
                                </h3>
                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                    Total: {formatCurrency(advancedStats.data.topCities?.reduce((acc, curr) => acc + Number(curr.total_sales), 0) || 0)}
                                </span>
                            </div>
                            <div className="space-y-4">
                                {advancedStats.data.topCities?.map((city, idx) => {
                                    const maxSales = Number(advancedStats.data.topCities[0].total_sales);
                                    const percent = (Number(city.total_sales) / maxSales) * 100;
                                    return (
                                        <div key={idx}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium text-gray-700">{city.city}</span>
                                                <span className="font-bold text-gray-800">{formatCurrency(Number(city.total_sales))}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div
                                                    className="bg-purple-500 h-2 rounded-full"
                                                    style={{ width: `${percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 6. Strategic Financials & Inventory */}
            {
                advancedStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                        {/* Cartera */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <DollarSign size={20} className="mr-2 text-green-600" />
                                Salud Financiera (Cartera)
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Por Cobrar (Deuda Total)</p>
                                    <p className="text-3xl font-bold text-red-500">{formatCurrency(advancedStats.data.receivables?.totalDebt)}</p>
                                    <p className="text-xs text-gray-400">Pedidos entregados sin cerrar en Siigo</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Recaudado (Este Mes)</p>
                                    <p className="text-3xl font-bold text-green-600">{formatCurrency(advancedStats.data.receivables?.collectedMonth)}</p>
                                    <p className="text-xs text-gray-400">Pagos conciliados este mes</p>
                                </div>
                            </div>
                        </div>

                        {/* Mix de Clientes */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Users size={20} className="mr-2 text-blue-600" />
                                Mix de Clientes (Mes)
                            </h3>
                            <div className="flex items-center justify-center h-48">
                                <div className="w-full space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-blue-600">Nuevos ({advancedStats.data.customerMix?.newCustomers})</span>
                                            <span className="font-bold">{formatCurrency(advancedStats.data.customerMix?.newSales)}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-4">
                                            <div
                                                className="bg-blue-500 h-4 rounded-full"
                                                style={{ width: `${(advancedStats.data.customerMix?.newSales / (advancedStats.data.customerMix?.newSales + advancedStats.data.customerMix?.recurringSales)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-indigo-600">Recurrentes ({advancedStats.data.customerMix?.recurringCustomers})</span>
                                            <span className="font-bold">{formatCurrency(advancedStats.data.customerMix?.recurringSales)}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-4">
                                            <div
                                                className="bg-indigo-500 h-4 rounded-full"
                                                style={{ width: `${(advancedStats.data.customerMix?.recurringSales / (advancedStats.data.customerMix?.newSales + advancedStats.data.customerMix?.recurringSales)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inventory Runway */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Activity size={20} className="mr-2 text-orange-600" />
                                Días de Inventario (Runway)
                            </h3>
                            <div className="overflow-y-auto max-h-64">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="pb-2">Producto</th>
                                            <th className="pb-2 text-right">Días</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {advancedStats.data.inventoryRunway?.map((item, idx) => {
                                            let daysClass = 'text-green-600';
                                            if (item.days_remaining < 15) daysClass = 'text-yellow-600';
                                            if (item.days_remaining < 7) daysClass = 'text-red-600 font-bold';

                                            return (
                                                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                    <td className="py-2">
                                                        <p className="font-medium text-gray-800 truncate w-48" title={item.product_name}>{item.product_name}</p>
                                                        <p className="text-xs text-gray-500">Stock: {item.current_stock}</p>
                                                    </td>
                                                    <td className={`py-2 text-right ${daysClass}`}>
                                                        {item.days_remaining > 365 ? '> 1 año' : `${Math.round(item.days_remaining)} días`}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* 7. Rentabilidad Real por Segmento */}
            {
                advancedStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 pb-8">
                        {/* Top Rentabilidad Clientes */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <DollarSign size={20} className="mr-2 text-green-600" />
                                Top Rentabilidad Clientes
                            </h3>
                            <div className="overflow-y-auto max-h-[600px]">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="pb-2">Cliente</th>
                                            <th
                                                className="pb-2 text-right cursor-pointer"
                                                onClick={() => handleSort('customer', 'total_profit')}
                                            >
                                                <div className={`flex items-center justify-end inline-flex px-2 py-1 rounded-lg transition-colors ${sortConfig.customer.key === 'total_profit' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}>
                                                    Utilidad
                                                    {sortConfig.customer.key === 'total_profit' && (
                                                        sortConfig.customer.direction === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="pb-2 text-right cursor-pointer"
                                                onClick={() => handleSort('customer', 'margin_percent')}
                                            >
                                                <div className={`flex items-center justify-end inline-flex px-2 py-1 rounded-lg transition-colors ${sortConfig.customer.key === 'margin_percent' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}>
                                                    %
                                                    {sortConfig.customer.key === 'margin_percent' && (
                                                        sortConfig.customer.direction === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                                                    )}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getSortedData(advancedStats.data?.profitByCustomer, 'customer').map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-2">
                                                    <p className="font-medium text-gray-800" title={item.name}>{item.name}</p>
                                                    <p className="text-xs text-gray-500">{formatCurrency(item.total_sales)}</p>
                                                </td>
                                                <td className="py-2 text-right font-bold text-green-600">
                                                    {formatCurrency(item.total_profit)}
                                                </td>
                                                <td className="py-2 text-right text-gray-600">
                                                    {formatPercent(item.margin_percent)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Top Rentabilidad Productos */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Package size={20} className="mr-2 text-purple-600" />
                                Top Rentabilidad Productos
                            </h3>
                            <div className="overflow-y-auto max-h-[600px]">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="pb-2">Producto</th>
                                            <th
                                                className="pb-2 text-right cursor-pointer"
                                                onClick={() => handleSort('product', 'total_profit')}
                                            >
                                                <div className={`flex items-center justify-end inline-flex px-2 py-1 rounded-lg transition-colors ${sortConfig.product.key === 'total_profit' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}>
                                                    Utilidad
                                                    {sortConfig.product.key === 'total_profit' && (
                                                        sortConfig.product.direction === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="pb-2 text-right cursor-pointer"
                                                onClick={() => handleSort('product', 'margin_percent')}
                                            >
                                                <div className={`flex items-center justify-end inline-flex px-2 py-1 rounded-lg transition-colors ${sortConfig.product.key === 'margin_percent' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}>
                                                    %
                                                    {sortConfig.product.key === 'margin_percent' && (
                                                        sortConfig.product.direction === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                                                    )}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getSortedData(advancedStats.data?.profitByProduct, 'product').map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-2">
                                                    <p className="font-medium text-gray-800" title={item.product_name}>{item.product_name}</p>
                                                    <p className="text-xs text-gray-500">{formatCurrency(item.total_sales)}</p>
                                                </td>
                                                <td className="py-2 text-right font-bold text-purple-600">
                                                    {formatCurrency(item.total_profit)}
                                                </td>
                                                <td className="py-2 text-right text-gray-600">
                                                    {formatPercent(item.margin_percent)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Rentabilidad por Ciudad */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <TrendingUp size={20} className="mr-2 text-blue-600" />
                                Rentabilidad por Ciudad ({getMonthName(selectedMonth)})
                            </h3>
                            <div className="overflow-y-auto max-h-[600px]">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="pb-2">Ciudad</th>
                                            <th className="pb-2 text-right">Ventas</th>
                                            <th
                                                className="pb-2 text-right cursor-pointer"
                                                onClick={() => handleSort('city', 'total_profit')}
                                            >
                                                <div className={`flex items-center justify-end inline-flex px-2 py-1 rounded-lg transition-colors ${sortConfig.city.key === 'total_profit' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}>
                                                    Utilidad
                                                    {sortConfig.city.key === 'total_profit' && (
                                                        sortConfig.city.direction === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="pb-2 text-right cursor-pointer"
                                                onClick={() => handleSort('city', 'margin_percent')}
                                            >
                                                <div className={`flex items-center justify-end inline-flex px-2 py-1 rounded-lg transition-colors ${sortConfig.city.key === 'margin_percent' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100'}`}>
                                                    %
                                                    {sortConfig.city.key === 'margin_percent' && (
                                                        sortConfig.city.direction === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                                                    )}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getSortedData(advancedStats.data?.profitByCity, 'city').map((item, idx) => (
                                            <React.Fragment key={idx}>
                                                <tr
                                                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        const newExpanded = [...(expandedCities || [])];
                                                        const index = newExpanded.indexOf(idx);
                                                        if (index > -1) newExpanded.splice(index, 1);
                                                        else newExpanded.push(idx);
                                                        setExpandedCities(newExpanded);
                                                    }}
                                                >
                                                    <td className="py-2">
                                                        <div className="flex items-center">
                                                            {expandedCities?.includes(idx) ? <ChevronDown size={14} className="mr-1 text-gray-400" /> : <ChevronRight size={14} className="mr-1 text-gray-400" />}
                                                            <p className="font-medium text-gray-800">{item.city}</p>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 text-right text-gray-600">
                                                        {formatCurrency(item.total_sales)}
                                                    </td>
                                                    <td className="py-2 text-right font-bold text-blue-600">
                                                        {formatCurrency(item.total_profit)}
                                                    </td>
                                                    <td className="py-2 text-right text-gray-600">
                                                        {formatPercent(item.margin_percent)}
                                                    </td>
                                                </tr>
                                                {expandedCities?.includes(idx) && item.top_customers && (
                                                    <tr className="bg-gray-50">
                                                        <td colSpan="3" className="p-0">
                                                            <div className="pl-6 pr-2 py-2 border-l-4 border-blue-100 my-1">
                                                                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Top 5 Clientes en {item.city}</p>
                                                                <table className="min-w-full text-xs">
                                                                    <thead>
                                                                        <tr className="text-gray-400 border-b border-gray-100">
                                                                            <th className="text-left font-normal pb-1">Cliente</th>
                                                                            <th className="text-right font-normal pb-1">Utilidad</th>
                                                                            <th className="text-right font-normal pb-1">%</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(JSON.parse(item.top_customers) || []).map((cust, custIdx) => (
                                                                            <tr key={custIdx} className="border-b border-gray-100 last:border-0">
                                                                                <td className="py-1 truncate max-w-[140px]" title={cust.name}>{cust.name}</td>
                                                                                <td className="py-1 text-right font-medium text-gray-700">{formatCurrency(cust.total_profit)}</td>
                                                                                <td className="py-1 text-right text-gray-500">{formatPercent(cust.margin_percent)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 7. Rentabilidad Real por Segmento */}
            {
                advancedStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 pb-8">
                        {/* ... (Existing Top Rentabilidad Clientes and Productos) ... omitted for brevity in previous context but kept here implicitly by structure */}

                        {/* Strategic Cluster Analysis - Full Width */}
                        <div className="lg:col-span-3">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                                    <Layers size={24} className="mr-2 text-indigo-600" />
                                    Análisis Estratégico de Clientes (Clusters)
                                </h3>

                                {/* Cluster Summaries */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    {advancedStats.data.customerClusters?.map((cluster, idx) => {
                                        let colorClass = 'bg-gray-50 border-gray-200';
                                        let titleColor = 'text-gray-700';
                                        let dotColor = '#9CA3AF'; // gray

                                        if (cluster.type === 'titan') {
                                            colorClass = 'bg-purple-50 border-purple-200';
                                            titleColor = 'text-purple-800';
                                            dotColor = '#8884d8'; // purple
                                        } else if (cluster.type === 'regular') {
                                            colorClass = 'bg-blue-50 border-blue-200';
                                            titleColor = 'text-blue-800';
                                            dotColor = '#82ca9d'; // green/blue
                                        }

                                        return (
                                            <div key={idx} className={`p-4 rounded-lg border ${colorClass}`}>
                                                <h4 className={`font-bold ${titleColor} mb-2 flex justify-between`}>
                                                    {cluster.label}
                                                    <button
                                                        onClick={() => fetchClusterCustomers(cluster.type)}
                                                        className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
                                                        title="Ver detalles de clientes"
                                                    >
                                                        {cluster.count} Clientes
                                                    </button>
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Ventas Totales:</span>
                                                        <span className="font-bold">{formatCurrency(cluster.totalSales)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Rentabilidad (%):</span>
                                                        <div className="text-right">
                                                            <span className={`font-bold block ${cluster.totalProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {formatCurrency(cluster.totalProfit)}
                                                            </span>
                                                            <span className="text-xs text-gray-500 font-medium">
                                                                ({cluster.totalSales > 0 ? ((cluster.totalProfit / cluster.totalSales) * 100).toFixed(1) : '0.0'}% Margen)
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between pt-2 border-t border-gray-200/50">
                                                        <span className="text-gray-500" title="Ventas promedio por pedido">Ticket Promedio:</span>
                                                        <span className="font-medium text-gray-800">{formatCurrency(cluster.avgTicket)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500" title="Ventas promedio por cliente">Eficiencia/Cliente:</span>
                                                        <span className="font-medium text-gray-800">{formatCurrency(cluster.efficiency)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Scatter Chart */}
                                <div className="h-96 w-full">
                                    <h4 className="text-sm font-semibold text-gray-500 mb-4 text-center">Eficiencia Logística: Esfuerzo vs Recompensa</h4>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={advancedStats.data.customerClusters?.map(c => {
                                                const totalSystemOrders = advancedStats.data.customerClusters.reduce((acc, curr) => acc + (curr.totalOrders || 0), 0);
                                                const totalSystemProfit = advancedStats.data.customerClusters.reduce((acc, curr) => acc + (curr.totalProfit || 0), 0);

                                                let shortName = c.label.split(" ")[0];
                                                if (c.label.includes("Plata")) shortName = "Plata";
                                                if (c.label.includes("Oro")) shortName = "Oro";

                                                return {
                                                    name: shortName,
                                                    'Esfuerzo Logístico (% Pedidos)': totalSystemOrders > 0 ? (c.totalOrders / totalSystemOrders) * 100 : 0,
                                                    'Recompensa Financiera (% Ganancia)': totalSystemProfit > 0 ? (c.totalProfit / totalSystemProfit) * 100 : 0
                                                };
                                            })}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis unit="%" />
                                            <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                                            <Legend />
                                            <Bar dataKey="Esfuerzo Logístico (% Pedidos)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Recompensa Financiera (% Ganancia)" fill="#10B981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <p className="text-center text-xs text-gray-500 mt-2 italic">
                                        "Si la barra Roja (Esfuerzo) es más alta que la Verde (Ganancia), ese grupo consume demasiados recursos."
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 8. Clientes con Baja Rentabilidad (Moved down) */}
            {
                advancedStats && advancedStats.data?.lowProfitCustomers?.length > 0 && (
                    <div className="mt-8 pb-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <AlertCircle size={20} className="mr-2 text-red-600" />
                                ⚠️ Clientes con Baja Rentabilidad (Margen &lt; 15%)
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">Estos clientes requieren atención: revisa precios, descuentos o costos de servicio</p>
                            <div className="overflow-y-auto max-h-96">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="pb-2">Cliente</th>
                                            <th className="pb-2 text-right">Ventas</th>
                                            <th className="pb-2 text-right">Utilidad</th>
                                            <th className="pb-2 text-right">Margen %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {advancedStats.data.lowProfitCustomers.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-red-50">
                                                <td className="py-2">
                                                    <p className="font-medium text-gray-800" title={item.name}>{item.name}</p>
                                                </td>
                                                <td className="py-2 text-right text-gray-600">
                                                    {formatCurrency(item.total_sales)}
                                                </td>
                                                <td className="py-2 text-right font-bold text-orange-600">
                                                    {formatCurrency(item.total_profit)}
                                                </td>
                                                <td className="py-2 text-right">
                                                    <span className={`font-bold ${Number(item.margin_percent) < 10 ? 'text-red-600' : 'text-orange-600'}`}>
                                                        {formatPercent(item.margin_percent)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* 9. Reporte Detallado de Fletes (Nuevo) */}
            {
                shippingStats && (
                    <div className="mt-8 pb-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                                        <Package size={20} className="mr-2 text-indigo-600" />
                                        Auditoría de Fletes y Envíos
                                    </h3>
                                    <p className="text-sm text-gray-500">Desglose de cargos por fletes en facturas</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(shippingStats.summary.total_gross)}</p>
                                    <p className="text-xs text-gray-500">Total Fletes ({shippingStats.summary.count} pedidos)</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowShippingDetails(!showShippingDetails)}
                                className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors mb-4"
                            >
                                {showShippingDetails ? <ChevronUp size={16} className="mr-1" /> : <ChevronDown size={16} className="mr-1" />}
                                {showShippingDetails ? 'Ocultar Detalle' : 'Ver Detalle de Facturas'}
                            </button>

                            {showShippingDetails && (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 text-left text-gray-500 border-b">
                                                <th className="py-3 px-4">Fecha</th>
                                                <th className="py-3 px-4">Pedido / Factura</th>
                                                <th className="py-3 px-4">Cliente</th>
                                                <th className="py-3 px-4">Ciudad</th>
                                                <th className="py-3 px-4 text-right">Valor Flete</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shippingStats.details.map((item, idx) => (
                                                <tr key={idx} className="border-b hover:bg-gray-50">
                                                    <td className="py-2 px-4 text-gray-600">{new Date(item.created_at).toLocaleDateString()}</td>
                                                    <td className="py-2 px-4 font-medium text-gray-800">
                                                        {item.order_number}
                                                        {item.siigo_invoice_number && <span className="ml-2 text-xs text-gray-500">({item.siigo_invoice_number})</span>}
                                                    </td>
                                                    <td className="py-2 px-4 text-gray-600">{item.customer_name}</td>
                                                    <td className="py-2 px-4 text-gray-600">{item.customer_city}</td>
                                                    <td className="py-2 px-4 text-right font-bold text-gray-800">{formatCurrency(item.total_charge)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }


            {/* Cluster Customer Modal */}
            <ClusterCustomerModal
                isOpen={clusterModal.isOpen}
                cluster={clusterModal.cluster}
                customers={clusterModal.customers}
                loading={clusterModal.loading}
                onClose={() => setClusterModal({ isOpen: false, cluster: null, customers: [], loading: false })}
                formatCurrency={formatCurrency}
            />
        </div >
    );
};

export default ExecutiveDashboardPage;
