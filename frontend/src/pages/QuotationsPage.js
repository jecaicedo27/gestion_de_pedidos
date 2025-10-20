import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import CustomerSearchDropdown from '../components/CustomerSearchDropdown';
import { quotationService } from '../services/api';
import api from '../services/api';

const QuotationsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('create');
  const [loading, setLoading] = useState(false);
  
  // Estado para creación de cotizaciones
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [naturalLanguageOrder, setNaturalLanguageOrder] = useState('');
  const [processedOrder, setProcessedOrder] = useState(null);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [quotationItems, setQuotationItems] = useState([]);
  const [quotationNotes, setQuotationNotes] = useState('');
  
  // Estado para vista previa del JSON de SIIGO
  const [showSiigoPreview, setShowSiigoPreview] = useState(false);
  const [siigoJsonPreview, setSiigoJsonPreview] = useState(null);
  
  // Estado para listado de cotizaciones
  const [quotations, setQuotations] = useState([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (activeTab === 'list') {
      loadQuotations();
    }
    loadStats();
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const response = await api.get('/quotations/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const syncCustomersFromSiigo = async () => {
    setLoading(true);
    try {
      const response = await api.post('/quotations/customers/sync');
      toast.success(`${response.data.data.synchronized} clientes sincronizados desde SIIGO`);
      await loadStats();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Error sincronizando clientes');
    } finally {
      setLoading(false);
    }
  };

  const processNaturalLanguageOrder = async () => {
    if (!naturalLanguageOrder.trim()) {
      toast.error('Debe ingresar un pedido');
      return;
    }

    if (!selectedCustomer) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    setProcessingOrder(true);
    try {
      const response = await api.post('/quotations/process-natural-order', {
        customer_id: selectedCustomer.id,
        natural_language_order: naturalLanguageOrder,
        processing_type: 'text'
      });

      if (response.status === 200) {
        const data = response.data;
        setProcessedOrder(data.data);
        
        // Mapear los items de ChatGPT al formato esperado
        let mappedItems = [];
        
        // El backend ahora envía items ya procesados en structured_items
        if (data.data.structured_items && Array.isArray(data.data.structured_items)) {
          mappedItems = data.data.structured_items;
        } 
        // Fallback a chatgpt_response si existe
        else if (data.data.chatgpt_response) {
          // Si chatgpt_response es un array directo
          if (Array.isArray(data.data.chatgpt_response)) {
            mappedItems = data.data.chatgpt_response;
          }
        } 
        // Fallback a items si existe
        else if (data.data.items && Array.isArray(data.data.items)) {
          mappedItems = data.data.items;
        }
        
        // Asegurar que todos los items tengan el formato correcto
        mappedItems = mappedItems.map(item => ({
          product_code: item.product_code || item.codigo || '',
          product_name: item.product_name || item.nombre || '',
          quantity: parseInt(item.quantity || item.cantidad || 1),
          unit_price: parseFloat(item.unit_price || item.precio || 0),
          confidence_score: item.confidence_score || item.confidence || 0.9
        }));
        
        console.log('Items mapeados:', mappedItems);
        setQuotationItems(mappedItems);
        
        if (mappedItems.length > 0) {
          toast.success(`Pedido procesado: ${mappedItems.length} productos detectados`);
        } else {
          toast('⚠️ Pedido procesado pero no se detectaron productos', {
            icon: '⚠️',
            style: {
              background: '#FEF3C7',
              color: '#92400E',
            },
          });
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error procesando pedido');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error procesando pedido con ChatGPT');
    } finally {
      setProcessingOrder(false);
    }
  };

  const processImageOrder = async (imageFile) => {
    if (!selectedCustomer) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    setProcessingOrder(true);
    const formData = new FormData();
    formData.append('customer_id', selectedCustomer.id);
    formData.append('image', imageFile);
    formData.append('processing_type', 'image');

    try {
      const response = await api.post('/quotations/process-image-order', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setProcessedOrder(response.data.data);
      setQuotationItems(response.data.data.structured_items || []);
      toast.success('Imagen procesada correctamente por ChatGPT');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Error procesando imagen con ChatGPT');
    } finally {
      setProcessingOrder(false);
    }
  };

  const updateQuotationItem = (index, field, value) => {
    const updatedItems = [...quotationItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setQuotationItems(updatedItems);
  };

  const removeQuotationItem = (index) => {
    const updatedItems = quotationItems.filter((_, i) => i !== index);
    setQuotationItems(updatedItems);
  };

  const addQuotationItem = () => {
    setQuotationItems([...quotationItems, {
      product_code: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      confidence_score: 1.0
    }]);
  };

  // Auto-generar vista previa cuando cambian los items o el cliente
  useEffect(() => {
    if (selectedCustomer && quotationItems.length > 0) {
      generateSiigoJsonPreview();
    } else {
      setShowSiigoPreview(false);
      setSiigoJsonPreview(null);
    }
  }, [selectedCustomer, quotationItems, quotationNotes]);

  const generateSiigoJsonPreview = () => {
    if (!selectedCustomer || quotationItems.length === 0) {
      toast.error('Seleccione un cliente y agregue items para generar la vista previa');
      return;
    }

    // Calcular totales
    const subtotal = quotationItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price);
    }, 0);
    
    const tax = subtotal * 0.19; // IVA 19%
    const total = subtotal + tax;

    // Calcular fecha de vencimiento (30 días)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Generar estructura JSON siguiendo el formato de SiigoInvoiceService
    const siigoJson = {
      document: { 
        id: 5153 // FV-1 - Factura No Electrónica de Venta
      },
      date: new Date().toISOString().split('T')[0],
      customer: {
        identification: selectedCustomer.identification,
        identification_type: selectedCustomer.identification?.length > 10 ? 31 : 13, // NIT o CC
        branch_office: 0
      },
      cost_center: 235,
      seller: 629,
      observations: [
        quotationNotes,
        naturalLanguageOrder ? `Pedido original: ${naturalLanguageOrder.substring(0, 200)}` : '',
        'Factura generada automáticamente desde sistema interno usando ChatGPT.'
      ].filter(Boolean).join('\n\n').substring(0, 500),
      items: quotationItems.map((item, index) => {
        const productCode = item.product_code || 
          (item.product_name || `Producto ${index + 1}`)
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 10)
            .toUpperCase() + (index + 1).toString().padStart(2, '0');
        
        return {
          code: productCode,
          description: (item.product_name || `Producto ${index + 1}`).substring(0, 100),
          quantity: item.quantity,
          price: item.unit_price,
          discount: 0,
          taxes: [{
            id: 13156 // IVA 19%
          }]
        };
      }),
      payments: [{
        id: 8887, // Efectivo
        value: total,
        due_date: dueDate.toISOString().split('T')[0]
      }],
      additional_fields: {}
    };

    setSiigoJsonPreview(siigoJson);
    setShowSiigoPreview(true);
    toast.success('Vista previa del JSON generada exitosamente');
  };

  const createQuotation = async () => {
    if (!selectedCustomer) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    if (quotationItems.length === 0) {
      toast.error('Debe tener al menos un item en la cotización');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/quotations', {
        customer_id: selectedCustomer.id,
        notes: quotationNotes,
        items: quotationItems,
        chatgpt_processing_id: processedOrder?.processing_id
      });

      toast.success('Cotización creada exitosamente');
      
      // Limpiar formulario
      setSelectedCustomer(null);
      setCustomerSearch('');
      setNaturalLanguageOrder('');
      setProcessedOrder(null);
      setQuotationItems([]);
      setQuotationNotes('');
      
      // Cambiar a la pestaña de listado
      setActiveTab('list');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Error creando cotización');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (documentType) => {
    if (!selectedCustomer) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    if (quotationItems.length === 0) {
      toast.error('Debe tener al menos un item en la factura');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/quotations/create-invoice', {
        customer_id: selectedCustomer.id,
        items: quotationItems,
        notes: quotationNotes,
        document_type: documentType,
        natural_language_order: naturalLanguageOrder,
        chatgpt_processing_id: processedOrder?.processing_id
      });

      toast.success(`¡${documentType === 'FV-2' ? 'Factura electrónica' : 'Factura'} creada exitosamente en SIIGO! Número: ${response.data.data.siigo_invoice_number}`);
      
      // Mostrar información adicional si está disponible
      if (response.data.data.pdf_url) {
        toast.success('PDF de factura disponible en SIIGO', { duration: 6000 });
      }

      // Guardar datos técnicos para mostrar en UI
      if (response.data.data.siigo_request_data) {
        setProcessedOrder({
          ...response.data.data,
          showTechnicalDetails: true
        });
      }
      
      // Limpiar formulario
      setSelectedCustomer(null);
      setCustomerSearch('');
      setNaturalLanguageOrder('');
      setProcessedOrder(null);
      setQuotationItems([]);
      setQuotationNotes('');
      
      // Cambiar a la pestaña de listado y recargar
      setActiveTab('list');
      await loadStats();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || `Error creando factura ${documentType} en SIIGO`);
    } finally {
      setLoading(false);
    }
  };

  const createSiigoInvoiceWithChatGPT = async () => {
    if (!selectedCustomer) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    if (quotationItems.length === 0) {
      toast.error('Debe tener al menos un item en la factura');
      return;
    }

    setLoading(true);
    try {
      const data = await quotationService.createSiigoInvoiceWithChatGPT({
        customer_id: selectedCustomer.id,
        notes: quotationNotes,
        items: quotationItems,
        chatgpt_processing_id: processedOrder?.processing_id,
        natural_language_order: naturalLanguageOrder
      });

      toast.success(`¡Factura electrónica creada en SIIGO! Número: ${data.data.siigo_invoice_number || data.data.siigo_quotation_number}`);
      
      // Mostrar información adicional si está disponible
      if (data.data.siigo_urls && data.data.siigo_urls.pdf_url) {
        toast.success('PDF de factura disponible en SIIGO', { duration: 6000 });
      }
      
      // Mostrar estadísticas de ChatGPT si están disponibles
      if (data.data.chatgpt_stats) {
        const stats = data.data.chatgpt_stats;
        console.log('ChatGPT Stats:', stats);
      }

      // Guardar datos técnicos para mostrar en UI
      if (data.data.chatgpt_response || data.data.siigo_request_data) {
        setProcessedOrder({
          ...data.data,
          showTechnicalDetails: true
        });
      }
      
      // Limpiar formulario
      setSelectedCustomer(null);
      setCustomerSearch('');
      setNaturalLanguageOrder('');
      setProcessedOrder(null);
      setQuotationItems([]);
      setQuotationNotes('');
      
      // Cambiar a la pestaña de listado y recargar
      setActiveTab('list');
      await loadStats(); // Actualizar estadísticas
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Error creando factura directamente en SIIGO');
    } finally {
      setLoading(false);
    }
  };

  const generateSiigoQuotation = async (quotationId) => {
    setLoading(true);
    try {
      const response = await api.post(`/quotations/${quotationId}/generate-siigo`);
      toast.success(`Cotización generada en SIIGO con número: ${response.data.data.siigo_quotation_number}`);
      await loadQuotations();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Error generando cotización en SIIGO');
    } finally {
      setLoading(false);
    }
  };

  const loadQuotations = async () => {
    setQuotationsLoading(true);
    try {
      const response = await api.get('/quotations');
      setQuotations(response.data.data);
    } catch (error) {
      console.error('Error cargando cotizaciones:', error);
      toast.error('Error cargando cotizaciones');
    } finally {
      setQuotationsLoading(false);
    }
  };

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icons.FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Cotizaciones Creadas</p>
            <p className="text-2xl font-semibold">{stats.total_quotations || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <Icons.CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Generadas en SIIGO</p>
            <p className="text-2xl font-semibold">{stats.generated_in_siigo || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Icons.Users className="w-6 h-6 text-purple-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Clientes Sincronizados</p>
            <p className="text-2xl font-semibold">{stats.total_customers || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Icons.Brain className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Procesadas por ChatGPT</p>
            <p className="text-2xl font-semibold">{stats.chatgpt_processed || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCreateQuotation = () => (
    <div className="space-y-6">
      {/* Selección de Cliente */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Icons.Users className="w-5 h-5 mr-2" />
          Seleccionar Cliente
        </h3>
        
        <CustomerSearchDropdown
          value={customerSearch}
          onChange={setCustomerSearch}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          placeholder="Buscar cliente por nombre o documento..."
          showSyncButton={true}
          onSync={syncCustomersFromSiigo}
          syncLoading={loading}
        />
      </div>

      {/* Entrada de Pedido */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Icons.MessageSquare className="w-5 h-5 mr-2" />
          Ingreso de Pedido
        </h3>

        {/* Pestañas para Texto vs Imagen */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => {/* Lógica para cambiar modo */}}
              className="py-2 px-1 border-b-2 border-blue-500 text-blue-600 font-medium text-sm"
            >
              <Icons.Type className="w-4 h-4 inline mr-2" />
              Texto
            </button>
            <button
              onClick={() => {/* Lógica para cambiar modo */}}
              className="py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm"
            >
              <Icons.Image className="w-4 h-4 inline mr-2" />
              Imagen
            </button>
          </nav>
        </div>

        {/* Entrada de Texto */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pedido en Lenguaje Natural
            </label>
            <textarea
              value={naturalLanguageOrder}
              onChange={(e) => setNaturalLanguageOrder(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ejemplo: Necesito 10 cajas de Liquipops sabor maracuyá, 5 Skarcha limón de 250g y 2 PITILLOS especiales..."
            />
          </div>

          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-900 mb-2 flex items-center">
              <Icons.Lightbulb className="w-4 h-4 mr-2" />
              Ejemplos de Pedidos en Lenguaje Natural:
            </h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• "Quiero 5 cajas de Liquipops maracuyá y 3 de cereza"</li>
              <li>• "Necesito 10 Skarcha limón de 250 gramos"</li>
              <li>• "Dame 2 PITILLOS especiales de 10mm"</li>
              <li>• "10 unidades de VASO GOLD de 16 oz"</li>
            </ul>
          </div>

          <button
            onClick={processNaturalLanguageOrder}
            disabled={processingOrder || !naturalLanguageOrder.trim() || !selectedCustomer}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
          >
            {processingOrder ? (
              <>
                <Icons.Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Procesando con ChatGPT...
              </>
            ) : (
              <>
                <Icons.Brain className="w-5 h-5 mr-2" />
                Procesar con ChatGPT
              </>
            )}
          </button>
        </div>
      </div>

      {/* Resultado Procesado */}
      {processedOrder && (
        <>
          {/* Cuadro de Resultado de ChatGPT - DESTACADO */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400 rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Icons.Brain className="w-5 h-5 mr-2 text-green-600 animate-pulse" />
              🤖 Resultado de Procesamiento ChatGPT
            </h3>
            
            <div className="space-y-4">
              {/* Respuesta Raw de ChatGPT - Cuadro Principal */}
              <div className="bg-white rounded-lg shadow-inner p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-800 flex items-center">
                    <Icons.Code className="w-4 h-4 mr-2 text-blue-600" />
                    RESPUESTA COMPLETA DE CHATGPT:
                  </label>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    JSON Response
                  </span>
                </div>
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-auto max-h-96">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(processedOrder, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Interpretación Resumida */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                    <Icons.Package className="w-4 h-4 mr-2" />
                    Productos Detectados
                  </h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {processedOrder.structured_items?.length || 0}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Items procesados exitosamente
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center">
                    <Icons.TrendingUp className="w-4 h-4 mr-2" />
                    Confianza Promedio
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round((processedOrder.average_confidence || 0) * 100)}%
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Nivel de certeza en el procesamiento
                  </p>
                </div>
              </div>

              {/* Detalles del Procesamiento */}
              {processedOrder.processing_notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-900 mb-2 flex items-center">
                    <Icons.Info className="w-4 h-4 mr-2" />
                    Notas del Procesamiento
                  </h4>
                  <p className="text-sm text-yellow-800">
                    {processedOrder.processing_notes}
                  </p>
                </div>
              )}

              {/* Texto Original Procesado */}
              {processedOrder.original_text && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texto Original Procesado:
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 italic">
                      "{processedOrder.original_text}"
                    </p>
                  </div>
                </div>
              )}

              {/* Items Estructurados */}
              {processedOrder.structured_items && processedOrder.structured_items.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Items Estructurados Detectados:
                  </label>
                  <div className="space-y-2">
                    {processedOrder.structured_items.map((item, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">
                              {item.product_name || 'Producto sin nombre'}
                            </span>
                            {item.product_code && (
                              <span className="ml-2 text-sm text-gray-500">
                                (Código: {item.product_code})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600">
                              Cantidad: <strong>{item.quantity}</strong>
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              item.confidence_score >= 0.8 
                                ? 'bg-green-100 text-green-800' 
                                : item.confidence_score >= 0.6 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {Math.round(item.confidence_score * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nueva sección: Petición a SIIGO */}
              {processedOrder.showTechnicalDetails && processedOrder.siigo_request_data && (
                <>
                  <div className="border-t border-gray-300 mt-6 pt-6">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-400 rounded-lg shadow-lg p-4 mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Icons.Send className="w-5 h-5 mr-2 text-blue-600 animate-pulse" />
                        🎯 Petición JSON Enviada a SIIGO
                      </h4>
                      
                      {/* Petición Raw a SIIGO */}
                      <div className="bg-white rounded-lg shadow-inner p-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-bold text-gray-800 flex items-center">
                            <Icons.Database className="w-4 h-4 mr-2 text-blue-600" />
                            DATOS ENVIADOS A SIIGO API:
                          </label>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Invoice Request
                          </span>
                        </div>
                        <div className="bg-gray-900 text-blue-400 rounded-lg p-4 overflow-auto max-h-96">
                          <pre className="text-xs font-mono">
                            {JSON.stringify(processedOrder.siigo_request_data, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {/* Resumen de la petición a SIIGO */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <h5 className="font-medium text-purple-900 mb-2 flex items-center">
                            <Icons.FileText className="w-4 h-4 mr-2" />
                            Documento SIIGO
                          </h5>
                          <p className="text-sm text-purple-700">
                            ID: {processedOrder.siigo_request_data?.document?.id || 'N/A'}
                          </p>
                          <p className="text-sm text-purple-700">
                            Fecha: {processedOrder.siigo_request_data?.date || 'N/A'}
                          </p>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h5 className="font-medium text-green-900 mb-2 flex items-center">
                            <Icons.DollarSign className="w-4 h-4 mr-2" />
                            Valor Total
                          </h5>
                          <p className="text-lg font-bold text-green-600">
                            ${processedOrder.siigo_request_data?.payments?.[0]?.value?.toLocaleString() || '0'}
                          </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h5 className="font-medium text-blue-900 mb-2 flex items-center">
                            <Icons.Package className="w-4 h-4 mr-2" />
                            Items Facturados
                          </h5>
                          <p className="text-2xl font-bold text-blue-600">
                            {processedOrder.siigo_request_data?.items?.length || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Respuesta de SIIGO (si existe) */}
              {processedOrder.showTechnicalDetails && processedOrder.siigo_response && (
                <div className="border-t border-gray-300 mt-6 pt-6">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg shadow-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Icons.CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                      ✅ Respuesta de SIIGO API
                    </h4>
                    
                    {/* Respuesta Raw de SIIGO */}
                    <div className="bg-white rounded-lg shadow-inner p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-gray-800 flex items-center">
                          <Icons.Server className="w-4 h-4 mr-2 text-green-600" />
                          RESPUESTA COMPLETA DE SIIGO:
                        </label>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          API Response
                        </span>
                      </div>
                      <div className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-auto max-h-96">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(processedOrder.siigo_response, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Resumen del resultado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <h5 className="font-medium text-emerald-900 mb-2 flex items-center">
                          <Icons.Hash className="w-4 h-4 mr-2" />
                          Factura Creada
                        </h5>
                        <p className="text-lg font-bold text-emerald-600">
                          {processedOrder.siigo_invoice_number || processedOrder.siigo_response?.name || 'N/A'}
                        </p>
                        <p className="text-sm text-emerald-700 mt-1">
                          ID: {processedOrder.siigo_invoice_id || processedOrder.siigo_response?.id || 'N/A'}
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="font-medium text-blue-900 mb-2 flex items-center">
                          <Icons.ExternalLink className="w-4 h-4 mr-2" />
                          Estado
                        </h5>
                        <p className="text-sm text-blue-700">
                          {processedOrder.siigo_response?.status || 'Creada exitosamente'}
                        </p>
                        {processedOrder.siigo_public_url && (
                          <a 
                            href={processedOrder.siigo_public_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            Ver en SIIGO ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <QuotationItemsEditor
            items={quotationItems}
            onUpdateItem={updateQuotationItem}
            onRemoveItem={removeQuotationItem}
            onAddItem={addQuotationItem}
            processing={processedOrder}
          />
        </>
      )}

      {/* Finalizar Cotización */}
      {quotationItems.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Icons.FileText className="w-5 h-5 mr-2" />
            Finalizar Cotización
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas Adicionales
              </label>
              <textarea
                value={quotationNotes}
                onChange={(e) => setQuotationNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notas adicionales para la cotización..."
              />
            </div>

            {/* Botón para Vista Previa del JSON */}
            <div className="mb-4">
              <button
                onClick={generateSiigoJsonPreview}
                disabled={!selectedCustomer || quotationItems.length === 0}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300"
              >
                <Icons.Eye className="w-4 h-4 mr-2" />
                Ver JSON que se enviará a SIIGO
              </button>
            </div>

            {/* Cuadro Rojo - Vista Previa de Datos para SIIGO */}
            {showSiigoPreview && siigoJsonPreview && (
              <div className="mb-6 border-4 border-red-500 bg-red-50 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-red-900 flex items-center">
                    <Icons.AlertTriangle className="w-5 h-5 mr-2" />
                    🎯 DATOS QUE SE ENVIARÁN AL API DE SIIGO
                  </h4>
                  <button
                    onClick={() => setShowSiigoPreview(false)}
                    className="text-red-700 hover:text-red-900"
                  >
                    <Icons.X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* 1. DOCUMENTO DE FACTURA */}
                  <div className="bg-white border-2 border-red-300 rounded-lg p-4">
                    <h5 className="font-bold text-red-900 mb-3 flex items-center">
                      <Icons.FileText className="w-5 h-5 mr-2" />
                      📋 TIPO DE DOCUMENTO
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                        <p className="text-red-800 font-semibold">Tipo:</p>
                        <p className="text-red-900 font-bold text-lg">FV-1</p>
                        <p className="text-red-600 text-sm">Factura No Electrónica</p>
                      </div>
                      <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                        <p className="text-red-800 font-semibold">ID en SIIGO:</p>
                        <p className="text-red-900 font-bold text-lg">{siigoJsonPreview.document.id}</p>
                        <p className="text-red-600 text-sm">Identificador interno</p>
                      </div>
                      <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                        <p className="text-red-800 font-semibold">Fecha:</p>
                        <p className="text-red-900 font-bold text-lg">{siigoJsonPreview.date}</p>
                        <p className="text-red-600 text-sm">Fecha de emisión</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. DATOS DEL CLIENTE */}
                  <div className="bg-white border-2 border-red-300 rounded-lg p-4">
                    <h5 className="font-bold text-red-900 mb-3 flex items-center">
                      <Icons.User className="w-5 h-5 mr-2" />
                      👤 CLIENTE
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-blue-800 font-semibold">Nombre:</p>
                        <p className="text-blue-900 font-bold">{selectedCustomer?.name || 'N/A'}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-blue-800 font-semibold">Documento:</p>
                        <p className="text-blue-900 font-bold text-lg">
                          {siigoJsonPreview.customer.identification || selectedCustomer?.identification || 'Sin documento'}
                        </p>
                        <p className="text-blue-600 text-sm">
                          Tipo: {siigoJsonPreview.customer.identification_type === 31 ? 'NIT' : 'Cédula'}
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-blue-800 font-semibold">Sucursal:</p>
                        <p className="text-blue-900 font-bold">{siigoJsonPreview.customer.branch_office}</p>
                        <p className="text-blue-600 text-sm">Principal</p>
                      </div>
                    </div>
                  </div>

                  {/* 3. ITEMS DE LA FACTURA */}
                  <div className="bg-white border-2 border-red-300 rounded-lg p-4">
                    <h5 className="font-bold text-red-900 mb-3 flex items-center">
                      <Icons.Package className="w-5 h-5 mr-2" />
                      📦 PRODUCTOS ({siigoJsonPreview.items.length})
                    </h5>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {siigoJsonPreview.items.map((item, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div>
                              <p className="text-green-700 font-semibold text-xs">CÓDIGO</p>
                              <p className="text-green-900 font-bold text-sm">{item.code}</p>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-green-700 font-semibold text-xs">DESCRIPCIÓN</p>
                              <p className="text-green-900 font-bold text-sm">{item.description}</p>
                            </div>
                            <div>
                              <p className="text-green-700 font-semibold text-xs">CANTIDAD</p>
                              <p className="text-green-900 font-bold text-sm">{item.quantity}</p>
                            </div>
                            <div>
                              <p className="text-green-700 font-semibold text-xs">PRECIO UNIT.</p>
                              <p className="text-green-900 font-bold text-sm">${item.price.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-green-300">
                            <p className="text-green-600 text-xs">
                              <strong>Subtotal:</strong> ${(item.quantity * item.price).toLocaleString()} | 
                              <strong> Descuento:</strong> ${item.discount} | 
                              <strong> IVA ID:</strong> {item.taxes[0].id}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. CONFIGURACIÓN DE FACTURACIÓN */}
                  <div className="bg-white border-2 border-red-300 rounded-lg p-4">
                    <h5 className="font-bold text-red-900 mb-3 flex items-center">
                      <Icons.Settings className="w-5 h-5 mr-2" />
                      ⚙️ CONFIGURACIÓN
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-purple-800 font-semibold">Centro de Costos:</p>
                        <p className="text-purple-900 font-bold text-lg">{siigoJsonPreview.cost_center}</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-purple-800 font-semibold">Vendedor ID:</p>
                        <p className="text-purple-900 font-bold text-lg">{siigoJsonPreview.seller}</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-purple-800 font-semibold">Método de Pago ID:</p>
                        <p className="text-purple-900 font-bold text-lg">{siigoJsonPreview.payments[0].id}</p>
                        <p className="text-purple-600 text-sm">Efectivo</p>
                      </div>
                    </div>
                  </div>

                  {/* 5. TOTALES Y PAGOS */}
                  <div className="bg-white border-2 border-red-300 rounded-lg p-4">
                    <h5 className="font-bold text-red-900 mb-3 flex items-center">
                      <Icons.DollarSign className="w-5 h-5 mr-2" />
                      💰 TOTALES Y PAGOS
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-yellow-800 font-semibold">Valor Total:</p>
                        <p className="text-yellow-900 font-bold text-2xl">${siigoJsonPreview.payments[0].value.toLocaleString()}</p>
                        <p className="text-yellow-600 text-sm">Incluye IVA 19%</p>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-yellow-800 font-semibold">Fecha de Vencimiento:</p>
                        <p className="text-yellow-900 font-bold">{siigoJsonPreview.payments[0].due_date}</p>
                        <p className="text-yellow-600 text-sm">30 días</p>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-yellow-800 font-semibold">Estado:</p>
                        <p className="text-yellow-900 font-bold">LISTO PARA ENVÍO</p>
                        <p className="text-yellow-600 text-sm">Factura No Electrónica</p>
                      </div>
                    </div>
                  </div>

                  {/* 6. OBSERVACIONES */}
                  {siigoJsonPreview.observations && (
                    <div className="bg-white border-2 border-red-300 rounded-lg p-4">
                      <h5 className="font-bold text-red-900 mb-3 flex items-center">
                        <Icons.MessageSquare className="w-5 h-5 mr-2" />
                        📝 OBSERVACIONES
                      </h5>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{siigoJsonPreview.observations}</p>
                      </div>
                    </div>
                  )}

                  {/* JSON Completo (Colapsable) */}
                  <div className="bg-white rounded-lg shadow-inner border-2 border-gray-300 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-bold text-gray-800 flex items-center">
                        <Icons.Code className="w-4 h-4 mr-2" />
                        JSON TÉCNICO PARA DESARROLLADORES
                      </label>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                          Technical Details
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(siigoJsonPreview, null, 2));
                            toast.success('JSON copiado al portapapeles');
                          }}
                          className="text-gray-600 hover:text-gray-800"
                          title="Copiar JSON"
                        >
                          <Icons.Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 mb-2">
                        Click para ver/ocultar JSON técnico
                      </summary>
                      <div className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-auto max-h-60 border border-gray-400">
                        <pre className="text-xs font-mono leading-relaxed">
                          {JSON.stringify(siigoJsonPreview, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-red-300">
                    <button
                      onClick={() => setShowSiigoPreview(false)}
                      className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50"
                    >
                      Cerrar Vista Previa
                    </button>
                    <button
                      onClick={() => {
                        generateSiigoJsonPreview();
                        toast.info('Datos actualizados con la información más reciente');
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      <Icons.RefreshCw className="w-4 h-4 inline mr-1" />
                      Actualizar Datos
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <div className="flex space-x-3">
                <button
                  onClick={() => handleCreateInvoice('FV-1')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Icons.FileText className="h-4 w-4 mr-2" />
                  )}
                  Crear Factura FV-1
                </button>
                <button
                  onClick={() => handleCreateInvoice('FV-2')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Icons.FileText className="h-4 w-4 mr-2" />
                  )}
                  Crear Factura FV-2
                </button>
              </div>
              <button
                onClick={createQuotation}
                disabled={loading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              >
                {loading ? (
                  <>
                    <Icons.Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Icons.Save className="w-5 h-5 mr-2" />
                    Crear Cotización
                  </>
                )}
              </button>
              <button
                onClick={createSiigoInvoiceWithChatGPT}
                disabled={loading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
              >
                {loading ? (
                  <>
                    <Icons.Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creando Factura en SIIGO...
                  </>
                ) : (
                  <>
                    <Icons.Database className="w-5 h-5 mr-2" />
                    Crear Factura Directamente en SIIGO
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderQuotationsList = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Cotizaciones Creadas</h3>
          <button
            onClick={loadQuotations}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Icons.RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
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
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotations.map((quotation) => (
              <tr key={quotation.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {quotation.customer_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {quotation.customer_document}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{quotation.items_count} items</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    ${quotation.total_amount?.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    quotation.siigo_quotation_number 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {quotation.siigo_quotation_number ? 'En SIIGO' : 'Borrador'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(quotation.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    {!quotation.siigo_quotation_number && (
                      <button
                        onClick={() => generateSiigoQuotation(quotation.id)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                      >
                        <Icons.Send className="w-3 h-3 mr-1" />
                        Enviar a SIIGO
                      </button>
                    )}
                    <button
                      onClick={() => {/* Ver detalles */}}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 hover:bg-gray-50"
                    >
                      <Icons.Eye className="w-3 h-3 mr-1" />
                      Ver
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {quotations.length === 0 && !quotationsLoading && (
          <div className="text-center py-12">
            <Icons.FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay cotizaciones</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comienza creando tu primera cotización con ChatGPT
            </p>
          </div>
        )}
        
        {quotationsLoading && (
          <div className="text-center py-12">
            <Icons.Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-2 text-sm text-gray-600">Cargando cotizaciones...</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Cotizaciones</h1>
          <p className="mt-2 text-gray-600">
            Crea cotizaciones rápidas usando ChatGPT para procesar pedidos en lenguaje natural
          </p>
        </div>

        {/* Estadísticas */}
        {renderStats()}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('create')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icons.Plus className="w-5 h-5 inline mr-2" />
              Crear Cotización
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icons.FileText className="w-5 h-5 inline mr-2" />
              Cotizaciones
            </button>
          </nav>
        </div>

        {/* Contenido */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Icons.Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Procesando...</span>
          </div>
        )}
        
        {!loading && (
          <>
            {activeTab === 'create' && renderCreateQuotation()}
            {activeTab === 'list' && renderQuotationsList()}
          </>
        )}
      </div>
    </div>
  );
};

// Componente para editar items de la cotización
const QuotationItemsEditor = ({ items, onUpdateItem, onRemoveItem, onAddItem, processing }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Icons.Edit className="w-5 h-5 mr-2" />
        Revisar y Editar Cotización
      </h3>

      {/* Información del procesamiento */}
      {processing && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center mb-2">
            <Icons.Brain className="w-5 h-5 text-green-600 mr-2" />
            <h4 className="font-medium text-green-900">Procesado por ChatGPT</h4>
          </div>
          <div className="text-sm text-green-800 space-y-1">
            <p><strong>Confianza promedio:</strong> {Math.round(processing.average_confidence * 100)}%</p>
            <p><strong>Productos encontrados:</strong> {processing.structured_items?.length || 0}</p>
            {processing.processing_notes && (
              <p><strong>Notas:</strong> {processing.processing_notes}</p>
            )}
          </div>
        </div>
      )}

      {/* Lista de items */}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-500">Item #{index + 1}</span>
                {item.confidence_score && (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.confidence_score >= 0.8 
                      ? 'bg-green-100 text-green-800' 
                      : item.confidence_score >= 0.6 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    {Math.round(item.confidence_score * 100)}% confianza
                  </span>
                )}
              </div>
              <button
                onClick={() => onRemoveItem(index)}
                className="text-red-600 hover:text-red-800"
              >
                <Icons.Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código del Producto
                </label>
                <input
                  type="text"
                  value={item.product_code || ''}
                  onChange={(e) => onUpdateItem(index, 'product_code', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: LIQUIPP01"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  value={item.product_name || ''}
                  onChange={(e) => onUpdateItem(index, 'product_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre completo del producto"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity || 1}
                  onChange={(e) => onUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio Unitario
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price || 0}
                  onChange={(e) => onUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total
                </label>
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 font-medium">
                  ${((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Botón para agregar item */}
        <button
          onClick={onAddItem}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <div className="flex items-center justify-center text-gray-600">
            <Icons.Plus className="w-5 h-5 mr-2" />
            Agregar Producto
          </div>
        </button>
      </div>

      {/* Resumen */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-900">Total de la Cotización:</span>
          <span className="text-2xl font-bold text-blue-600">
            ${items.reduce((total, item) => total + ((item.quantity || 0) * (item.unit_price || 0)), 0).toLocaleString()}
          </span>
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {items.length} producto{items.length !== 1 ? 's' : ''} • {items.reduce((total, item) => total + (item.quantity || 0), 0)} unidades
        </div>
      </div>
    </div>
  );
};

export default QuotationsPage;
