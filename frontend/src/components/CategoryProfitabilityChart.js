
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import adminService from '../services/adminService';

const CategoryProfitabilityChart = ({ selectedMonth }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('day'); // 'day' | 'month'

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let startDate, endDate;

                if (viewMode === 'day') {
                    if (!selectedMonth) return;
                    // Current selected month
                    const [year, month] = selectedMonth.split('-');
                    startDate = `${year}-${month}-01`;
                    endDate = new Date(year, month, 0).toISOString().slice(0, 10) + ' 23:59:59';
                } else {
                    // Last 12 months
                    const today = new Date();
                    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10) + ' 23:59:59';

                    const past = new Date();
                    past.setMonth(today.getMonth() - 11);
                    past.setDate(1);
                    startDate = past.toISOString().slice(0, 10);
                }

                const response = await adminService.getCategoryProfitabilityTrend({
                    startDate,
                    endDate,
                    interval: viewMode
                });

                if (response.success) {
                    processData(response.data);
                }
            } catch (error) {
                console.error('Error loading category profitability:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedMonth, viewMode]);

    const processData = (rawData) => {
        // 1. Group by Date
        const grouped = rawData.reduce((acc, curr) => {
            const dateStr = curr.date; // Backend formats date
            const dateKey = viewMode === 'month' ? dateStr.slice(0, 7) : dateStr.slice(0, 10);

            if (!acc[dateKey]) acc[dateKey] = { date: dateStr }; // Keep original date format for sorting/display
            acc[dateKey][curr.category_group] = Number(curr.margin_percent);
            return acc;
        }, {});

        // 2. Flatten for Recharts
        // No need to normalize to 100% here because we are showing actual margin %
        const processed = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));

        setData(processed);
    };

    const COLORS = {
        'Liquipops': '#ec4899', // pink-500
        'Geniality': '#a855f7', // purple-500
        'Skarcha': '#f97316',   // orange-500
        'Skarchamoy': '#fb7185', // rose-400
        'Skarchalito': '#fdba74', // orange-300
        'Yexis': '#eab308',     // yellow-500
        'Perlas Explosivas': '#dc2626', // red-600
        'Liquimon': '#84cc16',  // lime-500
        'Base Cítrica': '#84cc16', // lime-500
        'Banderitas + Frutos Secos': '#b45309', // amber-700
        'Mezclas en Polvo': '#78716c', // stone-500
        'Complementos': '#60a5fa', // blue-400
        'Otros': '#9ca3af'      // gray-400
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-gray-800">Rentabilidad por Categoría (%)</h3>

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

            <div className="h-[400px]">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-400">Cargando...</div>
                ) : data.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400">No hay datos para este periodo</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str) => {
                                    if (viewMode === 'month') return str.slice(0, 7); // YYYY-MM
                                    return new Date(str).getDate(); // Day number
                                }}
                                stroke="#9CA3AF"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                interval={viewMode === 'day' ? 0 : 'preserveEnd'}
                            />
                            <YAxis
                                unit="%"
                                // Domain auto or fixed? Margins usually 0-100 but can be negative. Let's try auto.
                                domain={['auto', 'auto']}
                                stroke="#9CA3AF"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                labelFormatter={(label) => viewMode === 'day' ? new Date(label).toLocaleDateString() : label.slice(0, 7)}
                                formatter={(value, name) => [`${value}%`, name]}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                            {/* Dynamically render Lines based on keys present in data */}
                            {data.length > 0 && Object.keys(COLORS).map((cat) => (
                                // Only render line if category exists in at least one data point
                                data.some(d => d[cat] !== undefined) && (
                                    <Line
                                        key={cat}
                                        type="monotone"
                                        dataKey={cat}
                                        stroke={COLORS[cat]}
                                        strokeWidth={2}
                                        dot={{ r: 3, strokeWidth: 0, fill: COLORS[cat] }}
                                        activeDot={{ r: 6 }}
                                        connectNulls
                                    />
                                )
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};
export default CategoryProfitabilityChart;
