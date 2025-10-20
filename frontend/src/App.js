import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Componentes de páginas
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import CreateOrderPage from './pages/CreateOrderPage';
import EditOrderPage from './pages/EditOrderPage';
import UsersPage from './pages/UsersPage';
import CompanyConfigPage from './pages/CompanyConfigPage';
import ProfilePage from './pages/ProfilePage';
import APIConfigPage from './pages/APIConfigPage';
import SiigoCredentialsPage from './pages/SiigoCredentialsPage';
import SiigoInvoicesPage from './pages/SiigoInvoicesPage';
import SiigoStartDateConfigPage from './pages/SiigoStartDateConfigPage';
import BillingPage from './pages/BillingPage';
import ShippingGuidesPage from './pages/ShippingGuidesPage';
import CustomerCreditPage from './pages/CustomerCreditPage';
import PackagingPage from './pages/PackagingPage';
import DeliveryMethodsPage from './pages/DeliveryMethodsPage';
import ProductsPage from './pages/ProductsPage';
import CarriersManagementPage from './pages/CarriersManagementPage';
import QuotationsPage from './pages/QuotationsPage';
import CustomersPage from './pages/CustomersPage';
import InventoryBillingPage from './pages/InventoryBillingPage';
import CashierCollectionsPage from './pages/CashierCollectionsPage';

// Componentes de layout
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

// Componente para rutas protegidas
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasPermission(requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Componente para rutas públicas (solo accesibles si no está autenticado)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Componente principal de rutas
const AppRoutes = () => {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Rutas protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard - accesible para todos los roles */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Pedidos - accesible para todos los roles */}
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/create" element={<CreateOrderPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route 
          path="orders/:id/edit" 
          element={
            <ProtectedRoute requiredRole="admin">
              <EditOrderPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Facturación - admin y facturador */}
        <Route
          path="billing"
          element={
            <ProtectedRoute requiredRole={['admin', 'facturador']}>
              <BillingPage />
            </ProtectedRoute>
          }
        />

        {/* Facturas SIIGO - admin y facturador */}
        <Route
          path="siigo-invoices"
          element={
            <ProtectedRoute requiredRole={['admin', 'facturador']}>
              <SiigoInvoicesPage />
            </ProtectedRoute>
          }
        />

        {/* Usuarios - solo admin */}
        <Route
          path="users"
          element={
            <ProtectedRoute requiredRole="admin">
              <UsersPage />
            </ProtectedRoute>
          }
        />

        {/* Configuración de Empresa - solo admin */}
        <Route
          path="company-config"
          element={
            <ProtectedRoute requiredRole="admin">
              <CompanyConfigPage />
            </ProtectedRoute>
          }
        />

        {/* Configuración de APIs - solo admin */}
        <Route
          path="api-config"
          element={
            <ProtectedRoute requiredRole="admin">
              <APIConfigPage />
            </ProtectedRoute>
          }
        />

        {/* Credenciales SIIGO - solo admin */}
        <Route
          path="siigo-credentials"
          element={
            <ProtectedRoute requiredRole="admin">
              <SiigoCredentialsPage />
            </ProtectedRoute>
          }
        />

        {/* Configuración de Fecha de Inicio SIIGO - solo admin */}
        <Route
          path="siigo-start-date-config"
          element={
            <ProtectedRoute requiredRole="admin">
              <SiigoStartDateConfigPage />
            </ProtectedRoute>
          }
        />

        {/* Guías de Envío - admin y logística */}
        <Route
          path="shipping-guides"
          element={
            <ProtectedRoute requiredRole={['admin', 'logistica']}>
              <ShippingGuidesPage />
            </ProtectedRoute>
          }
        />

        {/* Crédito de Clientes - solo admin */}
        <Route
          path="customer-credit"
          element={
            <ProtectedRoute requiredRole="admin">
              <CustomerCreditPage />
            </ProtectedRoute>
          }
        />

        {/* Sistema de Empaque - admin y empaque */}
        <Route
          path="packaging"
          element={
            <ProtectedRoute requiredRole={['admin', 'logistica', 'empaque']}>
              <PackagingPage />
            </ProtectedRoute>
          }
        />

        {/* Métodos de Envío - solo admin */}
        <Route
          path="delivery-methods"
          element={
            <ProtectedRoute requiredRole="admin">
              <DeliveryMethodsPage />
            </ProtectedRoute>
          }
        />

        {/* Productos y Códigos de Barras - admin y logística */}
        <Route
          path="products"
          element={
            <ProtectedRoute requiredRole={['admin', 'logistica']}>
              <ProductsPage />
            </ProtectedRoute>
          }
        />

        {/* Gestión de Transportadoras - admin y logística */}
        <Route
          path="carriers"
          element={
            <ProtectedRoute requiredRole={['admin', 'logistica']}>
              <CarriersManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Sistema de Cotizaciones - admin y facturador */}
        <Route
          path="quotations"
          element={
            <ProtectedRoute requiredRole={['admin', 'facturador']}>
              <QuotationsPage />
            </ProtectedRoute>
          }
        />

        {/* Gestión de Clientes - admin y facturador */}
        <Route
          path="customers"
          element={
            <ProtectedRoute requiredRole={['admin', 'facturador']}>
              <CustomersPage />
            </ProtectedRoute>
          }
        />
        {/* Cartera - Entrega de Efectivo - admin y cartera */}
        <Route
          path="cashier-collections"
          element={
            <ProtectedRoute requiredRole={['admin', 'cartera']}>
              <CashierCollectionsPage />
            </ProtectedRoute>
          }
        />

        {/* Inventario + Facturación Directa - admin y facturador */}
        <Route
          path="inventory-billing"
          element={
            <ProtectedRoute requiredRole={['admin', 'facturador']}>
              <InventoryBillingPage />
            </ProtectedRoute>
          }
        />

        {/* Perfil - accesible para todos los roles */}
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Ruta por defecto */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

// Componente principal de la aplicación
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
          
          {/* Configuración global de toast */}
          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            containerClassName=""
            containerStyle={{}}
            toastOptions={{
              // Configuración por defecto para todos los toast
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              
              // Configuración específica por tipo
              success: {
                duration: 3000,
                style: {
                  background: '#10B981',
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#10B981',
                },
              },
              
              error: {
                duration: 5000,
                style: {
                  background: '#EF4444',
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#EF4444',
                },
              },
              
              loading: {
                duration: Infinity,
                style: {
                  background: '#3B82F6',
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
