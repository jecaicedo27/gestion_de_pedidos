import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const EditOrderPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState(null);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_city: '',
    customer_department: '',
    delivery_method: '',
    payment_method: '',
    delivery_date: '',
    notes: '',
    total_amount: 0
  });

  // Opciones para los selects
  const deliveryMethods = [
    { value: 'domicilio_ciudad', label: 'Domicilio en Ciudad' },
    { value: 'recoge_bodega', label: 'Recoge en Bodega' },
    { value: 'envio_nacional', label: 'Envío Nacional' }
  ];

  const paymentMethods = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia Bancaria' },
    { value: 'cliente_credito', label: 'Cliente a Crédito' },
    { value: 'pago_electronico', label: 'Pago Electrónico' }
  ];

  // Cargar datos del pedido
  useEffect(() => {
    const loadOrder = async () => {
      try {
        setLoading(true);
        const response = await orderService.getOrderById(id);
        const orderData = response.data;
        
        setOrder(orderData);
        setFormData({
          customer_name: orderData.customer_name || '',
          customer_phone: orderData.customer_phone || '',
          customer_email: orderData.customer_email || '',
          customer_address: orderData.customer_address || '',
          customer_city: orderData.customer_city || '',
          customer_department: orderData.customer_department || '',
          delivery_method: orderData.delivery_method || '',
          payment_method: orderData.payment_method || '',
          delivery_date: orderData.delivery_date ? orderData.delivery_date.split('T')[0] : '',
          notes: orderData.notes || '',
          total_amount: orderData.total_amount || 0
        });
      } catch (error) {
        console.error('Error cargando pedido:', error);
        toast.error('Error cargando pedido');
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadOrder();
    }
  }, [id, navigate]);

  // Verificar permisos
  useEffect(() => {
    if (!loading && order && user?.role !== 'admin') {
      toast.error('No tienes permisos para editar pedidos');
      navigate('/orders');
    }
  }, [loading, order, user, navigate]);

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Guardar cambios
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customer_name.trim()) {
      toast.error('El nombre del cliente es requerido');
      return;
    }

    if (!formData.customer_phone.trim()) {
      toast.error('El teléfono del cliente es requerido');
      return;
    }

    try {
      setSaving(true);
      await orderService.updateOrder(id, formData);
      toast.success('Pedido actualizado exitosamente');
      navigate('/orders');
    } catch (error) {
      console.error('Error actualizando pedido:', error);
      toast.error('Error actualizando pedido');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Icons.AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Pedido no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Editar Pedido</h1>
          <p className="text-gray-600 mt-2">
            Pedido #{order.order_number}
          </p>
        </div>
        
        <button
          onClick={() => navigate('/orders')}
          className="btn btn-secondary"
        >
          <Icons.ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Pedidos
        </button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Información del Cliente */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Icons.User className="w-5 h-5 mr-2 text-blue-600" />
                Información del Cliente
              </h3>
            </div>
            <div className="card-content space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <textarea
                  name="customer_address"
                  value={formData.customer_address}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="customer_city"
                    value={formData.customer_city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departamento
                  </label>
                  <input
                    type="text"
                    name="customer_department"
                    value={formData.customer_department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Información del Pedido */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Icons.Package className="w-5 h-5 mr-2 text-blue-600" />
                Información del Pedido
              </h3>
            </div>
            <div className="card-content space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Entrega
                </label>
                <select
                  name="delivery_method"
                  value={formData.delivery_method}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar método</option>
                  {deliveryMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar método</option>
                  {paymentMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Entrega
                </label>
                <input
                  type="date"
                  name="delivery_date"
                  value={formData.delivery_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto Total
                </label>
                <input
                  type="number"
                  name="total_amount"
                  value={formData.total_amount}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Información adicional */}
        {order.siigo_invoice_id && (
          <div className="card mt-6">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Icons.FileText className="w-5 h-5 mr-2 text-blue-600" />
                Información SIIGO
              </h3>
            </div>
            <div className="card-content">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                  <strong>Factura SIIGO:</strong> {order.siigo_invoice_number || order.siigo_invoice_id}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Este pedido fue creado desde una factura de SIIGO
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex items-center justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Icons.Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditOrderPage;
