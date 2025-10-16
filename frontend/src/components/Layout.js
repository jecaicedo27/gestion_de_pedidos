import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Menu, 
  X, 
  Home, 
  ShoppingCart, 
  Users, 
  Settings, 
  User, 
  LogOut,
  Bell,
  FileText,
  CreditCard,
  Database,
  Building,
  Calendar,
  Package,
  Truck,
  Calculator,
  Package2
} from 'lucide-react';
import NotificationSystem from './NotificationSystem';
import RoleNavigation from './RoleNavigation';

const Layout = () => {
  const { user, logout, hasPermission, getRoleName } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      current: location.pathname === '/dashboard',
    },
    {
      name: 'Pedidos',
      href: '/orders',
      icon: ShoppingCart,
      current: location.pathname === '/orders',
    },
    {
      name: 'Productos',
      href: '/products',
      icon: Package,
      current: location.pathname === '/products',
      requiresPermission: ['admin', 'logistica'],
    },
    {
      name: 'Facturas SIIGO',
      href: '/siigo-invoices',
      icon: FileText,
      current: location.pathname === '/siigo-invoices',
      requiresPermission: ['admin', 'facturador'],
    },
    {
      name: 'Usuarios',
      href: '/users',
      icon: Users,
      current: location.pathname === '/users',
      requiresPermission: 'admin',
    },
    {
      name: 'Config Empresa',
      href: '/company-config',
      icon: Building,
      current: location.pathname === '/company-config',
      requiresPermission: 'admin',
    },
    {
      name: 'API Config',
      href: '/api-config',
      icon: Settings,
      current: location.pathname === '/api-config',
      requiresPermission: 'admin',
    },
    {
      name: 'Fecha Inicio SIIGO',
      href: '/siigo-start-date-config',
      icon: Calendar,
      current: location.pathname === '/siigo-start-date-config',
      requiresPermission: 'admin',
    },
    {
      name: 'Guías de Envío',
      href: '/shipping-guides',
      icon: ShoppingCart,
      current: location.pathname === '/shipping-guides',
      requiresPermission: ['admin', 'logistica'],
    },
    {
      name: 'Crédito de Clientes',
      href: '/customer-credit',
      icon: CreditCard,
      current: location.pathname === '/customer-credit',
      requiresPermission: 'admin',
    },
    {
      name: 'Métodos de Envío',
      href: '/delivery-methods',
      icon: Settings,
      current: location.pathname === '/delivery-methods',
      requiresPermission: 'admin',
    },
    {
      name: 'Transportadoras',
      href: '/carriers',
      icon: Truck,
      current: location.pathname === '/carriers',
      requiresPermission: ['admin', 'logistica'],
    },
    {
      name: 'Cotizaciones',
      href: '/quotations',
      icon: Calculator,
      current: location.pathname === '/quotations',
      requiresPermission: ['admin', 'facturador'],
    },
    {
      name: 'Clientes',
      href: '/customers',
      icon: Users,
      current: location.pathname === '/customers',
      requiresPermission: ['admin', 'facturador'],
    },
    {
      name: 'Inventario + Facturación',
      href: '/inventory-billing',
      icon: Package2,
      current: location.pathname === '/inventory-billing',
      requiresPermission: ['admin', 'facturador'],
    },
  ];

  const handleLogout = () => {
    logout();
  };

  const filteredNavigation = navigation.filter(item => 
    !item.requiresPermission || hasPermission(item.requiresPermission)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar para móvil */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        
        <div
          className={`relative flex-1 flex flex-col max-w-xs w-full bg-white transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">
                Gestión Pedidos
              </span>
            </div>
            
            <nav className="mt-5 px-2 space-y-1">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                      item.current
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="mr-4 h-6 w-6" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-3">
                <p className="text-base font-medium text-gray-700">{user?.full_name}</p>
                <p className="text-sm font-medium text-gray-500">{getRoleName(user?.role)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar para desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">
                Gestión Pedidos
              </span>
            </div>
            
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      item.current
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-6 w-6" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <Link to="/profile" className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div className="h-9 w-9 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {user?.full_name}
                  </p>
                  <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">
                    {getRoleName(user?.role)}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="md:pl-64 flex flex-col flex-1">
        {/* Header */}
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-50">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Navegación por roles (solo admin) */}
        <RoleNavigation />

        {/* Barra superior */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {navigation.find(item => item.current)?.name || 'Dashboard'}
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Sistema de Notificaciones */}
                <NotificationSystem />
                
                {/* Menú de usuario */}
                <div className="relative">
                  <button
                    onClick={handleLogout}
                    className="flex items-center text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <LogOut className="h-5 w-5 mr-1" />
                    <span className="hidden sm:block">Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido de la página */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
