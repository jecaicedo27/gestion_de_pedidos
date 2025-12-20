import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Timer, ArrowUp, ArrowDown } from 'lucide-react';
import adminService from '../services/adminService';

const InventoryTurnoverChart = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await adminService.getInventoryTurnoverHistory();
                if (response.success) {
                    setData(response.data);
                }
            } catch (error) {
                console.error('Error loading inventory turnover history', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    };

    if (loading) return <div className="h-64 flex items-center justify-center text-gray-400">Cargando rotación...</div>;
    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">No hay datos suficientes para calcular rotación</div>;

    const lastValue = data[data.length - 1]?.days || 0;
    const prevValue = data.length > 1 ? data[data.length - 2]?.days : lastValue;
    const diff = lastValue - prevValue;
    const isWorse = diff > 0; // More days = worse for turnover (money stuck)

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-gray-500 text-sm font-medium flex items-center gap-2">
                        <Timer size={16} className="text-orange-500" />
                        Días de Inventario (Rotación Promedio)
                    </h3>
                    <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-2xl font-bold text-gray-900">{lastValue} Días</span>
                        <div className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${isWorse ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {diff > 0 ? <ArrowUp size={12} className="mr-1" /> : <ArrowDown size={12} className="mr-1" />}
                            {Math.abs(diff).toFixed(1)} días vs ayer
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
                            width={30}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value) => [`${value} Días`, 'Rotación']}
                            labelFormatter={formatDate}
                        />
                        <Line
                            type="monotone"
                            dataKey="days"
                            stroke="#F97316"
                            strokeWidth={3}
                            dot={{ fill: '#F97316', strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
                Mide cuántos días tardarías en vender todo tu inventario actual basado en la velocidad de venta (Costo) de los últimos 30 días.
            </p>
        </div>
    );
};

export default InventoryTurnoverChart;
