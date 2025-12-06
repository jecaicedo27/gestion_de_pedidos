import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { configService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Eye, EyeOff, LogIn } from 'lucide-react';

const LoginPage = () => {
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm();

  // Cargar configuración de la empresa
  useEffect(() => {
    const loadCompanyConfig = async () => {
      try {
        const response = await configService.getPublicConfig();
        if (response.success) {
          setCompanyConfig(response.data);
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
      } finally {
        setConfigLoading(false);
      }
    };

    loadCompanyConfig();
  }, []);

  const onSubmit = async (data) => {
    try {
      const result = await login(data);
      if (!result.success) {
        setError('root', {
          type: 'manual',
          message: result.message || 'Error en el inicio de sesión',
        });
      }
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: 'Error inesperado. Intenta de nuevo.',
      });
    }
  };

  if (configLoading) {
    return <LoadingSpinner size="xl" text="Cargando..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          {companyConfig?.logo_url ? (
            <img
              className="mx-auto h-16 w-auto"
              src={companyConfig.logo_url}
              alt={companyConfig.name}
            />
          ) : (
            <div className="mx-auto h-16 w-16 bg-primary-600 rounded-lg flex items-center justify-center">
              <LogIn className="h-8 w-8 text-white" />
            </div>
          )}
          
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {companyConfig?.name || 'Sistema de Gestión'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Inicia sesión en tu cuenta
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Error general */}
            {errors.root && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-md text-sm">
                {errors.root.message}
              </div>
            )}

            {/* Campo de usuario */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className={`input w-full ${errors.username ? 'input-error' : ''}`}
                placeholder="Ingresa tu usuario"
                {...register('username', {
                  required: 'El usuario es requerido',
                  minLength: {
                    value: 3,
                    message: 'El usuario debe tener al menos 3 caracteres',
                  },
                })}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-danger-600">{errors.username.message}</p>
              )}
            </div>

            {/* Campo de contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input w-full pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="Ingresa tu contraseña"
                  {...register('password', {
                    required: 'La contraseña es requerida',
                    minLength: {
                      value: 6,
                      message: 'La contraseña debe tener al menos 6 caracteres',
                    },
                  })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-600">{errors.password.message}</p>
              )}
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="btn btn-primary btn-lg w-full flex items-center justify-center"
            >
              {isSubmitting || isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              {/* Información de usuarios de prueba (solo desarrollo) */}
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Usuarios de prueba:
              </h3>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span className="font-medium">admin</span>
                  <span>admin123</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">facturador1</span>
                  <span>facturador123</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">cartera1</span>
                  <span>cartera123</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">logistica1</span>
                  <span>logistica123</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">mensajero1</span>
                  <span>mensajero123</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Sistema de Gestión de Pedidos Universal</p>
          <p className="mt-1">© 2025 - Todos los derechos reservados</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
