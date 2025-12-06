import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const AdhocPaymentModal = ({ isOpen, onClose, onConfirm }) => {
    const [photo, setPhoto] = useState(null);
    const [uploading, setUploading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset
    } = useForm();

    const handleClose = () => {
        reset();
        setPhoto(null);
        onClose();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 15 * 1024 * 1024) { // 15MB limit
                toast.error('El archivo no puede ser mayor a 15MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                setPhoto({
                    file,
                    preview: e.target.result
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const onSubmit = async (data) => {
        if (!photo) {
            toast.error('Debe tomar una foto del dinero o comprobante');
            return;
        }

        setUploading(true);
        try {
            const formData = {
                amount: parseFloat(data.amount),
                description: data.description,
                notes: data.notes,
                evidence: photo.file
            };

            await onConfirm(formData);
            handleClose();
        } catch (error) {
            console.error('Error registrando recaudo:', error);
            toast.error('Error al registrar el recaudo');
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Dinero de Clientes a Crédito
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <Icons.X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6">
                    {/* Monto */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Monto Recibido *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amount ? 'border-red-500' : 'border-gray-300'}`}
                            {...register('amount', {
                                required: 'El monto es obligatorio',
                                min: { value: 0.01, message: 'El monto debe ser mayor a 0' }
                            })}
                        />
                        {errors.amount && (
                            <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
                        )}
                    </div>

                    {/* Descripción / Factura */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Concepto / Factura *
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: Abono Factura 12345"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
                            {...register('description', {
                                required: 'La descripción es obligatoria'
                            })}
                        />
                        {errors.description && (
                            <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            Indique a qué factura o concepto corresponde este dinero.
                        </p>
                    </div>

                    {/* Foto del dinero */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Foto del Dinero *
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                            {photo ? (
                                <div className="relative">
                                    <img
                                        src={photo.preview}
                                        alt="Foto del dinero"
                                        className="w-full h-48 object-cover rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setPhoto(null)}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                    >
                                        <Icons.X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Icons.Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                    <p className="text-gray-600 mb-2">Ningún archivo seleccionado</p>
                                    <div className="flex justify-center gap-3">
                                        <label className="flex flex-col items-center justify-center w-32 h-24 bg-blue-50 text-blue-700 rounded-xl border-2 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer shadow-sm active:scale-95">
                                            <Icons.Camera className="w-8 h-8 mb-2" />
                                            <span className="text-xs font-semibold text-center leading-tight">Usar<br />Cámara</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                        </label>
                                        <label className="flex flex-col items-center justify-center w-32 h-24 bg-gray-50 text-gray-700 rounded-xl border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all cursor-pointer shadow-sm active:scale-95">
                                            <Icons.Upload className="w-8 h-8 mb-2" />
                                            <span className="text-xs font-semibold text-center leading-tight">Subir<br />Archivo</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notas adicionales */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notas Adicionales
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Observaciones adicionales..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('notes')}
                        />
                    </div>

                    {/* Botones */}
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="btn btn-secondary"
                            disabled={uploading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary min-h-[48px] h-12 px-6 text-base font-semibold rounded-md shadow-sm hover:shadow-md"
                            disabled={uploading}
                        >
                            {uploading ? (
                                <>
                                    <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Icons.Check className="w-4 h-4 mr-2" />
                                    Registrar Recaudo
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdhocPaymentModal;
