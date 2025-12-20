import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Upload, Search, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';

const SupplierCodesPage = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [mappings, setMappings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchMappings();
    }, [page, search]);

    const fetchMappings = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/supplier-codes?page=${page}&search=${search}`);
            setMappings(response.data.data);
            setTotalPages(response.data.pagination.totalPages);
        } catch (error) {
            console.error('Error fetching mappings:', error);
            toast.error('Error cargando los códigos');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setStats(null);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            const response = await api.post('/supplier-codes/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            toast.success('Archivo procesado correctamente');
            setStats(response.data.details);
            setFile(null);
            fetchMappings(); // Refresh list
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error(error.response?.data?.message || 'Error subiendo el archivo');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Mapeo de Códigos de Proveedor</h1>

            {/* Upload Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border border-gray-200">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-indigo-600" /> Cargar Nuevo Mapeo
                </h2>
                <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Archivo Excel (.xlsx)
                        </label>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-indigo-50 file:text-indigo-700
                                hover:file:bg-indigo-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Columnas requeridas: <strong>CodigoProveedor, CodigoBarras, Descripcion</strong>
                        </p>
                    </div>
                    <button
                        type="submit"
                        disabled={!file || uploading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Procesando...' : 'Cargar Archivo'}
                    </button>
                </form>

                {stats && (
                    <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200">
                        <h3 className="text-sm font-bold text-green-800 mb-2">Resultado de la carga:</h3>
                        <ul className="text-sm text-green-700 space-y-1">
                            <li>Total procesados: {stats.processed}</li>
                            <li>Exitosos: {stats.success}</li>
                            <li>Errores/Omitidos: {stats.errors}</li>
                        </ul>
                    </div>
                )}
            </div>

            {/* List Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-600" /> Códigos Registrados
                    </h2>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar código..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Proveedor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Barras (Interno)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto Asociado</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
                                        <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
                                        Cargando datos...
                                    </td>
                                </tr>
                            ) : (mappings || []).length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
                                        No se encontraron registros
                                    </td>
                                </tr>
                            ) : (
                                mappings.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {item.supplier_code}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {item.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-gray-900">{item.barcode}</span>
                                                {item.internal_code && (
                                                    <span className="text-xs text-indigo-600">
                                                        Código interno: {item.internal_code}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {item.internal_product_name ? (
                                                <span className="flex items-center gap-1 text-green-600">
                                                    <CheckCircle className="w-4 h-4" /> {item.internal_product_name}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-yellow-600">
                                                    <AlertCircle className="w-4 h-4" /> No encontrado
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                        Anterior
                    </button>
                    <span className="text-sm text-gray-600">
                        Página {page} de {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SupplierCodesPage;
