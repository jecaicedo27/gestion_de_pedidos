import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, GripVertical, Save, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DeliveryMethodsPage = () => {
  const { user } = useAuth();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    active: true,
    sort_order: 0
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      loadMethods();
    }
  }, [user]);

  const loadMethods = async () => {
    setLoading(true);
    try {
      const response = await api.get('/delivery-methods');
      if (response.data.success) {
        setMethods(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando métodos de envío:', error);
      toast.error('Error cargando métodos de envío');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await api.post('/delivery-methods', formData);
      if (response.data.success) {
        toast.success('Método de envío creado exitosamente');
        setShowCreateModal(false);
        resetForm();
        loadMethods();
      }
    } catch (error) {
      console.error('Error creando método de envío:', error);
      toast.error(error.response?.data?.message || 'Error creando método de envío');
    }
  };

  const handleUpdate = async () => {
    try {
      const response = await api.put(`/delivery-methods/${editingMethod.id}`, formData);
      if (response.data.success) {
        toast.success('Método de envío actualizado exitosamente');
        setEditingMethod(null);
        resetForm();
        loadMethods();
      }
    } catch (error) {
      console.error('Error actualizando método de envío:', error);
      toast.error(error.response?.data?.message || 'Error actualizando método de envío');
    }
  };

  const handleDelete = async (method) => {
    if (!window.confirm(`¿Está seguro de eliminar el método "${method.name}"?`)) {
      return;
    }

    try {
      const response = await api.delete(`/delivery-methods/${method.id}`);
      if (response.data.success) {
        toast.success('Método de envío eliminado exitosamente');
        loadMethods();
      }
    } catch (error) {
      console.error('Error eliminando método de envío:', error);
      toast.error(error.response?.data?.message || 'Error eliminando método de envío');
    }
  };

  const handleToggleStatus = async (method) => {
    try {
      const response = await api.patch(`/delivery-methods/${method.id}/toggle-status`);
      if (response.data.success) {
        toast.success(response.data.message);
        loadMethods();
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
      toast.error(error.response?.data?.message || 'Error cambiando estado');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      active: true,
      sort_order: 0
    });
  };

  const openCreateModal = () => {
    resetForm();
    setFormData(prev => ({ ...prev, sort_order: methods.length }));
    setShowCreateModal(true);
  };

  const openEditModal = (method) => {
    setFormData({
      code: method.code,
      name: method.name,
      description: method.description || '',
      active: method.active,
      sort_order: method.sort_order
    });
    setEditingMethod(method);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setEditingMethod(null);
    resetForm();
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Métodos de Envío</h1>
            <p className="text-gray-600 mt-1">
              Administra los métodos de envío disponibles en el sistema
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Método</span>
          </button>
        </div>
      </div>

      {/* Lista de métodos */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {methods.map((method) => (
                  <tr key={method.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <GripVertical className="w-4 h-4 text-gray-400 mr-2" />
                        {method.sort_order}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">
                        {method.code}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {method.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="max-w-xs truncate">
                        {method.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(method)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          method.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {method.active ? (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            Activo
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3 mr-1" />
                            Inactivo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(method)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(method)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {methods.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay métodos de envío configurados</p>
                <button
                  onClick={openCreateModal}
                  className="mt-2 text-blue-600 hover:text-blue-800"
                >
                  Crear el primer método
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para crear/editar */}
      {(showCreateModal || editingMethod) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingMethod ? 'Editar Método de Envío' : 'Nuevo Método de Envío'}
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ej: domicilio_ciudad"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Identificador único (sin espacios, solo letras, números y guiones bajos)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ej: Domicilio en Ciudad"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descripción opcional del método de envío"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orden de visualización
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Número para ordenar los métodos (menor número aparece primero)
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                  Activo (visible para los usuarios)
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={closeModals}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancelar
              </button>
              <button
                onClick={editingMethod ? handleUpdate : handleCreate}
                disabled={!formData.code || !formData.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{editingMethod ? 'Actualizar' : 'Crear'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryMethodsPage;
