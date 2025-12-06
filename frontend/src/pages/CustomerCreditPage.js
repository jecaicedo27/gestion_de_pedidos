import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { customerService } from '../services/api';

const CustomerCreditPage = () => {
    const { user } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    });

    const [formData, setFormData] = useState({
        customer_nit: '',
        customer_name: '',
        credit_limit: '',
        notes: '',
        status: 'active'
    });

    // Autocompletar desde clientes SIIGO sincronizados
    const [nitQuery, setNitQuery] = useState('');
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [nitSelected, setNitSelected] = useState(false);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchCustomers();
        }
    }, [pagination.page, searchTerm, statusFilter, user?.role]);

    // Verificar que el usuario sea admin
    if (user?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h2>
                    <p className="text-gray-600">Solo los administradores pueden acceder a esta página.</p>
                </div>
            </div>
        );
    }

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...(searchTerm && { search: searchTerm }),
                ...(statusFilter && { status: statusFilter })
            });

            const response = await fetch(`/api/customer-credit?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                setCustomers(data.data.customers);
                setPagination(prev => ({
                    ...prev,
                    total: data.data.pagination.total,
                    pages: data.data.pagination.pages
                }));
            } else {
                setError(data.message);
            }
        } catch (error) {
            setError('Error al cargar los clientes de crédito');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            const url = editingCustomer 
                ? `/api/customer-credit/${editingCustomer.id}`
                : '/api/customer-credit';
            
            const method = editingCustomer ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(editingCustomer ? 'Cliente actualizado exitosamente' : 'Cliente creado exitosamente');
                setShowModal(false);
                resetForm();
                fetchCustomers();
            } else {
                setError(data.message);
            }
        } catch (error) {
            setError('Error al guardar el cliente');
            console.error('Error:', error);
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setFormData({
            customer_nit: customer.customer_nit,
            customer_name: customer.customer_name,
            credit_limit: customer.credit_limit,
            notes: customer.notes || '',
            status: customer.status
        });
        setShowModal(true);
    };

    const handleDelete = async (customerId) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este cliente de crédito?')) {
            return;
        }

        try {
            const response = await fetch(`/api/customer-credit/${customerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('Cliente eliminado exitosamente');
                fetchCustomers();
            } else {
                setError(data.message);
            }
        } catch (error) {
            setError('Error al eliminar el cliente');
            console.error('Error:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            customer_nit: '',
            customer_name: '',
            credit_limit: '',
            notes: '',
            status: 'active'
        });
        setNitQuery('');
        setCustomerSuggestions([]);
        setNitSelected(false);
        setEditingCustomer(null);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Activo' },
            inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactivo' },
            suspended: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspendido' }
        };

        const config = statusConfig[status] || statusConfig.inactive;

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                {config.label}
            </span>
        );
    };

    if (loading && customers.length === 0) {
        return <LoadingSpinner />;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Gestión de Crédito de Clientes</h1>
                    <p className="mt-2 text-gray-600">
                        Administre los cupos de crédito y la información de clientes corporativos
                    </p>
                </div>

                {/* Alertas */}
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                        {success}
                    </div>
                )}

                {/* Filtros y acciones */}
                <div className="bg-white p-6 rounded-lg shadow mb-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-4 flex-1">
                            <input
                                type="text"
                                placeholder="Buscar por NIT o nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Todos los estados</option>
                                <option value="active">Activo</option>
                                <option value="inactive">Inactivo</option>
                                <option value="suspended">Suspendido</option>
                            </select>
                        </div>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowModal(true);
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Nuevo Cliente
                        </button>
                    </div>
                </div>

                {/* Tabla de clientes */}
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Cliente
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        NIT
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Cupo de Crédito
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Saldo Actual
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Disponible
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {customers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {customer.customer_name}
                                            </div>
                                            {customer.notes && (
                                                <div className="text-sm text-gray-500">
                                                    {customer.notes}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {customer.customer_nit}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatCurrency(customer.credit_limit)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatCurrency(customer.current_balance)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span className={customer.available_credit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                {formatCurrency(customer.available_credit)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(customer.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(customer)}
                                                className="text-blue-600 hover:text-blue-900 mr-3"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(customer.id)}
                                                className="text-red-600 hover:text-red-900"
                                                disabled={customer.current_balance > 0}
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {customers.length === 0 && !loading && (
                        <div className="text-center py-8">
                            <p className="text-gray-500">No se encontraron clientes de crédito</p>
                        </div>
                    )}
                </div>

                {/* Paginación */}
                {pagination.pages > 1 && (
                    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6 rounded-lg shadow">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                disabled={pagination.page === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                                disabled={pagination.page === pagination.pages}
                                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Siguiente
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Mostrando <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> a{' '}
                                    <span className="font-medium">
                                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                                    </span>{' '}
                                    de <span className="font-medium">{pagination.total}</span> resultados
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                    {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => setPagination(prev => ({ ...prev, page }))}
                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                                page === pagination.page
                                                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal para crear/editar cliente */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente de Crédito'}
                            </h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700">NIT</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.customer_nit}
                                        onChange={async (e) => {
                                            const value = e.target.value;
                                            setFormData({ ...formData, customer_nit: value });
                                            setNitQuery(value);
                                            setNitSelected(false);
                                            setFormData(prev => ({ ...prev, customer_name: prev.customer_name }));
                                            if (value && value.trim().length >= 2) {
                                                try {
                                                    const resp = await customerService.searchCustomers(value.trim());
                                                    if (resp && resp.success) {
                                                        setCustomerSuggestions(resp.customers || resp.data || []);
                                                    } else {
                                                        setCustomerSuggestions([]);
                                                    }
                                                } catch (err) {
                                                    setCustomerSuggestions([]);
                                                }
                                            } else {
                                                setCustomerSuggestions([]);
                                            }
                                        }}
                                        disabled={editingCustomer}
                                        placeholder="Escribe NIT o nombre y selecciona de la lista"
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                    />
                                    {customerSuggestions && customerSuggestions.length > 0 && !nitSelected && (
                                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto">
                                            {customerSuggestions.map((c) => {
                                                const displayName = c.commercial_name && c.commercial_name.trim() && c.commercial_name.toLowerCase() !== 'no aplica'
                                                    ? c.commercial_name
                                                    : (c.name || 'Cliente');
                                                const nit = c.identification || '';
                                                return (
                                                    <div
                                                        key={`${nit}-${c.id}`}
                                                        onClick={() => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                customer_nit: nit,
                                                                customer_name: displayName
                                                            }));
                                                            setNitSelected(true);
                                                            setCustomerSuggestions([]);
                                                        }}
                                                        className="px-3 py-2 cursor-pointer hover:bg-blue-50"
                                                    >
                                                        <div className="text-sm font-medium text-gray-900">{displayName}</div>
                                                        <div className="text-xs text-gray-500">NIT: {nit}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre del Cliente</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        readOnly={nitSelected}
                                        className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${nitSelected ? 'bg-gray-100' : ''}`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cupo de Crédito</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="1000"
                                        value={formData.credit_limit}
                                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="active">Activo</option>
                                        <option value="inactive">Inactivo</option>
                                        <option value="suspended">Suspendido</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Notas</label>
                                    <textarea
                                        rows="3"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Información adicional sobre el cliente..."
                                    />
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            resetForm();
                                        }}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        {editingCustomer ? 'Actualizar' : 'Crear'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerCreditPage;
