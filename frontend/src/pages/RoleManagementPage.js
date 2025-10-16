import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  Save
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

const RoleManagementPage = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [roleViews, setRoleViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, permissionsRes, userRolesRes, rolePermissionsRes, roleViewsRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/roles'),
        api.get('/api/admin/permissions'),
        api.get('/api/admin/user-roles'),
        api.get('/api/admin/role-permissions'),
        api.get('/api/admin/role-views')
      ]);

      setUsers(usersRes.data.users || []);
      setRoles(rolesRes.data.roles || []);
      setPermissions(permissionsRes.data.permissions || []);
      setUserRoles(userRolesRes.data.userRoles || []);
      setRolePermissions(rolePermissionsRes.data.rolePermissions || []);
      setRoleViews(roleViewsRes.data.roleViews || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar los datos del sistema');
    } finally {
      setLoading(false);
    }
  };

  // Obtener roles de un usuario
  const getUserRoles = (userId) => {
    return userRoles
      .filter(ur => ur.user_id === userId && ur.is_active)
      .map(ur => roles.find(r => r.id === ur.role_id))
      .filter(Boolean);
  };

  // Obtener permisos de un rol
  const getRolePermissions = (roleId) => {
    return rolePermissions
      .filter(rp => rp.role_id === roleId)
      .map(rp => permissions.find(p => p.id === rp.permission_id))
      .filter(Boolean);
  };

  // Asignar rol a usuario
  const assignRoleToUser = async (userId, roleId) => {
    try {
      await api.post('/api/admin/assign-role', { userId, roleId });
      toast.success('Rol asignado correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al asignar rol');
    }
  };

  // Quitar rol de usuario
  const removeRoleFromUser = async (userId, roleId) => {
    try {
      await api.post('/api/admin/remove-role', { userId, roleId });
      toast.success('Rol removido correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al remover rol');
    }
  };

  // Componente de gestión de usuarios
  const UserManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Users className="mr-3 text-blue-600" />
          Gestión de Usuarios
        </h2>
        <button
          onClick={() => setShowUserModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Roles Actuales
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
            {users.map((user) => {
              const userRolesList = getUserRoles(user.id);
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {userRolesList.map((role) => (
                        <span
                          key={role.id}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: role.color + '20', color: role.color }}
                        >
                          {role.display_name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Activo
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Componente de gestión de roles
  const RoleManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Shield className="mr-3 text-purple-600" />
          Gestión de Roles
        </h2>
        <button
          onClick={() => setShowRoleModal(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Rol
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => {
          const rolePermissionsList = getRolePermissions(role.id);
          const usersWithRole = userRoles
            .filter(ur => ur.role_id === role.id && ur.is_active)
            .map(ur => users.find(u => u.id === ur.user_id))
            .filter(Boolean);

          return (
            <div key={role.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: role.color }}
                  >
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">{role.display_name}</h3>
                    <p className="text-sm text-gray-500">{role.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRole(role)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>

              <p className="text-gray-600 text-sm mb-4">{role.description}</p>

              <div className="space-y-3">
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permisos ({rolePermissionsList.length})
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {rolePermissionsList.slice(0, 3).map((permission) => (
                      <span
                        key={permission.id}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700"
                      >
                        {permission.display_name}
                      </span>
                    ))}
                    {rolePermissionsList.length > 3 && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                        +{rolePermissionsList.length - 3} más
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuarios ({usersWithRole.length})
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {usersWithRole.slice(0, 3).map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700"
                      >
                        {user.username}
                      </span>
                    ))}
                    {usersWithRole.length > 3 && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                        +{usersWithRole.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Modal de edición de usuario
  const UserModal = () => {
    if (!selectedUser) return null;

    const userRolesList = getUserRoles(selectedUser.id);
    const availableRoles = roles.filter(role => 
      !userRolesList.find(ur => ur.id === role.id)
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Gestionar Roles - {selectedUser.username}
            </h3>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Roles Actuales</h4>
              <div className="space-y-2">
                {userRolesList.map((role) => (
                  <div key={role.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white mr-3"
                        style={{ backgroundColor: role.color }}
                      >
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{role.display_name}</span>
                        <p className="text-sm text-gray-500">{role.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeRoleFromUser(selectedUser.id, role.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Roles Disponibles</h4>
              <div className="space-y-2">
                {availableRoles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white mr-3"
                        style={{ backgroundColor: role.color }}
                      >
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{role.display_name}</span>
                        <p className="text-sm text-gray-500">{role.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => assignRoleToUser(selectedUser.id, role.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Settings className="mr-4 text-blue-600" />
            Sistema de Gestión de Roles y Permisos
          </h1>
          <p className="mt-2 text-gray-600">
            Administra usuarios, roles y permisos del sistema de forma avanzada
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="inline-block mr-2 h-4 w-4" />
              Usuarios
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'roles'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Shield className="inline-block mr-2 h-4 w-4" />
              Roles
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'roles' && <RoleManagement />}

        {/* Modals */}
        {selectedUser && <UserModal />}
      </div>
    </div>
  );
};

export default RoleManagementPage;
