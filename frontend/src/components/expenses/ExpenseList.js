
import React, { useState, useEffect, useCallback } from 'react';
import {
    Card, CardBody, Table, Badge, Button, Input, Label, Modal, ModalHeader, ModalBody, Row, Col, FormGroup,
    UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem
} from 'reactstrap';
import api from '../../services/api';
import * as Icons from 'lucide-react';

const ExpenseList = ({ refreshTrigger, filters, setFilters, onEdit, onDelete }) => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(false);

    // For evidence modal
    const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const toggleEvidenceModal = () => setEvidenceModalOpen(!evidenceModalOpen);

    const handleViewEvidence = (url) => {
        setSelectedImage(`${process.env.REACT_APP_API_URL || ''}${url}`);
        toggleEvidenceModal();
    };

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                month: filters.month,
                year: filters.year
            };

            if (filters.siigo_status) params.siigo_status = filters.siigo_status;
            if (filters.payment_status) params.payment_status = filters.payment_status;

            const response = await api.get('/expenses', { params });

            if (response.data.success) {
                setExpenses(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses, refreshTrigger]);

    const currencyFormatter = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 2
    });

    const months = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
    ];

    const years = [2024, 2025, 2026];

    return (
        <>
            <Card className="shadow">
                <CardBody>
                    {/* FILTERS TOOLBAR */}
                    <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 bg-secondary p-3 rounded">
                        <div className="d-flex align-items-center mb-2 mb-md-0">
                            <h4 className="mb-0 mr-4">Historial de Egresos</h4>
                        </div>

                        <div className="d-flex flex-wrap align-items-center">
                            <FormGroup className="mb-0 mr-2 d-flex align-items-center">
                                <Label className="mr-2 mb-0 text-sm font-weight-bold">Mes:</Label>
                                <Input
                                    type="select"
                                    bsSize="sm"
                                    style={{ width: '120px' }}
                                    value={filters.month}
                                    onChange={e => setFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </Input>
                            </FormGroup>

                            <FormGroup className="mb-0 mr-2 d-flex align-items-center">
                                <Label className="mr-2 mb-0 text-sm font-weight-bold">Año:</Label>
                                <Input
                                    type="select"
                                    bsSize="sm"
                                    style={{ width: '80px' }}
                                    value={filters.year}
                                    onChange={e => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </Input>
                            </FormGroup>

                            <FormGroup className="mb-0 mr-2 d-flex align-items-center">
                                <Label className="mr-2 mb-0 text-sm font-weight-bold">Estado Siigo:</Label>
                                <Input
                                    type="select"
                                    bsSize="sm"
                                    style={{ width: '130px' }}
                                    value={filters.siigo_status}
                                    onChange={e => setFilters(prev => ({ ...prev, siigo_status: e.target.value }))}
                                >
                                    <option value="">Todos</option>
                                    <option value="PENDIENTE">Pendiente</option>
                                    <option value="APLICADO">Aplicado</option>
                                </Input>
                            </FormGroup>

                            <FormGroup className="mb-0 d-flex align-items-center">
                                <Label className="mr-2 mb-0 text-sm font-weight-bold">Pago:</Label>
                                <Input
                                    type="select"
                                    bsSize="sm"
                                    style={{ width: '130px' }}
                                    value={filters.payment_status}
                                    onChange={e => setFilters(prev => ({ ...prev, payment_status: e.target.value }))}
                                >
                                    <option value="">Todos</option>
                                    <option value="PAGADO">Pagado</option>
                                    <option value="PENDIENTE">Pendiente</option>
                                </Input>
                            </FormGroup>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center p-3">Cargando...</div>
                    ) : (
                        <div className="table-responsive">
                            <Table className="align-items-center table-flush table-hover" responsive style={{ fontSize: '0.8rem' }}>
                                <thead className="thead-light">
                                    <tr>
                                        <th scope="col" className="text-center font-weight-bold text-dark">Fecha Fact.</th>
                                        <th scope="col" className="font-weight-bold text-dark">Proveedor</th>
                                        <th scope="col" className="font-weight-bold text-dark">Fact. Prov</th>
                                        <th scope="col" className="font-weight-bold text-dark">Valor</th>
                                        <th scope="col" className="font-weight-bold text-dark border-right">FC Siigo</th>

                                        <th scope="col" className="text-center font-weight-bold text-dark">Fecha Pago</th>
                                        <th scope="col" className="font-weight-bold text-dark">Medio Pago</th>
                                        <th scope="col" className="font-weight-bold text-dark">Estado Pago</th>
                                        <th scope="col" className="font-weight-bold text-dark">Estado Siigo</th>
                                        <th scope="col" className="font-weight-bold text-dark border-right">RP Siigo</th>

                                        <th scope="col" className="font-weight-bold text-dark">Centro Costo</th>
                                        <th scope="col" className="font-weight-bold text-dark">Concepto</th>
                                        <th scope="col" className="font-weight-bold text-dark">Evidencia</th>
                                        <th scope="col" className="text-center font-weight-bold text-dark">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.length === 0 ? (
                                        <tr>
                                            <td colSpan="13" className="text-center">No hay egresos registrados para este filtro.</td>
                                        </tr>
                                    ) : (
                                        expenses.map((expense) => {
                                            const isUnpaid = expense.payment_status === 'PENDIENTE';
                                            return (
                                                <tr key={expense.id} style={isUnpaid ? { backgroundColor: '#fff5f5' } : {}}>
                                                    {/* SIIGO */}
                                                    <td className="text-center">
                                                        {expense.date ? expense.date.substring(0, 10) : '-'}
                                                    </td>
                                                    <td className="font-weight-bold text-wrap" style={{ maxWidth: '150px' }}>
                                                        {expense.provider_name || '-'}
                                                    </td>
                                                    <td>{expense.provider_invoice_number || '-'}</td>
                                                    <td className="font-weight-bold text-dark text-right">
                                                        {currencyFormatter.format(expense.amount)}
                                                    </td>
                                                    <td className="border-right">{expense.siigo_fc_number || '-'}</td>

                                                    {/* PAGO */}
                                                    <td className="text-center">
                                                        {expense.payment_date ? (
                                                            <span className="text-sm">{expense.payment_date.substring(0, 10)}</span>
                                                        ) : '-'}
                                                    </td>
                                                    <td>
                                                        {expense.source === 'bancolombia' && <Badge color="warning" pill className="text-dark">Bancolombia</Badge>}
                                                        {expense.source === 'mercadopago' && <Badge color="info" pill>Mercado Pago</Badge>}
                                                        {expense.source === 'caja_menor' && <Badge color="secondary" pill className="text-dark">Caja Menor</Badge>}
                                                    </td>
                                                    <td className="text-center">
                                                        {expense.payment_status === 'PENDIENTE'
                                                            ? <Badge color="danger" pill>PENDIENTE</Badge>
                                                            : <Badge color="success" pill>PAGADO</Badge>
                                                        }
                                                    </td>
                                                    <td className="text-center">
                                                        {expense.siigo_status === 'APLICADO'
                                                            ? <Badge color="success">APLICADO</Badge>
                                                            : <Badge color="danger">PENDIENTE</Badge>
                                                        }
                                                    </td>
                                                    <td className="border-right">{expense.siigo_rp_number || '-'}</td>

                                                    {/* CLASIFICACION */}
                                                    <td>
                                                        <div className="d-flex flex-column align-items-center">
                                                            <Badge color="primary" style={{ fontSize: '9px' }} className="mb-1">
                                                                {expense.cost_center || 'OTROS'}
                                                            </Badge>
                                                            {expense.category && expense.category !== 'OTROS' && (
                                                                <Badge color="info" style={{ fontSize: '8px' }}>
                                                                    {expense.category}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <small className="d-block text-truncate" style={{ maxWidth: '120px' }} title={expense.concept}>
                                                            {expense.concept || '-'}
                                                        </small>
                                                        {expense.description && (
                                                            <small className="d-block text-muted text-wrap mt-1" style={{ maxWidth: '120px', fontSize: '0.75rem', lineHeight: '1.1' }}>
                                                                <strong>Nota:</strong> {expense.description}
                                                            </small>
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        {expense.evidence_url && (
                                                            <Button
                                                                size="sm"
                                                                color="neutral"
                                                                className="p-1"
                                                                onClick={() => handleViewEvidence(expense.evidence_url)}
                                                                title="Ver"
                                                            >
                                                                <Icons.Eye size={18} className="text-secondary" />
                                                            </Button>
                                                        )}
                                                    </td>
                                                    <td className="text-right">
                                                        <button
                                                            className="btn btn-link btn-sm p-0 mr-2 text-info"
                                                            onClick={() => onEdit(expense)}
                                                            title="Editar"
                                                            style={{ boxShadow: 'none' }}
                                                        >
                                                            <Icons.Edit size={18} />
                                                        </button>
                                                        <button
                                                            className="btn btn-link btn-sm p-0 text-danger"
                                                            onClick={() => onDelete(expense.id)}
                                                            title="Eliminar"
                                                            style={{ boxShadow: 'none' }}
                                                        >
                                                            <Icons.Trash size={18} />
                                                        </button>
                                                        {expense.payment_status === 'PENDIENTE' && (
                                                            <button
                                                                className="btn btn-sm btn-success p-1 ml-2"
                                                                onClick={() => {
                                                                    // We open modal as 'payment' mode with existing data
                                                                    onEdit({ ...expense, mode: 'payment' }); // HACK: Force edit mode to payment
                                                                }}
                                                                title="Registrar Pago"
                                                                style={{ boxShadow: 'none' }}
                                                            >
                                                                <Icons.DollarSign size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </CardBody >
            </Card >

            <Modal isOpen={evidenceModalOpen} toggle={toggleEvidenceModal} size="lg" centered>
                <ModalHeader toggle={toggleEvidenceModal}>Evidencia del Gasto</ModalHeader>
                <ModalBody className="text-center bg-secondary">
                    {selectedImage ? (
                        <img
                            src={selectedImage}
                            alt="Evidencia"
                            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
                            className="rounded shadow"
                        />
                    ) : (
                        <p>No se pudo cargar la imagen.</p>
                    )}
                </ModalBody>
            </Modal>
        </>
    );
};

export default ExpenseList;
