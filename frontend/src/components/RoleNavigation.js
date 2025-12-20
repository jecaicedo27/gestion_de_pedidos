import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as Icons from 'lucide-react';

const RoleNavigation = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Roles soportando multi-rol (user.role + user.roles[] del perfil)
  const rolesFromProfile = Array.isArray(user?.roles) ? user.roles.map(r => r.role_name) : [];
  const roleNames = Array.from(new Set([user?.role, ...rolesFromProfile].filter(Boolean)));

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
      id: 'inventory-billing',
      name: 'Inventario + Facturación',
      icon: Icons.Package2,
      path: '/inventory-billing',
      description: 'Facturación directa desde inventario',
      roles: ['admin', 'facturador', 'cartera', 'empacador', 'empaque', 'packaging']
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
      id: 'treasury-audit',
      name: 'Auditoría Cartera',
      icon: Icons.ShieldCheck,
      path: '/treasury-audit',
      description: 'Historial de consignaciones y cambios de base',
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
      id: 'ready-to-deliver',
      name: 'Pedidos por Entregar',
      icon: Icons.ClipboardCheck,
      path: '/ready-to-deliver',
      description: 'Pedidos listos para entregar',
      roles: ['admin', 'logistica', 'cartera', 'facturador']
    },
    {
      id: 'packaging-progress',
      name: 'Progreso Empaque',
      icon: Icons.Activity,
      path: '/packaging-progress',
      description: 'Seguimiento en tiempo real (solo lectura)',
      roles: ['admin', 'logistica', 'facturador', 'cartera']
    },
    {
      id: 'evidence-gallery',
      name: 'Galería Evidencias',
      icon: Icons.Image,
      path: '/packaging/evidence-gallery',
      description: 'Fotos de empaque por pedido',
      roles: ['admin', 'logistica', 'empaque', 'empacador', 'cartera', 'facturador']
    },
    {
      id: 'empaque',
      name: 'Empaque',
      icon: Icons.Box,
      path: '/packaging',
      description: 'Control de calidad y empaque',
      roles: ['admin', 'logistica', 'empacador', 'empaque', 'packaging'] // ✅ Logística y Empaque/Empacador pueden acceder a empaque
    },
    {
      id: 'mensajero',
      name: 'Mensajero',
      icon: Icons.Truck,
      path: '/orders?view=mensajero',
      description: 'Entregas y cobros',
      roles: ['admin', 'logistica', 'mensajero']
    },

    {
      id: 'automation',
      name: 'Automatización',
      icon: Icons.Settings,
      path: '/automation',
      description: 'Monitoreo y control de servicios y webhooks',
      roles: ['admin']
    }
  ];

  // Filtrar vistas según el rol del usuario
  const roleViews = allViews.filter(view =>
    view.roles.some(r => roleNames.includes(r))
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
    if (path === '/postventa') return 'postventa';
    if (path === '/postventa-analytics') return 'postventa-analytics';
    if (path === '/automation') return 'automation';
    if (path === '/orders') return 'facturacion'; // Sin parámetros = facturación
    if (path === '/billing' || path === '/siigo-invoices') return 'facturacion';
    if (path === '/siigo-consulta') return 'siigo-consulta';
    if (path === '/ready-to-deliver') return 'ready-to-deliver';
    if (path === '/packaging') return 'empaque';
    if (path === '/packaging-progress') return 'packaging-progress';
    if (path === '/packaging/evidence-gallery') return 'evidence-gallery';
    if (path === '/products') return 'productos';
    if (path === '/delivery-methods') return 'delivery-methods';
    if (path === '/quotations') return 'cotizaciones';
    if (path === '/customers') return 'clientes';
    if (path === '/cashier-collections') return 'cartera-cobros';
    if (path === '/treasury-audit') return 'treasury-audit';

    return 'dashboard';
  };

  const currentView = getCurrentView();

  const handleRoleChange = (roleView) => {
    navigate(roleView.path);
  };

  const scrollContainerRef = React.useRef(null);
  const [showLeftArrow, setShowLeftArrow] = React.useState(false);
  const [showRightArrow, setShowRightArrow] = React.useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1); // -1 for tolerance
    }
  };

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [roleViews]);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="bg-gray-800 text-white sticky top-12 md:top-0 z-20">
      <div className="px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-12 relative">

          {/* Left Arrow */}
          {showLeftArrow && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 z-30 h-full px-2 bg-gradient-to-r from-gray-800 to-transparent flex items-center text-white hover:text-blue-400"
            >
              <Icons.ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex items-center space-x-1 overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 pr-2 px-6" // Added px-6 for arrow space
          >
            {roleViews.map((roleView) => {
              const Icon = roleView.icon;
              const isActive = currentView === roleView.id;

              return (
                <button
                  key={roleView.id}
                  onClick={() => handleRoleChange(roleView)}
                  className={`
                    flex items-center rounded-md font-medium transition-colors px-2 py-1 text-xs sm:px-3 sm:py-2 sm:text-sm
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

          {/* Right Arrow */}
          {showRightArrow && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 md:right-auto md:left-[calc(100%-200px)] lg:right-auto lg:left-auto z-30 h-full px-2 bg-gradient-to-l from-gray-800 to-transparent flex items-center text-white hover:text-blue-400"
              style={{ right: '0' }} // Force right alignment relative to container
            >
              <Icons.ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div className="hidden md:flex items-center text-sm text-gray-400 pl-2 shrink-0 border-l border-gray-700 ml-2">
            <Icons.Crown className="w-4 h-4 mr-1" />
            {(() => {
              const map = (r) => (
                r === 'admin' ? 'Administrador' :
                  r === 'facturador' ? 'Facturador' :
                    r === 'cartera' ? 'Cartera' :
                      r === 'logistica' ? 'Logística' :
                        r === 'mensajero' ? 'Mensajero' : (r === 'empacador' || r === 'empaque' ? 'Empacador' : 'Usuario')
              );
              const labels = roleNames.length ? roleNames.map(map).join(' + ') : map(user?.role);
              return <span>Vista de {labels}</span>;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleNavigation;
