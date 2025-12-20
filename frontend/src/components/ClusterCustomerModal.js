import React from 'react';

const ClusterCustomerModal = ({ isOpen, cluster, customers, loading, onClose, formatCurrency }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Clientes {cluster && `- ${cluster.charAt(0).toUpperCase() + cluster.slice(1)}`}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p className="mt-2 text-gray-600">Cargando clientes...</p>
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No se encontraron clientes en este cluster
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr className="border-b-2 border-gray-200">
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Cliente</th>
                                    <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">Ciudad</th>
                                    <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Pedidos</th>
                                    <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Ventas</th>
                                    <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Rentabilidad</th>
                                    <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Margen %</th>
                                    <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Ticket Prom.</th>
                                </tr>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Ventas (Con IVA)</th>
                            </thead>
                            <tbody>
                                {customers.map((customer, idx) => (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-gray-800">{customer.name}</p>
                                            <p className="text-xs text-gray-500">{customer.identification}</p>
                                        </td>
                                        <td className="py-3 px-4 text-center text-gray-600 text-sm">{customer.city || '-'}</td>
                                        <td className="py-3 px-4 text-right text-gray-700 font-medium">{customer.orders}</td>
                                        <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatCurrency(customer.sales)}</td>
                                        <td className={`py-3 px-4 text-right font-bold ${customer.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(customer.profit)}
                                        </td>
                                                <td className="py-3 px-4 text-right font-semibold text-indigo-600">{formatCurrency(customer.salesWithIVA)}</td>
                                        <td className="py-3 px-4 text-right text-gray-700">
                                            {customer.margin.toFixed(1)}%
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-700">{formatCurrency(customer.avgTicket)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 text-right text-sm text-gray-600">
                    Total: {customers.length} clientes
                </div>
            </div>
        </div>
    );
};

export default ClusterCustomerModal;
