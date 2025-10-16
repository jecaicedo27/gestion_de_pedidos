import React from 'react';
import { useAuth } from '../context/AuthContext';

const ProfilePage = () => {
  const { user, getRoleName } = useAuth();

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-600 mt-2">
          Gestiona tu información personal
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Información Personal</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                <p className="mt-1 text-sm text-gray-900">{user?.full_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Usuario</label>
                <p className="mt-1 text-sm text-gray-900">{user?.username}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rol</label>
                <p className="mt-1 text-sm text-gray-900">{getRoleName(user?.role)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Cambiar Contraseña</h3>
          </div>
          <div className="card-content">
            <p className="text-gray-500 text-center py-8">
              Funcionalidad de cambio de contraseña en desarrollo...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
