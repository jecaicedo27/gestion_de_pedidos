import React from 'react';

/**
 * Generic table renderer for "Pedidos Listos para Entrega" groups.
 *
 * Props:
 * - orders: Array of order objects.
 * - columns: Array<{ header: string, render: (order) => ReactNode, key?: string }>
 * - getActions?: (order) => ReactNode  // Optional actions cell renderer per row
 * - maxHeight?: Tailwind class string to control vertical scroll area height (default: 'max-h-64')
 */
export default function ReadyForDeliveryGroupTable({
  orders = [],
  columns = [],
  getActions,
  maxHeight = ''
}) {
  return (
    <div className={`overflow-x-auto ${maxHeight} rounded-lg border border-gray-100`}>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
            {typeof getActions === 'function' && (
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {(orders || []).map((order) => (
            <tr key={order.id} className="hover:bg-gray-50">
              {columns.map((col, idx) => (
                <td key={col.key || idx} className="px-3 py-2 align-top">
                  {col.render(order)}
                </td>
              ))}
              {typeof getActions === 'function' && (
                <td className="px-3 py-2 text-right align-top">{getActions(order)}</td>
              )}
            </tr>
          ))}
          {(!orders || orders.length === 0) && (
            <tr>
              <td
                className="px-3 py-6 text-center text-gray-500"
                colSpan={(columns?.length || 0) + (typeof getActions === 'function' ? 1 : 0)}
              >
                No hay pedidos en este grupo
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
