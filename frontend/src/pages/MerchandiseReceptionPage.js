import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    Plus, FileText, CheckCircle, AlertTriangle,
    Search, QrCode, ArrowLeft, Upload, Edit, Eye
} from 'lucide-react';

const MerchandiseReceptionPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [mode, setMode] = useState('list'); // list, upload, review, process
    const [view, setView] = useState('facturacion'); // facturacion, logistica, cartera
    const [receptions, setReceptions] = useState([]);
    const [currentReception, setCurrentReception] = useState(null);
    const [items, setItems] = useState([]);
    const [expectedItems, setExpectedItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Upload & Analysis
    const [file, setFile] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [extractedData, setExtractedData] = useState(null);

    // Create Form
    const [supplier, setSupplier] = useState('');
    const [supplierNit, setSupplierNit] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [suppliers, setSuppliers] = useState([]);

    // Scanner
    const [scanInput, setScanInput] = useState('');
    const scanInputRef = useRef(null);
    const [lastScanned, setLastScanned] = useState(null);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        // Determinar vista según rol
        const role = user?.role?.toLowerCase();
        if (role === 'facturacion' || role === 'facturador') {
            setView('facturacion');
            fetchSuppliers();
        } else if (role === 'logistica' || role === 'empaque' || role === 'packaging') {
            setView('logistica');
            fetchPendingReceptions();
        } else if (role === 'cartera' || role === 'wallet') {
            setView('cartera');
            fetchForApproval();
        } else {
            // Admin o rol no específico: permitir cambiar vista, default a facturacion
            setView('facturacion');
            fetchReceptions();
        }
    }, [user]);

    // Efecto para cargar datos cuando cambia la vista manualmente (para admin)
    useEffect(() => {
        const role = user?.role?.toLowerCase();
        if (role === 'admin' || role === 'administrador') {
            if (view === 'facturacion') fetchReceptions();
            else if (view === 'logistica') fetchPendingReceptions();
            else if (view === 'cartera') fetchForApproval();
        }
    }, [view, user]);

    useEffect(() => {
        if (mode === 'process' && scanInputRef.current) {
            scanInputRef.current.focus();
        }
    }, [mode, items]);

    const fetchReceptions = async () => {
        try {
            const res = await api.get('/receptions');
            setReceptions(res.data.data);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando recepciones');
        }
    };

    const fetchSuppliers = async () => {
        try {
            const res = await api.get('/receptions/suppliers');
            setSuppliers(res.data.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchPendingReceptions = async () => {
        try {
            const res = await api.get('/receptions/pending');
            setReceptions(res.data.data);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando recepciones pendientes');
        }
    };

    const fetchForApproval = async () => {
        try {
            const res = await api.get('/receptions/for-approval');
            setReceptions(res.data.data);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando recepciones para aprobar');
        }
    };

    const handleFileSelect = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setAnalyzing(true);

        const formData = new FormData();
        formData.append('invoice', selectedFile);

        try {
            const res = await api.post('/receptions/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setExtractedData(res.data.data);
            setSupplier(res.data.data.supplier);
            setSupplierNit(res.data.data.supplier_nit || '');
            setInvoiceNumber(res.data.data.invoice_number);
            setMode('review');
            toast.success(`Extraídos ${res.data.data.items.length} items de la factura`);
        } catch (error) {
            console.error(error);
            toast.error('Error analizando PDF: ' + (error.response?.data?.message || error.message));
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!file || !supplier) return toast.error('Faltan datos');

        const formData = new FormData();
        formData.append('supplier', supplier);
        formData.append('supplier_nit', supplierNit);
        formData.append('invoice_number', invoiceNumber);
        formData.append('invoice', file);
        if (extractedData?.items) {
            formData.append('expected_items', JSON.stringify(extractedData.items));
        }

        setLoading(true);
        try {
            const res = await api.post('/receptions', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Recepción creada exitosamente');
            setMode('list');
            fetchReceptions();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error creando recepción');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenProcess = async (id) => {
        setLoading(true);
        try {
            const res = await api.get(`/receptions/${id}`);
            setCurrentReception(res.data.data);
            setItems(res.data.data.items || []);
            setExpectedItems(res.data.data.expectedItems || []);
            setMode('process');
        } catch (error) {
            console.error(error);
            toast.error('Error cargando detalle');
        } finally {
            setLoading(false);
        }
    };

    const playSound = (type) => {
        const audio = new Audio(
            type === 'success'
                ? 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
                : 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'
        );
        audio.play().catch(e => console.warn('Audio play failed', e));
    };

    const handleScan = async (e) => {
        e.preventDefault();
        const code = scanInput.trim();
        if (!code) return;

        try {
            const res = await api.post(`/receptions/${currentReception.id}/items`, { barcode: code });

            playSound('success');
            setLastScanned(res.data.product);
            toast.success(`Agregado: ${res.data.product.name}`);

            const updated = await api.get(`/receptions/${currentReception.id}`);
            setItems(updated.data.data.items);
            setExpectedItems(updated.data.data.expectedItems || []);

            setScanInput('');
        } catch (error) {
            playSound('error');
            toast.error(error.response?.data?.message || 'Producto no encontrado');
            setScanInput('');
        }
    };

    const handleCompleteReception = async () => {
        const expectedTotal = expectedItems.reduce((sum, item) => sum + item.expected_quantity, 0);
        const scannedTotal = items.reduce((sum, item) => sum + item.quantity, 0);

        if (scannedTotal !== expectedTotal && (!notes || notes.trim() === '')) {
            return toast.error('Debe agregar notas explicando la diferencia entre lo esperado y lo recibido');
        }

        if (!window.confirm('¿Completar recepción? Esto la enviará a Cartera para aprobación.')) return;

        setLoading(true);
        try {
            await api.post(`/receptions/${currentReception.id}/complete-reception`, { notes });
            toast.success('Recepción completada y enviada a Cartera');
            setMode('list');
            fetchPendingReceptions();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error completando recepción');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm('¿Aprobar recepción? Esto actualizará el inventario.')) return;

        setLoading(true);
        try {
            await api.post(`/receptions/${id}/approve`);
            toast.success('Recepción aprobada e inventario actualizado');
            fetchForApproval();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error aprobando recepción');
        } finally {
            setLoading(false);
        }
    };

    // Cálculos para la vista de logística
    const expectedTotal = expectedItems.reduce((sum, item) => sum + item.expected_quantity, 0);
    const scannedTotal = items.reduce((sum, item) => sum + item.quantity, 0);
    const status = scannedTotal === expectedTotal ? 'ok' : scannedTotal < expectedTotal ? 'faltante' : 'sobrante';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Admin View Switcher */}
            {(user?.role === 'admin' || user?.role === 'administrador') && (
                <div className="bg-white border-b px-6 py-2 flex justify-center gap-4">
                    <button
                        onClick={() => setView('facturacion')}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${view === 'facturacion' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        Facturación
                    </button>
                    <button
                        onClick={() => setView('logistica')}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${view === 'logistica' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        Logística (Empaque)
                    </button>
                    <button
                        onClick={() => setView('cartera')}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${view === 'cartera' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        Cartera
                    </button>
                </div>
            )}

            {/* --- RENDER FACTURACIÓN --- */}
            {view === 'facturacion' && (
                <>
                    {mode === 'upload' && (
                        <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow mt-10">
                            <h2 className="text-2xl font-bold mb-6">Subir Factura de Proveedor</h2>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                <div className="space-y-1 text-center">
                                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                    <div className="flex text-sm text-gray-600">
                                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                            <span>Subir un archivo</span>
                                            <input
                                                id="file-upload"
                                                name="file-upload"
                                                type="file"
                                                className="sr-only"
                                                accept="application/pdf"
                                                onChange={handleFileSelect}
                                                disabled={analyzing}
                                            />
                                        </label>
                                        <p className="pl-1">o arrastrar y soltar</p>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {analyzing ? 'Analizando factura...' : 'PDF hasta 10MB'}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => setMode('list')}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {mode === 'review' && extractedData && (
                        <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow mt-10">
                            <h2 className="text-2xl font-bold mb-6">Revisar Datos Extraídos</h2>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Proveedor</label>
                                    <input
                                        type="text"
                                        list="suppliers-list"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        value={supplier}
                                        onChange={e => setSupplier(e.target.value)}
                                        placeholder="Escribe o selecciona un proveedor"
                                        required
                                    />
                                    <datalist id="suppliers-list">
                                        {suppliers.map((sup, idx) => (
                                            <option key={idx} value={sup}>{sup}</option>
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">NIT del Proveedor</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        value={supplierNit}
                                        onChange={e => setSupplierNit(e.target.value)}
                                        placeholder="NIT extraído del PDF"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Número de Factura</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        value={invoiceNumber}
                                        onChange={e => setInvoiceNumber(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Items Extraídos ({extractedData.items.length})
                                    </label>
                                    <div className="border rounded-md overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {extractedData.items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.code}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-900">{item.description}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{item.quantity}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setMode('upload')}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                    >
                                        {loading ? 'Creando...' : 'Crear Recepción'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </>
            )}

            {/* List mode for Facturación */}
            {view === 'facturacion' && mode === 'list' && (
                <div className="p-6 max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">Recepción de Mercancía - Facturación</h1>
                        <button
                            onClick={() => setMode('upload')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Nueva Recepción
                        </button>
                    </div>
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                        <ul className="divide-y divide-gray-200">
                            {receptions.map((reception) => (
                                <li key={reception.id} className="px-4 py-4 sm:px-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-indigo-600 truncate">{reception.supplier}</p>
                                            <p className="text-sm text-gray-500">Factura: {reception.invoice_number || 'N/A'}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(reception.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${reception.status === 'completado' ? 'bg-green-100 text-green-800' :
                                                reception.status === 'recepcionado' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {reception.status === 'completado' ? 'Completado' :
                                                    reception.status === 'recepcionado' ? 'En Cartera' :
                                                        'Pendiente'}
                                            </span>
                                            <button
                                                onClick={() => handleOpenProcess(reception.id)}
                                                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 flex items-center gap-1"
                                            >
                                                <Eye className="w-4 h-4" /> Ver
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                            {receptions.length === 0 && (
                                <li className="px-4 py-10 text-center text-gray-500">
                                    No hay recepciones registradas
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            )}

            {/* --- RENDER CARTERA --- */}
            {view === 'cartera' && (
                <div className="p-6 max-w-7xl mx-auto">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Recepciones para Aprobar - Cartera</h1>
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                        <ul className="divide-y divide-gray-200">
                            {receptions.map((reception) => (
                                <li key={reception.id} className="px-4 py-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-indigo-600">{reception.supplier}</p>
                                            <p className="text-sm text-gray-500">Factura: {reception.invoice_number}</p>
                                            <p className="text-xs text-gray-400">
                                                Recepcionado: {new Date(reception.received_at).toLocaleString()}
                                            </p>
                                            {reception.reception_notes && (
                                                <p className="text-sm text-gray-700 mt-2 italic">
                                                    Notas: {reception.reception_notes}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 text-xs rounded-full ${reception.status === 'completado' ? 'bg-green-100 text-green-800' :
                                                reception.status === 'recepcionado' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {reception.status === 'completado' ? 'Completado' :
                                                    reception.status === 'recepcionado' ? 'En Cartera' :
                                                        'Pendiente'}
                                            </span>
                                            <button
                                                onClick={() => handleApprove(reception.id)}
                                                disabled={loading}
                                                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                                            >
                                                Aprobar
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                            {receptions.length === 0 && (
                                <li className="px-4 py-10 text-center text-gray-500">
                                    No hay recepciones en cartera
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            )}

            {/* --- RENDER LOGÍSTICA --- */}
            {view === 'logistica' && (
                mode === 'process' && currentReception ? (
                    <div className="flex h-screen bg-gray-100 overflow-hidden">
                        {/* Main Content: Scanner & Items (Full Width) */}
                        <div className="w-full h-full flex flex-col bg-white">
                            {/* Header with Back Button */}
                            <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm">
                                <h3 className="font-bold text-gray-700 text-lg">Factura: {currentReception.invoice_number}</h3>
                                <button onClick={() => setMode('list')} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors flex items-center">
                                    <ArrowLeft className="inline w-4 h-4 mr-2" /> Volver a la lista
                                </button>
                            </div>

                            {/* Scanner Section */}
                            <div className="p-6 bg-indigo-50 border-b">
                                <h2 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                    <QrCode className="w-6 h-6" /> Escanear Productos
                                </h2>
                                <form onSubmit={handleScan} className="flex gap-2">
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        value={scanInput}
                                        onChange={e => setScanInput(e.target.value)}
                                        placeholder="Escanea código de barras..."
                                        className="flex-1 p-3 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 text-lg shadow-sm"
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm"
                                    >
                                        Agregar
                                    </button>
                                </form>

                                {lastScanned && (
                                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
                                        <p className="text-sm text-green-800 font-bold">¡Escaneado!</p>
                                        <p className="text-lg font-bold text-gray-900">{lastScanned.name}</p>
                                    </div>
                                )}

                                {/* Status */}
                                <div className="mt-4 p-4 bg-white rounded-lg border shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-base font-medium text-gray-600">Esperado: <span className="text-gray-900 font-bold">{expectedTotal}</span></span>
                                        <span className="text-base font-medium text-gray-600">Escaneado: <span className="text-gray-900 font-bold">{scannedTotal}</span></span>
                                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${status === 'ok' ? 'bg-green-100 text-green-800' :
                                            status === 'faltante' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                            {status === 'ok' ? '✓ OK' : status === 'faltante' ? '⚠ Faltante' : '⚠ Sobrante'}
                                        </span>
                                    </div>
                                </div>

                                {/* Notes */}
                                {status !== 'ok' && (
                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Notas (obligatorio) *
                                        </label>
                                        <textarea
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="Explique la diferencia..."
                                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                            rows="2"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <h3 className="font-bold text-lg mb-4 text-gray-800">Progreso de Recepción</h3>
                                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Progreso</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {expectedItems.map((expected) => {
                                                // Usar scanned_quantity directamente del item esperado
                                                const scannedQty = expected.scanned_quantity || 0;
                                                const isComplete = scannedQty >= expected.expected_quantity;
                                                const isOver = scannedQty > expected.expected_quantity;

                                                return (
                                                    <tr key={expected.id} className={`hover:bg-gray-50 transition-colors ${isComplete ? 'bg-green-50' : ''}`}>
                                                        <td className="px-6 py-4 text-sm">
                                                            <div className="font-medium text-gray-900">{expected.item_description}</div>
                                                            <div className="text-xs text-gray-500 font-mono mt-1">{expected.item_code}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-center whitespace-nowrap">
                                                            <span className="font-bold text-gray-900">{scannedQty}</span> <span className="text-gray-400 mx-1">/</span> <span className="text-gray-600">{expected.expected_quantity}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                                                            {isOver ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                    Excedido
                                                                </span>
                                                            ) : isComplete ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                    ✓ Listo
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                    Pendiente
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {items.filter(i => !expectedItems.find(e => e.item_code === i.product_code)).map(extra => (
                                                <tr key={extra.id} className="bg-yellow-50 hover:bg-yellow-100 transition-colors">
                                                    <td className="px-6 py-4 text-sm">
                                                        <div className="font-medium text-gray-900">{extra.product_name}</div>
                                                        <div className="text-xs text-red-500 font-bold mt-1">No esperado</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-center font-bold text-gray-900">
                                                        {extra.quantity}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                            ⚠ Extra
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t bg-gray-50 flex justify-end">
                                <button
                                    onClick={handleCompleteReception}
                                    disabled={loading}
                                    className="w-full md:w-auto px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 shadow-sm transition-colors flex items-center justify-center"
                                >
                                    <CheckCircle className="inline w-5 h-5 mr-2" />
                                    Completar Recepción
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 max-w-7xl mx-auto">
                        <h1 className="text-2xl font-bold text-gray-900 mb-6">Recepciones Pendientes - Logística</h1>
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                            <ul className="divide-y divide-gray-200">
                                {receptions.map((reception) => (
                                    <li key={reception.id} className="px-4 py-4 hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenProcess(reception.id)}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-indigo-600">{reception.supplier}</p>
                                                <p className="text-sm text-gray-500">Factura: {reception.invoice_number}</p>
                                            </div>
                                            <button className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm">
                                                Iniciar Recepción
                                            </button>
                                        </div>
                                    </li>
                                ))}
                                {receptions.length === 0 && (
                                    <li className="px-4 py-10 text-center text-gray-500">
                                        No hay recepciones registradas
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}



export default MerchandiseReceptionPage;
