import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUp, ArrowDown, Activity } from 'lucide-react';
import adminService from '../services/adminService';

const InventoryValueChart = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await adminService.getInventoryValueHistory();
                if (response.success) {
                    setData(response.data);
                }
            } catch (error) {
                console.error('Error loading inventory history', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    };

    if (loading) return <div className="h-64 flex items-center justify-center text-gray-400">Cargando historial...</div>;
    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">No hay datos históricos aún</div>;

    const lastValue = data[data.length - 1]?.value || 0;
    const prevValue = data.length > 1 ? data[data.length - 2]?.value : lastValue;
    const diff = lastValue - prevValue;
    const diffPercent = prevValue > 0 ? (diff / prevValue) * 100 : 0;
    const isPositive = diff >= 0;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-gray-500 text-sm font-medium flex items-center gap-2">
                        <Activity size={16} className="text-blue-500" />
                        Evolución Valor del Inventario (Costo)
                    </h3>
                    <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-2xl font-bold text-gray-900">{formatCurrency(lastValue)}</span>
                        <div className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {isPositive ? <ArrowUp size={12} className="mr-1" /> : <ArrowDown size={12} className="mr-1" />}
                            {Math.abs(diffPercent).toFixed(1)}% vs ayer
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={formatDate}
                            tickMargin={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                            width={40}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value) => [formatCurrency(value), 'Valor Inventario']}
                            labelFormatter={formatDate}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            dot={{ fill: '#3B82F6', strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
                Visualizando el valor total del inventario (costo) al cierre de cada día de los últimos 30 días.
            </p>
        </div>
    );
};

export default InventoryValueChart;
