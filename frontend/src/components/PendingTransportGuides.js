import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import * as Icons from 'lucide-react';
import api from '../services/api';

const PendingTransportGuides = ({ onGuideUploaded }) => {
    const { user } = useAuth();
    const [pendingOrders, setPendingOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            if (searchTerm !== debouncedSearchTerm) {
                setCurrentPage(1);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Modal state
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [notes, setNotes] = useState('');
    const [previews, setPreviews] = useState([]);
    const [filesToUpload, setFilesToUpload] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [zoomedIndex, setZoomedIndex] = useState(null);
    const modalRef = useRef(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const fetchPendingGuides = useCallback(async () => {
        try {
            const response = await api.get('/orders/pending-guides');
            if (response.data.success) {
                setPendingOrders(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching pending guides:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingGuides();
        const handleRefresh = () => fetchPendingGuides();
        window.addEventListener('orders:refresh', handleRefresh);
        return () => {
            window.removeEventListener('orders:refresh', handleRefresh);
        };
    }, [fetchPendingGuides]);

    // Handle Paste Event
    useEffect(() => {
        const handlePaste = (e) => {
            if (!selectedOrder) return;

            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    handleFileSelect([blob]);
                    break;
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [selectedOrder]);

    const handleFileSelect = (files) => {
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files).filter(file => {
            if (!file.type.startsWith('image/')) {
                toast.error(`${file.name} no es una imagen`);
                return false;
            }
            return true;
        });

        if (newFiles.length === 0) return;

        setFilesToUpload(prev => [...prev, ...newFiles]);

        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviews(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeFile = (index) => {
        setFilesToUpload(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (filesToUpload.length === 0 || !selectedOrder) return;

        try {
            setIsUploading(true);
            const formData = new FormData();
            filesToUpload.forEach(file => {
                formData.append('guides', file);
            });
            if (notes.trim()) {
                formData.append('notes', notes.trim());
            }

            const response = await api.post(`/orders/${selectedOrder.id}/transport-guide`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                toast.success('Guía subida exitosamente');
                if (onGuideUploaded) {
                    onGuideUploaded(selectedOrder.id);
                }
                setPendingOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
                closeModal();
            }
        } catch (error) {
            console.error('Error uploading guide:', error);
            toast.error('Error al subir la guía');
        } finally {
            setIsUploading(false);
        }
    };

    const openModal = (order) => {
        setSelectedOrder(order);
        setNotes('');
        setPreviews([]);
        setFilesToUpload([]);
    };

    const closeModal = () => {
        setSelectedOrder(null);
        setNotes('');
        setPreviews([]);
        setFilesToUpload([]);
    };

    // Filter orders
    const filteredOrders = pendingOrders.filter(order => {
        if (!debouncedSearchTerm) return true;
        const searchLower = debouncedSearchTerm.toLowerCase();
        return (
            (order.order_number && order.order_number.toLowerCase().includes(searchLower)) ||
            (order.customer_name && order.customer_name.toLowerCase().includes(searchLower))
        );
    });

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (pendingOrders.length === 0) {
        return null;
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8 min-h-[600px]">
                <div className="p-4 border-b border-gray-200 bg-orange-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Icons.Truck className="w-5 h-5 text-orange-600" />
                        <h2 className="font-semibold text-gray-800">
                            Pendientes por subir guías de transporte
                            <span className="ml-2 px-2 py-0.5 bg-orange-200 text-orange-800 text-xs rounded-full">
                                {filteredOrders.length}
                            </span>
                        </h2>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Icons.Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por pedido o cliente..."
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent w-full"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                            }}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pedido</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciudad</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transportadora</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Envío</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {currentOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {order.order_number}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {order.customer_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {order.customer_city}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {order.carrier_name || 'Nacional'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {order.shipping_date ? new Date(order.shipping_date).toLocaleDateString('es-CO') : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => openModal(order)}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-orange-600 hover:bg-orange-700"
                                        >
                                            <Icons.Upload className="w-3 h-3 mr-1" />
                                            Subir Guía
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-white">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button
                                onClick={() => paginate(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                            >
                                Siguiente
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Mostrando <span className="font-medium">{indexOfFirstItem + 1}</span> a <span className="font-medium">{Math.min(indexOfLastItem, filteredOrders.length)}</span> de <span className="font-medium">{filteredOrders.length}</span> resultados
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => paginate(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                                    >
                                        <span className="sr-only">Anterior</span>
                                        <Icons.ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <button
                                        onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                                        disabled={currentPage === totalPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                                    >
                                        <span className="sr-only">Siguiente</span>
                                        <Icons.ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {
                selectedOrder && (
                    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeModal}></div>

                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 sm:mx-0 sm:h-10 sm:w-10">
                                            <Icons.Upload className="h-6 w-6 text-orange-600" />
                                        </div>
                                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                                Subir Guía - Pedido {selectedOrder.order_number}
                                            </h3>
                                            <div className="mt-2">
                                                <p className="text-sm text-gray-500 mb-4">
                                                    Selecciona una imagen o pega (Ctrl+V) una captura de pantalla.
                                                </p>

                                                {/* Drop/Paste Zone */}
                                                <div
                                                    className={`border-2 border-dashed rounded-lg p-6 text-center ${previews.length > 0 ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-orange-500'}`}
                                                >
                                                    {previews.length > 0 ? (
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {previews.map((preview, index) => (
                                                                <div key={index} className="relative group">
                                                                    {/* Image Container with Zoom */}
                                                                    <div
                                                                        className={`relative overflow-hidden rounded transition-all duration-200 ${zoomedIndex === index ? 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4' : 'h-32 w-full'}`}
                                                                        onClick={() => setZoomedIndex(zoomedIndex === index ? null : index)}
                                                                    >
                                                                        <img
                                                                            src={preview}
                                                                            alt={`Preview ${index}`}
                                                                            className={`${zoomedIndex === index ? 'max-h-screen max-w-full object-contain cursor-zoom-out' : 'h-full w-full object-cover cursor-zoom-in'}`}
                                                                        />
                                                                        {zoomedIndex === index && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setZoomedIndex(null); }}
                                                                                className="absolute top-4 right-4 text-white hover:text-gray-300"
                                                                            >
                                                                                <Icons.X className="w-8 h-8" />
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Remove Button (only visible when not zoomed) */}
                                                                    {zoomedIndex !== index && (
                                                                        <button
                                                                            onClick={() => removeFile(index)}
                                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                                        >
                                                                            <Icons.X className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded hover:border-orange-500 cursor-pointer">
                                                                <label htmlFor="file-upload-more" className="cursor-pointer w-full h-full flex items-center justify-center">
                                                                    <Icons.Plus className="w-8 h-8 text-gray-400" />
                                                                    <input id="file-upload-more" type="file" className="sr-only" accept="image/*" multiple onChange={(e) => handleFileSelect(e.target.files)} />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <Icons.Image className="mx-auto h-12 w-12 text-gray-400" />
                                                            <div className="flex text-sm text-gray-600 justify-center">
                                                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-orange-600 hover:text-orange-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-orange-500">
                                                                    <span>Sube archivos</span>
                                                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" multiple onChange={(e) => handleFileSelect(e.target.files)} />
                                                                </label>
                                                                <p className="pl-1">o arrastra y suelta</p>
                                                            </div>
                                                            <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 5MB</p>
                                                            <p className="text-xs text-blue-500 font-medium mt-2">¡Tip! Puedes pegar (Ctrl+V) imágenes directamente</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Notes Field */}
                                                <div className="mt-4">
                                                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                                                        Notas (Opcional)
                                                    </label>
                                                    <textarea
                                                        id="notes"
                                                        rows={3}
                                                        className="shadow-sm focus:ring-orange-500 focus:border-orange-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md"
                                                        placeholder="Agregar detalles adicionales..."
                                                        value={notes}
                                                        onChange={(e) => setNotes(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm ${(!filesToUpload.length || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={handleUpload}
                                        disabled={!filesToUpload.length || isUploading}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Subiendo...
                                            </>
                                        ) : 'Subir Guía'}
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        onClick={closeModal}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};

export default PendingTransportGuides;
