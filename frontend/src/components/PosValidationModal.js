import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api'; // Import api for base URL
import { formatCurrencyCOP } from '../utils/formatters';

const PosValidationModal = ({ isOpen, onClose, order, onValidate }) => {
    // const [bankReference, setBankReference] = useState(''); // Removed per user request
    const [cashAmount, setCashAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fetchedEvidence, setFetchedEvidence] = useState(null);

    console.log('PosValidationModal Order Data:', order);

    useEffect(() => {
        if (isOpen && order) {
            // setBankReference(''); // Removed
            setNotes('');
            setFetchedEvidence(null);

            // Pre-fill cash amount if it's cash payment
            if (order.payment_method === 'efectivo') {
                setCashAmount(order.total_amount || '');
            } else {
                setCashAmount('');
            }

            // Fetch timeline evidence if not present in order object
            const hasDirectEvidence = order.payment_evidence_photo || (order.payment_evidence_path && order.payment_evidence_path.length > 5);

            if (!hasDirectEvidence) {
                console.log('Fetching timeline for evidence...');
                api.get(`/orders/${order.id}/timeline`)
                    .then(res => {
                        const data = res.data.data;
                        const allAttachments = [];
                        const add = (list) => {
                            if (!Array.isArray(list)) return;
                            list.forEach(att => {
                                if (att && att.url) allAttachments.push(att);
                            });
                        };

                        // 1. Top level attachments
                        add(data?.attachments);

                        // 2. Event attachments
                        if (Array.isArray(data?.events)) {
                            data.events.forEach(ev => add(ev.attachments));
                        }

                        // Find first payment evidence
                        const evidence = allAttachments.find(a =>
                            a.source === 'cartera' ||
                            (a.label && (a.label.toLowerCase().includes('pago') || a.label.toLowerCase().includes('transferencia')))
                        );

                        if (evidence) {
                            console.log('Found evidence in timeline:', evidence);
                            setFetchedEvidence(evidence.url);
                        }
                    })
                    .catch(err => console.error('Error fetching timeline evidence:', err));
            }
        }
    }, [isOpen, order]);

    if (!isOpen || !order) return null;

    const isTransfer = order.payment_method === 'transferencia' || order.payment_method === 'pago_electronico';
    const isCash = order.payment_method === 'efectivo';
    const isMixed = order.payment_method === 'mixto' || (order.payment_method && order.payment_method.includes(','));

    const handleSubmit = async () => {
        // Validation for reference removed per user request
        /*
        if (isTransfer && !bankReference) {
            toast.error('Por favor ingresa la referencia bancaria');
            return;
        }
        */

        setIsSubmitting(true);
        try {
            await onValidate({
                orderId: order.id,
                bankReference: 'N/A', // Default value since input is removed
                cashAmount,
                notes,
                validationType: 'pos_approved'
            });
            onClose();
        } catch (error) {
            console.error('Error validating POS order:', error);
            toast.error('Error al validar el pedido');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-blue-50 rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-full">
                            <Icons.Store className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Validación Venta POS</h3>
                            <p className="text-sm text-gray-600">Pedido #{order.order_number}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <Icons.X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Order Info */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Cliente:</span>
                            <span className="font-medium text-gray-900">{order.customer_name}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Total a Pagar:</span>
                            <span className="font-bold text-lg text-green-600">{formatCurrencyCOP(order.total_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Método de Pago:</span>
                            <span className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-medium uppercase text-gray-700">
                                {order.payment_method}
                            </span>
                        </div>
                    </div>

                    {/* Payment Evidence Image */}
                    {/* Payment Evidence Image */}
                    {(() => {
                        let evidenceUrl = order.payment_evidence_photo;

                        if (!evidenceUrl && order.payment_evidence_path) {
                            try {
                                // Try to parse as JSON if it looks like one
                                if (order.payment_evidence_path.startsWith('[') || order.payment_evidence_path.startsWith('{')) {
                                    const parsed = JSON.parse(order.payment_evidence_path);
                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                        evidenceUrl = parsed[0];
                                    } else if (parsed.file_path) {
                                        evidenceUrl = parsed.file_path;
                                    }
                                } else {
                                    evidenceUrl = order.payment_evidence_path;
                                }
                            } catch (e) {
                                evidenceUrl = order.payment_evidence_path;
                            }
                        }

                        // Fallback to fetched evidence from timeline
                        if (!evidenceUrl && fetchedEvidence) {
                            evidenceUrl = fetchedEvidence;
                        }

                        if (!evidenceUrl) return null;

                        // Handle full URLs (from timeline) vs relative paths
                        const isFullUrl = evidenceUrl.startsWith('http');
                        const fullUrl = isFullUrl ? evidenceUrl : `${api.defaults.baseURL.replace('/api', '')}/${evidenceUrl.startsWith('/') ? evidenceUrl.slice(1) : evidenceUrl}`;

                        return (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Icons.Image className="w-4 h-4" />
                                    Evidencia de Pago
                                </label>
                                <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                    <img
                                        src={fullUrl}
                                        alt="Evidencia de pago"
                                        className="w-full h-64 object-contain bg-black"
                                    />
                                    <a
                                        href={fullUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <span className="bg-white text-gray-900 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm flex items-center gap-2">
                                            <Icons.ExternalLink className="w-4 h-4" />
                                            Ver Original
                                        </span>
                                    </a>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Validation Inputs */}
                    <div className="space-y-4">

                        {/* Bank Reference Input REMOVED per user request */}
                        {/* 
                        {(isTransfer || isMixed) && (
                            <div>
                                ...
                            </div>
                        )} 
                        */}

                        {(isCash || isMixed) && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Monto Recibido en Efectivo
                                </label>
                                <div className="relative">
                                    <Icons.DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="number"
                                        value={cashAmount}
                                        onChange={(e) => setCashAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Confirma el monto físico recibido en caja.</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notas de Validación (Opcional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows="2"
                                placeholder="Observaciones adicionales..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            />
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md font-medium transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full py-3 bg-green-600 text-white rounded-full text-lg font-bold hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg transform transition hover:scale-105"
                    >
                        {isSubmitting ? (
                            <>
                                <Icons.Loader2 className="w-6 h-6 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Icons.CheckCircle className="w-6 h-6" />
                                {isCash && !isMixed ? 'Confirmar Recepción Efectivo' : 'Transferencia Validada'}
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PosValidationModal;
