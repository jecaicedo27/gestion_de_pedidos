import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const PackagingPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [stats, setStats] = useState({});

  // Verificar si hay un orderId en la URL para procesar directamente
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId) {
      console.log('🎯 ID de pedido detectado en URL:', orderId);
      toast('🎯 Iniciando empaque del pedido específico...');
      startPackaging(parseInt(orderId));
      // Limpiar el parámetro de la URL después de procesar
      setSearchParams({});
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        await loadPendingOrders();
      }
      await loadStats();
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando información');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingOrders = async () => {
    try {
      const response = await fetch('/api/packaging/pending-orders', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingOrders(data.data);
      } else {
        throw new Error('Error cargando pedidos pendientes');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cargando pedidos pendientes');
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/packaging/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const startPackaging = async (orderId) => {
    try {
      const response = await fetch(`/api/packaging/start/${orderId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Proceso de empaque iniciado');
        await loadChecklist(orderId);
        setActiveTab('checklist');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error iniciando empaque');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error iniciando proceso de empaque');
    }
  };

  const loadChecklist = async (orderId) => {
    try {
      const response = await fetch(`/api/packaging/checklist/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentOrder(data.data.order);
        setChecklist(data.data.checklist);
      } else {
        throw new Error('Error cargando checklist');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cargando checklist');
    }
  };

  const verifyItem = async (itemId, itemData) => {
    try {
      const response = await fetch(`/api/packaging/verify-item/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(itemData)
      });

      if (response.ok) {
        toast.success('Item verificado');
        await loadChecklist(currentOrder.id);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error verificando item');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error verificando item');
    }
  };

  const completePackaging = async (orderId, notes, qualityPassed) => {
    try {
      const response = await fetch(`/api/packaging/complete/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          packaging_notes: notes,
          quality_check_passed: qualityPassed
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setActiveTab('pending');
        setCurrentOrder(null);
        setChecklist([]);
        await loadData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error completando empaque');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error completando empaque');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'requires_review': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'Pendiente',
      'in_progress': 'En Proceso',
      'completed': 'Completado',
      'requires_review': 'Requiere Revisión'
    };
    return labels[status] || status;
  };

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Icons.Package className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Pendientes</p>
            <p className="text-2xl font-semibold">{stats.pending_packaging || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icons.Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">En Empaque</p>
            <p className="text-2xl font-semibold">{stats.in_packaging || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <Icons.CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Listos</p>
            <p className="text-2xl font-semibold">{stats.ready_shipping || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-red-100 rounded-lg">
            <Icons.AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Requieren Revisión</p>
            <p className="text-2xl font-semibold">{stats.requires_review || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPendingOrders = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Pedidos Pendientes de Empaque</h3>
        <p className="text-sm text-gray-600 mt-1">Pedidos que llegaron desde logística</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pedido
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pendingOrders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {order.order_number}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{order.customer_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{order.item_count} items</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    ${order.total_amount?.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => startPackaging(order.id)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Icons.Play className="w-4 h-4 mr-2" />
                    Iniciar Empaque
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {pendingOrders.length === 0 && (
          <div className="text-center py-8">
            <Icons.Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pedidos pendientes</h3>
            <p className="mt-1 text-sm text-gray-500">
              Todos los pedidos están empacados o en proceso
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderChecklist = () => {
    if (!currentOrder) return null;

    const verifiedCount = checklist.filter(item => item.is_verified).length;
    const totalCount = checklist.length;
    const progress = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Información del pedido */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Checklist de Empaque - Pedido {currentOrder.order_number}
            </h3>
            <button
              onClick={() => {
                setActiveTab('pending');
                setCurrentOrder(null);
                setChecklist([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <Icons.X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Cliente</p>
              <p className="font-medium">{currentOrder.customer_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="font-medium">${currentOrder.total_amount?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Progreso</p>
              <p className="font-medium">{verifiedCount}/{totalCount} items</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Estado</p>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentOrder.packaging_status)}`}>
                {getStatusLabel(currentOrder.packaging_status)}
              </span>
            </div>
          </div>
          
          {/* Barra de progreso */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {/* Notas del Pedido SIIGO */}
          {currentOrder.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Icons.FileText className="w-4 h-4 mr-2" />
                  Notas del Pedido Original
                </h4>
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Información importante del cliente:</strong>
                </p>
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentOrder.notes}</p>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  💡 Esta información puede contener detalles sobre instrucciones especiales de empaque, 
                  manejo del producto u otras observaciones importantes para el proceso.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Validación Rápida */}
        <FastPackagingValidation
          checklist={checklist}
          onVerifyItem={(itemId, itemData) => verifyItem(itemId, itemData)}
          onVerifyAll={() => verifyAllItems()}
        />

        {/* Finalizar empaque */}
        {verifiedCount === totalCount && totalCount > 0 && (
          <CompletePackagingForm
            orderId={currentOrder.id}
            onComplete={(notes, qualityPassed) => completePackaging(currentOrder.id, notes, qualityPassed)}
          />
        )}
      </div>
    );
  };

  const verifyAllItems = async () => {
    try {
      const response = await fetch(`/api/packaging/verify-all/${currentOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          verification_notes: 'Verificación rápida - Todo correcto'
        })
      });

      if (response.ok) {
        toast.success('Todos los items verificados correctamente');
        await loadChecklist(currentOrder.id);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error verificando items');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error verificando items');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Empaque</h1>
          <p className="mt-2 text-gray-600">
            Control de calidad y verificación de productos antes del envío
          </p>
        </div>

        {/* Estadísticas */}
        {renderStats()}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icons.Package className="w-5 h-5 inline mr-2" />
              Pedidos Pendientes
            </button>
            {currentOrder && (
              <button
                onClick={() => setActiveTab('checklist')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'checklist'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icons.CheckSquare className="w-5 h-5 inline mr-2" />
                Checklist Activo
              </button>
            )}
          </nav>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icons.Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Cargando...</span>
          </div>
        ) : (
          <>
            {activeTab === 'pending' && renderPendingOrders()}
            {activeTab === 'checklist' && renderChecklist()}
          </>
        )}
      </div>
    </div>
  );
};

// Componente para item individual del checklist
const PackagingItem = ({ item, onVerify }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    packed_quantity: item.packed_quantity || '',
    packed_weight: item.packed_weight || '',
    packed_flavor: item.packed_flavor || '',
    packed_size: item.packed_size || '',
    verification_notes: item.verification_notes || '',
    is_verified: item.is_verified || false
  });

  const handleSave = () => {
    onVerify(formData);
  };

  const availableFlavors = item.available_flavors ? JSON.parse(item.available_flavors) : [];
  const qualityChecks = item.quality_checks ? JSON.parse(item.quality_checks) : [];
  const commonErrors = item.common_errors ? JSON.parse(item.common_errors) : [];

  return (
    <div className={`bg-white rounded-lg shadow border-l-4 ${item.is_verified ? 'border-green-500' : 'border-yellow-500'}`}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${item.is_verified ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <h4 className="text-lg font-medium text-gray-900">{item.item_name}</h4>
              {item.is_verified && (
                <Icons.CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
            
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Cantidad:</span> {item.required_quantity} {item.required_unit}
              </div>
              {item.required_weight && (
                <div>
                  <span className="font-medium">Peso:</span> {item.required_weight}kg
                </div>
              )}
              {item.required_flavor && (
                <div>
                  <span className="font-medium">Sabor:</span> {item.required_flavor}
                </div>
              )}
              {item.required_size && (
                <div>
                  <span className="font-medium">Tamaño:</span> {item.required_size}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? (
              <Icons.ChevronUp className="w-5 h-5" />
            ) : (
              <Icons.ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-6 space-y-6">
            {/* Instrucciones */}
            {item.packaging_instructions && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">📋 Instrucciones de Empaque</h5>
                <p className="text-blue-800 text-sm">{item.packaging_instructions}</p>
              </div>
            )}

            {/* Controles de calidad */}
            {qualityChecks.length > 0 && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h5 className="font-medium text-green-900 mb-2">✅ Controles de Calidad</h5>
                <ul className="text-green-800 text-sm space-y-1">
                  {qualityChecks.map((check, index) => (
                    <li key={index}>• {check}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Errores comunes */}
            {commonErrors.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h5 className="font-medium text-yellow-900 mb-2">⚠️ Errores Comunes a Evitar</h5>
                <ul className="text-yellow-800 text-sm space-y-1">
                  {commonErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Formulario de verificación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad Empacada
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.packed_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, packed_quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`${item.required_quantity} ${item.required_unit}`}
                />
              </div>

              {item.required_weight && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Peso Empacado (kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.packed_weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, packed_weight: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`${item.required_weight}kg`}
                  />
                </div>
              )}

              {availableFlavors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sabor Empacado
                  </label>
                  <select
                    value={formData.packed_flavor}
                    onChange={(e) => setFormData(prev => ({ ...prev, packed_flavor: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar sabor</option>
                    {availableFlavors.map((flavor) => (
                      <option key={flavor} value={flavor}>{flavor}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas de Verificación
                </label>
                <textarea
                  value={formData.verification_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, verification_notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`verified-${item.id}`}
                  checked={formData.is_verified}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_verified: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`verified-${item.id}`} className="ml-2 text-sm text-gray-900">
                  Item verificado y correcto
                </label>
              </div>
              
              <button
                onClick={handleSave}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Icons.Save className="w-4 h-4 mr-2" />
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para finalizar empaque
const CompletePackagingForm = ({ orderId, onComplete }) => {
  const [notes, setNotes] = useState('');
  const [qualityPassed, setQualityPassed] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = () => {
    if (showConfirm) {
      onComplete(notes, qualityPassed);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Finalizar Empaque
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Control de Calidad Final
          </label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={qualityPassed === true}
                onChange={() => setQualityPassed(true)}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-900">✅ Aprobado - Enviar a reparto</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={qualityPassed === false}
                onChange={() => setQualityPassed(false)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-900">❌ Requiere revisión</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas Finales del Empaque
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Observaciones generales del proceso de empaque..."
          />
        </div>

        {showConfirm && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <Icons.AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
              <h4 className="font-medium text-yellow-900">Confirmar Finalización</h4>
            </div>
            <p className="text-yellow-800 text-sm mt-2">
              {qualityPassed 
                ? '¿Estás seguro de que quieres marcar este empaque como completado y enviarlo a reparto?'
                : '¿Estás seguro de que quieres marcar este empaque como que requiere revisión?'
              }
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className={`px-4 py-2 border border-transparent rounded-md text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              qualityPassed
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            }`}
          >
            <Icons.CheckCircle className="w-4 h-4 mr-2 inline" />
            {showConfirm ? 'Confirmar' : 'Finalizar Empaque'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente de Validación Dual
const FastPackagingValidation = ({ checklist, onVerifyItem, onVerifyAll }) => {
  const [validationMode, setValidationMode] = useState('manual'); // 'manual' o 'barcode'
  const [globalNotes, setGlobalNotes] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanningActive, setScanningActive] = useState(false);

  const [itemCounters, setItemCounters] = useState({});

  const verifyItemQuick = (item, isCorrect, overrideCount = null) => {
    const requiredQty = Math.floor(parseFloat(item.required_quantity) || 0);
    
    // Si es cantidad > 1 y está marcando como correcto, verificar conteo
    if (requiredQty > 1 && isCorrect) {
      const currentCount = overrideCount !== null ? overrideCount : (itemCounters[item.id] || 0);
      if (currentCount !== requiredQty) {
        toast.error(`⚠️ Debe contar exactamente ${requiredQty} unidades. Actualmente: ${currentCount}`);
        return;
      }
    }

    const finalCount = overrideCount !== null ? overrideCount : (itemCounters[item.id] || 0);
    const itemData = {
      packed_quantity: requiredQty > 1 ? finalCount : item.required_quantity,
      packed_weight: item.required_weight || '',
      packed_flavor: item.required_flavor || '',
      packed_size: item.required_size || '',
      verification_notes: isCorrect ? `Verificado - ${requiredQty > 1 ? `Contadas ${finalCount} unidades` : 'Todo correcto'}` : 'Requiere atención',
      is_verified: isCorrect
    };
    onVerifyItem(item.id, itemData);
    
    // Limpiar contador después de verificar
    if (requiredQty > 1) {
      setItemCounters(prev => ({ ...prev, [item.id]: 0 }));
    }
  };

  const updateItemCounter = (itemId, increment) => {
    setItemCounters(prev => {
      const newCount = Math.max(0, (prev[itemId] || 0) + increment);
      return { ...prev, [itemId]: newCount };
    });
  };

  const resetItemCounter = (itemId) => {
    setItemCounters(prev => ({ ...prev, [itemId]: 0 }));
  };

  const handleBarcodeInput = (barcode) => {
    // Buscar el item que coincida con el código de barras
    const matchedItem = checklist.find(item => 
      item.product_code === barcode || 
      item.barcode === barcode ||
      item.item_name.toLowerCase().includes(barcode.toLowerCase())
    );

    if (matchedItem && !matchedItem.is_verified) {
      const requiredQty = Math.floor(parseFloat(matchedItem.required_quantity) || 0);
      
      if (requiredQty > 1) {
        // Para cantidades múltiples, incrementar el contador
        const currentCount = itemCounters[matchedItem.id] || 0;
        const newCount = currentCount + 1;
        
        // Actualizar el estado del contador
        setItemCounters(prev => ({ ...prev, [matchedItem.id]: newCount }));
        
        if (newCount === requiredQty) {
          // Si se completó el conteo, verificar automáticamente pasando el contador correcto
          verifyItemQuick(matchedItem, true, newCount);
          toast.success(`✅ ${matchedItem.item_name} - ${newCount}/${requiredQty} unidades completadas y verificado`);
        } else if (newCount < requiredQty) {
          toast.success(`📊 ${matchedItem.item_name} - ${newCount}/${requiredQty} unidades escaneadas`);
        } else {
          // Si se excede, mostrar advertencia pero no incrementar más allá del requerido
          setItemCounters(prev => ({ ...prev, [matchedItem.id]: requiredQty }));
          toast.error(`⚠️ ${matchedItem.item_name} - Ya se escanearon todas las ${requiredQty} unidades requeridas`);
        }
      } else {
        // Para cantidad única, verificar directamente
        verifyItemQuick(matchedItem, true);
        toast.success(`✅ ${matchedItem.item_name} verificado por código de barras`);
      }
      setBarcodeInput('');
    } else if (matchedItem && matchedItem.is_verified) {
      toast(`⚠️ ${matchedItem.item_name} ya está verificado`);
      setBarcodeInput('');
    } else {
      toast.error(`❌ Código ${barcode} no encontrado en este pedido`);
      setBarcodeInput('');
    }
  };

  const handleBarcodeKeyPress = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      handleBarcodeInput(barcodeInput.trim());
    }
  };

  const verifiedCount = checklist.filter(item => item.is_verified).length;
  const totalCount = checklist.length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">⚡ Validación de Empaque</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {verifiedCount}/{totalCount} verificados
          </span>
          <div className="w-16 h-2 bg-gray-200 rounded-full">
            <div 
              className="h-2 bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Selector de Modo de Validación */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-gray-900 mb-3">🔧 Modo de Validación</h4>
        <div className="flex space-x-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="validationMode"
              value="manual"
              checked={validationMode === 'manual'}
              onChange={(e) => setValidationMode(e.target.value)}
              className="mr-2 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex items-center">
              <Icons.Hand className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Manual Mejorada</span>
            </div>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="validationMode"
              value="barcode"
              checked={validationMode === 'barcode'}
              onChange={(e) => setValidationMode(e.target.value)}
              className="mr-2 text-purple-600 focus:ring-purple-500"
            />
            <div className="flex items-center">
              <Icons.Scan className="w-4 h-4 mr-2 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">Código de Barras</span>
            </div>
          </label>
        </div>
      </div>

      {/* Modo Manual Mejorado */}
      {validationMode === 'manual' && (
        <>
          {/* Botones de acción rápida */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-blue-900">🚀 Acciones Rápidas</h4>
              <div className="flex space-x-3">
                <button
                  onClick={onVerifyAll}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Icons.CheckCircle className="w-4 h-4 mr-2" />
                  Todo Correcto
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Notas Generales (opcional)
              </label>
              <input
                type="text"
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Todo en perfecto estado, sin observaciones..."
              />
            </div>
          </div>

          {/* Lista compacta de items - Alineación perfecta */}
          <div className="space-y-2">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  item.is_verified
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-blue-200'
                }`}
              >
                <div className="flex items-center justify-between h-12">
                  {/* Sección izquierda - Info del producto */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* Estado visual - ancho fijo */}
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {item.is_verified ? (
                        <Icons.CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                      )}
                    </div>
                    
                    {/* Cantidad - ancho fijo */}
                    <div className={`w-16 h-10 flex items-center justify-center text-lg font-bold rounded-lg flex-shrink-0 ${
                      item.is_verified 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-blue-200 text-blue-800'
                    }`}>
                      {Math.floor(parseFloat(item.required_quantity) || 0)}x
                    </div>
                    
                    {/* Nombre del producto */}
                    <div className="flex-1 min-w-0">
                      <h5 className={`font-semibold truncate text-sm leading-4 ${
                        item.is_verified ? 'text-green-800' : 'text-gray-900'
                      }`}>
                        {item.item_name}
                      </h5>
                        <div className="flex items-center space-x-3 text-xs text-gray-600 mt-1">
                          <span>📦 {item.required_unit}</span>
                          {item.required_weight && (
                            <span>⚖️ {item.required_weight}kg</span>
                          )}
                          {item.required_flavor && (
                            <span>🎨 {item.required_flavor}</span>
                          )}
                        </div>
                        {/* CÓDIGOS DEL PRODUCTO Y CÓDIGO DE BARRAS - SÚPER PROMINENTES Y VISIBLES */}
                        <div className="flex items-center space-x-3 mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300 shadow-md">
                          {item.product_code && (
                            <div className="bg-white border-3 border-blue-500 px-4 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
                              <div className="text-xs text-blue-600 font-extrabold uppercase tracking-widest mb-1">CÓDIGO PRODUCTO</div>
                              <div className="font-mono text-blue-900 font-black text-lg tracking-wider"># {item.product_code}</div>
                            </div>
                          )}
                          {item.barcode && (
                            <div className="bg-white border-3 border-gray-500 px-4 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
                              <div className="text-xs text-gray-600 font-extrabold uppercase tracking-widest mb-1">CÓDIGO DE BARRAS</div>
                              <div className="font-mono text-gray-900 font-black text-lg tracking-wider">📊 {item.barcode}</div>
                            </div>
                          )}
                          {!item.product_code && !item.barcode && (
                            <div className="bg-yellow-100 border-2 border-yellow-400 px-4 py-3 rounded-xl">
                              <div className="text-xs text-yellow-700 font-bold">⚠️ SIN CÓDIGOS DISPONIBLES</div>
                            </div>
                          )}
                        </div>
                    </div>
                  </div>

                  {/* Sección derecha - Controles alineados */}
                  <div className="flex items-center justify-end space-x-1 flex-shrink-0" style={{ minWidth: '280px' }}>
                    {!item.is_verified && (
                      <>
                        {/* Contador - ancho fijo cuando es necesario */}
                        <div className="w-32 flex justify-center">
                          {Math.floor(parseFloat(item.required_quantity) || 0) > 1 ? (
                            <div className="flex items-center bg-gray-100 rounded-lg p-1">
                              <button
                                onClick={() => updateItemCounter(item.id, -1)}
                                className="w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center transition-colors"
                              >
                                <Icons.Minus className="w-3 h-3" />
                              </button>
                              <div className="px-2 text-center min-w-[48px]">
                                <div className="text-sm font-bold text-gray-900">
                                  {itemCounters[item.id] || 0}
                                </div>
                                <div className="text-xs text-gray-500 leading-3">
                                  /{Math.floor(parseFloat(item.required_quantity) || 0)}
                                </div>
                              </div>
                              <button
                                onClick={() => updateItemCounter(item.id, 1)}
                                className="w-7 h-7 bg-green-500 hover:bg-green-600 text-white rounded flex items-center justify-center transition-colors"
                              >
                                <Icons.Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div /> // Espacio vacío para mantener alineación
                          )}
                        </div>

                        {/* Botones de acción - anchos fijos */}
                        <button
                          onClick={() => verifyItemQuick(item, true)}
                          className="w-12 h-8 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded flex items-center justify-center transition-colors"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => verifyItemQuick(item, false)}
                          className="w-12 h-8 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded flex items-center justify-center transition-colors"
                        >
                          ✗
                        </button>

                        {/* Reset - ancho fijo */}
                        <div className="w-8 h-8 flex items-center justify-center">
                          {Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                            <button
                              onClick={() => resetItemCounter(item.id)}
                              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                (itemCounters[item.id] || 0) > 0 
                                  ? 'text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100' 
                                  : 'text-transparent cursor-default'
                              }`}
                              title="Reset contador"
                              disabled={(itemCounters[item.id] || 0) === 0}
                            >
                              <Icons.RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {item.is_verified && (
                      <>
                        {/* Espacio para contador cuando verificado */}
                        <div className="w-32" />
                        
                        {/* Estado verificado */}
                        <div className="w-24 flex justify-center">
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            ✅ OK
                          </span>
                        </div>
                        
                        {/* Botón deshacer */}
                        <div className="w-8 h-8 flex items-center justify-center">
                          <button
                            onClick={() => verifyItemQuick(item, false)}
                            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-gray-100 transition-colors"
                            title="Desmarcar"
                          >
                            <Icons.RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modo Código de Barras */}
      {validationMode === 'barcode' && (
        <>
          {/* Scanner Interface */}
          <div className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-purple-900 flex items-center">
                <Icons.Scan className="w-5 h-5 mr-2" />
                Escáner de Código de Barras
              </h4>
              <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                scanningActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  scanningActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
                {scanningActive ? 'Escaneando...' : 'Inactivo'}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-purple-800 mb-2">
                  🔫 Escanea o ingresa el código de barras
                </label>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyPress={handleBarcodeKeyPress}
                    onFocus={() => setScanningActive(true)}
                    onBlur={() => setScanningActive(false)}
                    className="flex-1 px-4 py-3 border border-purple-300 rounded-md text-lg font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Escanea aquí o escribe el código..."
                    autoComplete="off"
                  />
                  <button
                    onClick={() => handleBarcodeInput(barcodeInput.trim())}
                    disabled={!barcodeInput.trim()}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors"
                  >
                    <Icons.Search className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h5 className="text-sm font-medium text-purple-800 mb-2">📋 Instrucciones:</h5>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Apunta la pistola al código de barras del producto</li>
                  <li>• El código se escaneará automáticamente</li>
                  <li>• También puedes escribir el código manualmente</li>
                  <li>• El sistema verificará automáticamente el producto correcto</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Lista Compacta de Items para Código de Barras */}
          <div className="space-y-1">
            <h5 className="font-medium text-gray-900 flex items-center mb-3">
              <Icons.List className="w-4 h-4 mr-2" />
              Productos del Pedido ({checklist.length} items)
            </h5>
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`p-2 rounded border transition-colors ${
                  item.is_verified
                    ? 'border-green-300 bg-green-50'
                    : 'border-purple-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Info del Producto - Compacta */}
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {/* Estado + Cantidad */}
                    <div className="flex items-center space-x-1">
                      {item.is_verified ? (
                        <Icons.CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <Icons.Scan className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      )}
                      <div className={`text-lg font-bold px-2 py-1 rounded text-white ${
                        item.is_verified ? 'bg-green-600' : 'bg-purple-600'
                      }`}>
                        {Math.floor(parseFloat(item.required_quantity) || 0)}x
                      </div>
                    </div>
                    
                    {/* Nombre del Producto */}
                    <div className="flex-1 min-w-0">
                      <h6 className="font-medium text-sm truncate">{item.item_name}</h6>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{item.required_unit}</span>
                        {item.required_weight && <span>⚖️{item.required_weight}kg</span>}
                        {item.required_flavor && <span>🎨{item.required_flavor}</span>}
                        {/* Códigos del producto - PROMINENTES Y VISIBLES */}
                        <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                          {item.product_code && (
                            <div className="bg-blue-100 px-2 py-1 rounded border border-blue-300">
                              <span className="text-xs text-blue-700 font-bold">CÓDIGO</span>
                              <div className="font-mono text-blue-900 font-bold text-sm"># {item.product_code}</div>
                            </div>
                          )}
                          {item.barcode && (
                            <div className="bg-gray-200 px-2 py-1 rounded border border-gray-400">
                              <span className="text-xs text-gray-700 font-bold">BARRAS</span>
                              <div className="font-mono text-gray-900 font-bold text-sm">📊 {item.barcode}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Controles - Compactos */}
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {!item.is_verified && (
                      <>
                        {/* Contador compacto para cantidades > 1 */}
                        {Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                          <div className="flex items-center bg-gray-100 rounded px-1">
                            <button
                              onClick={() => updateItemCounter(item.id, -1)}
                              className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded text-xs flex items-center justify-center"
                            >
                              <Icons.Minus className="w-3 h-3" />
                            </button>
                            <div className="px-2 text-center min-w-[40px]">
                              <div className="text-sm font-bold">{itemCounters[item.id] || 0}</div>
                              <div className="text-xs text-gray-500">/{Math.floor(parseFloat(item.required_quantity) || 0)}</div>
                            </div>
                            <button
                              onClick={() => updateItemCounter(item.id, 1)}
                              className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded text-xs flex items-center justify-center"
                            >
                              <Icons.Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Botones de verificación compactos */}
                        <button
                          onClick={() => verifyItemQuick(item, true)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded flex items-center"
                        >
                          <Icons.Check className="w-3 h-3 mr-1" />
                          ✓
                        </button>
                        <button
                          onClick={() => verifyItemQuick(item, false)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded flex items-center"
                        >
                          <Icons.X className="w-3 h-3 mr-1" />
                          ✗
                        </button>

                        {/* Reset compacto - siempre reserva espacio para productos múltiples */}
                        {Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                          <button
                            onClick={() => resetItemCounter(item.id)}
                            className={`p-1 transition-colors ${
                              (itemCounters[item.id] || 0) > 0 
                                ? 'text-gray-400 hover:text-gray-600 cursor-pointer' 
                                : 'text-transparent cursor-default'
                            }`}
                            title="Reset"
                            disabled={(itemCounters[item.id] || 0) === 0}
                          >
                            <Icons.RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}

                    {item.is_verified && (
                      <div className="flex items-center space-x-1">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          ✅ OK
                        </span>
                        <button
                          onClick={() => verifyItemQuick(item, false)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Deshacer"
                        >
                          <Icons.RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instrucción compacta solo para productos múltiples no verificados */}
                {!item.is_verified && Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                  <div className="mt-1 pt-1 border-t border-purple-100">
                    <div className="text-xs text-purple-600 flex items-center">
                      <Icons.Info className="w-3 h-3 mr-1 flex-shrink-0" />
                      Requiere {Math.floor(parseFloat(item.required_quantity) || 0)} unidades - escanea múltiples veces o usa contador
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Instrucciones generales compactas */}
            <div className="mt-3 bg-purple-50 p-3 rounded border border-purple-200">
              <div className="text-xs text-purple-800">
                <strong>💡 Instrucciones:</strong> Escanea productos o usa botones ✓/✗. Para cantidades múltiples usa el contador antes de verificar.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Resumen */}
      {verifiedCount === totalCount && totalCount > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <Icons.CheckCircle className="w-6 h-6 text-green-600 mr-3" />
            <div>
              <h4 className="font-medium text-green-900">¡Empaque Verificado!</h4>
              <p className="text-sm text-green-700 mt-1">
                Todos los items han sido verificados con {validationMode === 'barcode' ? 'código de barras' : 'validación manual'}. 
                Puedes proceder a finalizar el empaque.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagingPage;
