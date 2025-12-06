// Mocks deben ir antes de importar el componente para evitar cargar módulos reales (axios, etc.)
jest.mock('../../services/api', () => ({
  walletService: {
    validatePayment: jest.fn(),
  },
}), { virtual: true });

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'cartera' }, isAuthenticated: true, isLoading: false }),
}));

// Mock ligero de react-hot-toast para evitar errores de DOM en pruebas
jest.mock('react-hot-toast', () => {
  const fn = jest.fn();
  return {
    __esModule: true,
    default: { success: fn, error: fn },
    toast: { success: fn, error: fn },
  };
});

// Mock de lucide-react para no renderizar íconos reales
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));

import React from 'react';
import { render, screen } from '@testing-library/react';
import WalletValidationModal from '../../components/WalletValidationModal';

describe('WalletValidationModal - visualización de campos de transferencia', () => {
  test('MUESTRA campos de transferencia para Cartera aunque totalDue = 0 (requiresPayment=false)', () => {
    const order = {
      id: 1,
      order_number: 'T-100',
      customer_name: 'Cliente Prueba',
      total_amount: 100000,
      payment_method: 'transferencia',
      // importante para computeCollectionAmounts: no es pickup
      delivery_method: 'domicilio',
      // cualquier otro campo no es necesario; para transferencia + no pickup => productDue=0
    };

    render(
      <WalletValidationModal
        isOpen={true}
        onClose={() => {}}
        order={order}
        onValidate={() => {}}
      />
    );

    // Aunque no requiera cobro, Cartera debe poder cargar comprobante y monto
    const coincidencias = screen.getAllByText(/Monto Transferido/i);
    expect(coincidencias.length).toBeGreaterThan(0);
  });
});
