import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import adminService from '../services/adminService';

const CategoryPieChart = ({ selectedMonth }) => {
    const [viewMode, setViewMode] = useState('month'); // 'day' | 'month'
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let startDate, endDate;

                if (viewMode === 'day') {
                    // Today
                    const today = new Date();
                    startDate = today.toISOString().slice(0, 10);
                    endDate = today.toISOString().slice(0, 10) + 'T23:59:59';
                } else {
                    // Selected Month
                    if (!selectedMonth) return;
                    const [year, month] = selectedMonth.split('-');
                    startDate = `${year}-${month}-01`;
                    // End of that month
                    endDate = new Date(year, month, 0).toISOString().slice(0, 10) + 'T23:59:59';
                }

                console.log('📊 Fetching Category Stats:', { startDate, endDate });
                const response = await adminService.getCategoryStats({ startDate, endDate });

                console.log('📊 Category Stats Response:', response);
                if (response.success) {
                    setData(response.data);
                }
            } catch (error) {
                console.error('Error loading category stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [viewMode, selectedMonth]);

    // Transform data for the chart
    const chartData = data.map(cat => ({
        name: cat.category_group,
        value: Number(cat.sales_value),
        fullData: cat
    })).filter(item => item.value > 0);

    // Sort by value desc
    chartData.sort((a, b) => b.value - a.value);

    // Color Palette Matching the List
    const COLORS = {
        'Liquipops': '#ec4899', // pink-500
        'Geniality': '#a855f7', // purple-500
        'Skarcha': '#f97316',   // orange-500
        'Skarchamoy': '#fb7185', // rose-400
        'Skarchalito': '#fdba74', // orange-300
        'Yexis': '#eab308',     // yellow-500
        'Perlas Explosivas': '#dc2626', // red-600
        'Liquimon': '#84cc16',  // lime-500
        'Base Cítrica': '#84cc16', // lime-500 (same as liquimon)
        'Banderitas + Frutos Secos': '#b45309', // amber-700
        'Mezclas en Polvo': '#78716c', // stone-500
        'Complementos': '#60a5fa', // blue-400
        'Otros': '#9ca3af'      // gray-400
    };

    const getColor = (name) => COLORS[name] || '#9ca3af';

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const percent = (data.value / chartData.reduce((acc, curr) => acc + curr.value, 0)) * 100;
            return (
                <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg z-50">
                    <p className="font-bold text-gray-800">{data.name}</p>
                    <p className="text-sm text-gray-600">Ventas: {formatCurrency(data.value)}</p>
                    <p className="text-xs text-gray-400">Participación: {percent.toFixed(1)}%</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col relative">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-gray-800">Distribución de Ventas (Mix)</h3>
                <div className="bg-gray-100 p-1 rounded-lg flex text-xs">
                    <button
                        onClick={() => setViewMode('day')}
                        className={`px-3 py-1 rounded-md transition-all ${viewMode === 'day' ? 'bg-white shadow text-gray-800 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Hoy
                    </button>
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-3 py-1 rounded-md transition-all ${viewMode === 'month' ? 'bg-white shadow text-gray-800 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Mes
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-[300px]">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">Cargando...</div>
                ) : chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No hay ventas registradas</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                outerRadius="75%"
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getColor(entry.name)} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default CategoryPieChart;
