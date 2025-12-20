import React, { useEffect, useState } from 'react';
import { DollarSign, AlertTriangle, XCircle, Package, Activity } from 'lucide-react';
import inventoryManagementService from '../services/inventoryManagementService';

const InventoryDashboard = () => {
    const [kpis, setKpis] = useState({
        totalInventoryValue: 0,
        outOfStockCount: 0,
        lowStockCount: 0,
        totalProducts: 0,
        inventoryAccuracy: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchKPIs = async () => {
            try {
                const data = await inventoryManagementService.getKPIs();
                setKpis(data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching KPIs:', err);
                setError('Error cargando indicadores');
                setLoading(false);
            }
        };

        fetchKPIs();
    }, []);

    if (loading) return <div className="p-4 text-center">Cargando indicadores...</div>;
    if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Proyección de Ventas - Ambos valores */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                    <DollarSign size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Proyección de Ventas con Inventario Actual</p>
                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(kpis.totalInventoryValueNoVat || kpis.totalInventoryValue)}</p>
                    <p className="text-xs text-blue-600 font-medium">Valor antes de IVA</p>
                    <p className="text-xs text-gray-500">Valor con IVA: {formatCurrency((kpis.totalInventoryValueNoVat || kpis.totalInventoryValue) * 1.19)}</p>
                </div>
            </div>

            {/* Costo de Mercancía de Inventario Actual */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
                <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
                    <Activity size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Costo de Mercancía de Inventario Actual</p>
                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(kpis.merchandiseCost || 0)}</p>
                    <p className="text-xs text-indigo-600 font-medium">Costo antes de IVA</p>
                    <p className="text-xs text-gray-500">Costo con IVA: {formatCurrency((kpis.merchandiseCost || 0) * 1.19)} • Margen: {(((1 - (kpis.costRatio || 0)) * 100)).toFixed(0)}%</p>
                </div>
            </div>

            {/* Velocidad de Ventas Diaria */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
                    <Activity size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Velocidad de Ventas Diaria</p>
                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(kpis.dailySalesVelocity || 0)}</p>
                    <p className="text-xs text-purple-600 font-medium">Valor antes de IVA</p>
                    <p className="text-xs text-gray-500">Valor con IVA: {formatCurrency((kpis.dailySalesVelocity || 0) * 1.19)}</p>
                </div>
            </div>

            {/* Proyección Ventas Mes */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
                <div className="p-3 rounded-full bg-teal-100 text-teal-600 mr-4">
                    <DollarSign size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Proyección Ventas Mes</p>
                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(kpis.monthlySalesProjection || 0)}</p>
                    <p className="text-xs text-teal-600 font-medium">Valor antes de IVA</p>
                    <p className="text-xs text-gray-500">Valor con IVA: {formatCurrency((kpis.monthlySalesProjection || 0) * 1.19)}</p>
                </div>
            </div>

            {/* Productos Agotados */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
                <div className="p-3 rounded-full bg-red-100 text-red-600 mr-4">
                    <XCircle size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Productos Agotados</p>
                    <p className="text-2xl font-bold text-gray-800">{kpis.outOfStockCount}</p>
                </div>
            </div>

            {/* Stock Bajo */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Stock Bajo</p>
                    <p className="text-2xl font-bold text-gray-800">{kpis.lowStockCount}</p>
                </div>
            </div>

            {/* Total Productos */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                    <Package size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Total Productos</p>
                    <p className="text-2xl font-bold text-gray-800">{kpis.totalProducts}</p>
                </div>
            </div>
        </div>
    );
};

export default InventoryDashboard;
