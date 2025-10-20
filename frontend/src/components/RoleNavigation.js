import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as Icons from 'lucide-react';

const RoleNavigation = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Definir qué vistas puede ver cada rol
  const allViews = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: Icons.BarChart3,
      path: '/dashboard',
      description: 'Vista general del sistema',
      roles: ['admin', 'facturador', 'cartera', 'logistica', 'mensajero']
    },
    {
      id: 'todos-pedidos',
      name: 'Todos los Pedidos',
      icon: Icons.List,
      path: '/orders?view=todos',
      description: 'Ver todos los pedidos con todos los estados',
      clearFilters: true,
      roles: ['admin', 'facturador', 'cartera', 'logistica', 'mensajero']
    },
    {
      id: 'facturacion',
      name: 'Facturación',
      icon: Icons.FileText,
      path: '/orders?view=facturacion&status=pendiente_por_facturacion',
      description: 'Gestión de pedidos y facturación',
      roles: ['admin', 'facturador']
    },
    {
      id: 'cartera',
      name: 'Cartera',
      icon: Icons.CreditCard,
      path: '/orders?view=cartera&status=revision_cartera',
      description: 'Verificación de pagos',
      roles: ['admin', 'cartera']
    },
    {
      id: 'cartera-cobros',
      name: 'Entrega de Efectivo',
      icon: Icons.Coins,
      path: '/cashier-collections',
      description: 'Recibir efectivo por factura y cerrar actas',
      roles: ['admin', 'cartera']
    },
    {
      id: 'logistica',
      name: 'Logística',
      icon: Icons.Package,
      path: '/orders?view=logistica&status=en_logistica',
      description: 'Preparación y asignación',
      roles: ['admin', 'logistica']
    },
    {
      id: 'empaque',
      name: 'Empaque',
      icon: Icons.Box,
      path: '/packaging',
      description: 'Control de calidad y empaque',
      roles: ['admin', 'logistica'] // ✅ Logística puede acceder a empaque
    },
    {
      id: 'mensajero',
      name: 'Mensajero',
      icon: Icons.Truck,
      path: '/orders?view=mensajero',
      description: 'Entregas y cobros',
      roles: ['admin', 'logistica', 'mensajero']
    }
  ];

  // Filtrar vistas según el rol del usuario
  const roleViews = allViews.filter(view => 
    view.roles.includes(user?.role)
  );

  // No mostrar si no hay vistas disponibles para el rol
  if (roleViews.length === 0) {
    return null;
  }

  const getCurrentView = () => {
    const path = location.pathname;
    const search = location.search;
    const urlParams = new URLSearchParams(search);
    
    if (path === '/dashboard') return 'dashboard';
    
    // Detectar vista por parámetro 'view' en la URL
    const viewParam = urlParams.get('view');
    if (viewParam) {
      if (viewParam === 'todos') return 'todos-pedidos';
      return viewParam;
    }
    
    // Detectar vista por estado de pedidos
    const statusParam = urlParams.get('status');
    if (path === '/orders' && statusParam) {
      if (statusParam === 'revision_cartera' || statusParam === 'pendiente_pago') {
        return 'cartera';
      }
      if (statusParam === 'en_logistica' || statusParam === 'preparando' || statusParam === 'listo_envio') {
        return 'logistica';
      }
      if (statusParam === 'en_reparto' || statusParam === 'entregado' || statusParam === 'devuelto') {
        return 'mensajero';
      }
    }
    
    // Rutas específicas
    if (path === '/users') return 'usuarios';
    if (path === '/orders') return 'facturacion'; // Sin parámetros = facturación
    if (path === '/billing' || path === '/siigo-invoices') return 'facturacion';
    if (path === '/siigo-consulta') return 'siigo-consulta';
    if (path === '/packaging') return 'empaque';
    if (path === '/products') return 'productos';
    if (path === '/delivery-methods') return 'delivery-methods';
    if (path === '/quotations') return 'cotizaciones';
    if (path === '/customers') return 'clientes';
    if (path === '/cashier-collections') return 'cartera-cobros';
    
    return 'dashboard';
  };

  const currentView = getCurrentView();

  const handleRoleChange = (roleView) => {
    navigate(roleView.path);
  };

  return (
    <div className="bg-gray-800 text-white">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center space-x-1">
            {roleViews.map((roleView) => {
              const Icon = roleView.icon;
              const isActive = currentView === roleView.id;
              
              return (
                <button
                  key={roleView.id}
                  onClick={() => handleRoleChange(roleView)}
                  className={`
                    flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                  title={roleView.description}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {roleView.name}
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center text-sm text-gray-400">
            <Icons.Crown className="w-4 h-4 mr-1" />
            <span>Vista de {user?.role === 'admin' ? 'Administrador' : 
                        user?.role === 'facturador' ? 'Facturador' :
                        user?.role === 'cartera' ? 'Cartera' :
                        user?.role === 'logistica' ? 'Logística' :
                        user?.role === 'mensajero' ? 'Mensajero' : 'Usuario'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleNavigation;
