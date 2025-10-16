import React, { useState, useEffect } from 'react';
import { 
  Package2, 
  Search, 
  ShoppingCart, 
  Plus,
  Minus,
  User,
  Receipt,
  X,
  Eye,
  Filter,
  RefreshCw,
  FileText,
  Code
} from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerSearchDropdown from '../components/CustomerSearchDropdown';
import api from '../services/api';

const InventoryBillingPage = () => {
  const [products, setProducts] = useState([]);
  const [groupedProducts, setGroupedProducts] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([
    'GENIALITY',
    'LIQUIPOPS', 
    'MEZCLAS EN POLVO',
    'Productos No fabricados 19%',
    'YEXIS'
  ]);
  const [categories, setCategories] = useState([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // Estado del carrito de facturación
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchValue, setCustomerSearchValue] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [processingInvoice, setProcessingInvoice] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);

  // Estados para organización de inventario
  const [presentations, setPresentations] = useState([]);
  const [flavors, setFlavors] = useState([]);
  
  // Estado para sincronización de inventario desde SIIGO
  const [syncingInventory, setSyncingInventory] = useState(false);

  // Estado para stock temporal (stock real - cantidad en carrito)
  const [temporaryStock, setTemporaryStock] = useState({});

  // Cargar productos del inventario - USANDO ENDPOINT FILTRADO PARA PRODUCTOS ACTIVOS ÚNICAMENTE
  const loadInventoryProducts = async () => {
    setLoading(true);
    try {
      // CAMBIADO: Usar el endpoint filtrado que excluye productos inactivos
      const response = await api.get('/inventory/grouped');
      const data = response.data;

      if (data.success) {
        // Verificar que no hay productos inactivos en la respuesta
        const activeProducts = data.data.filter(product => product.is_active === 1);
        console.log(`📦 Productos cargados: ${data.data.length} total, ${activeProducts.length} activos`);
        
        if (activeProducts.length !== data.data.length) {
          console.warn('⚠️ ADVERTENCIA: Se encontraron productos inactivos en la respuesta filtrada');
        }
        
        setProducts(activeProducts);
        organizeProductsForInventory(activeProducts);
        
        // 🔄 REEMPLAZADO: Cargar categorías desde SIIGO en tiempo real (no desde productos locales)
        await loadCategoriesFromSiigo();
        
        // Mantener la extracción de presentaciones y sabores de productos locales
        const pres = [...new Set(activeProducts.map(p => extractPresentation(p.product_name)))];
        const flvs = [...new Set(activeProducts.map(p => extractFlavor(p.product_name)))];
        setPresentations(pres.sort());
        setFlavors(flvs.sort());
      } else {
        toast.error('Error cargando inventario: ' + data.message);
      }
    } catch (error) {
      console.error('Error cargando inventario:', error);
      toast.error('Error cargando inventario');
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Nueva función para cargar categorías directamente desde SIIGO (NO hardcodeadas)
  const loadCategoriesFromSiigo = async () => {
    try {
      console.log('🔄 Cargando categorías en tiempo real desde SIIGO...');
      const response = await api.get('/siigo-categories/live');
      
      if (response.data.success) {
        const siigoCategories = response.data.data; // FIX: Cambiar de .categories a .data
        console.log('✅ Categorías cargadas desde SIIGO:', siigoCategories);
        setCategories(siigoCategories);
        
        toast.success(`📊 ${siigoCategories.length} categorías cargadas desde SIIGO`, {
          duration: 3000,
          icon: '🔄'
        });
      } else {
        console.warn('⚠️ Error cargando categorías desde SIIGO, usando fallback local');
        await loadCategoriesFromLocal();
      }
    } catch (error) {
      console.error('❌ Error conectando con SIIGO para categorías:', error);
      console.log('🔄 Intentando cargar categorías desde base de datos local...');
      await loadCategoriesFromLocal();
    }
  };

  // 🆕 Función de fallback para categorías locales cuando SIIGO no está disponible
  const loadCategoriesFromLocal = async () => {
    try {
      const response = await api.get('/siigo-categories/local');
      
      // Handle both response formats - object with success/data or simple array
      let localCategories = [];
      
      if (Array.isArray(response.data)) {
        // Simple array format
        localCategories = response.data;
        console.log('✅ Categorías cargadas desde base de datos local (formato simple):', localCategories);
      } else if (response.data.success && response.data.data) {
        // Complex object format
        localCategories = response.data.data;
        console.log('✅ Categorías cargadas desde base de datos local (formato complejo):', localCategories);
      } else {
        console.error('❌ Formato de respuesta inesperado:', response.data);
        setCategories([]);
        toast.error('Formato de respuesta incorrecto');
        return;
      }
      
      setCategories(localCategories);
      
      toast('📂 Categorías cargadas desde base de datos local', {
        icon: '📂',
        duration: 3000
      });
      
    } catch (error) {
      console.error('❌ Error fatal cargando categorías:', error);
      setCategories([]);
      toast.error('Error conectando para cargar categorías');
    }
  };

  // Organizar productos en formato tabla como la imagen
  const organizeProductsForInventory = (products) => {
    const grouped = {};
    const stockMap = {};
    
    products.forEach(product => {
      if (!product.category || !product.product_name) return;
      
      // Extraer presentación y sabor del nombre del producto
      const presentation = extractPresentation(product.product_name);
      const flavor = extractFlavor(product.product_name);
      
      if (!grouped[product.category]) {
        grouped[product.category] = {};
      }
      
      if (!grouped[product.category][presentation]) {
        grouped[product.category][presentation] = {};
      }
      
      const realStock = product.available_quantity || product.stock || 0;
      
      grouped[product.category][presentation][flavor] = {
        ...product,
        stock: realStock, // Stock real de SIIGO
        realStock: realStock, // Guardar stock original
        presentation,
        flavor
      };

      // Crear mapa de stock temporal
      stockMap[product.id] = realStock;
    });
    
    setGroupedProducts(grouped);
    setTemporaryStock(stockMap);
  };

  // Extraer presentación del nombre del producto basado en patrones reales
  const extractPresentation = (productName) => {
    // Normalizar espacios y unidades
    const normalized = productName.toUpperCase().replace(/\s+/g, ' ');
    
    // Patrones específicos encontrados en la base de datos
    const match = normalized.match(/X\s*(\d+(?:\.\d+)?)\s*(?:GR?|ML|KG|L|G)\b/i);
    
    if (match) {
      let value = match[1];
      let unit = 'G'; // Por defecto gramos
      
      // Determinar unidad basada en el contexto del producto
      if (normalized.includes('ML') || normalized.includes('SIROPE') || normalized.includes('LIQUIDO')) {
        unit = 'ML';
      }
      
      // Formatear presentaciones comunes encontradas
      if (value === '250') return '250G';
      if (value === '330') return '330G';
      if (value === '350') return '350G';
      if (value === '360') return '360ML';
      if (value === '500') return unit === 'ML' ? '500ML' : '500G';
      if (value === '1000') return '1000ML';
      if (value === '1100') return '1100G';
      if (value === '1150') return '1150G';
      if (value === '2300') return '2300G';
      if (value === '3400') return '3400G';
      
      return `${value}${unit}`;
    }
    
    return 'STANDARD';
  };

  // Extraer sabor del nombre del producto
  const extractFlavor = (productName) => {
    // Lista de sabores comunes
    const commonFlavors = [
      'BLUEBERRY', 'CAFE', 'CEREZA', 'CHAMOY', 'CHICLE', 'COCO', 'FRESA',
      'ICE PINK', 'LYCHE', 'MANGO BICHE', 'MANGO BICHE CON SAL', 'MANZANA VERDE',
      'MARACUYA', 'SANDIA'
    ];
    
    const upperName = productName.toUpperCase();
    
    for (const flavor of commonFlavors) {
      if (upperName.includes(flavor)) {
        return flavor;
      }
    }
    
    // Si no encuentra sabor específico, usar parte del nombre
    const parts = productName.split(' ');
    return parts[parts.length - 1] || 'CLASICO';
  };

  // Extraer categorías y presentaciones únicas
  const extractCategoriesAndPresentations = (products) => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    const pres = [...new Set(products.map(p => extractPresentation(p.product_name)))];
    const flvs = [...new Set(products.map(p => extractFlavor(p.product_name)))];
    
    setCategories(cats);
    setPresentations(pres.sort());
    setFlavors(flvs.sort());
  };

  // Calcular stock disponible (stock real - cantidad en carrito)
  const getAvailableStock = (productId) => {
    const realStock = temporaryStock[productId] || 0;
    const cartItem = cart.find(item => item.id === productId);
    const cartQuantity = cartItem ? cartItem.quantity : 0;
    return Math.max(0, realStock - cartQuantity);
  };

  // Agregar producto al carrito con validación de stock
  const addToCart = (product, quantity = 1) => {
    const availableStock = getAvailableStock(product.id);
    
    // Validar stock disponible
    if (availableStock <= 0) {
      toast.error(`❌ Sin stock disponible para ${product.product_name}`);
      return;
    }

    // Si ya está en el carrito, validar que no exceda el stock
    const existingItem = cart.find(item => item.id === product.id);
    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentCartQuantity + quantity;
    
    if (newTotalQuantity > temporaryStock[product.id]) {
      toast.error(`❌ Stock insuficiente. Solo quedan ${availableStock} unidades de ${product.product_name}`);
      return;
    }

    setCart(prevCart => {
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prevCart, { 
          ...product, 
          quantity,
          unit_price: product.standard_price || 0
        }];
      }
    });
    
    toast.success(`✅ ${product.product_name} agregado al carrito (${availableStock - quantity} restantes)`);
  };

  // Remover del carrito
  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  // Actualizar cantidad en carrito con validación de stock
  const updateCartQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    // Validar que la nueva cantidad no exceda el stock real
    const realStock = temporaryStock[productId] || 0;
    if (newQuantity > realStock) {
      const productInCart = cart.find(item => item.id === productId);
      const productName = productInCart ? productInCart.product_name : 'Producto';
      toast.error(`❌ Stock insuficiente. Solo hay ${realStock} unidades disponibles de ${productName}`);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  // Calcular total del carrito
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

  // Generar código dinámico de producto único
  const generateDynamicProductCode = (productName, index) => {
    const upperName = productName.toUpperCase();
    
    // Función para extraer sabor de manera inteligente
    const extractFlavorCode = (name) => {
      const flavorMappings = {
        'BLUEBERRY': 'BLU',
        'CAFE': 'CAF', 
        'CEREZA': 'CER',
        'CHAMOY': 'CHA',
        'CHICLE': 'CHI',
        'COCO': 'COC',
        'FRESA': 'FRE',
        'ICE PINK': 'ICE',
        'LYCHE': 'LYC',
        'MANGO BICHE': 'MAN',
        'MANGO BICHE CON SAL': 'MAS',
        'MANZANA VERDE': 'MVE',
        'MARACUYA': 'MAR',
        'SANDIA': 'SAN',
        // Nuevos sabores
        'PERLAS DE COCO': 'PCO',
        'PERLA DE COCO': 'PCO',
        'COCO PERLAS': 'PCO',
        'UVA': 'UVA',
        'LIMON': 'LIM',
        'NARANJA': 'NAR',
        'PIÑA': 'PIN',
        'MENTA': 'MEN',
        'CHOCOLATE': 'CHO'
      };
      
      // Buscar coincidencias exactas primero
      for (const [flavor, code] of Object.entries(flavorMappings)) {
        if (name.includes(flavor)) {
          return code;
        }
      }
      
      // Si no encuentra sabor específico, usar las primeras 3 letras de la última palabra
      const words = name.split(' ').filter(word => word.length > 2);
      const lastWord = words[words.length - 1] || 'GEN';
      return lastWord.substring(0, 3).toUpperCase();
    };

    // Función para extraer código de presentación
    const extractPresentationCode = (name) => {
      if (name.includes('350')) return 'P'; // Pequeño
      if (name.includes('1100') || name.includes('1200')) return 'M'; // Mediano
      if (name.includes('3400')) return 'G'; // Grande
      if (name.includes('500')) return 'R'; // Regular
      if (name.includes('250')) return 'S'; // Small
      if (name.includes('2000')) return 'L'; // Large
      return 'X'; // Desconocido
    };

    // Función para determinar categoría del producto
    const getProductCategory = (name) => {
      if (name.includes('LIQUIPOPS')) return 'LIQ';
      if (name.includes('DULCE')) return 'DUL';
      if (name.includes('GOMITA')) return 'GOM';
      if (name.includes('CARAMELO')) return 'CAR';
      if (name.includes('CHOCOLATE')) return 'CHO';
      return 'GEN'; // Genérico
    };

    // Generar código dinámico único
    const category = getProductCategory(upperName);
    const presentation = extractPresentationCode(upperName);
    const flavor = extractFlavorCode(upperName);
    
    // Generar código único: CATEGORIA + PRESENTACION + SABOR + INDICE
    const baseCode = `${category}${presentation}${flavor}`;
    const indexSuffix = (index + 1).toString().padStart(2, '0');
    
    // Si el código es muy largo, acortarlo manteniendo unicidad
    let finalCode = baseCode.length > 8 
      ? `${category}${presentation}${flavor.substring(0, 2)}${indexSuffix}`
      : `${baseCode}${indexSuffix}`;
    
    console.log(`🔧 Generando código dinámico:`, {
      producto: productName,
      categoria: category,
      presentacion: presentation, 
      sabor: flavor,
      indice: index,
      codigoFinal: finalCode
    });
    
    return finalCode;
  };

  // Procesar facturación usando el endpoint específico para inventario directo
  const processInvoice = async () => {
    if (!selectedCustomer) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setProcessingInvoice(true);
    
    try {
      console.log('🛒 Iniciando proceso de facturación desde inventario directo...');
      
      // Preparar datos usando la estructura EXACTA que funciona en cotizaciones
      const invoiceData = {
        customer_id: selectedCustomer.id,
        items: cart.map((item, index) => {
          // Determinar el código que se enviará (misma lógica del preview)
          let productCode;
          let codeSource = '';
          
          // 1. Primera prioridad: siigo_code si existe y es válido
          if (item.siigo_code && item.siigo_code.length <= 20 && !item.siigo_code.includes('770')) {
            productCode = item.siigo_code;
            codeSource = 'siigo_code';
          }
          // 2. Segunda prioridad: CÓDIGO INTERNO
          else if (item.internal_code) {
            productCode = item.internal_code;
            codeSource = 'internal_code';
          }
          else if (item.product_code && item.product_code.length <= 20 && !item.product_code.includes('770')) {
            productCode = item.product_code;
            codeSource = 'product_code';
          }
          else if (item.code) {
            productCode = item.code;
            codeSource = 'code';
          }
          else if (item.reference) {
            productCode = item.reference;
            codeSource = 'reference';
          }
          // 3. ÚLTIMO RECURSO: barcode
          else if (item.barcode) {
            productCode = item.barcode;
            codeSource = 'barcode';
          }
          else {
            productCode = `ERROR_NO_CODE_${index}`;
            codeSource = 'error';
          }

          console.log(`📦 Item ${index + 1}: ${item.product_name}`, {
            selected_code: productCode,
            source: codeSource,
            quantity: item.quantity,
            price: item.unit_price
          });

          // Retornar en el formato EXACTO que espera siigoInvoiceService
          return {
            // Campos principales (formato esperado por backend)
            code: productCode,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.unit_price || 0,
            siigo_code: item.siigo_code || productCode,
            
            // Campos adicionales para trazabilidad
            product_id: item.id,
            unit_price: item.unit_price || 0,
            total: (item.unit_price || 0) * item.quantity,
            
            // Metadatos para debugging
            _code_source: codeSource,
            _original_item: {
              id: item.id,
              siigo_code: item.siigo_code,
              internal_code: item.internal_code,
              product_code: item.product_code,
              barcode: item.barcode
            }
          };
        }),
        
        // Usar la MISMA ESTRUCTURA EXACTA que funciona en cotizaciones
        document_type: 'FV-1',
        documentType: 'FV-1',
        notes: `Factura FV-1 generada desde inventario directo - ${new Date().toLocaleString()}`,
        natural_language_order: `Productos del inventario: ${cart.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}`
      };

      console.log('📊 Datos preparados para facturación (estructura exitosa):', invoiceData);
      console.log('💰 Total de factura:', getCartTotal());
      console.log('📦 Items a facturar:', invoiceData.items.length);

      // USAR EL MISMO ENDPOINT EXITOSO DEL SISTEMA DE COTIZACIONES
      const response = await api.post('/quotations/create-invoice', invoiceData);
      const data = response.data;
      
      if (data.success) {
        console.log('✅ Factura creada exitosamente:', data.data);
        
        toast.success(`✅ Factura FV-1 creada exitosamente!`, {
          duration: 6000,
          style: {
            background: '#10B981',
            color: 'white',
          },
        });

        // Mostrar información detallada de la factura
        if (data.data.siigo_invoice_number) {
          toast.success(`📄 Número: ${data.data.siigo_invoice_number}`, {
            duration: 8000
          });
        }
        
        if (data.data.siigo_public_url) {
          toast.success(`🔗 Acceso directo disponible`, {
            duration: 5000
          });
        }

        console.log('🎯 Detalles de factura creada:', {
          invoice_id: data.data.siigo_invoice_id,
          invoice_number: data.data.siigo_invoice_number,
          customer: data.data.customer?.name,
          items_processed: data.data.items_processed,
          total: data.data.total_amount
        });
        
        // Limpiar carrito y cerrar checkout
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearchValue('');
        setShowCheckout(false);
        
        // Recargar inventario para reflejar el stock actualizado
        toast('🔄 Actualizando inventario...', {
          icon: '🔄',
          duration: 2000,
        });
        
        setTimeout(() => {
          loadInventoryProducts();
        }, 1000);
        
      } else {
        console.error('❌ Error del servidor:', data);
        
        // Manejo específico de errores
        if (data.error_type === 'INSUFFICIENT_STOCK') {
          toast.error(`❌ Stock insuficiente: ${data.message}`, {
            duration: 6000
          });
        } else if (data.error_type === 'INVALID_QUANTITY') {
          toast.error(`❌ Cantidad inválida: ${data.message}`, {
            duration: 6000
          });
        } else if (data.message && data.message.includes('Cliente no encontrado')) {
          toast.error('❌ Error: Cliente no válido. Seleccione otro cliente.');
        } else if (data.message && data.message.includes('SIIGO')) {
          toast.error(`❌ Error SIIGO: ${data.message}`);
          if (data.suggestions && data.suggestions.length > 0) {
            console.log('💡 Sugerencias:', data.suggestions);
          }
        } else {
          toast.error(`❌ Error: ${data.message || 'Error desconocido en la facturación'}`);
        }
        
        // Log detallado para debugging
        console.error('🔍 Análisis detallado del error:', {
          message: data.message,
          error: data.error,
          details: data.details,
          error_type: data.error_type
        });
      }
      
    } catch (error) {
      console.error('❌ Error de conexión:', error);
      
      if (error.response) {
        console.error('📡 Respuesta del servidor:', error.response.data);
        const serverError = error.response.data;
        
        if (serverError.error_type === 'INSUFFICIENT_STOCK') {
          toast.error(`❌ Stock insuficiente para ${serverError.product_name || 'un producto'}`, {
            duration: 6000
          });
        } else if (error.response.status === 404) {
          toast.error('❌ Endpoint no encontrado. Verifique la configuración del servidor.');
        } else if (error.response.status === 422) {
          toast.error(`❌ Error de validación: ${serverError.message || 'Datos inválidos'}`);
        } else {
          toast.error(`❌ Error del servidor: ${serverError.message || 'Error interno'}`);
        }
      } else if (error.request) {
        toast.error('❌ Sin respuesta del servidor. Verifique la conexión.');
      } else {
        toast.error('❌ Error configurando la solicitud');
      }
      
    } finally {
      setProcessingInvoice(false);
    }
  };

  // Sincronizar inventario desde SIIGO (recargar datos actualizados)
  const syncInventoryFromSiigo = async () => {
    setSyncingInventory(true);
    try {
      // Por ahora, simplemente recarga el inventario existente
      // que ya tiene los datos sincronizados desde SIIGO automáticamente
      await loadInventoryProducts();
      toast.success('Inventario actualizado exitosamente desde la base de datos.');
    } catch (error) {
      console.error('Error actualizando inventario:', error);
      toast.error('Error actualizando inventario');
    } finally {
      setSyncingInventory(false);
    }
  };

  // Helper functions for category selection
  const handleCategoryToggle = (categoryValue) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(categoryValue);
      if (isSelected) {
        return prev.filter(cat => cat !== categoryValue);
      } else {
        return [...prev, categoryValue];
      }
    });
  };

  const clearAllCategories = () => {
    setSelectedCategories([]);
    setShowCategoryDropdown(false);
  };

  const getCategoryLabel = (categoryValue) => {
    return categoryValue; // In this case, category names are the labels
  };

  useEffect(() => {
    loadInventoryProducts();
  }, []);

  // Filtrar productos según búsqueda y categorías múltiples
  const filteredGroupedProducts = () => {
    let filtered = { ...groupedProducts };
    
    // Filtrar por categorías múltiples seleccionadas
    if (selectedCategories.length > 0) {
      const categoryFiltered = {};
      selectedCategories.forEach(category => {
        if (filtered[category]) {
          categoryFiltered[category] = filtered[category];
        }
      });
      filtered = categoryFiltered;
    }
    
    // Filtrar por término de búsqueda
    if (searchTerm) {
      const newFiltered = {};
      Object.keys(filtered).forEach(category => {
        const categoryProducts = {};
        Object.keys(filtered[category]).forEach(presentation => {
          const presentationProducts = {};
          Object.keys(filtered[category][presentation]).forEach(flavor => {
            const product = filtered[category][presentation][flavor];
            if (product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                flavor.toLowerCase().includes(searchTerm.toLowerCase())) {
              presentationProducts[flavor] = product;
            }
          });
          if (Object.keys(presentationProducts).length > 0) {
            categoryProducts[presentation] = presentationProducts;
          }
        });
        if (Object.keys(categoryProducts).length > 0) {
          newFiltered[category] = categoryProducts;
        }
      });
      filtered = newFiltered;
    }
    
    return filtered;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Contenido Principal - Ajustado para el carrito fijo */}
      <div className="flex-1 p-3 min-w-0" style={{ marginRight: '420px' }}>
        {/* Header */}
        <div className="mb-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <Package2 className="mr-2 text-blue-600" />
                Inventario + Facturación
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Selecciona productos y factura al instante
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  // Hacer scroll suave al carrito lateral
                  const cartElement = document.querySelector('[data-cart-panel]');
                  if (cartElement) {
                    cartElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  // Efecto visual para destacar el carrito
                  const cartPanel = document.querySelector('[data-cart-panel]');
                  if (cartPanel) {
                    cartPanel.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.6)';
                    setTimeout(() => {
                      cartPanel.style.boxShadow = '-5px 0 15px rgba(0,0,0,0.2)';
                    }, 2000);
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-base flex items-center transition-colors font-bold border-2 border-green-800"
                style={{
                  backgroundColor: cart.length > 0 ? '#16a34a' : '#6b7280',
                  animation: cart.length > 0 ? 'pulse 1s infinite' : 'none'
                }}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                👉 VER CARRITO →  ({cart.length})
              </button>
              <button
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm flex items-center transition-colors"
              >
                <Receipt className="w-3 h-3 mr-1" />
                Facturar ({cart.length})
              </button>
              <button
                onClick={syncInventoryFromSiigo}
                disabled={syncingInventory || loading}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm flex items-center transition-colors"
                title="Sincronizar inventario real desde SIIGO"
              >
                {syncingInventory ? (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Package2 className="w-3 h-3 mr-1" />
                )}
                Sync
              </button>
              <button
                onClick={loadInventoryProducts}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm flex items-center transition-colors"
              >
                {loading ? (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Actualizar
              </button>
            </div>
          </div>
        </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 w-full border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
          <div className="pl-8 pr-3 py-1.5 w-full border border-gray-300 rounded text-sm min-h-[38px] cursor-pointer focus-within:ring-1 focus-within:ring-blue-500">
            {/* Selected categories badges */}
            <div className="flex flex-wrap gap-1 min-h-[26px] items-center">
              {selectedCategories.length === 0 ? (
                <span 
                  className="text-gray-500 text-sm cursor-pointer flex-1"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  Selecciona categorías (múltiples)
                </span>
              ) : (
                <div className="flex flex-wrap gap-1 flex-1">
                  {selectedCategories.map(categoryValue => (
                    <span
                      key={categoryValue}
                      className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center"
                    >
                      {getCategoryLabel(categoryValue)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryToggle(categoryValue);
                        }}
                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="text-blue-600 hover:text-blue-700 text-sm px-2 py-1 rounded"
                  >
                    + Agregar
                  </button>
                </div>
              )}
              
              {/* Clear all button */}
              {selectedCategories.length > 0 && (
                <button
                  onClick={clearAllCategories}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  title="Limpiar todas las categorías"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              
              {/* Dropdown toggle */}
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
            
            {/* Dropdown menu */}
            {showCategoryDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                <div className="p-2">
                  {categories.map(category => {
                    const isSelected = selectedCategories.includes(category);
                    return (
                      <div
                        key={category}
                        onClick={() => handleCategoryToggle(category)}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-50 ${
                          isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <span className="flex-1">
                          {category}
                        </span>
                        <div className={`w-4 h-4 border-2 rounded ${
                          isSelected 
                            ? 'bg-blue-600 border-blue-600' 
                            : 'border-gray-300'
                        } flex items-center justify-center`}>
                          {isSelected && (
                            <div className="w-2 h-2 bg-white rounded-sm"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {categories.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No hay categorías disponibles
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventario en formato tabla */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <p className="ml-2 text-sm text-gray-600">Cargando inventario...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.keys(filteredGroupedProducts()).map(category => {
            const categoryData = filteredGroupedProducts()[category];
            const allFlavors = [...new Set(
              Object.values(categoryData)
                .flatMap(presentation => Object.keys(presentation))
            )].sort();

            return (
              <div key={category} className="bg-white rounded shadow overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <h2 className="text-lg font-bold text-gray-900 text-center">
                    {category}
                  </h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full table-auto border-collapse min-w-fit">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-tight leading-tight sticky left-0 bg-gray-50 border-r border-gray-300 z-10"
                          style={{ minWidth: '80px', width: '80px' }}
                        >
                          <div className="text-xs font-bold">
                            PRES
                          </div>
                        </th>
                        {allFlavors.map(flavor => {
                          return (
                            <th 
                              key={flavor} 
                              className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-tight"
                              style={{ 
                                minWidth: '65px',
                                width: 'auto'
                              }}
                            >
                              <div className="flex items-center justify-center" title={flavor}>
                                <div className="text-xs font-bold">
                                  {flavor}
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {Object.keys(categoryData).sort().map(presentation => (
                        <tr key={presentation} className="hover:bg-gray-50">
                          <td 
                            className="px-2 py-2 whitespace-nowrap font-medium text-gray-900 text-xs align-middle sticky left-0 bg-white border-r border-gray-300 z-10"
                            style={{ minWidth: '80px', width: '80px' }}
                          >
                            <div className="text-xs font-bold text-center">
                              {presentation
                                .replace('STANDARD', 'STD')
                                .replace(' GR', 'g')
                                .replace(' ML', 'ml')
                                .replace('1100', '1.1K')
                                .replace('350', '350')
                                .replace('3400', '3.4K')
                              }
                            </div>
                          </td>
                          {allFlavors.map(flavor => {
                            const product = categoryData[presentation]?.[flavor];
                            
                            return (
                              <td 
                                key={`${presentation}-${flavor}`} 
                                className="px-1 py-2 align-middle text-center"
                                style={{ minWidth: '65px' }}
                              >
                                <div className="flex items-center justify-center">
                                  {product ? (
                                    (() => {
                                      const availableStock = getAvailableStock(product.id);
                                      return (
                                        <button
                                          onClick={() => addToCart(product)}
                                          disabled={availableStock <= 0}
                                          className={`w-12 h-8 rounded text-white font-bold text-xs transition-colors flex items-center justify-center ${
                                            availableStock <= 0
                                              ? 'bg-red-500 cursor-not-allowed'
                                              : availableStock < 50
                                              ? 'bg-yellow-500 hover:bg-yellow-600'
                                              : 'bg-green-500 hover:bg-green-600'
                                          }`}
                                          title={(() => {
                                            // Generar tooltip dinámico con información completa del producto
                                            const availableStock = getAvailableStock(product.id);
                                            const cartItem = cart.find(item => item.id === product.id);
                                            const inCartQuantity = cartItem ? cartItem.quantity : 0;
                                            
                                            let tooltip = `${product.product_name}\n`;
                                            tooltip += `Stock Real: ${product.stock}\n`;
                                            tooltip += `En Carrito: ${inCartQuantity}\n`;
                                            tooltip += `Disponible: ${availableStock}\n`;
                                            tooltip += `Precio: $${(product.standard_price || 0).toLocaleString()}\n`;
                                        tooltip += `\n--- CÓDIGOS DEL PRODUCTO ---\n`;
                                        
                                        // ID de Base de Datos
                                        if (product.id) {
                                          tooltip += `ID Base Datos: ${product.id}\n`;
                                        }
                                        
                                        // CÓDIGO INTERNO (el que necesitas - como LIQUIPM01)
                                        if (product.internal_code) {
                                          tooltip += `CÓDIGO INTERNO: ${product.internal_code}\n`;
                                        } else if (product.product_code) {
                                          tooltip += `CÓDIGO INTERNO: ${product.product_code}\n`;
                                        } else if (product.code) {
                                          tooltip += `CÓDIGO INTERNO: ${product.code}\n`;
                                        } else if (product.reference) {
                                          tooltip += `CÓDIGO INTERNO: ${product.reference}\n`;
                                        } else {
                                          tooltip += `CÓDIGO INTERNO: No disponible\n`;
                                        }
                                        
                                        // Código SIIGO
                                        if (product.siigo_code) {
                                          tooltip += `Código SIIGO: ${product.siigo_code}\n`;
                                        } else {
                                          tooltip += `Código SIIGO: No disponible\n`;
                                        }
                                        
                                        // Código de Barras
                                        if (product.barcode) {
                                          tooltip += `Código Barras: ${product.barcode}\n`;
                                        } else {
                                          tooltip += `Código Barras: No disponible\n`;
                                        }
                                        
                                        // Código que se enviará a SIIGO (misma lógica que en checkout)
                                        let siigoCode = '';
                                        let codeSource = '';
                                        
                                        if (product.siigo_code && product.siigo_code.length <= 20 && !product.siigo_code.includes('770')) {
                                          siigoCode = product.siigo_code;
                                          codeSource = '✅ SIIGO Activo';
                                        } else if (product.product_code && product.product_code.length <= 20 && !product.product_code.includes('770')) {
                                          siigoCode = product.product_code;
                                          codeSource = '✅ Código Producto';
                                        } else if (product.barcode) {
                                          siigoCode = product.barcode;
                                          codeSource = '⚠️ Barcode (Respaldo)';
                                        } else {
                                          siigoCode = 'ERROR_NO_CODE';
                                          codeSource = '❌ Sin código válido';
                                        }
                                        
                                        tooltip += `\n--- CÓDIGO PARA FACTURACIÓN ---\n`;
                                        tooltip += `${codeSource}: ${siigoCode}\n`;
                                        
                                        // Información adicional
                                        if (product.category) {
                                          tooltip += `\nCategoría: ${product.category}`;
                                        }
                                        
                                            tooltip += `\n\nClick para agregar al carrito`;
                                            
                                            return tooltip;
                                          })()}
                                        >
                                          <span className="text-xs font-bold">
                                            {availableStock}
                                          </span>
                                        </button>
                                      );
                                    })()
                                  ) : (
                                    <div className="w-12 h-8 rounded bg-gray-200 flex items-center justify-center">
                                      <span className="text-gray-400 text-xs">-</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[98vh] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Receipt className="w-5 h-5 mr-2" />
                Facturación Directa - FV-1
              </h3>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Selección de Cliente */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Cliente *
                </label>
                <CustomerSearchDropdown
                  value={customerSearchValue}
                  onChange={setCustomerSearchValue}
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={(customer) => {
                    setSelectedCustomer(customer);
                    if (customer) {
                      setCustomerSearchValue(customer.name);
                    }
                  }}
                  placeholder="Buscar cliente por nombre o documento..."
                />
              </div>

              {/* Items del Carrito */}
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Items del Carrito ({cart.length})
                </h4>
                
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">El carrito está vacío</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900">{item.product_name}</h5>
                            <p className="text-sm text-gray-500 mt-1">
                              Precio: ${item.unit_price?.toLocaleString() || 0}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            
                            <span className="w-12 text-center font-medium">
                              {item.quantity}
                            </span>
                            
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center ml-2"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="ml-4 text-right">
                            <p className="font-medium text-gray-900">
                              ${(item.unit_price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Sección de Códigos del Producto */}
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <h6 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                            <Code className="w-3 h-3 mr-1" />
                            CÓDIGOS DEL PRODUCTO:
                          </h6>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                              <p className="font-semibold text-blue-700">ID Base Datos:</p>
                              <p className="text-blue-900 font-mono">{item.id || 'N/A'}</p>
                            </div>
                            
                            <div className="bg-red-50 border border-red-200 rounded p-2">
                              <p className="font-semibold text-red-700">CÓDIGO INTERNO:</p>
                              <p className="text-red-900 font-mono break-all font-bold">
                                {(() => {
                                  // MISMO LÓGICA que en el tooltip para encontrar el código interno
                                  if (item.internal_code) {
                                    return item.internal_code;
                                  } else if (item.product_code) {
                                    return item.product_code;
                                  } else if (item.code) {
                                    return item.code;
                                  } else if (item.reference) {
                                    return item.reference;
                                  } else {
                                    return 'No disponible';
                                  }
                                })()}
                              </p>
                            </div>
                            
                            <div className="bg-green-50 border border-green-200 rounded p-2">
                              <p className="font-semibold text-green-700">Código SIIGO:</p>
                              <p className="text-green-900 font-mono break-all">
                                {item.siigo_code || 'N/A'}
                              </p>
                            </div>
                            
                            <div className="bg-purple-50 border border-purple-200 rounded p-2">
                              <p className="font-semibold text-purple-700">Código Producto:</p>
                              <p className="text-purple-900 font-mono break-all">
                                {item.product_code || 'N/A'}
                              </p>
                            </div>
                            
                            <div className="bg-orange-50 border border-orange-200 rounded p-2">
                              <p className="font-semibold text-orange-700">Código Barras:</p>
                              <p className="text-orange-900 font-mono break-all">
                                {item.barcode || 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Vista previa del código que se enviará */}
                          <div className="mt-2">
                            <div className="bg-red-50 border border-red-200 rounded p-2">
                              <p className="font-semibold text-red-700 text-xs">Código que se enviará a SIIGO:</p>
                              <p className="text-red-900 font-mono text-sm font-bold">
                                {(() => {
                                  // MISMA LÓGICA EXACTA que processInvoice - priorizar CÓDIGO INTERNO
                                  let productCode;
                                  let codeSource = '';
                                  
                                  // 1. Primera prioridad: siigo_code si existe y es válido (no es un código de barras largo)
                                  if (item.siigo_code && item.siigo_code.length <= 20 && !item.siigo_code.includes('770')) {
                                    productCode = item.siigo_code;
                                    codeSource = '✅ SIIGO';
                                  }
                                  // 2. Segunda prioridad: CÓDIGO INTERNO (internal_code, product_code, code, reference)
                                  else if (item.internal_code) {
                                    productCode = item.internal_code;
                                    codeSource = '✅ CÓDIGO INTERNO';
                                  }
                                  else if (item.product_code && item.product_code.length <= 20 && !item.product_code.includes('770')) {
                                    productCode = item.product_code;
                                    codeSource = '✅ CÓDIGO INTERNO';
                                  }
                                  else if (item.code) {
                                    productCode = item.code;
                                    codeSource = '✅ CÓDIGO INTERNO';
                                  }
                                  else if (item.reference) {
                                    productCode = item.reference;
                                    codeSource = '✅ CÓDIGO INTERNO';
                                  }
                                  // 3. ÚLTIMO RECURSO: usar el barcode solo si no hay código interno disponible
                                  else if (item.barcode) {
                                    productCode = item.barcode;
                                    codeSource = '⚠️ BARCODE (ÚLTIMO RECURSO)';
                                  }
                                  // 4. Si NO hay ningún código disponible, mostrar error
                                  else {
                                    const index = cart.findIndex(cartItem => cartItem.id === item.id);
                                    productCode = `ERROR_NO_CODE_${index}`;
                                    codeSource = '❌ SIN CÓDIGO';
                                  }
                                  
                                  return (
                                    <span>
                                      <span className={codeSource.includes('✅') ? 'text-green-600' : 'text-yellow-600'}>
                                        {codeSource}: 
                                      </span>
                                      <span className="ml-1 font-black text-lg">
                                        {productCode}
                                      </span>
                                    </span>
                                  );
                                })()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total */}
              {cart.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">${getCartTotal().toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={processInvoice}
                disabled={!selectedCustomer || cart.length === 0 || processingInvoice}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                {processingInvoice ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generar Factura FV-1
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


        {/* Leyenda de colores */}
        <div className="mt-3 bg-white rounded shadow p-3">
          <h3 className="text-xs font-medium text-gray-900 mb-2">Leyenda de Stock:</h3>
          <div className="flex space-x-4 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
              <span>≥50</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded mr-1"></div>
              <span>&lt;50</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
              <span>0</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🛒 CARRITO LATERAL DERECHO - SIDEBAR FIJO QUE SIGUE AL USUARIO */}
      <div 
        data-cart-panel
        className="bg-white border-l-4 border-green-500 p-3 overflow-y-auto" 
        style={{ 
          width: '420px', 
          minWidth: '420px', 
          maxWidth: '420px',
          flexShrink: 0,
          backgroundColor: '#f0fdf4',
          boxShadow: '-5px 0 15px rgba(0,0,0,0.3)',
          height: '100vh',
          position: 'fixed',
          top: '0',
          right: '0',
          zIndex: 1000
        }}
      >
        <div className="sticky top-0 bg-green-50 pb-3 border-b-4 border-green-400 mb-3 rounded-lg p-2">
          <h2 className="text-lg font-bold text-green-800 flex items-center text-center">
            <ShoppingCart className="w-6 h-6 mr-2 text-green-600 animate-pulse" />
            🛒 CARRITO DE COMPRAS
          </h2>
          <p className="text-base text-green-700 font-bold bg-green-100 p-2 rounded">
            {cart.length} {cart.length === 1 ? 'producto' : 'productos'} | Total: ${getCartTotal().toLocaleString()}
          </p>
          <div className="text-sm text-green-600 mt-2 font-semibold bg-yellow-100 p-1 rounded">
            💡 Haz clic en los números de stock para agregar productos
          </div>
          <div className="text-xs text-red-600 mt-1 font-bold">
            ⚠️ SI VES ESTE TEXTO, EL CARRITO YA ESTÁ FUNCIONANDO ⚠️
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-green-600 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <ShoppingCart className="w-16 h-16 mb-3 animate-bounce text-green-500" />
            <p className="text-lg font-bold text-green-700">¡CARRITO VACÍO!</p>
            <p className="text-sm text-center font-semibold text-green-600 bg-yellow-100 p-2 rounded mt-2">
              🎯 Haz clic en los NÚMEROS VERDES/AMARILLOS de la tabla para agregar productos
            </p>
            <p className="text-xs text-center font-bold text-red-600 mt-2 bg-red-100 p-1 rounded">
              ⚠️ SI VES ESTO, EL CARRITO SÍ ESTÁ FUNCIONANDO ⚠️
            </p>
          </div>
        ) : (
          <>
            {/* Items del Carrito */}
            <div className="space-y-2 mb-4">
              {cart.map(item => {
                const availableStock = getAvailableStock(item.id);
                return (
                  <div key={item.id} className="bg-gray-50 p-2 rounded border border-gray-200">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-medium text-gray-900 truncate">
                          {item.product_name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          ${item.unit_price?.toLocaleString() || 0} c/u
                        </p>
                        <div className="flex items-center text-xs">
                          <span className="text-blue-600">
                            Stock: {temporaryStock[item.id] || 0}
                          </span>
                          <span className="mx-1 text-gray-400">•</span>
                          <span className="text-orange-600">
                            Disp: {availableStock}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Controles de cantidad */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          className="w-5 h-5 rounded bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-2 h-2" />
                        </button>
                        <span className="w-6 text-center font-medium text-xs">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= (temporaryStock[item.id] || 0)}
                          className="w-5 h-5 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-2 h-2" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-900">
                          ${(item.unit_price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Código interno del producto */}
                    <div className="mt-1 pt-1 border-t border-gray-200">
                      <p className="text-xs text-gray-600 font-medium">
                        Código: {
                          item.internal_code || 
                          item.product_code || 
                          item.code || 
                          item.reference || 
                          item.barcode || 
                          'N/A'
                        }
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen Total */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Subtotal:</span>
                <span className="text-xs font-medium">${getCartTotal().toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Items:</span>
                <span className="text-xs font-medium">
                  {cart.reduce((total, item) => total + item.quantity, 0)} unidades
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-200">
                <span className="text-sm font-bold text-gray-900">Total:</span>
                <span className="text-sm font-bold text-green-600">
                  ${getCartTotal().toLocaleString()}
                </span>
              </div>

              {/* Botón de Facturar */}
              <button
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 px-4 rounded-lg flex items-center justify-center transition-colors font-bold text-base border-2 border-green-800"
                style={{
                  backgroundColor: cart.length > 0 ? '#059669' : '#9CA3AF',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  padding: '12px 16px'
                }}
              >
                <Receipt className="w-4 h-4 mr-2" />
                🚀 PROCEDER A FACTURAR ({cart.length})
              </button>

              {/* Botón para limpiar carrito */}
              <button
                onClick={() => {
                  setCart([]);
                  toast.success('Carrito limpiado');
                }}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 px-3 rounded flex items-center justify-center transition-colors text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Limpiar Carrito
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InventoryBillingPage;
