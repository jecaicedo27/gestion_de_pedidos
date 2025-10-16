import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/api';
import toast from 'react-hot-toast';

// Estado inicial
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Tipos de acciones
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer para manejar el estado de autenticación
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    
    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      };
    
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    
    default:
      return state;
  }
};

// Crear contexto
const AuthContext = createContext();

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Proveedor del contexto
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Función para inicializar la autenticación
  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        // Verificar si el token es válido
        try {
          const response = await authService.verifyToken();
          if (response.success) {
            dispatch({
              type: AUTH_ACTIONS.LOGIN_SUCCESS,
              payload: { 
                user: JSON.parse(userData),
                token: token
              },
            });
          } else {
            // Token inválido, limpiar localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
          }
        } catch (error) {
          // Error verificando token, limpiar localStorage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        }
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    } catch (error) {
      console.error('Error inicializando autenticación:', error);
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Función para hacer login
  const login = async (credentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await authService.login(credentials);
      
      if (response.success) {
        const { user, token } = response.data;
        
        // Guardar en localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, token },
        });
        
        toast.success('Inicio de sesión exitoso');
        return { success: true };
      } else {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_FAILURE,
          payload: response.message || 'Error en el inicio de sesión',
        });
        return { success: false, message: response.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error en el inicio de sesión';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage,
      });
      return { success: false, message: errorMessage };
    }
  };

  // Función para hacer logout
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
    toast.success('Sesión cerrada exitosamente');
  };

  // Función para actualizar el perfil del usuario
  const updateProfile = async () => {
    try {
      const response = await authService.getProfile();
      if (response.success) {
        const updatedUser = response.data;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        dispatch({
          type: AUTH_ACTIONS.SET_USER,
          payload: updatedUser,
        });
        return { success: true, user: updatedUser };
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      return { success: false, message: 'Error actualizando perfil' };
    }
  };

  // Función para cambiar contraseña
  const changePassword = async (passwordData) => {
    try {
      const response = await authService.changePassword(passwordData);
      if (response.success) {
        toast.success('Contraseña cambiada exitosamente');
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error cambiando contraseña';
      return { success: false, message: errorMessage };
    }
  };

  // Función para limpiar errores
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Función para verificar permisos
  const hasPermission = (requiredRole) => {
    if (!state.user) return false;
    
    const userRole = state.user.role;
    
    // Admin tiene acceso a todo
    if (userRole === 'admin') return true;
    
    // Verificar rol específico
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(userRole);
    }
    
    return userRole === requiredRole;
  };

  // Función para verificar si es admin
  const isAdmin = () => {
    return state.user?.role === 'admin';
  };

  // Función para obtener el nombre del rol en español
  const getRoleName = (role) => {
    const roleNames = {
      admin: 'Administrador',
      facturador: 'Facturador',
      cartera: 'Cartera',
      logistica: 'Logística',
      mensajero: 'Mensajero',
    };
    return roleNames[role] || role;
  };

  // Inicializar autenticación al montar el componente
  useEffect(() => {
    initializeAuth();
  }, []);

  // Valor del contexto
  const value = {
    // Estado
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    
    // Funciones
    login,
    logout,
    updateProfile,
    changePassword,
    clearError,
    hasPermission,
    isAdmin,
    getRoleName,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
