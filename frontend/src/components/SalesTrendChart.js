import React, { useState, useEffect } from 'react';
import adminService from '../services/adminService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const SalesTrendChart = ({ selectedMonth }) => {
    const [trendData, setTrendData] = useState([]);
    const [viewMode, setViewMode] = useState('day'); // 'day' | 'month'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrend = async () => {
            setLoading(true);
            try {
                let startDate, endDate;

                if (viewMode === 'day') {
                    // Current selected month
                    const [year, month] = selectedMonth.split('-');
                    startDate = `${year}-${month}-01`;
                    endDate = new Date(year, month, 0).toISOString().slice(0, 10) + ' 23:59:59';
                } else {
                    // Last 12 months
                    const today = new Date();
                    // Fix: Set endDate to the end of the current month to include all orders even with timezone shifts (UTC vs Local)
                    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10) + ' 23:59:59';

                    const past = new Date();
                    past.setMonth(today.getMonth() - 11);
                    past.setDate(1);
                    startDate = past.toISOString().slice(0, 10);
                }

                const response = await adminService.getProfitabilityTrend({
                    startDate,
                    endDate,
                    interval: viewMode
                });

                if (response.success) {
                    setTrendData(response.data);
                }
            } catch (error) {
                console.error('Error loading sales trend:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrend();
    }, [selectedMonth, viewMode]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatCurrencyShort = (value) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
        return value;
    };

    if (loading && trendData.length === 0) return <div className="h-64 bg-white rounded-xl shadow-sm mb-8 animate-pulse"></div>;

    const lastPoint = trendData[trendData.length - 1];
    const firstPoint = trendData[0];
    const isUp = lastPoint && firstPoint ? Number(lastPoint.sales) >= Number(firstPoint.sales) : true;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <DollarSign className="mr-2 text-indigo-500" />
                        Tendencia de Ventas
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Evolución del total vendido.
                        {viewMode === 'day' ? ' Visualizando días del mes.' : ' Visualizando últimos 12 meses.'}
                    </p>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('day')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Por Día
                    </button>
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Por Mes
                    </button>
                </div>
            </div>

            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            tickFormatter={(val) => {
                                if (viewMode === 'month') return val;
                                return val.split('-')[2];
                            }}
                            interval={viewMode === 'day' ? 2 : 0}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            tickFormatter={formatCurrencyShort}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            formatter={(value) => [formatCurrency(value), 'Ventas']}
                            labelFormatter={(label) => `Fecha: ${label}`}
                        />
                        <Line
                            type="monotone"
                            dataKey="sales"
                            stroke="#6366F1" // Indigo
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#6366F1", strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SalesTrendChart;
