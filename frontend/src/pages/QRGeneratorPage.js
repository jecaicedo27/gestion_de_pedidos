import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Search, Package, Box, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { inventoryManagementService } from '../services/inventoryManagementService';

const QRGeneratorPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Form State
    const [lot, setLot] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [packagingMode, setPackagingMode] = useState('box'); // 'box' or 'unit'
    const [quantity, setQuantity] = useState(1);
    const [copies, setCopies] = useState(1);

    const printRef = useRef();

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            // Set default quantity based on mode
            if (packagingMode === 'box') {
                setQuantity(selectedProduct.pack_size || 12);
            } else {
                setQuantity(1);
            }
        }
    }, [packagingMode, selectedProduct]);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await inventoryManagementService.getView();
            if (response.success && Array.isArray(response.data)) {
                setProducts(response.data);
            } else if (Array.isArray(response)) {
                setProducts(response);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Error cargando productos');
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        (p.name || p.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm)) ||
        (p.internal_code && p.internal_code.includes(searchTerm))
    ).slice(0, 10); // Limit results for performance

    const handlePrint = () => {
        if (!selectedProduct) return;

        const printWindow = window.open('', '_blank');
        const content = printRef.current.innerHTML;

        printWindow.document.write(`
            <html>
            <head>
                <title>Imprimir Etiquetas QR</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                    .label-container { 
                        display: flex; 
                        flex-wrap: wrap; 
                        gap: 20px; 
                    }
                    .label { 
                        width: 100mm; 
                        height: 80mm; 
                        border: 1px dashed #ccc; 
                        padding: 4mm; 
                        page-break-inside: avoid;
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        justify-content: space-between;
                        box-sizing: border-box;
                        overflow: hidden;
                    }
                    .content-row {
                        display: flex;
                        flex-direction: row;
                        width: 100%;
                        align-items: center;
                        flex: 1;
                    }
                    .qr-code { margin-right: 8px; }
                    .info { font-size: 14px; flex: 1; line-height: 1.2; }
                    .product-name { 
                        font-weight: bold; 
                        font-size: 18px; 
                        margin-bottom: 5px; 
                        width: 100%; 
                        text-align: center;
                        line-height: 1.1;
                        max-height: 40px;
                        overflow: hidden;
                    }
                    .meta { margin-bottom: 4px; }
                    .qty-badge { 
                        font-size: 24px; 
                        font-weight: bold; 
                        border: 3px solid #000; 
                        padding: 2px 8px; 
                        display: inline-block;
                        margin-top: 5px;
                    }
                    @media print {
                        .label { border: none; }
                    }
                </style>
            </head>
            <body>
                <div class="label-container">
                    ${Array(parseInt(copies)).fill(content).join('')}
                </div>
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // JSON Data for QR
    const qrData = selectedProduct ? JSON.stringify({
        id: selectedProduct.barcode || selectedProduct.internal_code, // Prefer barcode
        qty: parseInt(quantity),
        lot: lot,
        exp: expirationDate
    }) : '';

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-blue-600" />
                Generador de Etiquetas QR
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Configuration */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-4">1. Configuración de Etiqueta</h2>

                    {/* Product Search */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Producto</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Nombre, código de barras..."
                                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {searchTerm && !selectedProduct && (
                            <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                                {filteredProducts.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedProduct(p);
                                            setSearchTerm('');
                                            setQuantity(p.pack_size || 12);
                                        }}
                                        className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                    >
                                        <div className="font-medium">{p.name || p.product_name}</div>
                                        <div className="text-xs text-gray-500">{p.barcode}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedProduct && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-md mb-4">
                                <span className="font-bold text-blue-800">Producto Seleccionado:</span>
                                <p className="text-blue-900">{selectedProduct.name || selectedProduct.product_name}</p>
                            </div>

                            {/* Packaging Mode */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Modo de Empaque</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setPackagingMode('box')}
                                        className={`flex-1 py-2 px-4 rounded-md border flex items-center justify-center gap-2 ${packagingMode === 'box' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                                            }`}
                                    >
                                        <Box className="w-4 h-4" /> Caja Completa
                                    </button>
                                    <button
                                        onClick={() => setPackagingMode('unit')}
                                        className={`flex-1 py-2 px-4 rounded-md border flex items-center justify-center gap-2 ${packagingMode === 'unit' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                                            }`}
                                    >
                                        <Package className="w-4 h-4" /> Unidad Suelta
                                    </button>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cantidad por Etiqueta ({packagingMode === 'box' ? 'Unidades en la caja' : 'Unidad'})
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                />
                            </div>

                            {/* Lot & Expiry */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lote (Opcional)</label>
                                    <input
                                        type="text"
                                        value={lot}
                                        onChange={(e) => setLot(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                        placeholder="Ej. L-202501"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento (Opcional)</label>
                                    <input
                                        type="date"
                                        value={expirationDate}
                                        onChange={(e) => setExpirationDate(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                            </div>

                            {/* Copies */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Copias</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={copies}
                                    onChange={(e) => setCopies(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Preview */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 flex flex-col items-center justify-center">
                    <h2 className="text-lg font-semibold mb-4 w-full text-left">2. Vista Previa</h2>

                    {selectedProduct ? (
                        <>
                            <div
                                ref={printRef}
                                className="bg-white border border-gray-300 shadow-sm flex flex-col items-start justify-between"
                                style={{ width: '100mm', height: '80mm', padding: '4mm' }}
                            >
                                <div className="font-bold text-[18px] mb-[5px] leading-tight w-full text-center max-h-[40px] overflow-hidden">
                                    {selectedProduct.name || selectedProduct.product_name}
                                </div>

                                <div className="flex flex-row items-center w-full flex-1">
                                    <div className="mr-4">
                                        <QRCodeCanvas value={qrData} size={180} level="M" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-[14px] text-gray-500 mb-[4px]">
                                            {selectedProduct.barcode || 'SIN CODIGO'}
                                        </div>

                                        <div className="text-[14px] space-y-[2px] leading-tight">
                                            {lot && <div><span className="font-semibold">Lote:</span> {lot}</div>}
                                            {expirationDate && <div><span className="font-semibold">Vence:</span> {expirationDate}</div>}
                                        </div>

                                        <div className="mt-[5px] border-2 border-black inline-block px-[8px] py-[2px] font-bold text-[24px]">
                                            CANT: {quantity}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {packagingMode === 'box' ? (
                                <button
                                    onClick={handlePrint}
                                    className="mt-6 bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 flex items-center gap-2 font-medium shadow-lg transition-transform hover:scale-105"
                                >
                                    <Printer className="w-5 h-5" />
                                    Imprimir {copies} Etiqueta{copies > 1 ? 's' : ''}
                                </button>
                            ) : (
                                <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-md text-yellow-800 text-sm text-center">
                                    <p className="font-bold mb-1">Modo Unidad Individual</p>
                                    <p>No es necesario imprimir etiquetas. El personal de logística escaneará directamente el código de barras del producto.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-gray-400 text-center">
                            <Package className="w-16 h-16 mx-auto mb-2 opacity-20" />
                            <p>Selecciona un producto para ver la vista previa</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QRGeneratorPage;
