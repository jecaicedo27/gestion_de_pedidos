import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import PasswordChangeModal from '../components/PasswordChangeModal';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const UsersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'facturador',
    password: ''
  });
  // Estado para roles avanzados (múltiples)
  const [advAllRoles, setAdvAllRoles] = useState([]); // roles de la tabla roles
  const [advUserRoles, setAdvUserRoles] = useState([]); // objetos de rol asignados al usuario
  const [advNewRoleId, setAdvNewRoleId] = useState('');

  const roles = [
    { value: 'admin', label: 'Administrador', color: 'bg-red-100 text-red-800' },
    { value: 'facturador', label: 'Facturador', color: 'bg-blue-100 text-blue-800' },
    { value: 'cartera', label: 'Cartera', color: 'bg-green-100 text-green-800' },
    { value: 'logistica', label: 'Logística', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'empaque', label: 'Empaque', color: 'bg-purple-100 text-purple-800' },
    { value: 'mensajero', label: 'Mensajero', color: 'bg-orange-100 text-orange-800' }
  ];

  const getRoleInfo = (role) => {
    return roles.find(r => r.value === role) || { label: role, color: 'bg-gray-100 text-gray-800' };
  };

  // Cargar usuarios
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Datos recibidos del backend:', data);
        setUsers(data.data.users || []);
      } else {
        throw new Error('Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtros
  const filteredUsers = Array.isArray(users) ? users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = selectedRole === '' || u.role === selectedRole;
    return matchesSearch && matchesRole;
  }) : [];

  // Crear usuario
  const handleCreateUser = async () => {
    try {
      if (!formData.username || !formData.password || !formData.role) {
        toast.error('Usuario, contraseña y rol son obligatorios');
        return;
      }

      // Preparar datos para envío
      const dataToSend = {
        username: formData.username,
        password: formData.password,
        role: formData.role
      };

      // Solo agregar email si no está vacío
      if (formData.email && formData.email.trim() !== '') {
        dataToSend.email = formData.email.trim();
      }

      // Solo agregar full_name si no está vacío
      if (formData.full_name && formData.full_name.trim() !== '') {
        dataToSend.full_name = formData.full_name.trim();
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        toast.success('Usuario creado exitosamente');
        setShowCreateModal(false);
        setFormData({ username: '', email: '', role: 'facturador', password: '' });
        fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear usuario');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al crear usuario');
    }
  };

  // Editar usuario
  const handleEditUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        username: formData.username,
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role
      };

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success('Usuario actualizado exitosamente');
        setShowEditModal(false);
        setEditingUser(null);
        setFormData({ username: '', email: '', role: 'facturador', password: '' });
        fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar usuario');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al actualizar usuario');
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Usuario eliminado exitosamente');
        fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar usuario');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al eliminar usuario');
    }
  };

  // Resetear contraseña
  const handleResetPassword = async (userId, username) => {
    if (!window.confirm(`¿Deseas resetear la contraseña de "${username}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Contraseña reseteada. Nueva contraseña: ${data.newPassword}`);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al resetear contraseña');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al resetear contraseña');
    }
  };

  // Abrir modal de edición
  const openEditModal = (userToEdit) => {
    setEditingUser(userToEdit);
    setFormData({
      username: userToEdit.username,
      email: userToEdit.email || '',
      full_name: userToEdit.full_name || '',
      role: userToEdit.role,
      password: ''
    });
    // Cargar roles avanzados del usuario
    loadAdvancedRoles(userToEdit.id);
    setShowEditModal(true);
  };

  // Cargar roles avanzados (roles disponibles y roles del usuario)
  const loadAdvancedRoles = async (userId) => {
    try {
      const [rolesRes, userRolesRes] = await Promise.all([
        api.get('/admin/roles'),
        api.get('/admin/user-roles')
      ]);
      const pick = (res) => (res?.data?.data ?? res?.data?.roles ?? res?.data) || [];
      const all = pick(rolesRes);
      const urs = ((res) => (res?.data?.data ?? res?.data?.userRoles ?? res?.data) || [])(userRolesRes);
      // Filtrar por usuario y mapear a objetos de rol
      const assigned = urs
        .filter((ur) => ur.user_id === userId && (ur.is_active === 1 || ur.is_active === true))
        .map((ur) => all.find((r) => r.id === ur.role_id))
        .filter(Boolean);
      setAdvAllRoles(all);
      setAdvUserRoles(assigned);
      setAdvNewRoleId('');
    } catch (e) {
      console.error('Error cargando roles avanzados:', e);
    }
  };

  const assignAdvancedRole = async () => {
    if (!editingUser || !advNewRoleId) return;
    try {
      await api.post('/admin/assign-role', { user_id: editingUser.id, role_id: advNewRoleId });
      await loadAdvancedRoles(editingUser.id);
      toast.success('Rol adicional asignado');
    } catch (e) {
      toast.error('No se pudo asignar el rol');
    }
  };

  const removeAdvancedRole = async (roleId) => {
    if (!editingUser) return;
    try {
      await api.post('/admin/remove-role', { user_id: editingUser.id, role_id: roleId });
      await loadAdvancedRoles(editingUser.id);
      toast.success('Rol removido');
    } catch (e) {
      toast.error('No se pudo remover el rol');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icons.Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Cargando usuarios...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <p className="text-gray-600 mt-2">
          Administra los usuarios del sistema
        </p>
      </div>

      {/* Controles superiores */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Búsqueda */}
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>

          {/* Filtro por rol */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los roles</option>
            {roles.map(role => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/roles-management')}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            title="Gestionar roles y permisos (múltiples roles por usuario)"
          >
            <Icons.Shield className="w-4 h-4 mr-2" />
            Gestionar Roles
          </button>
          {/* Botón crear usuario */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Icons.Plus className="w-4 h-4 mr-2" />
            Crear Usuario
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <Icons.Users className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Usuarios</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>
        
        {roles.slice(0, 3).map(role => {
          const count = Array.isArray(users) ? users.filter(u => u.role === role.value).length : 0;
          return (
            <div key={role.value} className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full ${role.color} flex items-center justify-center`}>
                  <Icons.User className="w-4 h-4" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{role.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Lista de Usuarios ({filteredUsers.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((u) => {
                const roleInfo = getRoleInfo(u.role);
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <Icons.User className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {u.username}
                          </div>
                          {u.id === user?.id && (
                            <div className="text-xs text-blue-600">Tú</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {u.full_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {u.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar usuario"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setPasswordChangeUser(u);
                            setShowPasswordModal(true);
                          }}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Cambiar contraseña"
                        >
                          <Icons.Key className="w-4 h-4" />
                        </button>
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar usuario"
                          >
                            <Icons.Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No se encontraron usuarios
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Crear Usuario</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usuario *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre de usuario"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre completo de la persona"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email (opcional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="correo@ejemplo.com (opcional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>



                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contraseña temporal"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Crear Usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Editar Usuario</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usuario *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre completo de la persona"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email (opcional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Roles adicionales (multi-rol) */}
                <div className="pt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Roles adicionales (multi-rol)
                  </label>
                  {/* Chips de roles actuales */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {advUserRoles.length === 0 && (
                      <span className="text-sm text-gray-500">Sin roles adicionales</span>
                    )}
                    {advUserRoles.map((r) => (
                      <span key={r.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {r.display_name || r.name}
                        <button
                          type="button"
                          className="ml-2 text-red-600 hover:text-red-800"
                          onClick={() => removeAdvancedRole(r.id)}
                          title="Quitar rol"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* Agregar nuevo rol */}
                  <div className="flex gap-2">
                    <select
                      value={advNewRoleId}
                      onChange={(e) => setAdvNewRoleId(Number(e.target.value))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Seleccionar rol para agregar</option>
                      {advAllRoles
                        .filter((r) => !advUserRoles.some((ur) => ur.id === r.id))
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.display_name || r.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={assignAdvancedRole}
                      disabled={!advNewRoleId}
                      className="px-3 py-2 bg-purple-600 text-white rounded-md disabled:opacity-50"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Actualizar Usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordChangeUser(null);
        }}
        user={passwordChangeUser}
        onPasswordChanged={() => {
          fetchUsers(); // Recargar usuarios después de cambiar contraseña
        }}
      />
    </div>
  );
};

export default UsersPage;
