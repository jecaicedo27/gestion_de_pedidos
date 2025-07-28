import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const DeliveryRegistrationModal = ({ isOpen, onClose, order, onConfirm }) => {
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [deliveryPhoto, setDeliveryPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset
  } = useForm();

  const amountReceived = watch('amountReceived');
  const expectedAmount = order?.total_amount || 0;
  const amountMatch = parseFloat(amountReceived || 0) === expectedAmount;

  const handleClose = () => {
    reset();
    setPaymentPhoto(null);
    setDeliveryPhoto(null);
    onClose();
  };

  const handleFileChange = (event, type) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('El archivo no puede ser mayor a 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (type === 'payment') {
          setPaymentPhoto({
            file,
            preview: e.target.result
          });
        } else {
          setDeliveryPhoto({
            file,
            preview: e.target.result
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data) => {
    if (!amountMatch && order?.payment_method === 'efectivo') {
      toast.error('El monto cobrado debe coincidir exactamente con el valor a cobrar');
      return;
    }

    if (!paymentPhoto && order?.payment_method === 'efectivo') {
      toast.error('Debe tomar una foto del efectivo recibido');
      return;
    }

    if (!deliveryPhoto) {
      toast.error('Debe tomar una foto como evidencia de entrega');
      return;
    }

    setUploading(true);
    try {
      const deliveryData = {
        orderId: order.id,
        amountReceived: parseFloat(data.amountReceived),
        paymentPhoto: paymentPhoto?.file,
        deliveryPhoto: deliveryPhoto?.file,
        notes: data.notes
      };

      await onConfirm(deliveryData);
      handleClose();
      toast.success('Entrega registrada exitosamente');
    } catch (error) {
      console.error('Error registrando entrega:', error);
      toast.error('Error al registrar la entrega');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Registrar Entrega - {order?.order_number}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {/* Información del pedido */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-600">Cliente</p>
              <p className="text-gray-900">{order?.customer_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Teléfono</p>
              <p className="text-gray-900">{order?.customer_phone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-medium text-gray-600">Dirección</p>
              <p className="text-gray-900">{order?.customer_address}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Método de Pago</p>
              <p className="text-gray-900 capitalize">{order?.payment_method || 'Efectivo'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Notas</p>
              <p className="text-gray-900">{order?.notes || 'Sin notas'}</p>
            </div>
          </div>

          {/* Monto a cobrar destacado */}
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-600 mb-1">Monto a Cobrar</p>
            <p className="text-3xl font-bold text-red-700">
              ${expectedAmount.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Input monto cobrado */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto Cobrado *
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.amountReceived ? 'border-red-500' : 'border-gray-300'
              } ${
                amountReceived && !amountMatch ? 'border-red-500 bg-red-50' : ''
              }`}
              {...register('amountReceived', {
                required: 'El monto cobrado es obligatorio',
                min: { value: 0, message: 'El monto debe ser mayor a 0' }
              })}
            />
            <p className="text-sm text-gray-600 mt-1">
              Ingrese el monto exacto recibido del cliente
            </p>
            {errors.amountReceived && (
              <p className="text-red-500 text-sm mt-1">{errors.amountReceived.message}</p>
            )}
            {amountReceived && !amountMatch && (
              <p className="text-red-500 text-sm mt-1">
                El monto no coincide con el valor a cobrar
              </p>
            )}
          </div>

          {/* Foto del pago recibido */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto del Pago Recibido *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {paymentPhoto ? (
                <div className="relative">
                  <img
                    src={paymentPhoto.preview}
                    alt="Foto del pago"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentPhoto(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <Icons.Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-2">Ningún archivo seleccionado</p>
                  <div className="flex justify-center space-x-2">
                    <label className="btn btn-primary cursor-pointer">
                      <Icons.Camera className="w-4 h-4 mr-2" />
                      Foto del Efectivo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'payment')}
                      />
                    </label>
                    <label className="btn btn-secondary cursor-pointer">
                      <Icons.Upload className="w-4 h-4 mr-2" />
                      Seleccionar archivo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'payment')}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Tome una foto del dinero en efectivo recibido del cliente
            </p>
          </div>

          {/* Evidencia de entrega */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidencia de Entrega *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {deliveryPhoto ? (
                <div className="relative">
                  <img
                    src={deliveryPhoto.preview}
                    alt="Evidencia de entrega"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setDeliveryPhoto(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <Icons.Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-2">Ningún archivo seleccionado</p>
                  <div className="flex justify-center space-x-2">
                    <label className="btn btn-primary cursor-pointer">
                      <Icons.Camera className="w-4 h-4 mr-2" />
                      Usar Cámara
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'delivery')}
                      />
                    </label>
                    <label className="btn btn-secondary cursor-pointer">
                      <Icons.Upload className="w-4 h-4 mr-2" />
                      Seleccionar archivo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'delivery')}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Tome una foto o adjunte una imagen como evidencia de entrega
            </p>
          </div>

          {/* Notas adicionales */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas Adicionales
            </label>
            <textarea
              rows={3}
              placeholder="Observaciones sobre la entrega..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('notes')}
            />
          </div>

          {/* Panel recordatorio */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Recordatorio:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Debe registrar el monto exacto recibido del cliente</li>
              <li>• Debe tomar una foto como evidencia de entrega</li>
              <li>• Verifique que el monto cobrado coincida con el valor a cobrar</li>
            </ul>
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
              className="btn btn-success"
              disabled={uploading || !amountMatch}
            >
              {uploading ? (
                <>
                  <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Icons.Check className="w-4 h-4 mr-2" />
                  Confirmar Entrega
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryRegistrationModal;
