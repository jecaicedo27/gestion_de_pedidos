import React, { useEffect, useState, useRef } from 'react';
import { Package, RefreshCw, Save, TrendingUp, Filter, Search, X, FileText } from 'lucide-react';
import inventoryManagementService from '../services/inventoryManagementService';
import InventoryDashboard from '../components/InventoryDashboard';
import ProductDetailsModal from '../components/ProductDetailsModal';
import toast from 'react-hot-toast';

const InventoryManagementPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados para matriz
    const [groupedProducts, setGroupedProducts] = useState({});
    const [categories, setCategories] = useState([]);

    // Estados para filtros y búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [abcFilter, setAbcFilter] = useState('');
    const [supplierFilter, setSupplierFilter] = useState(''); // Nuevo filtro de proveedor

    // Estados para análisis y modal
    const [analyzing, setAnalyzing] = useState(false);
    const [coverageDays, setCoverageDays] = useState(15);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchInventory();
    }, []); // Carga inicial

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const response = await inventoryManagementService.getView();
            console.log('📦 Inventory Data Received:', response); // DEBUG

            let data = [];
            if (response.success && Array.isArray(response.data)) {
                data = response.data;
            } else if (Array.isArray(response)) {
                data = response;
            } else {
                console.error('Formato de datos inesperado:', response);
                setError('Error: Formato de datos incorrecto');
                setLoading(false);
                return;
            }

            setProducts(data);
            organizeProductsForInventory(data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching inventory:', err);
            setError('Error cargando inventario');
            setLoading(false);
        }
    };

    // Obtener lista única de proveedores para el filtro
    const uniqueSuppliers = [...new Set(products.map(p => p.supplier).filter(Boolean))].sort();

    // --- HELPER FUNCTIONS (Adaptadas de InventoryBillingPage) ---

    const extractPresentation = (productName) => {
        const normalized = productName.toUpperCase().replace(/\s+/g, ' ');
        let match = normalized.match(/(?:\bX\b\s*)?(\d+(?:\.\d+)?)\s*(ML|GR?|KG|L|G)\b/i);
        if (!match) {
            match = normalized.match(/(\d+(?:\.\d+)?)\s*(ML|GR?|KG|L|G)\b/i);
        }

        if (match) {
            let value = match[1];
            const unitToken = match[2].toUpperCase();
            let unit = 'G';
            if (unitToken === 'ML' || unitToken === 'L' || normalized.includes('ML') || normalized.includes('SIROPE') || normalized.includes('LIQUIDO')) {
                unit = 'ML';
            }
            if (unitToken === 'L') {
                const n = parseFloat(value);
                if (!Number.isNaN(n)) value = String(Math.round(n * 1000));
            }

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

        const aux = normalized.match(/\b(250|500|1000)\b/);
        if (aux && (normalized.includes('SIROPE') || normalized.includes('LIQUIDO'))) {
            return `${aux[1]}ML`;
        }

        return 'STANDARD';
    };

    const extractFlavor = (productName) => {
        const upperName = productName.toUpperCase();
        const normalized = upperName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

        if (normalized.includes('LIMA LIMON') || normalized.includes('LIMA-LIMON') || normalized.includes('LIMA/LIMON')) {
            return 'LIMA LIMON';
        }

        // Regla específica: AZUCAR MARACUYA
        if (normalized.includes('AZUCAR') && normalized.includes('MARACUYA')) {
            return 'AZUCAR MARACUYA';
        }

        const commonFlavors = [
            'BLUEBERRY', 'CAFE', 'CEREZA', 'CHAMOY', 'CHICLE', 'COCO', 'FRESA',
            'ICE PINK', 'LYCHE', 'MANGO BICHE CON SAL', 'MANGO BICHE', 'MANZANA VERDE',
            'MARACUYA', 'SANDIA', 'VAINILLA', 'VANILLA', 'UVA', 'LIMA LIMON', 'LIMON',
            'NARANJA', 'PIÑA', 'MENTA', 'CHOCOLATE'
        ];

        for (const flavor of commonFlavors) {
            if (normalized.includes(flavor)) return flavor;
        }

        const m = normalized.match(/SABOR(?:\s+A)?\s+([A-ZÁÉÍÓÚÑ ]+?)(?:\s+X\s*\d|$)/);
        if (m && m[1]) return m[1].trim();

        const cleaned = normalized.replace(/\s+X\s*\d+(?:\.\d+)?\s*(?:ML|GR?|KG|L|G|OZ)\b/, '').trim();
        const words = cleaned.split(/\s+/);
        let candidate = words[words.length - 1] || 'CLASICO';
        const unitTokens = new Set(['ML', 'GR', 'G', 'KG', 'L', 'OZ', 'X']);
        if (unitTokens.has(candidate)) candidate = words[words.length - 2] || 'CLASICO';

        return candidate;
    };

    const pickFlavor = (product) => {
        try {
            const sub = String(product?.subcategory || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
            if (sub) {
                if (sub.includes('LIMA LIMON') || sub.includes('LIMA-LIMON') || sub.includes('LIMA/LIMON')) return 'LIMA LIMON';
                return sub;
            }
        } catch (_) { }
        return extractFlavor(product?.name || '');
    };

    const organizeProductsForInventory = (productsList) => {
        const grouped = {};
        const cats = new Set();
        let skippedCount = 0;

        console.log(`🧩 Organizing ${productsList.length} products...`); // DEBUG

        productsList.forEach(product => {
            if (!product.category || !product.name) {
                skippedCount++;
                return;
            }

            // Normalización de categoría para 5KG
            let category = product.category;
            if (category === 'SKARCHA NO FABRICADOS') {
                category = 'SKARCHA NO FABRICADOS 19%';
            }

            // Filtro ABC
            if (abcFilter && product.abc_classification !== abcFilter) return;

            // Filtro Proveedor
            if (supplierFilter && product.supplier !== supplierFilter) return;

            // Filtro Búsqueda
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const match = product.name.toLowerCase().includes(term) ||
                    product.internal_code?.toLowerCase().includes(term) ||
                    product.barcode?.toLowerCase().includes(term);
                if (!match) return;
            }

            const presentation = extractPresentation(product.name);
            const flavor = pickFlavor(product);

            const upperFlavor = String(flavor).toUpperCase();
            if (upperFlavor.includes('GENERICO') || upperFlavor.includes('WHATSAPP')) return;

            if (!grouped[category]) grouped[category] = {};
            if (!grouped[category][presentation]) grouped[category][presentation] = {};

            grouped[category][presentation][flavor] = product;
            cats.add(category);
        });

        console.log(`✅ Organization complete. Categories found: ${cats.size}. Skipped (no cat/name): ${skippedCount}`); // DEBUG
        console.log('📂 Categories:', [...cats]); // DEBUG

        setGroupedProducts(grouped);
        setCategories([...cats].sort());
    };

    // Re-organizar cuando cambian filtros
    useEffect(() => {
        if (products.length > 0) {
            organizeProductsForInventory(products);
        }
    }, [searchTerm, abcFilter, supplierFilter, products]);

    const getPresentationSortKey = (p) => {
        const pres = (p || '').toUpperCase();
        let group = 2;
        let value = Number.MAX_SAFE_INTEGER;

        if (pres.endsWith('KG')) { group = 0; value = (parseFloat(pres) || 0) * 1000; }
        else if (pres.endsWith('G')) { group = 0; value = parseFloat(pres) || 0; }
        else if (pres.endsWith('L')) { group = 1; value = (parseFloat(pres) || 0) * 1000; }
        else if (pres.endsWith('ML')) { group = 1; value = parseFloat(pres) || 0; }
        else if (pres === 'STANDARD' || pres === 'STD') { group = 3; }

        return { group, value };
    };

    const comparePresentations = (a, b) => {
        const ka = getPresentationSortKey(a);
        const kb = getPresentationSortKey(b);
        if (ka.group !== kb.group) return ka.group - kb.group;
        return ka.value - kb.value;
    };

    const isSkarchaCategoryName = (name) => {
        const n = String(name || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
        return /^(SKARCHA\s+NO\s+FABRICADOS\s+19%)$/.test(n);
    };

    const getFlavorGroupFromData = (categoryData, flavor, category) => {
        const candidates = [];
        Object.values(categoryData).forEach(pres => {
            const prod = pres[flavor];
            if (prod) candidates.push(prod);
        });

        const detect = (t) => {
            t = String(t || '').toUpperCase();
            if (t.includes('CHAMOY')) return 'CHAMOY';
            if (t.includes('SKARCHALITO')) return 'SKARCHALITO';
            if (['AZUCAR', 'AZUCARES'].some(k => t.includes(k))) return 'AZUCARES';
            if (['AJI', 'SAL', 'TAJIN', 'PICANTE'].some(k => t.includes(k))) return 'SALES';
            return null;
        };

        for (const p of candidates) {
            const g = detect(p.name || flavor);
            if (g) return g;
        }

        if ((candidates.length > 0) && (String(category || '').toUpperCase().includes('SKARCHA'))) {
            return 'AZUCARES';
        }
        return 'OTROS';
    };

    const computeOrderedFlavorsWithDividers = (categoryData, category) => {
        const flavorsSet = new Set();
        Object.values(categoryData).forEach(pres => Object.keys(pres).forEach(fl => flavorsSet.add(fl)));

        const groups = { SALES: [], AZUCARES: [], CHAMOY: [], SKARCHALITO: [], OTROS: [] };
        Array.from(flavorsSet).forEach(fl => {
            const g = getFlavorGroupFromData(categoryData, fl, category);
            (groups[g] || groups.OTROS).push(fl);
        });

        Object.keys(groups).forEach(k => groups[k].sort());

        // Ajuste LIMA LIMON
        const az = groups['AZUCARES'];
        const idxLL = az.indexOf('LIMA LIMON');
        if (idxLL !== -1) {
            az.splice(idxLL, 1);
            const idxS = az.indexOf('SANDIA');
            if (idxS !== -1) az.splice(idxS + 1, 0, 'LIMA LIMON');
            else az.push('LIMA LIMON');
        }

        const result = [];
        ['SALES', 'AZUCARES', 'CHAMOY', 'SKARCHALITO', 'OTROS'].forEach(k => {
            if (groups[k].length > 0) {
                if (result.length > 0) result.push('__DIVIDER__');
                result.push(...groups[k]);
            }
        });
        return result;
    };

    const getFlavorIcon = (flavor) => {
        const f = String(flavor).toUpperCase();
        if (f.includes('FRESA')) return '🍓';
        if (f.includes('MANZANA')) return '🍏';
        if (f.includes('SANDIA')) return '🍉';
        if (f.includes('MARACUYA')) return '🍈';
        if (f.includes('UVA')) return '🍇';
        if (f.includes('PIÑA')) return '🍍';
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
        return '';
    };

    const formatFlavorLabel = (flavor, category) => {
        if (!flavor) return '';
        const f = String(flavor).toUpperCase();
        const cat = String(category || '').toUpperCase();

        if (f === 'MM') return 'PITILLOS';
        if (f.includes('OZ-2') || f.includes('2 OZ')) return 'COPAS MEDIDORAS';
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

    // --- LOGIC FOR UPDATING & ANALYZING ---

    const handleUpdateConfig = async (productId, config) => {
        try {
            await inventoryManagementService.updateProductConfig(productId, config);
            toast.success('Configuración actualizada');
            fetchInventory(); // Recargar para ver cambios
        } catch (error) {
            console.error('Error updating config:', error);
            toast.error('Error actualizando configuración');
        }
    };

    const handleAnalyzeConsumption = async () => {
        try {
            setAnalyzing(true);
            toast.loading('Analizando consumo...', { id: 'analyze' });
            const response = await inventoryManagementService.analyzeConsumption({ days: coverageDays });
            if (response.success) {
                toast.success(response.message, { id: 'analyze' });
                await fetchInventory();
            } else {
                toast.error(response.message || 'Error analizando consumo', { id: 'analyze' });
            }
        } catch (error) {
            console.error('Error analyzing consumption:', error);
            toast.error('Error al analizar consumo', { id: 'analyze' });
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCalculateABC = async () => {
        try {
            setAnalyzing(true);
            toast.loading('Calculando clasificación ABC...', { id: 'abc' });
            const response = await inventoryManagementService.calculateABC();
            if (response.success) {
                toast.success(response.message, { id: 'abc' });
                await fetchInventory();
            } else {
                toast.error(response.message || 'Error calculando ABC', { id: 'abc' });
            }
        } catch (error) {
            console.error('Error calculando ABC:', error);
            toast.error('Error al calcular clasificación ABC', { id: 'abc' });
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCellClick = (product) => {
        if (product) {
            setSelectedProduct(product);
            setShowModal(true);
        }
    };

    // Determinar color de celda según estado
    // Determinar color de celda según estado
    const getCellColor = (product) => {
        if (!product) return 'bg-gray-50';

        // 1. Si hay análisis de consumo válido (days_until_stockout no es null)
        if (product.days_until_stockout !== null && product.days_until_stockout !== undefined) {
            if (product.days_until_stockout <= 0) return 'bg-red-500 text-white'; // Agotado
            if (product.days_until_stockout <= 3) return 'bg-orange-400 text-white'; // Crítico
            if (product.days_until_stockout <= 7) return 'bg-yellow-300 text-gray-900'; // Bajo
        }

        // 2. Fallback: Si no hay análisis, usar stock vs mínimo
        const minStock = product.min_inventory_qty || 0;
        if (product.current_stock <= 0) return 'bg-red-500 text-white'; // Sin stock
        if (product.current_stock <= minStock) return 'bg-yellow-300 text-gray-900'; // Bajo mínimo

        // 3. Si tiene sugerencia de pedido, resaltar también
        if (product.suggested_order_qty > 0) return 'bg-blue-200 text-blue-900';

        return 'bg-green-100 text-green-900'; // Normal
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="w-full mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    📦 Gestión de Inventario y Reaprovisionamiento
                </h1>
                <p className="text-gray-600">
                    Vista matricial de inventario. Haz clic en una celda para ver detalles y configurar.
                </p>
            </div>

            {/* Dashboard de KPIs */}
            <InventoryDashboard />

            {/* Desglose por Categoría */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                {(() => {
                    // 1. Calcular Costo Total Global para porcentajes
                    let grandTotalCostNet = 0;
                    const catCosts = {};

                    categories.forEach(cat => {
                        const catData = groupedProducts[cat];
                        if (!catData) return;

                        let catTotal = 0;
                        Object.values(catData).forEach(pres => {
                            Object.values(pres).forEach(product => {
                                const stock = Number(product.current_stock || 0);
                                const cost = Number(product.purchasing_price || 0) || (Number(product.standard_price || 0) / 1.19);
                                catTotal += stock * cost;
                            });
                        });

                        catCosts[cat] = catTotal;
                        grandTotalCostNet += catTotal;
                    });

                    // 2. Renderizar tarjetas
                    return categories.map(cat => {
                        const catData = groupedProducts[cat];
                        if (!catData) return null;

                        const totalCostNet = catCosts[cat] || 0;
                        const percent = grandTotalCostNet > 0 ? (totalCostNet / grandTotalCostNet) * 100 : 0;

                        let totalStock = 0;
                        Object.values(catData).forEach(pres => {
                            Object.values(pres).forEach(product => {
                                totalStock += Number(product.current_stock || 0);
                            });
                        });

                        return (
                            <div key={cat} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 relative overflow-hidden">
                                <div className="absolute top-2 right-2 p-1 bg-blue-50 rounded text-center min-w-[40px]">
                                    <span className="text-xl font-bold text-blue-600 block">{percent.toFixed(1)}%</span>
                                </div>

                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 truncate pr-10" title={cat}>{cat}</h3>
                                <p className="text-lg font-bold text-gray-800">
                                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalCostNet)}
                                </p>
                                <p className="text-[10px] text-indigo-600 font-medium">Costo antes de IVA</p>
                                <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-1">
                                    <span className="text-[10px] text-gray-500">Und: <span className="font-bold text-gray-700">{totalStock}</span></span>
                                    <span className="text-[9px] text-gray-400 truncate">c/IVA: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalCostNet * 1.19)}</span>
                                </div>
                            </div>
                        );
                    });
                })()}
            </div>



            {/* Actions Bar */}
            <div className="w-full mb-6 bg-white rounded-lg shadow p-4 sticky top-0 z-20">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-2 items-center">
                        <label className="text-sm font-medium text-gray-700">Días de cobertura:</label>
                        <select
                            value={coverageDays}
                            onChange={(e) => setCoverageDays(Number(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={3}>3 días</option>
                            <option value={7}>7 días</option>
                            <option value={15}>15 días</option>
                        </select>

                        <button
                            onClick={handleAnalyzeConsumption}
                            disabled={analyzing}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                            {analyzing ? 'Analizando...' : 'Analizar Consumo'}
                        </button>

                        <button
                            onClick={handleCalculateABC}
                            disabled={analyzing}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <TrendingUp className="w-4 h-4" />
                            Calcular ABC
                        </button>

                        <button
                            onClick={async () => {
                                toast.loading('Generando Excel...', { id: 'excel' });
                                const success = await inventoryManagementService.exportToExcel();
                                if (success) toast.success('Excel descargado', { id: 'excel' });
                                else toast.error('Error descargando Excel', { id: 'excel' });
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            Exportar Excel
                        </button>

                        <button
                            onClick={async () => {
                                if (!supplierFilter) return;
                                toast.loading(`Generando Orden para ${supplierFilter}...`, { id: 'po' });
                                const result = await inventoryManagementService.generatePurchaseOrder(supplierFilter);
                                if (result === true) {
                                    toast.success('Orden de Compra descargada', { id: 'po' });
                                } else {
                                    toast.error(result?.message || 'Error generando orden', { id: 'po' });
                                }
                            }}
                            disabled={!supplierFilter}
                            className={`px-4 py-2 text-white rounded-md flex items-center gap-2 ${supplierFilter
                                ? 'bg-indigo-600 hover:bg-indigo-700'
                                : 'bg-gray-400 cursor-not-allowed'
                                }`}
                            title={!supplierFilter ? "Selecciona un proveedor primero" : "Generar Orden de Compra"}
                        >
                            <FileText className="w-4 h-4" />
                            Generar Orden
                        </button>
                    </div>

                    <div className="flex gap-2 items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                            />
                        </div>

                        <select
                            value={abcFilter}
                            onChange={(e) => setAbcFilter(e.target.value)}
                            className="border rounded-md px-3 py-2 text-sm"
                        >
                            <option value="">Todas las Clases ABC</option>
                            <option value="A">Clase A (Alta Rotación)</option>
                            <option value="B">Clase B (Media Rotación)</option>
                            <option value="C">Clase C (Baja Rotación)</option>
                        </select>

                        {/* Filtro Proveedor */}
                        <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="border rounded-md px-3 py-2 text-sm"
                        >
                            <option value="">Todos los Proveedores</option>
                            {uniqueSuppliers.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Matrix View */}
            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="ml-2 text-gray-600">Cargando inventario...</p>
                </div>
            ) : (
                <div className="space-y-6 w-full">
                    {categories.map(category => {
                        const categoryData = groupedProducts[category];
                        const isSkarcha = isSkarchaCategoryName(category);
                        const allFlavors = isSkarcha
                            ? computeOrderedFlavorsWithDividers(categoryData, category)
                            : [...new Set(Object.values(categoryData).flatMap(p => Object.keys(p)))].sort();

                        return (
                            <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                                    <h2 className="text-lg font-bold text-gray-900">{category}</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full table-auto border-collapse">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r shadow-sm">
                                                    PRES
                                                </th>
                                                {allFlavors.map((flavor, idx) => (
                                                    flavor === '__DIVIDER__' ? (
                                                        <th key={`div-${idx}`} className="w-2 bg-gray-200"></th>
                                                    ) : (
                                                        <th key={idx} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-lg">{getFlavorIcon(flavor)}</span>
                                                                <span className="text-[10px] leading-tight mt-1">{formatFlavorLabel(flavor, category)}</span>
                                                            </div>
                                                        </th>
                                                    )
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {Object.keys(categoryData).sort((a, b) => comparePresentations(a, b)).map(presentation => (
                                                <tr key={presentation}>
                                                    <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-gray-900 sticky left-0 bg-white z-10 border-r shadow-sm">
                                                        {presentation}
                                                    </td>
                                                    {allFlavors.map((flavor, idx) => {
                                                        if (flavor === '__DIVIDER__') return <td key={`div-${idx}`} className="bg-gray-100"></td>;

                                                        const product = categoryData[presentation][flavor];
                                                        const cellColor = getCellColor(product);

                                                        return (
                                                            <td
                                                                key={idx}
                                                                className={`px-1 py-1 text-center border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity relative ${cellColor}`}
                                                                onClick={() => handleCellClick(product)}
                                                                title={product ? `${product.name} - Stock: ${product.current_stock}` : 'Sin producto'}
                                                            >
                                                                {product ? (
                                                                    <div className="flex flex-col justify-center h-full py-1">
                                                                        {/* Cost Indicator Badge */}
                                                                        {product.purchasing_price > 0 && (
                                                                            <div className="absolute top-0.5 right-0.5 bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow-sm" title={`Costo: $${product.purchasing_price}`}>
                                                                                $
                                                                            </div>
                                                                        )}
                                                                        <span className="font-bold text-base">{product.current_stock}</span>
                                                                        <div className="flex flex-col gap-0.5 mt-1">
                                                                            {product.suggested_order_qty > 0 && (
                                                                                <span className="text-[10px] bg-white bg-opacity-40 rounded px-1 font-bold animate-pulse">
                                                                                    Pedir: {product.suggested_order_qty}
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[9px] opacity-80 leading-none">
                                                                                Min:{product.min_inventory_qty} Pk:{product.pack_size}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
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

            {/* Modal de Detalles */}
            {showModal && selectedProduct && (
                <ProductDetailsModal
                    product={selectedProduct}
                    onClose={() => setShowModal(false)}
                    onUpdate={handleUpdateConfig}
                    onAnalyze={handleAnalyzeConsumption}
                />
            )}
        </div>
    );
};

export default InventoryManagementPage;
