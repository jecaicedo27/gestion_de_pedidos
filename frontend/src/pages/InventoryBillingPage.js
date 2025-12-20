import React, { useState, useEffect, useRef } from 'react';
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
  Code,
  CheckCircle,
  Package,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerSearchDropdown from '../components/CustomerSearchDropdown';
import api from '../services/api';
import { io } from 'socket.io-client';
import { createPortal } from 'react-dom';
import InvoiceItemsTable from '../components/InvoiceItemsTable';
import CreateSiigoCustomerModal from '../components/CreateSiigoCustomerModal';
import CameraInput from '../components/CameraInput';

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
    'YEXIS',
    'SKARCHA NO FABRICADOS 19%'
  ]);
  const [categories, setCategories] = useState([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Estado del carrito de facturación
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchValue, setCustomerSearchValue] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [invoiceType, setInvoiceType] = useState('FV-2'); // Default to Electronic Invoice
  const [documentType, setDocumentType] = useState('invoice'); // 'invoice' | 'quotation'
  const [selectedDiscount, setSelectedDiscount] = useState(0); // Default 0% discount
  const [selectedRetefuente, setSelectedRetefuente] = useState('0'); // Default '0' (No apply)

  // Evidence State
  const [productPhoto, setProductPhoto] = useState(null);
  const [paymentEvidence, setPaymentEvidence] = useState(null);
  const [cashPhoto, setCashPhoto] = useState(null);
  const [processingInvoice, setProcessingInvoice] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState(''); // Estado para notas de factura

  // Estados para forma de pago
  const [paymentMethod, setPaymentMethod] = useState(null); // 'cash', 'transfer', 'mixed'
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [orderType, setOrderType] = useState('regular'); // 'regular' | 'pos'
  const [modalState, setModalState] = useState('config'); // 'config' | 'processing' | 'upload_evidence' | 'completed'
  const [importedOrder, setImportedOrder] = useState(null);

  // Estados para servicios (Flete)
  const [servicePrice, setServicePrice] = useState('');
  const [showServiceSection, setShowServiceSection] = useState(false);

  // Estado para controlar la visibilidad del carrito lateral
  const [isCartOpen, setIsCartOpen] = useState(window.innerWidth > 1280); // Default open on large screens

  // Actualizar descuento de un ítem específico
  const updateItemDiscount = (productId, newDiscount) => {
    setCart(prevCart => prevCart.map(item =>
      item.id === productId ? { ...item, discount: newDiscount } : item
    ));
  };

  // Effect to handle resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1280) {
        setIsCartOpen(true);
      } else {
        setIsCartOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Estados para organización de inventario
  const [presentations, setPresentations] = useState([]);
  const [flavors, setFlavors] = useState([]);

  // Estado para sincronización de inventario desde SIIGO
  const [syncingInventory, setSyncingInventory] = useState(false);

  // Estado para stock temporal (stock real - cantidad en carrito)
  const [temporaryStock, setTemporaryStock] = useState({});

  // DEBUG: Mostrar una sola vez si LIMA LIMON fue detectado en SKARCHA NO FABRICADOS 19%
  const debugLLToastShown = useRef(false);

  // Estado para escáner de código de barras flotante
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanningActive, setScanningActive] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [scannerCollapsed, setScannerCollapsed] = useState(false);
  const barcodeInputRef = useRef(null);

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

      // Extraer presentación y sabor (preferir subcategory si viene de BD)
      const presentation = extractPresentation(product.product_name);
      const flavor = pickFlavor(product);

      // FILTRO: Excluir productos no deseados (GENERICO, WHATSAPP)
      const upperFlavor = String(flavor).toUpperCase();
      if (upperFlavor.includes('GENERICO') || upperFlavor.includes('WHATSAPP')) {
        return;
      }

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

  // Extraer presentación del nombre del producto (robusto y consistente para siropes en ML)
  const extractPresentation = (productName) => {
    // Normalizar espacios y mayúsculas
    const normalized = productName.toUpperCase().replace(/\s+/g, ' ');

    // Buscar número + unidad con o sin "X" previo, en cualquier parte
    let match = normalized.match(/(?:\bX\b\s*)?(\d+(?:\.\d+)?)\s*(ML|GR?|KG|L|G)\b/i);
    if (!match) {
      match = normalized.match(/(\d+(?:\.\d+)?)\s*(ML|GR?|KG|L|G)\b/i);
    }

    if (match) {
      let value = match[1];
      const unitToken = match[2].toUpperCase();

      // Unidad base: si aparece ML/L o si es un sirope/líquido, usamos ML
      let unit = 'G';
      if (unitToken === 'ML' || unitToken === 'L' || normalized.includes('ML') || normalized.includes('SIROPE') || normalized.includes('LIQUIDO')) {
        unit = 'ML';
      }

      // Convertir litros a mililitros si viniera en L (ej. 1 L -> 1000ML)
      if (unitToken === 'L') {
        const n = parseFloat(value);
        if (!Number.isNaN(n)) {
          value = String(Math.round(n * 1000));
        }
      }

      // Formatear presentaciones comunes respetando la unidad detectada
      if (value === '250') return unit === 'ML' ? '250ML' : '250G';
      if (value === '330') return unit === 'ML' ? '330ML' : '330G';
      if (value === '350') return unit === 'ML' ? '350ML' : '350G';
      if (value === '360') return unit === 'ML' ? '360ML' : '360G';
      if (value === '500') return unit === 'ML' ? '500ML' : '500G';
      if (value === '1000') return unit === 'ML' ? '1000ML' : '1000G';
      if (value === '1100') return unit === 'ML' ? '1100ML' : '1100G';
      if (value === '1150') return unit === 'ML' ? '1150ML' : '1150G';
      if (value === '2300') return unit === 'ML' ? '2300ML' : '2300G';
      if (value === '3400') return unit === 'ML' ? '3400ML' : '3400G';

      return `${value}${unit}`;
    }

    // Heurística adicional: si es sirope/líquido y aparece 250/500/1000 sin unidad, asumir ML
    const aux = normalized.match(/\b(250|500|1000)\b/);
    if (aux && (normalized.includes('SIROPE') || normalized.includes('LIQUIDO'))) {
      return `${aux[1]}ML`;
    }

    return 'STANDARD';
  };

  // Elegir sabor priorizando la subcategoría de BD (evita depender solo del parsing del nombre)
  const pickFlavor = (product) => {
    try {
      const sub = String(product?.subcategory || '')
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
        .replace(/\s+/g, ' ')
        .trim();

      if (sub) {
        // Normalizar variantes de Lima Limón
        if (sub.includes('LIMA LIMON') || sub.includes('LIMA-LIMON') || sub.includes('LIMA/LIMON')) {
          return 'LIMA LIMON';
        }
        // Devolver la subcategoría tal cual si existe
        return sub;
      }
    } catch (_) { }
    // Fallback: derivar del nombre del producto
    return extractFlavor(product?.product_name || '');
  };

  // Extraer sabor del nombre del producto (robusto para evitar devolver unidades como ML/GR)
  const extractFlavor = (productName) => {
    const upperName = productName.toUpperCase();
    const normalized = upperName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
      .replace(/\s+/g, ' ') // colapsar espacios
      .trim();

    // Regla específica: priorizar "LIMA LIMON" sobre "LIMON"
    // Cubre variantes con guión o slash.
    if (
      normalized.includes('LIMA LIMON') ||
      normalized.includes('LIMA-LIMON') ||
      normalized.includes('LIMA/LIMON')
    ) {
      return 'LIMA LIMON';
    }

    // Regla específica: AZUCAR MARACUYA
    if (normalized.includes('AZUCAR') && normalized.includes('MARACUYA')) {
      return 'AZUCAR MARACUYA';
    }

    // 1) Sabores comunes (ampliado)
    const commonFlavors = [
      'BLUEBERRY', 'CAFE', 'CEREZA', 'CHAMOY', 'CHICLE', 'COCO', 'FRESA',
      'ICE PINK', 'LYCHE', 'MANGO BICHE CON SAL', 'MANGO BICHE', 'MANZANA VERDE',
      'MARACUYA', 'SANDIA',
      // Adicionales frecuentes
      'VAINILLA', 'VANILLA', 'UVA', 'LIMA LIMON', 'LIMON', 'NARANJA', 'PIÑA', 'MENTA', 'CHOCOLATE'
    ];

    for (const flavor of commonFlavors) {
      if (normalized.includes(flavor)) {
        return flavor;
      }
    }

    // 2) Patrón "SABOR A <...>" o "SABOR <...>"
    const m = normalized.match(/SABOR(?:\s+A)?\s+([A-ZÁÉÍÓÚÑ ]+?)(?:\s+X\s*\d|$)/);
    if (m && m[1]) {
      return m[1].trim();
    }

    // 3) Eliminar sufijo de presentación "X 350 GR/ML/etc." y tomar la última palabra
    const cleaned = normalized
      .replace(/\s+X\s*\d+(?:\.\d+)?\s*(?:ML|GR?|KG|L|G|OZ)\b/, '')
      .trim();

    const words = cleaned.split(/\s+/);
    let candidate = words[words.length - 1] || 'CLASICO';

    // 4) Evitar devolver unidades como sabor (ej.: ML, GR)
    const unitTokens = new Set(['ML', 'GR', 'G', 'KG', 'L', 'OZ', 'X']);
    if (unitTokens.has(candidate)) {
      candidate = words[words.length - 2] || 'CLASICO';
    }

    return candidate;
  };

  // Obtener icono para el sabor
  const getFlavorIcon = (flavor) => {
    const f = String(flavor).toUpperCase();
    if (f.includes('FRESA')) return '🍓';
    if (f.includes('MANZANA')) return '🍏';
    if (f.includes('SANDIA')) return '🍉';
    if (f.includes('MARACUYA')) return '🍈';
    if (f.includes('UVA')) return '🍇';
    if (f.includes('PIÑA') || f.includes('PINA')) return '🍍';
    if (f.includes('COCO')) return '🥥';
    if (f.includes('CEREZA')) return '🍒';
    if (f.includes('LIMON')) return '🍋';
    if (f.includes('NARANJA')) return '🍊';
    if (f.includes('BLUEBERRY') || f.includes('MORA')) return '🫐';
    if (f.includes('DURAZNO')) return '🍑';
    if (f.includes('MANGO')) return '🥭';
    if (f.includes('KIWI')) return '🥝';
    if (f.includes('MENTA')) return '🌿';
    if (f.includes('CHOCOLATE')) return '🍫';
    if (f.includes('VAINILLA')) return '🍦';
    if (f.includes('CAFE')) return '☕';
    if (f.includes('CHICLE')) return '🍬';
    if (f.includes('LYCHE')) return '⚪';
    if (f.includes('CHAMOY')) return '🌶️';
    if (f.includes('SAL')) return '🧂';
    if (f.includes('PICANTE')) return '🌶️';
    if (f.includes('GOMITA')) return '🧸';
    if (f.includes('CURAZAO')) return '🔵';
    if (f.includes('TARO')) return '🍠';
    if (f.includes('CHAI')) return '☕';
    if (f.includes('MATCHA')) return '🍵';
    return '';
  };

  // Formatear etiqueta visible de "sabor" (encabezados de columnas) según reglas del negocio
  const formatFlavorLabel = (flavor, category) => {
    if (!flavor) return '';
    const f = String(flavor).toUpperCase();
    const cat = String(category || '').toUpperCase();

    // Reglas globales
    if (f === 'MM') return 'PITILLOS';
    if (f === 'OZ-2' || f.includes('OZ-2') || f === '2 OZ' || f === '2OZ' || f.includes('OZ 2')) {
      return 'COPAS MEDIDORAS';
    }
    if (f === 'COPAS') return 'BORDEADOR DE COPAS';
    if (f === 'COCTELERA') return 'CUCHARA COCTELERA';
    if (f === 'ESCARCHADOR') return 'JARABE ESCARCHADOR';
    if (f === 'ESTANDARIZADA') return 'LIQUIMON';

    // Reglas específicas para "Productos No fabricados 19%"
    if (cat.includes('PRODUCTOS NO FABRICADOS')) {
      if (f === 'OSITOS') return 'GUDGUMI OSITOS';
      if (f === 'SANDIA') return 'GUDGUMI SANDIA';
      if (f === 'MARACUYA') return 'GUDGUMI MARACUYA';
      if (f === '16') return 'VASOS 16 OZ';
      if (f === '22') return 'VASOS 22 OZ';
      if (f === 'NARANJA') return 'NARANJA DESHIDRATADA';
    }

    // Reglas específicas para "SKARCHA NO FABRICADOS 19%"
    if (cat.includes('SKARCHA NO FABRICADOS')) {
      if (f === '16') return 'VASOS 16 OZ';
      if (f === '22') return 'VASOS 22 OZ';
      if (f === 'NARANJA') return 'NARANJA DESHIDRATADA';
    }

    return flavor;
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

  // Ordenar presentaciones: primero GR/GRAMOS (menor a mayor), luego ML (menor a mayor), y al final cualquier otro (incl. STANDARD)
  const getPresentationSortKey = (p) => {
    const pres = (p || '').toUpperCase();
    // Default: otros/STD al final
    let group = 2;
    let value = Number.MAX_SAFE_INTEGER;

    // Priorizar checks específicos para evitar solapamiento (KG antes que G)
    if (pres.endsWith('KG')) {
      group = 0; // gramos
      value = (parseFloat(pres) || 0) * 1000; // kg -> g
    } else if (pres.endsWith('G')) {
      group = 0; // gramos
      value = parseFloat(pres) || 0; // g
    } else if (pres.endsWith('L')) {
      group = 1; // mililitros
      value = (parseFloat(pres) || 0) * 1000; // l -> ml
    } else if (pres.endsWith('ML')) {
      group = 1; // mililitros
      value = parseFloat(pres) || 0; // ml
    } else if (pres === 'STANDARD' || pres === 'STD') {
      group = 3;
      value = Number.MAX_SAFE_INTEGER;
    }
    return { group, value };
  };

  const comparePresentations = (a, b) => {
    const ka = getPresentationSortKey(a);
    const kb = getPresentationSortKey(b);
    if (ka.group !== kb.group) return ka.group - kb.group;
    return ka.value - kb.value;
  };

  // Detectar si la categoría es exactamente "SKARCHA NO FABRICADOS 19%" (robusto a mayúsculas/espacios)
  const isSkarchaCategoryName = (name) => {
    const n = String(name || '')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
      .replace(/\s+/g, ' ')
      .trim();
    return /^(SKARCHA\s+NO\s+FABRICADOS\s+19%)$/.test(n);
  };

  // Agrupar sabores en: SALES, AZUCARES, CHAMOY, SKARCHALITO, OTROS
  const getFlavorGroup = (flavor, category) => {
    const f = String(flavor || '').toUpperCase();
    const cat = String(category || '').toUpperCase();

    if (f.includes('CHAMOY')) return 'CHAMOY';
    if (f.includes('SKARCHALITO')) return 'SKARCHALITO';

    const SALES = ['AJI', 'AJÍ', 'PIMIENTA', 'SAL', 'TAJIN', 'TAJÍN', 'CHILI', 'CHILE', 'PICANTE'];
    if (SALES.some(k => f.includes(k))) return 'SALES';

    // En Skarcha y productos no fabricados, el resto suelen ser azúcares/sabores dulces
    if (cat.includes('SKARCHA') || cat.includes('PRODUCTOS NO FABRICADOS')) return 'AZUCARES';

    return 'OTROS';
  };

  // Detectar grupo por texto (nombre completo o sabor)
  const detectGroupFromText = (text, category) => {
    const t = String(text || '').toUpperCase();
    const cat = String(category || '').toUpperCase();

    if (t.includes('CHAMOY')) return 'CHAMOY';
    if (t.includes('SKARCHALITO')) return 'SKARCHALITO';

    // Palabras clave para AZÚCARES (prioridad sobre SALES)
    const SUGARS = ['AZUCAR', 'AZÚCAR', 'AZUCARES', 'AZUCARADA', 'AZUCARADO'];
    if (SUGARS.some(k => t.includes(k))) return 'AZUCARES';

    const SALES = [' AJI', ' AJÍ', ' PIMIENTA', ' SAL ', ' SAL-', ' SAL.', ' TAJIN', ' TAJÍN', ' CHILI', ' CHILE', ' PICANTE'];
    if (SALES.some(k => t.includes(k))) return 'SALES';

    if (cat.includes('SKARCHA') || cat.includes('PRODUCTOS NO FABRICADOS')) return 'AZUCARES';
    return 'OTROS';
  };

  // Determinar grupo usando los nombres reales de los productos bajo ese "flavor"
  const getFlavorGroupFromData = (categoryData, flavor, category) => {
    // Revisar todos los productos bajo el flavor y presentación
    const candidates = [];
    Object.values(categoryData).forEach(pres => {
      const prod = pres[flavor];
      if (prod) candidates.push(prod);
    });

    // Prioridad: CHAMOY y SKARCHALITO primero
    for (const p of candidates) {
      const g = detectGroupFromText(p.product_name || p.flavor || flavor, category);
      if (g === 'CHAMOY') return 'CHAMOY';
    }
    for (const p of candidates) {
      const g = detectGroupFromText(p.product_name || p.flavor || flavor, category);
      if (g === 'SKARCHALITO') return 'SKARCHALITO';
    }
    // Luego AZUCARES (si algún producto dice AZUCAR/Á)
    for (const p of candidates) {
      const g = detectGroupFromText(p.product_name || p.flavor || flavor, category);
      if (g === 'AZUCARES') return 'AZUCARES';
    }
    // Después SALES
    for (const p of candidates) {
      const g = detectGroupFromText(p.product_name || p.flavor || flavor, category);
      if (g === 'SALES') return 'SALES';
    }
    // Por defecto en SKARCHA/No fabricados, clasificar como AZUCARES
    if ((candidates.length > 0) && (String(category || '').toUpperCase().includes('SKARCHA') || String(category || '').toUpperCase().includes('PRODUCTOS NO FABRICADOS'))) {
      return 'AZUCARES';
    }
    return 'OTROS';
  };

  // Ordenar sabores por grupos y agregar separadores visuales entre grupos (usando nombres reales)
  const computeOrderedFlavorsWithDividers = (categoryData, category) => {
    const flavorsSet = new Set();
    Object.values(categoryData).forEach(pres => {
      Object.keys(pres).forEach(fl => flavorsSet.add(fl));
    });

    const groups = { SALES: [], AZUCARES: [], CHAMOY: [], SKARCHALITO: [], OTROS: [] };
    Array.from(flavorsSet).forEach(fl => {
      const g = getFlavorGroupFromData(categoryData, fl, category);
      (groups[g] || groups.OTROS).push(fl);
    });

    // Orden alfabético dentro de cada grupo para estabilidad
    Object.keys(groups).forEach(k => groups[k].sort());

    // Reordenar AZUCARES: ubicar "LIMA LIMON" al lado de "SANDIA" (después)
    try {
      const az = groups['AZUCARES'];
      if (Array.isArray(az)) {
        const idxLL = az.indexOf('LIMA LIMON');
        if (idxLL !== -1) {
          // quitar posición actual
          az.splice(idxLL, 1);
          const idxS = az.indexOf('SANDIA');
          if (idxS !== -1) {
            // insertar justo después de SANDIA
            az.splice(idxS + 1, 0, 'LIMA LIMON');
          } else {
            // si no hay SANDIA, dejarlo al final del bloque de AZUCARES
            az.push('LIMA LIMON');
          }
        }
      }
    } catch (_) { }

    const result = [];
    ['SALES', 'AZUCARES', 'CHAMOY', 'SKARCHALITO', 'OTROS'].forEach(k => {
      if (groups[k].length > 0) {
        if (result.length > 0) result.push('__DIVIDER__');
        result.push(...groups[k]);
      }
    });

    return result;
  };

  // Calcular stock disponible (stock real - cantidad en carrito)
  const getAvailableStock = (productId) => {
    const realStock = temporaryStock[productId] ?? 0;
    const cartItem = cart.find(item => item.id === productId);
    const cartQuantity = cartItem ? cartItem.quantity : 0;
    // Se usa para validaciones (no negativo)
    return Math.max(0, realStock - cartQuantity);
  };

  // Stock a mostrar en la celda:
  // - Si hay disponibles (>0) mostrar disponibles
  // - Si no, mostrar el stock real (puede ser negativo)
  const getDisplayStock = (productId) => {
    const realStock = temporaryStock[productId] ?? 0;
    const cartItem = cart.find(item => item.id === productId);
    const cartQuantity = cartItem ? cartItem.quantity : 0;
    const available = realStock - cartQuantity;
    return available > 0 ? available : realStock;
  };

  // Manejar input de código de barras (SOLO CÓDIGO DE BARRAS O CÓDIGO INTERNO)
  const handleBarcodeInput = (barcode) => {
    if (!barcode) return;

    const normalizedBarcode = barcode.trim().toUpperCase();

    // Buscar producto por código de barras o código interno (exacto)
    // NO buscar por nombre para evitar falsos positivos con el escáner
    const matchedProduct = products.find(p =>
      (p.barcode && String(p.barcode).trim().toUpperCase() === normalizedBarcode) ||
      (p.internal_code && String(p.internal_code).trim().toUpperCase() === normalizedBarcode) ||
      (p.product_code && String(p.product_code).trim().toUpperCase() === normalizedBarcode) ||
      (p.siigo_code && String(p.siigo_code).trim().toUpperCase() === normalizedBarcode)
    );

    if (matchedProduct) {
      addToCart(matchedProduct, 1);
      // toast.success(`✅ Agregado: ${matchedProduct.product_name}`); // Eliminado para evitar doble alerta
      setBarcodeInput('');

      // Auto-scroll al producto si está habilitado (opcional)
      if (autoScrollEnabled) {
        // Implementar scroll si es necesario, por ahora solo feedback visual
      }
    } else {
      toast.error(`❌ Producto no encontrado: ${barcode}`);
      setBarcodeInput('');
    }
  };

  const handleBarcodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleBarcodeInput(barcodeInput);
    }
  };

  // Agregar producto al carrito con validación de stock
  // Función para reproducir sonido de éxito (beep agradable)
  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Configuración del sonido: "Ding" agradable
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime); // Frecuencia inicial alta
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15); // Bajada rápida

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime); // Volumen moderado
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); // Fade out

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const addToCart = (product, quantity = 1) => {
    playSuccessSound(); // Reproducir sonido al agregar

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
          unit_price: product.standard_price || 0,
          discount: selectedDiscount // Heredar el descuento global al agregar un nuevo producto
        }];
      }
    });

    toast.success(`✅ ${product.product_name} agregado al carrito (${availableStock - quantity} restantes)`, {
      id: 'cart-toast',
      duration: 2000
    });
  };

  // Agregar servicio al carrito (Flete con precio editable)
  const addServiceToCart = () => {
    if (!servicePrice || parseFloat(servicePrice) <= 0) {
      toast.error('❌ Por favor ingresa un precio válido para el servicio');
      return;
    }

    const fleteService = {
      id: 'FL01',
      product_name: 'Flete, domicilio o envío',
      internal_code: 'FL01',
      barcode: 'FL01',
      standard_price: parseFloat(servicePrice),
      unit_price: parseFloat(servicePrice),
      quantity: 1,
      discount: 0,
      isService: true // Marcador para identificar que es un servicio
    };

    // Verificar si ya está en el carrito
    const existingService = cart.find(item => item.id === 'FL01');
    if (existingService) {
      toast.error('❌ El servicio de Flete ya está en el carrito');
      return;
    }

    setCart(prevCart => [...prevCart, fleteService]);
    toast.success(`✅ Servicio de Flete agregado al carrito ($${parseFloat(servicePrice).toLocaleString()})`);

    // Limpiar y ocultar sección
    setServicePrice('');
    setShowServiceSection(false);
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

    // Validar forma de pago (Requerido solo para facturas)
    if (documentType === 'invoice' && !paymentMethod) {
      toast.error('Debe seleccionar una forma de pago');
      return;
    }
    // Validar pago mixto
    if (paymentMethod === 'mixed') {
      const cash = parseFloat(cashAmount) || 0;
      const transfer = parseFloat(transferAmount) || 0;
      if (cash <= 0 || transfer <= 0) {
        toast.error('En pago mixto, debe ingresar ambos montos (efectivo y transferencia)');
        return;
      }
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

          // 1. Primera prioridad: CÓDIGO INTERNO (Lo más confiable desde BD)
          if (item.internal_code) {
            productCode = item.internal_code;
            codeSource = 'internal_code';
          }
          // 2. Segunda prioridad: siigo_code si existe y es válido
          else if (item.siigo_code && item.siigo_code.length <= 20 && !item.siigo_code.includes('770')) {
            productCode = item.siigo_code;
            codeSource = 'siigo_code';
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
            discount: !isNaN(Number(item.discount)) ? Number(item.discount) : 0,
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
        document_type: invoiceType,
        documentType: invoiceType,
        discount: selectedDiscount,
        apply_retefuente: selectedRetefuente === '2.5',
        notes: documentType === 'quotation'
          ? `Cotización generada desde inventario directo - ${new Date().toLocaleString()}${selectedDiscount > 0 ? ` - Descuento: ${selectedDiscount}%` : ''}${selectedRetefuente === '2.5' ? ' - Retefuente 2.5% aplicada' : ''}${invoiceNotes ? `\n\nNotas adicionales: ${invoiceNotes}` : ''}`
          : `Factura ${invoiceType} generada desde inventario directo - ${new Date().toLocaleString()}\n\nTipo de Venta: ${orderType === 'pos' ? 'VENTA POS (Entrega Inmediata)' : 'Pedido Regular'}\nForma de pago: ${paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'transfer' ? 'Transferencia' : paymentMethod === 'credit' ? 'Crédito' : paymentMethod === 'cod' ? 'Contra Entrega' : `Mixto (Efectivo: $${parseFloat(cashAmount || 0).toLocaleString()}, Transferencia: $${parseFloat(transferAmount || 0).toLocaleString()})`}${invoiceNotes ? `\n\nNotas adicionales: ${invoiceNotes}` : ''}`,
        natural_language_order: `Productos del inventario: ${cart.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}`,

        // Datos específicos para POS y Regular (SOLO SI NO ES COTIZACIÓN)
        ...(documentType !== 'quotation' ? {
          sale_channel: orderType,
          pos_payment_method: paymentMethod === 'cash' ? 'efectivo' : (paymentMethod === 'transfer' ? 'transferencia' : 'efectivo'),
          pos_cash_amount: paymentMethod === 'mixed' ? parseFloat(cashAmount) : null,
          pos_transfer_amount: paymentMethod === 'mixed' ? parseFloat(transferAmount) : null,
          delivery_method: orderType === 'pos' ? 'recoge_bodega' : 'domicilio'
        } : {})
      };

      console.log('📊 Datos preparados para facturación (estructura exitosa):', invoiceData);
      console.log('💰 Total de factura:', getCartTotal());
      console.log('📦 Items a facturar:', invoiceData.items.length);

      // Determinar endpoint basado en tipo de documento
      const endpoint = documentType === 'quotation'
        ? '/quotations/create-quotation-siigo'
        : '/quotations/create-invoice';

      const response = await api.post(endpoint, invoiceData);
      const data = response.data;

      if (data.success) {
        console.log(`✅ ${documentType === 'quotation' ? 'Cotización' : 'Factura'} creada exitosamente:`, data.data);

        const successMsg = documentType === 'quotation'
          ? '✅ Cotización creada exitosamente!'
          : `✅ Factura ${invoiceType} creada exitosamente!`;

        // Mostrar toast con botón de descarga
        toast.success(
          (t) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span>{successMsg}</span>
              {data.data.pdf_url && (
                <a
                  href={data.data.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#fff',
                    color: '#10B981',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    fontSize: '0.9em',
                    border: '1px solid #fff'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  📄 Descargar PDF
                </a>
              )}
              {data.data.siigo_public_url && !data.data.pdf_url && (
                <a
                  href={data.data.siigo_public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#fff',
                    color: '#10B981',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    fontSize: '0.9em',
                    border: '1px solid #fff'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  🔗 Ver en SIIGO
                </a>
              )}
            </div>
          ),
          {
            duration: 10000, // Duración más larga para dar tiempo a descargar
            style: {
              background: '#10B981',
              color: '#fff',
              minWidth: '300px'
            },
          }
        );

        // SI ES POS: No cerrar modal, iniciar flujo de importación inmediata (SOLO SI NO ES COTIZACIÓN)
        if (orderType === 'pos' && documentType !== 'quotation') {
          setModalState('processing');
          // Iniciar importación inmediata usando el ID de la factura (más seguro)
          handlePOSImport(data.data.siigo_invoice_id);
          return;
        }

        // SI ES REGULAR: Flujo normal (cerrar y limpiar)

        // Auto-importar a pedidos después de 15 segundos (solo regular y NO cotización)
        const siigoId = data.siigoId || data.data?.id;
        if (siigoId && documentType !== 'quotation') {
          toast('⏳ Sincronizando a pedidos en 15s...', {
            icon: '🔄',
            duration: 5000,
          });

          setTimeout(async () => {
            try {
              const token = localStorage.getItem('token');
              const importRes = await fetch(`${process.env.REACT_APP_API_URL}/api/siigo/import`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ invoice_ids: [siigoId] })
              });
              const importData = await importRes.json();
              if (importData.success) {
                toast.success('✅ Factura sincronizada a pedidos correctamente!', {
                  duration: 4000,
                  icon: '📦'
                });
              } else {
                console.warn('Auto-import warning:', importData);
              }
            } catch (err) {
              console.error('Error en auto-importación:', err);
            }
          }, 15000);
        }

        console.log('🎯 Detalles de factura creada:', {
          invoice_id: data.data.siigo_invoice_id,
          invoice_number: data.data.siigo_invoice_number,
          customer: data.data.customer?.name,
          items_processed: data.data.items_processed,
          total: data.data.total_amount
        });

        // Capturar productos facturados antes de limpiar carrito (excluyendo servicios)
        console.log('🛒 Items en carrito para sync:', cart.map(c => ({ id: c.id, isService: c.isService })));
        const productIds = [...new Set(cart.filter(i => !i.isService && i.id !== 'FL01').map(i => i.id).filter(Boolean))];
        console.log('🔄 IDs filtrados para sync:', productIds);

        // Limpiar carrito y cerrar checkout
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearchValue('');
        setShowCheckout(false);
        // Resetear forma de pago
        setPaymentMethod(null);
        setCashAmount('');
        setTransferAmount('');

        // Disparar sync puntual back-end para cada producto facturado (no bloqueante)
        try {
          productIds.forEach(pid => {
            api.post('/inventory/sync-product', { product_id: pid }).catch(() => { });
          });
        } catch (_) { }

        // Recargar inventario para reflejar el stock actualizado inmediato
        toast('🔄 Actualizando inventario...', {
          icon: '🔄',
          duration: 2000,
        });

        setTimeout(() => {
          loadInventoryProducts();
        }, 1000);

        // Refrescos adicionales tolerantes a latencia de SIIGO (evita necesidad de F5)
        setTimeout(() => {
          loadInventoryProducts();
        }, 3500);
        setTimeout(() => {
          loadInventoryProducts();
        }, 9000);

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

  // --- POS FLOW HELPERS ---

  const handlePOSImport = async (siigoInvoiceId) => {
    try {
      console.log('🚀 Iniciando importación inmediata POS para ID:', siigoInvoiceId);

      // Llamar al endpoint de importación con flag immediate
      const token = localStorage.getItem('token');

      // Map frontend payment method values to database ENUM values
      const paymentMethodMap = {
        'cash': 'efectivo',
        'transfer': 'transferencia',
        'mixed': 'efectivo' // For mixed, use efectivo as primary (backend handles the logic)
      };

      const dbPaymentMethod = paymentMethodMap[paymentMethod] || 'efectivo';

      // Nota: Usamos el endpoint existente pero con parámetros nuevos
      const response = await api.post('/siigo/import', {
        invoice_id: siigoInvoiceId,
        immediate: true,
        payment_method: dbPaymentMethod, // Mapped to database values: 'efectivo', 'transferencia'
        delivery_method: 'recoge_bodega', // POS orders are pickup at store/warehouse
        sale_channel: 'pos' // Explicitly mark as POS sale
      });

      if (response.data.success && response.data.order) {
        console.log('✅ Pedido importado inmediatamente:', response.data.order);
        setImportedOrder(response.data.order);
        setModalState('upload_evidence');
      } else {
        throw new Error(response.data.message || 'Error en importación');
      }

    } catch (error) {
      console.error('❌ POS Import Error:', error);
      toast.error('Error al importar el pedido. Por favor verifique en la lista de pedidos.');
      // En caso de error, permitimos cerrar o reintentar
      setModalState('config');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!importedOrder) return;

    // Validate files
    if (!productPhoto) {
      toast.error('La foto del producto es obligatoria');
      return;
    }

    if ((paymentMethod === 'transfer' || paymentMethod === 'mixed') && !paymentEvidence) {
      toast.error('El comprobante de pago es obligatorio para transferencias');
      return;
    }

    const formData = new FormData();
    formData.append('order_id', importedOrder.id);
    formData.append('product_photo', productPhoto);
    if (paymentEvidence) formData.append('payment_evidence', paymentEvidence);
    if (cashPhoto) formData.append('cash_photo', cashPhoto);

    setProcessingInvoice(true); // Reuse this state for loading
    try {
      const response = await api.post('/pos/upload-evidence-and-deliver', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setModalState('completed');

        // Limpiar estado global
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearchValue('');

        // Clear evidence state
        setProductPhoto(null);
        setPaymentEvidence(null);
        setCashPhoto(null);
        // No limpiamos paymentMethod aún para mostrar resumen en completed
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error('Delivery Error:', error);
      toast.error('Error al confirmar entrega: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessingInvoice(false);
    }
  };

  const handleClosePOS = () => {
    setShowCheckout(false);
    setModalState('config');
    setImportedOrder(null);
    setPaymentMethod(null);
    setCashAmount('');
    setTransferAmount('');
    setOrderType('regular'); // Reset to default
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

  // Auto-focus en el campo de escaneo después de cargar inventario
  useEffect(() => {
    // Solo ejecutar cuando ya no está cargando y hay productos
    if (!loading && products.length > 0 && !scannerCollapsed) {
      // Usar requestAnimationFrame para asegurar que el DOM esté completamente pintado
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
            // Verificar que realmente tiene el foco
            if (document.activeElement === barcodeInputRef.current) {
              console.log('✅ Auto-focus aplicado al escáner');
            } else {
              console.warn('⚠️ Focus aplicado pero perdido inmediatamente');
              // Intentar de nuevo
              setTimeout(() => barcodeInputRef.current?.focus(), 100);
            }
          }
        }, 300);
      });
    }
  }, [loading, products.length, scannerCollapsed]);

  // Bloquear scroll del fondo cuando el modal esté abierto
  useEffect(() => {
    if (showCheckout) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showCheckout]);

  // Suscripción en tiempo real a cambios de stock desde backend (Socket.IO)
  useEffect(() => {
    const socket = io('/', {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    const onStockUpdated = (payload) => {
      try {
        // Normalizar payload desde backend (webhook o sync programada)
        const productId = payload?.productId || payload?.id;
        const newStock = typeof payload?.newStock === 'number' ? payload.newStock : payload?.available_quantity;

        if (!productId || newStock == null) return;

        // Actualizar lista de productos y re-organizar inventario
        setProducts(prev => {
          const updated = prev.map(p =>
            p.id === productId
              ? { ...p, available_quantity: newStock, stock: newStock }
              : p
          );
          // Recalcular agrupaciones y mapa de stock real
          organizeProductsForInventory(updated);
          return updated;
        });

        // Si el producto está en el carrito y excede el nuevo stock, ajustar cantidad
        setCart(prevCart => {
          const item = prevCart.find(i => i.id === productId);
          if (!item) return prevCart;
          if (item.quantity <= newStock) return prevCart;

          toast.error(`Stock actualizado para "${item.product_name}". Cantidad ajustada a ${newStock}.`, { duration: 4000 });
          return prevCart.map(i =>
            i.id === productId ? { ...i, quantity: newStock } : i
          );
        });
      } catch (e) {
        console.error('Error manejando evento stock_updated:', e);
      }
    };

    socket.on('connect', () => {
      try {
        // Sala opcional para eventos de SIIGO
        socket.emit('join-siigo-updates');
      } catch { }
    });

    socket.on('stock_updated', onStockUpdated);

    return () => {
      socket.off('stock_updated', onStockUpdated);
      socket.disconnect();
    };
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
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden relative">
      {/* Contenido Principal - Ajustado para el carrito fijo */}
      <div
        className="flex-1 p-3 min-w-0 transition-all duration-300 ease-in-out"
        style={{
          marginRight: (isCartOpen && window.innerWidth > 1280) ? '380px' : '0px'
        }}
      >
        {/* Header */}
        <div className="mb-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 flex items-center">
                <Package2 className="mr-0 md:mr-2 text-blue-600 w-6 h-6 md:w-6 md:h-6" />
                <span className="hidden md:inline ml-2">Inventario + Facturación</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1 hidden md:block">
                Selecciona productos y factura al instante
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  // Hacer scroll suave al carrito lateral si está abierto
                  if (isCartOpen) {
                    const cartElement = document.querySelector('[data-cart-panel]');
                    if (cartElement) {
                      cartElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  } else {
                    setIsCartOpen(true);
                  }
                  // Efecto visual para destacar el carrito
                  if (isCartOpen) {
                    const cartPanel = document.querySelector('[data-cart-panel]');
                    if (cartPanel) {
                      cartPanel.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.6)';
                      setTimeout(() => {
                        cartPanel.style.boxShadow = ''; // Reset to default class shadow
                      }, 2000);
                    }
                  }
                }}
                className={`
                  ${cart.length > 0 ? 'bg-green-600 hover:bg-green-700 animate-pulse' : 'bg-gray-500 hover:bg-gray-600'} 
                  text-white px-2 py-2 md:px-4 md:py-2 rounded flex items-center transition-colors font-bold border-2 
                  ${cart.length > 0 ? 'border-green-800' : 'border-gray-600'}
                `}
                title="Ver Carrito"
              >
                <ShoppingCart className="w-5 h-5 md:mr-2" />
                <span className="hidden md:inline">{isCartOpen ? 'CARRITO ABIERTO' : `VER CARRITO (${cart.length})`}</span>
                <span className="md:hidden text-xs ml-1 font-bold">{cart.length}</span>
              </button>
              <button
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-2 md:px-3 md:py-1.5 rounded flex items-center transition-colors font-bold shadow-sm"
                title="Facturar"
              >
                <Receipt className="w-5 h-5 md:w-4 md:h-4 md:mr-1" />
                <span className="hidden md:inline">Facturar ({cart.length})</span>
              </button>
              <button
                onClick={syncInventoryFromSiigo}
                disabled={syncingInventory || loading}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-2 py-2 md:px-3 md:py-1.5 rounded flex items-center transition-colors"
                title="Sincronizar inventario real desde SIIGO"
              >
                {syncingInventory ? (
                  <RefreshCw className="w-5 h-5 md:w-3 md:h-3 md:mr-1 animate-spin" />
                ) : (
                  <Package2 className="w-5 h-5 md:w-3 md:h-3 md:mr-1" />
                )}
                <span className="hidden md:inline">Sync</span>
              </button>
              <button
                onClick={loadInventoryProducts}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-2 md:px-3 md:py-1.5 rounded flex items-center transition-colors"
                title="Actualizar lista local"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 md:w-3 md:h-3 md:mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5 md:w-3 md:h-3 md:mr-1" />
                )}
                <span className="hidden md:inline">Actualizar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Escáner Flotante Fixed (Sticky real) - COMPACTO PARA TABLET */}
        <div className="fixed top-0 left-0 z-50 w-full pb-1 pt-1 px-2 transition-all duration-300 pointer-events-none" style={{ top: '56px' }}>
          <div className="max-w-md pointer-events-auto">
            <div className="bg-white rounded shadow border border-purple-200 overflow-hidden">
              <div className="px-2 py-1 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <div className="p-0.5 bg-purple-100 rounded-full">
                    <Code className="w-3 h-3 text-purple-600" />
                  </div>
                  <h3 className="font-medium text-purple-900 text-xs">Escáner de Barras</h3>
                  <div className={`flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${scanningActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                    <div className={`w-1 h-1 rounded-full mr-1 ${scanningActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`}></div>
                    {scanningActive ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setScannerCollapsed(!scannerCollapsed)}
                    className="text-[10px] text-purple-600 hover:text-purple-800 font-medium px-1.5 py-0.5 hover:bg-purple-100 rounded transition-colors"
                  >
                    {scannerCollapsed ? 'Expandir' : 'Contraer'}
                  </button>
                </div>
              </div>

              {!scannerCollapsed && (
                <div className="p-2 flex items-center space-x-1.5">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                      <Code className="h-3 w-3 text-gray-400" />
                    </div>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={handleBarcodeKeyPress}
                      onFocus={() => setScanningActive(true)}
                      onBlur={() => setScanningActive(false)}
                      placeholder="Escanea código de barras aquí..."
                      className="block w-full pl-7 pr-2 py-1 border border-gray-300 rounded leading-4 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => handleBarcodeInput(barcodeInput)}
                    disabled={!barcodeInput.trim()}
                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3 w-3 mr-0.5" />
                    Agregar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Espaciador para compensar el header fixed */}
        <div className="h-8"></div>

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
                          className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                            }`}
                        >
                          <span className="flex-1">
                            {category}
                          </span>
                          <div className={`w-4 h-4 border-2 rounded ${isSelected
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

        {/* Sección de Servicios - Compacta */}
        <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-300 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Package className="w-4 h-4 text-orange-600" />
              <span className="font-semibold text-orange-800 text-sm whitespace-nowrap">Flete (FL01):</span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addServiceToCart();
                  }
                }}
                placeholder="Precio"
                className="w-full pl-6 pr-2 py-1.5 border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm"
              />
            </div>
            <button
              onClick={addServiceToCart}
              disabled={!servicePrice || parseFloat(servicePrice) <= 0}
              className="px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
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
              const isSkarchaCategory = isSkarchaCategoryName(category);
              const allFlavors = isSkarchaCategory
                ? computeOrderedFlavorsWithDividers(categoryData, category)
                : [...new Set(
                  Object.values(categoryData)
                    .flatMap(presentation => Object.keys(presentation))
                )].sort();

              // Debug: verificar que "LIMA LIMON" esté en los sabores calculados
              try {
                console.log('[InventoryBilling] Category:', category,
                  '| Flavors:', allFlavors,
                  '| Has LIMA LIMON?:', allFlavors.includes('LIMA LIMON'));
              } catch (_) { }

              return (
                <div key={category} className="bg-white rounded shadow overflow-hidden">


                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <h2 className="text-lg font-bold text-gray-900 text-center">
                      {category}
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full table-auto border-collapse min-w-fit">
                      <thead className="bg-gray-50">
                        {/* Fila de grupos (más visible) - solo para SKARCHA */}
                        {isSkarchaCategory && (
                          <tr>
                            <th
                              className="px-2 py-1 text-center text-[10px] font-medium text-gray-400 uppercase leading-tight sticky left-0 bg-gray-50 border-r border-gray-300 z-10"
                              style={{ minWidth: '80px', width: '80px' }}
                            >
                              Grupo
                            </th>
                            {(() => {
                              // Construir celdas de encabezado teniendo en cuenta también los divisores
                              const cells = [];
                              let current = null;
                              let span = 0;

                              const pushGroup = () => {
                                if (span > 0) {
                                  cells.push({ type: 'group', group: current, span });
                                  current = null;
                                  span = 0;
                                }
                              };

                              allFlavors.forEach(fl => {
                                if (fl === '__DIVIDER__') {
                                  // cerrar grupo actual y agregar una celda divisor para alinear columnas
                                  pushGroup();
                                  cells.push({ type: 'divider' });
                                } else {
                                  const g = getFlavorGroupFromData(categoryData, fl, category);
                                  if (current == null) { current = g; span = 1; }
                                  else if (g === current) { span += 1; }
                                  else { pushGroup(); current = g; span = 1; }
                                }
                              });
                              pushGroup();

                              const groupStyles = {
                                SALES: 'bg-blue-50 text-blue-700 border-blue-200',
                                AZUCARES: 'bg-pink-50 text-pink-700 border-pink-200',
                                CHAMOY: 'bg-red-50 text-red-700 border-red-200',
                                SKARCHALITO: 'bg-purple-50 text-purple-700 border-purple-200',
                                OTROS: 'bg-gray-50 text-gray-600 border-gray-200'
                              };

                              return cells.map((cell, i) => {
                                if (cell.type === 'divider') {
                                  return (
                                    <th
                                      key={`seg-div-${i}`}
                                      className="px-0"
                                      style={{ minWidth: '8px', width: '8px' }}
                                      aria-hidden="true"
                                    >
                                      <div className="w-px h-4 bg-gray-300" />
                                    </th>
                                  );
                                }
                                return (
                                  <th key={`seg-${i}`} colSpan={cell.span} className={`px-2 py-1 text-[10px] font-bold uppercase border ${groupStyles[cell.group]}`}>
                                    {cell.group}
                                  </th>
                                );
                              });
                            })()}
                          </tr>
                        )}
                        {/* Fila de sabores */}
                        <tr>
                          <th
                            className="px-1 py-1 text-center text-[10px] font-medium text-gray-500 uppercase tracking-tight leading-tight sticky left-0 bg-gray-50 border-r border-gray-300 z-10"
                            style={{ minWidth: '55px', width: '55px' }}
                          >
                            <div className="text-xs font-bold">
                              PRES
                            </div>
                          </th>
                          {allFlavors.map((flavor, idx) => {
                            if (flavor === '__DIVIDER__') {
                              return (
                                <th
                                  key={`div-${idx}`}
                                  className="px-0"
                                  style={{ minWidth: '8px', width: '8px' }}
                                  aria-hidden="true"
                                >
                                  <div className="w-px h-6 bg-gray-300" />
                                </th>
                              );
                            }
                            return (
                              <th
                                key={flavor}
                                className="px-0.5 py-1 text-center text-[9px] font-medium text-gray-500 uppercase tracking-tight align-bottom"
                                style={{
                                  minWidth: '55px',
                                  width: '55px',
                                  whiteSpace: 'normal',
                                  lineHeight: '1.1'
                                }}
                              >
                                <div className="flex flex-col items-center justify-end h-full pb-1" title={flavor}>
                                  <span className="text-sm mb-0.5 leading-none filter grayscale-[0.3]">{getFlavorIcon(flavor)}</span>
                                  <span className="break-words w-full line-clamp-2">
                                    {formatFlavorLabel(flavor, category)}
                                  </span>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {Object.keys(categoryData).sort(comparePresentations).map(presentation => (
                          <tr key={presentation} className="hover:bg-gray-50">
                            <td
                              className="px-1 py-1 whitespace-nowrap font-medium text-gray-900 text-[10px] align-middle sticky left-0 bg-white border-r border-gray-300 z-10"
                              style={{ minWidth: '55px', width: '55px' }}
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
                            {allFlavors.map((flavor, idx) => {
                              if (isSkarchaCategory && flavor === '__DIVIDER__') {
                                return (
                                  <td
                                    key={`${presentation}-div-${idx}`}
                                    className="px-0"
                                    style={{ minWidth: '8px', width: '8px' }}
                                    aria-hidden="true"
                                  >
                                    <div className="w-px h-8 bg-gray-300" />
                                  </td>
                                );
                              }
                              const product = categoryData[presentation]?.[flavor];

                              return (
                                <td
                                  key={`${presentation}-${flavor}`}
                                  className="px-0.5 py-1 align-middle text-center"
                                  style={{ minWidth: '55px', width: '55px' }}
                                >
                                  <div className="flex items-center justify-center">
                                    {product ? (
                                      (() => {
                                        const availableStock = getAvailableStock(product.id);
                                        return (
                                          <button
                                            onClick={() => addToCart(product)}
                                            disabled={availableStock <= 0}
                                            className={`w-full h-7 rounded text-white font-bold text-[10px] transition-colors flex items-center justify-center ${availableStock <= 0
                                              ? 'bg-red-500 cursor-not-allowed'
                                              : availableStock < 50
                                                ? 'bg-yellow-500 hover:bg-yellow-600'
                                                : 'bg-green-500 hover:bg-green-600'
                                              }`}
                                            style={{ minWidth: '100%' }}
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
                                              {getDisplayStock(product.id)}
                                            </span>
                                          </button>
                                        );
                                      })()
                                    ) : (
                                      <div className="w-full h-7 rounded bg-gray-100 flex items-center justify-center">
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
        {showCheckout && createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[98vh] overflow-hidden relative" style={{ zIndex: 10000 }}>
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Receipt className="w-5 h-5 mr-2" />
                  {documentType === 'invoice' ? `Facturación Directa - ${invoiceType}` : 'Generar Cotización'}
                </h3>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {modalState === 'config' ? (
                  <>
                    {/* Selección de Cliente */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Seleccionar Cliente *
                      </label>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
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
                        <button
                          type="button"
                          onClick={() => setShowCreateCustomerModal(true)}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          title="Crear cliente en SIIGO"
                        >
                          + Crear cliente
                        </button>
                      </div>

                      <CreateSiigoCustomerModal
                        open={showCreateCustomerModal}
                        onClose={() => setShowCreateCustomerModal(false)}
                        onCreated={(data) => {
                          const displayName = Array.isArray(data?.name) ? data.name.join(' ').trim() : (data?.name || '');
                          const selected = {
                            id: data?.id || data?._id || null,
                            name: displayName,
                            identification: data?.identification || '',
                            email: data?.email || data?.contacts?.[0]?.email || null,
                            phone: data?.phones?.[0]?.number || null,
                            siigo_id: data?.id || null
                          };
                          setSelectedCustomer(selected);
                          setCustomerSearchValue(selected.name || '');
                          setShowCreateCustomerModal(false);
                          toast.success('Cliente seleccionado para facturar');
                        }}
                      />
                    </div>

                    {/* Opciones de Facturación (Tipo, Descuento, Retención) - Compacto */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Documento
                        </label>
                        <select
                          value={documentType}
                          onChange={(e) => setDocumentType(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          <option value="invoice">Factura</option>
                          <option value="quotation">Cotización</option>
                        </select>
                      </div>

                      {documentType === 'invoice' ? (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Tipo de Factura
                          </label>
                          <select
                            value={invoiceType}
                            onChange={(e) => setInvoiceType(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                          >
                            <option value="FV-2">FV-2 (Factura Electrónica)</option>
                            <option value="FV-1">FV-1 (Factura No Electrónica)</option>
                          </select>
                        </div>
                      ) : (
                        <div className="hidden md:block"></div> // Espaciador
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Descuento Global
                        </label>
                        <select
                          value={selectedDiscount}
                          onChange={(e) => {
                            const newDiscount = Number(e.target.value);
                            setSelectedDiscount(newDiscount);
                            // Actualizar TODOS los items con el nuevo descuento global
                            setCart(prev => prev.map(item => ({ ...item, discount: newDiscount })));
                          }}
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          <option value={0}>Sin Descuento (0%)</option>
                          <option value={5}>5% Descuento</option>
                          <option value={8}>8% Descuento</option>
                          <option value={10}>10% Descuento</option>
                          <option value={15}>15% Descuento</option>
                          <option value={20}>20% Descuento</option>
                          <option value={25}>25% Descuento</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Retención en la Fuente
                        </label>
                        <select
                          value={selectedRetefuente}
                          onChange={(e) => setSelectedRetefuente(e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          <option value="0">No aplicar</option>
                          <option value="2.5">Aplicar 2.5% (Compras generales / Declarantes)</option>
                        </select>
                      </div>
                    </div>

                    {/* Items del Carrito */}
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">
                        Items del Carrito ({cart.length})
                      </h4>
                      <InvoiceItemsTable
                        cart={cart}
                        onIncrease={(id) => {
                          const item = cart.find(i => i.id === id);
                          if (item) updateCartQuantity(id, item.quantity + 1);
                        }}
                        onDecrease={(id) => {
                          const item = cart.find(i => i.id === id);
                          if (item) updateCartQuantity(id, Math.max(0, item.quantity - 1));
                        }}
                        onUpdateQuantity={(id, newQty) => updateCartQuantity(id, newQty)}
                        onRemove={(id) => removeFromCart(id)}
                        onUpdateDiscount={updateItemDiscount}
                        getAvailableStock={getAvailableStock}
                      />
                    </div>

                    {/* Selector de Tipo de Venta - Solo para Facturas */}
                    {documentType === 'invoice' && (
                      <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <label className="block text-sm font-bold text-gray-900 mb-3">
                          Tipo de Venta *
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => {
                              setOrderType('regular');
                              setPaymentMethod(null); // Limpiar forma de pago al cambiar a regular
                            }}
                            className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${orderType === 'regular'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                          >
                            <div className="font-bold text-lg mb-1">📦 Regular</div>
                            <div className="text-xs text-center">Envío a domicilio o nacional</div>
                          </button>

                          <button
                            onClick={() => setOrderType('pos')}
                            className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${orderType === 'pos'
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                          >
                            <div className="font-bold text-lg mb-1">🏪 Venta POS</div>
                            <div className="text-xs text-center">Cliente en punto (Entrega Inmediata)</div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Forma de Pago - Solo para Facturas */}
                    {documentType === 'invoice' && (
                      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Forma de Pago *
                        </label>
                        <div className="space-y-3">
                          <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'cash' ? 'bg-green-50 border-green-500' : 'bg-white hover:bg-gray-50'}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="cash"
                              checked={paymentMethod === 'cash'}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="form-radio h-4 w-4 text-green-600"
                            />
                            <span className="ml-2 flex items-center font-medium text-gray-700">
                              💵 Efectivo
                            </span>
                          </label>

                          <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'transfer' ? 'bg-blue-50 border-blue-500' : 'bg-white hover:bg-gray-50'}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="transfer"
                              checked={paymentMethod === 'transfer'}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="form-radio h-4 w-4 text-blue-600"
                            />
                            <span className="ml-2 flex items-center font-medium text-gray-700">
                              🏦 Transferencia
                            </span>
                          </label>

                          <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'mixed' ? 'bg-purple-50 border-purple-500' : 'bg-white hover:bg-gray-50'}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="mixed"
                              checked={paymentMethod === 'mixed'}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="form-radio h-4 w-4 text-purple-600"
                            />
                            <span className="ml-2 flex items-center font-medium text-gray-700">
                              💳 Mixto (Efectivo + Transferencia)
                            </span>
                          </label>

                          <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'credit' ? 'bg-orange-50 border-orange-500' : 'bg-white hover:bg-gray-50'}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="credit"
                              checked={paymentMethod === 'credit'}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="form-radio h-4 w-4 text-orange-600"
                            />
                            <span className="ml-2 flex items-center font-medium text-gray-700">
                              📋 Crédito
                            </span>
                          </label>

                          <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'cod' ? 'bg-yellow-50 border-yellow-500' : 'bg-white hover:bg-gray-50'}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="cod"
                              checked={paymentMethod === 'cod'}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="form-radio h-4 w-4 text-yellow-600"
                            />
                            <span className="ml-2 flex items-center font-medium text-gray-700">
                              🚚 Contra Entrega
                            </span>
                          </label>
                        </div>

                        {/* Campos para pago mixto */}
                        {paymentMethod === 'mixed' && (
                          <div className="mt-4 grid grid-cols-2 gap-4 animate-fadeIn">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Monto Efectivo</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500">$</span>
                                <input
                                  type="number"
                                  value={cashAmount}
                                  onChange={(e) => setCashAmount(e.target.value)}
                                  className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Monto Transferencia</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500">$</span>
                                <input
                                  type="number"
                                  value={transferAmount}
                                  onChange={(e) => setTransferAmount(e.target.value)}
                                  className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                            <div className="col-span-2 text-right text-sm font-bold text-gray-700">
                              Total: ${((parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0)).toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notas de la Factura */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notas / Observaciones
                      </label>
                      <textarea
                        value={invoiceNotes}
                        onChange={(e) => setInvoiceNotes(e.target.value)}
                        placeholder="Escribe aquí cualquier nota adicional para la factura..."
                        className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        rows={6}
                      />
                    </div>
                  </>
                ) : modalState === 'processing' ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <RefreshCw className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-gray-800">Procesando Pedido...</h3>
                    <p className="text-gray-500 mt-2">Importando factura desde SIIGO y creando pedido local.</p>
                  </div>
                ) : modalState === 'upload_evidence' ? (
                  <div className="space-y-6">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h3 className="text-lg font-bold text-green-800 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Pedido Importado: #{importedOrder?.order_number}
                      </h3>
                      <p className="text-sm text-green-700 mt-1">
                        Total a pagar: <span className="font-bold">${parseFloat(importedOrder?.total_amount || 0).toLocaleString()}</span>
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <h4 className="font-bold text-gray-800 mb-4">Subir Evidencias de Entrega</h4>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Foto del Producto (Obligatorio)
                          </label>
                          <CameraInput
                            id="product-photo"
                            label="Foto del Producto"
                            required={true}
                            onFileSelect={setProductPhoto}
                          />
                        </div>

                        {(paymentMethod === 'transfer' || paymentMethod === 'mixed') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Comprobante de Pago (Obligatorio)
                            </label>
                            <CameraInput
                              id="payment-evidence"
                              label="Comprobante de Pago"
                              required={true}
                              onFileSelect={setPaymentEvidence}
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Foto del Efectivo (Opcional)
                          </label>
                          <CameraInput
                            id="cash-photo"
                            label="Foto del Efectivo"
                            required={false}
                            onFileSelect={setCashPhoto}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64">
                    <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                    <h3 className="text-2xl font-bold text-gray-800">¡Proceso Completado!</h3>
                    <p className="text-gray-600 mt-2 text-center">
                      {paymentMethod === 'cash'
                        ? 'El pedido ha sido marcado como ENTREGADO.'
                        : 'El pedido ha sido enviado a aprobación de Cartera.'}
                    </p>
                    <div className="mt-6 p-4 bg-gray-50 rounded text-center">
                      <p className="font-mono text-lg">{importedOrder?.order_number}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                {modalState === 'config' ? (
                  <>
                    <button
                      onClick={() => setShowCheckout(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={processInvoice}
                      disabled={!selectedCustomer || cart.length === 0 || processingInvoice || (documentType === 'invoice' && !paymentMethod)}
                      title={documentType === 'invoice' && !paymentMethod ? "Seleccione una forma de pago" : ""}
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
                          {documentType === 'invoice' ? `Generar ${invoiceType}` : 'Generar Cotización'}
                        </>
                      )}
                    </button>
                  </>
                ) : modalState === 'processing' ? (
                  <button disabled className="px-4 py-2 bg-gray-300 text-white rounded-lg cursor-not-allowed">
                    Por favor espere...
                  </button>
                ) : modalState === 'upload_evidence' ? (
                  <button
                    onClick={handleConfirmDelivery}
                    disabled={processingInvoice}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg flex items-center"
                  >
                    {processingInvoice ? 'Subiendo...' : 'Confirmar Entrega'}
                    {!processingInvoice && <CheckCircle className="w-5 h-5 ml-2" />}
                  </button>
                ) : (
                  <button
                    onClick={handleClosePOS}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
                  >
                    Finalizar y Cerrar
                  </button>
                )}
              </div>
            </div>
          </div>
          , document.body)
        }


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
              <span>≤0</span>
            </div>
          </div>
        </div>
      </div >

      {/* 🛒 CARRITO LATERAL DERECHO - SIDEBAR COLLAPSIBLE */}
      {
        !showCheckout && (
          <>
            {/* Overlay para móviles/tablets cuando el carrito está abierto */}
            {isCartOpen && window.innerWidth <= 1280 && (
              <div
                className="fixed inset-0 bg-black bg-opacity-30 z-[999]"
                onClick={() => setIsCartOpen(false)}
              />
            )}

            <div
              data-cart-panel
              className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-[1000] transition-transform duration-300 ease-in-out transform ${isCartOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
              style={{
                width: '380px',
                maxWidth: '90vw',
                borderLeft: '1px solid #e5e7eb'
              }}
            >
              <div className="h-full flex flex-col">
                {/* Header del Carrito */}
                <div className="p-3 bg-green-50 border-b border-green-200 flex justify-between items-center">
                  <div className="flex items-center">
                    <ShoppingCart className="w-5 h-5 text-green-700 mr-2" />
                    <div>
                      <h2 className="text-base font-bold text-green-900 leading-tight">CARRITO DE COMPRAS</h2>
                      <p className="text-xs text-green-700 font-medium">
                        {cart.length} items | Total: ${getCartTotal().toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-1.5 hover:bg-green-100 rounded-full text-green-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Contenido del Carrito */}
                <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                      <ShoppingCart className="w-12 h-12 mb-2" />
                      <p className="text-sm font-medium">Tu carrito está vacío</p>
                      <p className="text-xs text-center mt-1 max-w-[200px]">
                        Selecciona productos del inventario para comenzar
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map(item => {
                        const availableStock = getAvailableStock(item.id);
                        return (
                          <div key={item.id} className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <h4 className="text-sm font-bold text-gray-800 leading-tight mb-0.5">
                                  {item.product_name}
                                </h4>
                                <div className="flex items-center text-xs text-gray-500 space-x-2">
                                  <span>${item.unit_price?.toLocaleString()}</span>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <span className={availableStock > 0 ? 'text-green-600' : 'text-orange-600'}>
                                    Disp: {availableStock > 0 ? availableStock : (temporaryStock[item.id] ?? 0)}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-gray-400 hover:text-red-500 p-1 -mr-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 rounded p-1">
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                  className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 flex items-center justify-center transition-colors shadow-sm"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const newQty = parseInt(e.target.value) || 0;
                                    updateCartQuantity(item.id, newQty);
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  min="0"
                                  max={temporaryStock[item.id] || 0}
                                  className="w-12 text-center font-bold text-sm text-gray-700 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                />
                                <button
                                  onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= (temporaryStock[item.id] || 0)}
                                  className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-sm"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="text-right pr-1">
                                <p className="text-sm font-bold text-gray-900">
                                  ${(item.unit_price * item.quantity).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer del Carrito */}
                {cart.length > 0 && (
                  <div className="p-3 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Items</span>
                        <span>{cart.reduce((total, item) => total + item.quantity, 0)} unid.</span>
                      </div>
                      <div className="flex justify-between items-center text-base font-bold text-gray-900">
                        <span>Total</span>
                        <span className="text-green-600">${getCartTotal().toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => {
                          if (window.confirm('¿Estás seguro de vaciar el carrito?')) {
                            setCart([]);
                            setPaymentMethod(null);
                            setCashAmount('');
                            setTransferAmount('');
                            toast.success('Carrito vaciado');
                          }
                        }}
                        className="col-span-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg flex items-center justify-center transition-colors"
                        title="Vaciar Carrito"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowCheckout(true)}
                        className="col-span-3 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-lg flex items-center justify-center transition-colors font-bold shadow-md hover:shadow-lg transform active:scale-95"
                      >
                        <Receipt className="w-4 h-4 mr-2" />
                        FACTURAR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Botón flotante para abrir carrito en móvil/tablet si está cerrado */}
            {!isCartOpen && cart.length > 0 && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center z-[90] hover:bg-green-700 transition-transform hover:scale-110 animate-bounce"
              >
                <div className="relative">
                  <ShoppingCart className="w-6 h-6" />
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-green-600">
                    {cart.length}
                  </span>
                </div>
              </button>
            )}
          </>
        )
      }
    </div >
  );
};

export default InventoryBillingPage;
// Force refresh Mon Dec 15 11:01:54 -05 2025
