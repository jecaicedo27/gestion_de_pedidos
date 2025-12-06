import React from 'react';
import { Minus, Plus, Trash2, CheckCircle } from 'lucide-react';

const formatCOP = (value) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
  }).format(value || 0);

// Prioridad EXACTA usada en el backend para seleccionar el código
const getSelectedCodeWithSource = (item) => {
  if (item?.siigo_code && item.siigo_code.length <= 20 && !item.siigo_code.includes('770')) {
    return { code: item.siigo_code, sourceKey: 'siigo_code', sourceLabel: 'CÓDIGO SIIGO' };
  }
  if (item?.internal_code) {
    return { code: item.internal_code, sourceKey: 'internal_code', sourceLabel: 'CÓDIGO INTERNO' };
  }
  if (item?.product_code && item.product_code.length <= 20 && !item.product_code.includes('770')) {
    return { code: item.product_code, sourceKey: 'product_code', sourceLabel: 'CÓDIGO PRODUCTO' };
  }
  if (item?.code) {
    return { code: item.code, sourceKey: 'code', sourceLabel: 'CODE' };
  }
  if (item?.reference) {
    return { code: item.reference, sourceKey: 'reference', sourceLabel: 'REFERENCE' };
  }
  if (item?.barcode) {
    return { code: item.barcode, sourceKey: 'barcode', sourceLabel: 'CÓDIGO BARRAS' };
  }
  return { code: 'SIN_CODIGO', sourceKey: 'none', sourceLabel: 'SIN CÓDIGO' };
};

const InvoiceItemsTable = ({
  cart = [],
  onIncrease,
  onDecrease,
  onRemove,
  onUpdateDiscount, // Nueva prop para actualizar descuento
  getAvailableStock,
}) => {
  // Calcular subtotal considerando descuentos individuales
  const subtotal = cart.reduce((acc, it) => {
    const unitPrice = it.unit_price || 0;
    const qty = it.quantity || 0;
    const discount = it.discount || 0;
    const discountedPrice = unitPrice * (1 - discount / 100);
    return acc + (discountedPrice * qty);
  }, 0);

  if (!cart || cart.length === 0) {
    return <p className="text-gray-500 text-center py-8">El carrito está vacío</p>;
  }

  return (
    <div className="w-full space-y-3">
      {/* Ítems en formato tarjetas, vista mínima y práctica */}
      {cart.map((item, index) => {
        const qty = item.quantity || 0;
        const unit = item.unit_price || 0;
        const discount = item.discount || 0;
        const discountedUnit = unit * (1 - discount / 100);
        const lineTotal = discountedUnit * qty;

        const remaining = typeof getAvailableStock === 'function' ? getAvailableStock(item.id) : undefined;
        const disablePlus = remaining !== undefined ? remaining <= 0 : false;

        const { code: selectedCode, sourceLabel } = getSelectedCodeWithSource(item);

        return (
          <div key={item.id} className={`border rounded-lg shadow-sm ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'}`}>
            {/* Header del ítem */}
            <div className="flex items-start justify-between px-4 py-3 border-b">
              <div className="min-w-0 pr-2 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="inline-flex items-center space-x-1 bg-green-600 text-white px-1.5 py-0.5 rounded-md">
                    <CheckCircle className="w-3 h-3" />
                    <span className="font-mono text-xs font-bold">{String(selectedCode).toUpperCase()}</span>
                  </div>
                  <div className="text-sm text-gray-900 font-semibold truncate">{item.product_name}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                  <span>Precio: {formatCOP(unit)}</span>
                  {discount > 0 && (
                    <span className="text-green-600 font-bold">
                      (-{discount}%) → {formatCOP(discountedUnit)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Selector de Descuento Individual */}
                {/* Selector de Descuento Individual */}
                <div className="flex flex-col items-end mr-2">
                  <span className="text-[10px] text-gray-500 mb-0.5">Descuento</span>
                  {(() => {
                    const STANDARD_DISCOUNTS = [0, 5, 8, 10, 15, 20, 25];
                    const isCustom = !STANDARD_DISCOUNTS.includes(discount) && discount !== 0; // 0 is standard

                    if (isCustom && discount !== 'custom') {
                       // Input mode for custom value
                       return (
                         <div className="flex items-center space-x-1">
                           <input
                             type="number"
                             value={discount}
                             onChange={(e) => onUpdateDiscount && onUpdateDiscount(item.id, Number(e.target.value))}
                             className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[50px] text-right"
                             autoFocus
                             min="0"
                             max="100"
                           />
                           <button
                             onClick={() => onUpdateDiscount && onUpdateDiscount(item.id, 0)}
                             className="text-gray-400 hover:text-red-500"
                             title="Restablecer"
                           >
                             ×
                           </button>
                         </div>
                       );
                    } else if (discount === 'custom') {
                        // Input mode initial state (empty or 0)
                        return (
                         <div className="flex items-center space-x-1">
                           <input
                             type="number"
                             placeholder="%"
                             onChange={(e) => onUpdateDiscount && onUpdateDiscount(item.id, Number(e.target.value))}
                             className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[50px] text-right"
                             autoFocus
                           />
                           <button
                             onClick={() => onUpdateDiscount && onUpdateDiscount(item.id, 0)}
                             className="text-gray-400 hover:text-red-500"
                           >
                             ×
                           </button>
                         </div>
                       );
                    }

                    // Select mode
                    return (
                      <select
                        value={discount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            onUpdateDiscount && onUpdateDiscount(item.id, 'custom');
                          } else {
                            onUpdateDiscount && onUpdateDiscount(item.id, Number(val));
                          }
                        }}
                        className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        style={{ width: '60px' }}
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={8}>8%</option>
                        <option value={10}>10%</option>
                        <option value={15}>15%</option>
                        <option value={20}>20%</option>
                        <option value={25}>25%</option>
                        <option value="custom">Otro...</option>
                      </select>
                    );
                  })()}
                </div>

                <button
                  type="button"
                  onClick={() => onDecrease && onDecrease(item.id)}
                  className="w-7 h-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center"
                  aria-label="Disminuir"
                  title="Disminuir"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="w-10 text-center font-semibold">{qty}</span>

                <button
                  type="button"
                  onClick={() => onIncrease && onIncrease(item.id)}
                  disabled={disablePlus}
                  className="w-7 h-7 rounded-full bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  aria-label="Aumentar"
                  title={disablePlus ? 'Sin stock disponible' : 'Aumentar'}
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onRemove && onRemove(item.id)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center"
                  aria-label="Eliminar"
                  title="Eliminar ítem"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="ml-3 text-base font-semibold text-gray-900 tabular-nums min-w-[80px] text-right">
                  {formatCOP(lineTotal)}
                </div>
              </div>
            </div>

          </div>
        );
      })}

      {/* Resumen tipo factura */}
      <div className="flex justify-end mt-3">
        <div className="w-full md:w-1/2 lg:w-1/3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{formatCOP(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">IVA 19% (informativo):</span>
            <span className="text-gray-500">—</span>
          </div>
          <div className="flex items-center justify-between text-base font-bold text-green-600 border-t pt-2">
            <span>Total:</span>
            <span>{formatCOP(subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceItemsTable;
