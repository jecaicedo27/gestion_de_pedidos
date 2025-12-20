import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Package, TrendingUp, History } from 'lucide-react';

const ProductDetailsModal = ({ product, onClose, onUpdate, onAnalyze }) => {
    const [config, setConfig] = useState({
        min_inventory_qty: 0,
        pack_size: 1,
        supplier: '',
        purchasing_price: 0, // Nuevo campo
        days_coverage: 7
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (product) {
            setConfig({
                min_inventory_qty: product.min_inventory_qty || 0,
                pack_size: product.pack_size || 1,
                supplier: product.supplier || '',
                purchasing_price: product.purchasing_price || 0, // Cargar precio
                days_coverage: 7
            });
        }
    }, [product]);

    if (!product) return null;

    const handleSave = async () => {
        setSaving(true);
        await onUpdate(product.id, {
            min_inventory_qty: Number(config.min_inventory_qty),
            pack_size: Number(config.pack_size),
            supplier: config.supplier,
            purchasing_price: Number(config.purchasing_price) // Enviar precio
        });
        setSaving(false);
        onClose();
    };

    // Calcular estado de urgencia para mostrar visualmente
    const getUrgencyStatus = () => {
        if (product.days_until_stockout <= 0) return { color: 'bg-red-100 text-red-800', text: 'AGOTADO' };
        if (product.days_until_stockout <= 3) return { color: 'bg-orange-100 text-orange-800', text: 'CRÍTICO' };
        if (product.days_until_stockout <= 7) return { color: 'bg-yellow-100 text-yellow-800', text: 'BAJO' };
        return { color: 'bg-green-100 text-green-800', text: 'NORMAL' };
    };

    const status = getUrgencyStatus();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-500">{product.internal_code} • {product.barcode}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${status.color}`}>
                            {status.text}
                        </div>
                        {product.abc_classification && (
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${product.abc_classification === 'A' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                product.abc_classification === 'B' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    'bg-gray-100 text-gray-700 border-gray-200'
                                }`}>
                                Clase {product.abc_classification}
                            </div>
                        )}
                    </div>

                    {/* Stock Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-xs text-blue-600 font-semibold uppercase">Stock Actual</p>
                            <p className="text-2xl font-bold text-blue-900">{product.current_stock}</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg">
                            <p className="text-xs text-purple-600 font-semibold uppercase">Sugerido</p>
                            <p className="text-2xl font-bold text-purple-900">{product.suggested_order_qty || 0}</p>
                        </div>
                    </div>

                    {/* Configuration Form */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            <Package className="w-4 h-4" /> Configuración
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mínimo
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={config.min_inventory_qty}
                                    onChange={(e) => setConfig({ ...config, min_inventory_qty: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pack/Caja
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={config.pack_size}
                                    onChange={(e) => setConfig({ ...config, pack_size: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Proveedor
                            </label>
                            <input
                                type="text"
                                value={config.supplier}
                                onChange={(e) => setConfig({ ...config, supplier: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Nombre del proveedor"
                            />
                        </div>

                        {/* Nuevo Campo: Costo de Compra */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Costo de Compra (Unitario)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">$</span>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    value={config.purchasing_price}
                                    onChange={(e) => setConfig({ ...config, purchasing_price: e.target.value })}
                                    className="w-full pl-7 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="0"
                                />
                                <p className="mt-1 text-xs text-gray-500">Usado para calcular rentabilidad real.</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Usado para calcular rentabilidad real.</p>
                        </div>
                    </div>

                    {/* Analysis Stats */}
                    <div className="border-t pt-4">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4" /> Análisis de Consumo
                        </h4>
                        <div className="text-sm text-gray-600 space-y-2">
                            <div className="flex justify-between">
                                <span>Consumo Diario Promedio:</span>
                                <span className="font-medium">{Number(product.avg_daily_consumption || 0).toFixed(2)} un/día</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Días hasta agotarse:</span>
                                <span className="font-medium">{product.days_until_stockout === 999 ? '> 30 días' : `${product.days_until_stockout} días`}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2"
                    >
                        {saving ? 'Guardando...' : (
                            <>
                                <Save className="w-4 h-4" /> Guardar Cambios
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetailsModal;
