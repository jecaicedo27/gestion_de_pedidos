import React, { useState } from 'react';
import { logisticsService } from '../services/api';
import toast from 'react-hot-toast';
import { Upload, X, Image as ImageIcon, FileText, CheckCircle } from 'lucide-react';

const UploadEvidenceModal = ({ isOpen, onClose, order, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // Estados para pago mixto
    const [paymentType, setPaymentType] = useState('full'); // 'full' o 'mixed'
    const [transferAmount, setTransferAmount] = useState('');
    const [cashAmount, setCashAmount] = useState('');

    React.useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setPreviewUrl(null);
            setPaymentType('full');
            setTransferAmount('');
            setCashAmount('');
            return;
        }

        // Enfocar el modal al abrir para capturar eventos de teclado
        const modalContent = document.getElementById('upload-modal-content');
        if (modalContent) {
            modalContent.focus();
        }

        const handlePaste = (e) => {
            // 1. Intentar obtener archivos directamente (ej. copiar archivo desde explorador)
            if (e.clipboardData.files && e.clipboardData.files.length > 0) {
                const pastedFile = e.clipboardData.files[0];
                if (pastedFile.type.startsWith('image/')) {
                    setFile(pastedFile);
                    const url = URL.createObjectURL(pastedFile);
                    setPreviewUrl(url);
                    toast.success('Imagen pegada del portapapeles');
                    return; // Éxito
                }
            }

            // 2. Intentar obtener items (ej. captura de pantalla / copiar imagen web)
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    // Asignar un nombre al archivo si viene del portapapeles
                    if (!blob.name || blob.name === 'image.png') {
                        blob.name = `pasted_evidence_${Date.now()}.png`;
                    }
                    setFile(blob);
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(url);
                    toast.success('Imagen pegada del portapapeles');
                    break;
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [isOpen]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const selectedFile = e.dataTransfer.files[0];
        if (selectedFile && selectedFile.type.startsWith('image/')) {
            setFile(selectedFile);
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
            toast.success('Imagen cargada');
        } else {
            toast.error('Por favor sube un archivo de imagen válido');
        }
    };

    const handleUpload = async () => {
        if (!file || !order) return;

        // Validaciones para pago mixto
        if (paymentType === 'mixed') {
            const transfer = parseFloat(transferAmount || 0);
            const cash = parseFloat(cashAmount || 0);
            const total = parseFloat(order.total_amount || 0);

            if (!transferAmount || transfer <= 0) {
                toast.error('Por favor ingresa el monto transferido');
                return;
            }

            if (!cashAmount || cash <= 0) {
                toast.error('Por favor ingresa el monto en efectivo');
                return;
            }

            const sumTotal = transfer + cash;
            const tolerance = total * 0.02; // 2% tolerancia

            if (Math.abs(sumTotal - total) > tolerance) {
                toast.error(`La suma de los montos ($${sumTotal.toLocaleString()}) debe ser igual al total del pedido ($${total.toLocaleString()})`);
                return;
            }
        }

        try {
            setLoading(true);
            const formData = new FormData();
            // Backend espera el campo 'photo' (ver logistics.js middleware optionalPhotoUpload)
            formData.append('photo', file);

            // Agregar datos de pago si es mixto
            if (paymentType === 'mixed') {
                formData.append('paymentType', 'mixed');
                formData.append('transferAmount', transferAmount);
                formData.append('cashAmount', cashAmount);
            }

            await logisticsService.uploadPaymentEvidence(order.id, formData);
            toast.success('Comprobante subido exitosamente');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error subiendo comprobante:', error);
            toast.error('Error al subir el comprobante');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
            <div
                id="upload-modal-content"
                tabIndex={-1}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 outline-none"
            >
                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Subir Comprobante</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Pedido <span className="font-mono font-medium text-gray-700">{order?.order_number}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Evidencia de Pago
                        </label>

                        <div
                            className={`
                                relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ease-in-out
                                ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}
                                ${previewUrl ? 'bg-gray-50 border-solid' : ''}
                            `}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer block w-full h-full">
                                {previewUrl ? (
                                    <div className="relative group">
                                        <div className="relative overflow-hidden rounded-lg shadow-md border border-gray-200">
                                            <img
                                                src={previewUrl}
                                                alt="Vista previa"
                                                className="w-full h-64 object-contain bg-white"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <p className="text-white font-medium flex items-center gap-2">
                                                    <ImageIcon className="w-5 h-5" />
                                                    Cambiar imagen
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-center text-green-600 text-sm font-medium">
                                            <CheckCircle className="w-4 h-4 mr-1.5" />
                                            Imagen lista para subir
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-6">
                                        <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Upload className="w-8 h-8" />
                                        </div>
                                        <p className="text-gray-900 font-medium mb-1">
                                            Haz clic para seleccionar
                                        </p>
                                        <p className="text-gray-500 text-sm mb-4">
                                            o arrastra y suelta aquí
                                        </p>
                                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600 border border-gray-200">
                                            <FileText className="w-3 h-3 mr-1.5" />
                                            Tip: Puedes pegar (Ctrl+V) directamente
                                        </div>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Selector de tipo de pago */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Tipo de Pago
                        </label>
                        <div className="flex gap-3">
                            <label className="flex-1 cursor-pointer">
                                <input
                                    type="radio"
                                    name="paymentType"
                                    value="full"
                                    checked={paymentType === 'full'}
                                    onChange={() => setPaymentType('full')}
                                    className="sr-only"
                                />
                                <div className={`p-3 rounded-lg border-2 transition-all ${paymentType === 'full'
                                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}>
                                    <p className="text-sm font-medium text-gray-900">Transferencia Completa</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Cliente pagó todo por transferencia</p>
                                </div>
                            </label>
                            <label className="flex-1 cursor-pointer">
                                <input
                                    type="radio"
                                    name="paymentType"
                                    value="mixed"
                                    checked={paymentType === 'mixed'}
                                    onChange={() => setPaymentType('mixed')}
                                    className="sr-only"
                                />
                                <div className={`p-3 rounded-lg border-2 transition-all ${paymentType === 'mixed'
                                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}>
                                    <p className="text-sm font-medium text-gray-900">Pago Mixto</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Transferencia + Efectivo</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Campos de monto para pago mixto */}
                    {paymentType === 'mixed' && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Monto Transferido *
                                    </label>
                                    <input
                                        type="number"
                                        value={transferAmount}
                                        onChange={(e) => {
                                            setTransferAmount(e.target.value);
                                            // Auto-calcular efectivo
                                            if (e.target.value) {
                                                const remaining = parseFloat(order?.total_amount || 0) - parseFloat(e.target.value || 0);
                                                setCashAmount(remaining > 0 ? remaining.toString() : '0');
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Monto en Efectivo *
                                    </label>
                                    <input
                                        type="number"
                                        value={cashAmount}
                                        onChange={(e) => setCashAmount(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div>
                                    <span className="text-gray-600">Total pedido:</span>
                                    <span className="ml-2 font-semibold text-gray-900">
                                        ${parseFloat(order?.total_amount || 0).toLocaleString('es-CO')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Suma actual:</span>
                                    <span className={`ml-2 font-semibold ${Math.abs((parseFloat(transferAmount || 0) + parseFloat(cashAmount || 0)) - parseFloat(order?.total_amount || 0)) <= (parseFloat(order?.total_amount || 0) * 0.02)
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                        }`}>
                                        ${(parseFloat(transferAmount || 0) + parseFloat(cashAmount || 0)).toLocaleString('es-CO')}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                El mensajero cobrará el monto en efectivo al entregar
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            className={`
                                px-6 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all shadow-sm
                                ${!file || loading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-primary-600 hover:bg-primary-700 hover:shadow-md active:transform active:scale-95'}
                            `}
                        >
                            {loading ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Subiendo...
                                </span>
                            ) : (
                                'Subir Comprobante'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadEvidenceModal;
