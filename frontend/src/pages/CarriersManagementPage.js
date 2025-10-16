import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

// Modal para crear/editar transportadora
const CarrierModal = ({ isOpen, onClose, carrier, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (carrier) {
      setFormData({
        name: carrier.name || '',
        email: carrier.email || '',
        phone: carrier.phone || '',
        website: carrier.website || '',
        active: carrier.active ?? true
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        website: '',
        active: true
      });
    }
  }, [carrier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('El nombre de la transportadora es requerido');
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
      toast.success(carrier ? 'Transportadora actualizada' : 'Transportadora creada');
    } catch (error) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {carrier ? 'Editar Transportadora' : 'Nueva Transportadora'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Servientrega"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="contacto@transportadora.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="01-8000-123456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sitio Web
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({...formData, website: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://www.transportadora.com"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({...formData, active: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                Transportadora activa
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Guardando...
                </>
              ) : (
                <>
                  <Icons.Save className="w-4 h-4 mr-2 inline" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CarriersManagementPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState(null);

  // Verificar permisos
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'logistica')) {
      toast.error('No tienes permisos para acceder a esta sección');
      navigate('/');
    }
  }, [user, navigate]);

  // Cargar transportadoras
  const fetchCarriers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/carriers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar transportadoras');
      }

      const data = await response.json();
      setCarriers(data.success ? data.data : data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar las transportadoras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

  // Crear/Actualizar transportadora
  const handleSaveCarrier = async (formData) => {
    const url = selectedCarrier 
      ? `/api/carriers/${selectedCarrier.id}`
      : '/api/carriers';
    
    const method = selectedCarrier ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al guardar');
    }

    await fetchCarriers();
    setModalOpen(false);
    setSelectedCarrier(null);
  };

  // Eliminar transportadora
  const handleDeleteCarrier = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta transportadora?')) {
      return;
    }

    try {
      const response = await fetch(`/api/carriers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar');
      }

      toast.success('Transportadora eliminada');
      await fetchCarriers();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al eliminar la transportadora');
    }
  };

  // Activar/Desactivar transportadora
  const handleToggleActive = async (id) => {
    try {
      const response = await fetch(`/api/carriers/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cambiar estado');
      }

      await fetchCarriers();
      toast.success('Estado actualizado');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cambiar el estado');
    }
  };

  // Filtrar transportadoras
  const filteredCarriers = carriers.filter(carrier => {
    const matchesSearch = carrier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (carrier.email && carrier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (carrier.phone && carrier.phone.includes(searchTerm));
    
    const matchesActive = showInactive || carrier.active;
    
    return matchesSearch && matchesActive;
  });

  // Estadísticas
  const stats = {
    total: carriers.length,
    active: carriers.filter(c => c.active).length,
    inactive: carriers.filter(c => !c.active).length
  };

  if (loading && carriers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Icons.Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Gestión de Transportadoras
        </h1>
        <p className="text-gray-600">
          Administra las empresas de transporte disponibles en el sistema
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Icons.Truck className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Activas</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <Icons.CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Inactivas</p>
              <p className="text-2xl font-bold text-gray-500">{stats.inactive}</p>
            </div>
            <Icons.XCircle className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {/* Búsqueda */}
            <div className="relative flex-1 max-w-md">
              <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar transportadora..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filtro de activas */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Mostrar inactivas</span>
            </label>
          </div>

          {/* Botón de nueva transportadora */}
          <button
            onClick={() => {
              setSelectedCarrier(null);
              setModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors"
          >
            <Icons.Plus className="w-5 h-5" />
            <span>Nueva Transportadora</span>
          </button>
        </div>
      </div>

      {/* Tabla de transportadoras */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sitio Web
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCarriers.map((carrier) => (
                <tr key={carrier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Icons.Truck className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {carrier.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {carrier.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      {carrier.email && (
                        <div className="flex items-center text-gray-600">
                          <Icons.Mail className="w-4 h-4 mr-1" />
                          {carrier.email}
                        </div>
                      )}
                      {carrier.phone && (
                        <div className="flex items-center text-gray-600 mt-1">
                          <Icons.Phone className="w-4 h-4 mr-1" />
                          {carrier.phone}
                        </div>
                      )}
                      {!carrier.email && !carrier.phone && (
                        <span className="text-gray-400">Sin contacto</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {carrier.website ? (
                      <a
                        href={carrier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Icons.Globe className="w-4 h-4 mr-1" />
                        Ver sitio
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">No disponible</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(carrier.id)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        carrier.active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {carrier.active ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedCarrier(carrier);
                          setModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Editar"
                      >
                        <Icons.Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCarrier(carrier.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Eliminar"
                      >
                        <Icons.Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCarriers.length === 0 && (
            <div className="text-center py-12">
              <Icons.Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No se encontraron transportadoras' : 'No hay transportadoras registradas'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de edición/creación */}
      <CarrierModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCarrier(null);
        }}
        carrier={selectedCarrier}
        onSave={handleSaveCarrier}
      />
    </div>
  );
};

export default CarriersManagementPage;
