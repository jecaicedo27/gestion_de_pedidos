import React, { useState, useEffect } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const ShippingGuideModal = ({ isOpen, onClose, order, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [senderConfig, setSenderConfig] = useState(null);
  const [formData, setFormData] = useState({
    shipping_company_id: '',
    guide_number: '',
    payment_type: 'contraentrega',
    package_weight: '',
    package_dimensions: '',
    package_content: '',
    declared_value: order?.total_amount || '',
    shipping_cost: '0',
    special_observations: '',
    delivery_method: 'envio_nacional'
  });
  const [guideImage, setGuideImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (order) {
      setFormData(prev => ({
        ...prev,
        declared_value: order.total_amount || '',
        package_content: `Pedido #${order.order_number} - ${order.customer_name}`
      }));
    }
  }, [order]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Cargar transportadoras activas
      const companiesResponse = await api.get('/shipping/companies/active');
      setCompanies(companiesResponse.data.data);

      // Cargar configuración del remitente
      const senderResponse = await api.get('/company-config/shipping-info');
      const companyData = senderResponse.data.data;

      // Mapear los campos para que coincidan con lo que espera el frontend
      const mappedData = {
        ...companyData,
        company_nit: companyData.nit,
        phone: companyData.whatsapp,
        address_line1: companyData.address
      };

      setSenderConfig(mappedData);

    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (companyId) => {
    const company = companies.find(c => c.id === parseInt(companyId));
    setSelectedCompany(company);
    setFormData(prev => ({
      ...prev,
      shipping_company_id: companyId
    }));
    setValidationError('');
  };

  const validateGuideNumber = async (guideNumber) => {
    if (!selectedCompany || !guideNumber) return;

    try {
      const response = await api.post('/shipping/validate-guide', {
        shipping_company_id: selectedCompany.id,
        guide_number: guideNumber
      });

      if (!response.data.data.is_valid) {
        setValidationError(`Formato inválido para ${selectedCompany.name}. Patrón esperado: ${selectedCompany.guide_format_pattern}`);
      } else {
        setValidationError('');
      }
    } catch (error) {
      console.error('Error validando guía:', error);
    }
  };

  const handleGuideNumberChange = (value) => {
    setFormData(prev => ({
      ...prev,
      guide_number: value
    }));

    // Validar después de un pequeño delay
    setTimeout(() => validateGuideNumber(value), 500);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert('Solo se permiten archivos JPG, PNG o PDF');
        return;
      }

      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo no puede ser mayor a 5MB');
        return;
      }

      setGuideImage(file);

      // Crear preview para imágenes
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
      }
    }
  };

  const uploadImage = async () => {
    if (!guideImage) return null;

    const imageFormData = new FormData();
    imageFormData.append('guide_image', guideImage);

    try {
      const response = await api.post('/shipping/upload-image', imageFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data.data.url;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      throw new Error('Error subiendo imagen de la guía');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validationError) {
      alert('Por favor corrige los errores antes de continuar');
      return;
    }

    if (!guideImage) {
      alert('Por favor sube una imagen de la guía');
      return;
    }

    try {
      setLoading(true);

      // Subir imagen primero
      const imageUrl = await uploadImage();

      // Crear guía
      const guideData = {
        ...formData,
        order_id: order.id,
        guide_image_url: imageUrl
      };

      const response = await api.post('/shipping/guides', guideData);

      if (response.data.success) {
        alert('Guía de envío creada exitosamente');
        onSuccess && onSuccess(response.data.data);
        handleClose();
      }
    } catch (error) {
      console.error('Error creando guía:', error);
      alert(error.response?.data?.message || 'Error creando guía de envío');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      shipping_company_id: '',
      guide_number: '',
      payment_type: 'contraentrega',
      package_weight: '',
      package_dimensions: '',
      package_content: '',
      declared_value: order?.total_amount || '',
      shipping_cost: '0',
      special_observations: '',
      delivery_method: 'envio_nacional'
    });
    setGuideImage(null);
    setImagePreview(null);
    setIsZoomed(false);
    setValidationError('');
    setSelectedCompany(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Generar Guía de Envío Manual
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading && (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          )}

          {!loading && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información del Pedido */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Información del Pedido</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Número de Pedido</label>
                    <input
                      type="text"
                      value={order?.order_number || ''}
                      disabled
                      className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cliente</label>
                    <input
                      type="text"
                      value={order?.customer_name || ''}
                      disabled
                      className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <input
                      type="text"
                      value={order?.customer_phone || ''}
                      disabled
                      className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valor Total</label>
                    <input
                      type="text"
                      value={`$${parseFloat(order?.total_amount || 0).toLocaleString('es-CO')}`}
                      disabled
                      className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Dirección de Entrega</label>
                  <textarea
                    value={order?.customer_address || ''}
                    disabled
                    rows={2}
                    className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {/* Información del Remitente */}
              {senderConfig && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Información del Remitente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Empresa</label>
                      <input
                        type="text"
                        value={senderConfig.company_name}
                        disabled
                        className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">NIT</label>
                      <input
                        type="text"
                        value={senderConfig.company_nit}
                        disabled
                        className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                      <input
                        type="text"
                        value={senderConfig.phone}
                        disabled
                        className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="text"
                        value={senderConfig.email}
                        disabled
                        className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Dirección</label>
                    <input
                      type="text"
                      value={`${senderConfig.address_line1}, ${senderConfig.city}, ${senderConfig.department}`}
                      disabled
                      className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}

              {/* Información de la Guía */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Información de la Guía</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Transportadora <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.shipping_company_id}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Seleccionar transportadora</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Número de Guía <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.guide_number}
                      onChange={(e) => handleGuideNumberChange(e.target.value)}
                      required
                      placeholder={selectedCompany ? `Formato: ${selectedCompany.guide_format_pattern}` : 'Selecciona una transportadora'}
                      className={`mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${validationError ? 'border-red-500' : 'border-gray-300'
                        }`}
                    />
                    {validationError && (
                      <p className="mt-1 text-sm text-red-600">{validationError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tipo de Pago <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.payment_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_type: e.target.value }))}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="contraentrega">Contraentrega</option>
                      <option value="contado">Contado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Peso del Paquete (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.package_weight}
                      onChange={(e) => setFormData(prev => ({ ...prev, package_weight: e.target.value }))}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dimensiones (cm)</label>
                    <input
                      type="text"
                      value={formData.package_dimensions}
                      onChange={(e) => setFormData(prev => ({ ...prev, package_dimensions: e.target.value }))}
                      placeholder="Ej: 30x20x10"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Valor Declarado <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.declared_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, declared_value: e.target.value }))}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Costo de Envío</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.shipping_cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipping_cost: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Método de Entrega <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.delivery_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, delivery_method: e.target.value }))}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="envio_nacional">Envío Nacional</option>
                      <option value="envio_internacional">Envío Internacional</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Contenido del Paquete <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.package_content}
                    onChange={(e) => setFormData(prev => ({ ...prev, package_content: e.target.value }))}
                    required
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Observaciones Especiales</label>
                  <textarea
                    value={formData.special_observations}
                    onChange={(e) => setFormData(prev => ({ ...prev, special_observations: e.target.value }))}
                    rows={2}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Subir Imagen */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Imagen de la Guía</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="mt-4">
                      <label htmlFor="guide-image" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Subir imagen de la guía
                        </span>
                        <span className="mt-1 block text-sm text-gray-500">
                          JPG, PNG o PDF hasta 5MB
                        </span>
                      </label>
                      <input
                        id="guide-image"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={handleImageChange}
                        className="sr-only"
                        required
                      />
                    </div>
                  </div>

                  {imagePreview && (
                    <div className={`mt-4 relative ${isZoomed ? 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4' : ''}`} onClick={() => setIsZoomed(!isZoomed)}>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className={`${isZoomed ? 'max-h-screen max-w-full object-contain cursor-zoom-out' : 'mx-auto max-h-48 rounded-lg cursor-zoom-in'}`}
                      />
                      {isZoomed && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
                          className="absolute top-4 right-4 text-white hover:text-gray-300"
                        >
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  {guideImage && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-600">
                        Archivo seleccionado: {guideImage.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end space-x-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || validationError}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creando Guía...' : 'Crear Guía de Envío'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShippingGuideModal;
