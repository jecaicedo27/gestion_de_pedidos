
import React from 'react';
import { Container, Row, Col } from 'reactstrap';
import FinancialEquityCard from '../components/dashboard/FinancialEquityCard';

const FinancialClosurePage = () => {
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Cierre Financiero Diario</h1>
                <p className="text-gray-600">Registro de saldos bancarios y estado patrimonial.</p>
            </div>

            <div className="w-full">
                <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <i className="ni ni-bell-55 text-blue-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-blue-700">
                                <strong>Importante:</strong> Ingrese los saldos al final del día para asegurar la precisión del historial patrimonial.
                                Los valores automáticos (Inventario, Caja, Circulación) se calculan en tiempo real.
                            </p>
                        </div>
                    </div>
                </div>

                <FinancialEquityCard />
            </div>
        </div>
    );
};

export default FinancialClosurePage;
