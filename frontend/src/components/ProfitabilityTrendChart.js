import React, { useState, useEffect } from 'react';
import adminService from '../services/adminService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';

const ProfitabilityTrendChart = ({ selectedMonth }) => {
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
                    // Fix: Set endDate to the end of the current month to include all orders even with timezone shifts
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
                console.error('Error loading trend:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrend();
    }, [selectedMonth, viewMode]);

    if (loading && trendData.length === 0) return <div className="h-64 bg-white rounded-xl shadow-sm mb-8 animate-pulse"></div>;

    const lastPoint = trendData[trendData.length - 1];
    const firstPoint = trendData[0];
    const isUp = lastPoint && firstPoint ? Number(lastPoint.margin) >= Number(firstPoint.margin) : true;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        {isUp ? <TrendingUp className="mr-2 text-green-500" /> : <TrendingDown className="mr-2 text-red-500" />}
                        Tendencia de Rentabilidad Ponderada (%)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Evolución del margen neto (Utilidad / Venta Neta).
                        {viewMode === 'day' ? ' Visualizando días del mes.' : ' Visualizando últimos 12 meses.'}
                    </p>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('day')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Por Día
                    </button>
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
                                if (viewMode === 'month') return val; // 2024-12
                                return val.split('-')[2]; // Show only day number
                            }}
                            interval={viewMode === 'day' ? 2 : 0}
                        />
                        <YAxis
                            domain={[0, 'auto']}
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            unit="%"
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            formatter={(value) => [`${value}%`, 'Margen']}
                            labelFormatter={(label) => `Fecha: ${label}`}
                        />
                        <ReferenceLine y={25} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Meta Min (25%)', position: 'right', fill: '#EF4444', fontSize: 10 }} />
                        <Line
                            type="monotone"
                            dataKey="margin"
                            stroke={isUp ? "#10B981" : "#EF4444"}
                            strokeWidth={3}
                            dot={{ r: 4, fill: isUp ? "#10B981" : "#EF4444", strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ProfitabilityTrendChart;
