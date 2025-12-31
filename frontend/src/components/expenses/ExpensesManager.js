
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, CardBody, CardTitle, Button, Modal, ModalHeader, ModalBody } from 'reactstrap';
import ExpenseForm from './ExpenseForm';
import ExpenseList from './ExpenseList';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ExpensesManager = () => {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [todayStats, setTodayStats] = useState({ total: 0, bancolombia: 0, mercadopago: 0, caja_menor: 0, total_month: 0 });

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);

    // Filter State (Global for this module)
    const [filters, setFilters] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        siigo_status: '',
        payment_status: ''
    });

    // Detail Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categoryExpenses, setCategoryExpenses] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const fetchCategoryDetails = async (category) => {
        try {
            setSelectedCategory(category);
            setLoadingDetails(true);
            setDetailModalOpen(true);

            const response = await api.get('/expenses', {
                params: {
                    month: filters.month,
                    year: filters.year,
                    category: category
                }
            });

            if (response.data.success) {
                // Sort by amount descending (highest to lowest) as requested
                const sortedData = response.data.data.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
                setCategoryExpenses(sortedData);
            }
        } catch (error) {
            console.error("Error fetching category details:", error);
            toast.error("Error al cargar detalles");
        } finally {
            setLoadingDetails(false);
        }
    };

    const toggleDetailModal = () => {
        setDetailModalOpen(!detailModalOpen);
    };

    const toggleModal = (mode = null) => {
        setModalOpen(!modalOpen);
        if (modalOpen) {
            setEditingExpense(null); // Reset on close
        } else if (mode) {
            // If opening, set initial data with mode
            setEditingExpense({ mode });
        }
    };

    const handleEdit = (expense) => {
        setEditingExpense({ ...expense, mode: expense.payment_status === 'PAGADO' ? 'payment' : 'schedule' });
        setModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de eliminar este registro?')) {
            try {
                await api.delete(`/expenses/${id}`);
                toast.success('Gasto eliminado');
                setRefreshTrigger(prev => prev + 1);
            } catch (error) {
                console.error(error);
                toast.error('Error al eliminar');
            }
        }
    };

    const handleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
        fetchDailyStats();
        toggleModal(); // Close modal
    };

    const fetchDailyStats = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await api.get('/expenses/stats', {
                params: {
                    // date: today, // Let backend decide based on Bogota time, as ISOString is UTC and shifts date at 7PM
                    month: filters.month,
                    year: filters.year
                }
            });
            if (response.data.success) {
                console.log('📊 Stats Received:', response.data.data);
                setTodayStats(response.data.data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchDailyStats();
    }, [refreshTrigger, filters]);

    const currencyFormatter = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    });

    const monthNames = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    return (
        <div className="content">
            {/* Stats Row */}
            <Row className="mb-4">
                <Col lg="3" md="6">
                    <Card className="card-stats mb-4 mb-xl-0 shadow h-100">
                        <CardBody>
                            <Row>
                                <div className="col">
                                    <CardTitle tag="h5" className="text-uppercase text-muted mb-0">
                                        Total Mes ({monthNames[parseInt(filters.month)]})
                                    </CardTitle>
                                    <span className="h2 font-weight-bold mb-0">
                                        {currencyFormatter.format(todayStats.total_month || 0)}
                                    </span>
                                </div>
                                <Col className="col-auto">
                                    <div className="icon icon-shape bg-primary text-white rounded-circle shadow">
                                        <i className="ni ni-calendar-grid-58" />
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
                <Col lg="3" md="6">
                    <Card className="card-stats mb-4 mb-xl-0 shadow h-100">
                        <CardBody>
                            <Row>
                                <div className="col">
                                    <CardTitle tag="h5" className="text-uppercase text-muted mb-0">
                                        Total Egresos Hoy
                                    </CardTitle>
                                    <span className="h2 font-weight-bold mb-0">
                                        {currencyFormatter.format(todayStats.total)}
                                    </span>
                                </div>
                                <Col className="col-auto">
                                    <div className="icon icon-shape bg-danger text-white rounded-circle shadow">
                                        <i className="ni ni-money-coins" />
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
                <Col lg="2" md="4">
                    <Card className="card-stats mb-4 mb-xl-0 shadow h-100">
                        <CardBody>
                            <Row>
                                <div className="col">
                                    <CardTitle tag="h5" className="text-uppercase text-muted mb-0">
                                        Bancolombia
                                    </CardTitle>
                                    <span className="h2 font-weight-bold mb-0">
                                        {currencyFormatter.format(todayStats.bancolombia)}
                                    </span>
                                </div>
                                <Col className="col-auto">
                                    <div className="icon icon-shape bg-warning text-white rounded-circle shadow">
                                        <i className="ni ni-briefcase-24" />
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
                <Col lg="2" md="4">
                    <Card className="card-stats mb-4 mb-xl-0 shadow h-100">
                        <CardBody>
                            <Row>
                                <div className="col">
                                    <CardTitle tag="h5" className="text-uppercase text-muted mb-0">
                                        Mercado Pago
                                    </CardTitle>
                                    <span className="h2 font-weight-bold mb-0">
                                        {currencyFormatter.format(todayStats.mercadopago)}
                                    </span>
                                </div>
                                <Col className="col-auto">
                                    <div className="icon icon-shape bg-info text-white rounded-circle shadow">
                                        <i className="ni ni-credit-card" />
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
                <Col lg="2" md="4">
                    <Card className="card-stats mb-4 mb-xl-0 shadow h-100">
                        <CardBody>
                            <Row>
                                <div className="col">
                                    <CardTitle tag="h5" className="text-uppercase text-muted mb-0">
                                        Caja Menor
                                    </CardTitle>
                                    <span className="h2 font-weight-bold mb-0">
                                        {currencyFormatter.format(todayStats.caja_menor)}
                                    </span>
                                </div>
                                <Col className="col-auto">
                                    <div className="icon icon-shape bg-success text-white rounded-circle shadow">
                                        <i className="ni ni-shop" />
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* NEW GROUPED CATEGORY STATS */}
            {todayStats.groups && (
                <>
                    {/* MERCHANDISE SECTION */}
                    <Row className="mb-2 mt-4">
                        <Col xs="12">
                            <h6 className="heading-small text-muted mb-3 text-uppercase font-weight-bold">
                                🛒 COMPRAS DE MERCANCÍA (MES) - TOTAL: <span className="text-primary">{currencyFormatter.format(todayStats.groups.merchandise.total)}</span>
                            </h6>
                        </Col>
                        {todayStats.groups.merchandise.items.length > 0 ? (
                            todayStats.groups.merchandise.items.map((cat, index) => (
                                <Col key={'merc_' + index} lg="2" md="4" className="mb-3">
                                    <Card
                                        className="card-stats shadow h-100 border-0 cursor-pointer element-hover"
                                        style={{ borderLeft: '4px solid #5e72e4', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onClick={() => fetchCategoryDetails(cat.category)}
                                    >
                                        <CardBody className="p-3">
                                            <Row>
                                                <div className="col">
                                                    <CardTitle tag="h6" className="text-uppercase text-muted mb-1 text-xs">{cat.category}</CardTitle>
                                                    <span className="h4 font-weight-bold mb-0 text-dark">{currencyFormatter.format(cat.total)}</span>
                                                </div>
                                            </Row>
                                        </CardBody>
                                    </Card>
                                </Col>
                            ))
                        ) : (
                            <Col className="mb-3"><span className="text-muted text-sm pl-3">Sin movimientos de mercancía este mes.</span></Col>
                        )}
                    </Row>

                    {/* OPERATIONAL SECTION */}
                    <Row className="mb-4">
                        <Col xs="12">
                            <h6 className="heading-small text-muted mb-3 text-uppercase font-weight-bold">
                                🏢 GASTOS OPERATIVOS Y OTROS (MES) - TOTAL: <span className="text-primary">{currencyFormatter.format(todayStats.groups.operational.total)}</span>
                            </h6>
                        </Col>
                        {todayStats.groups.operational.items.length > 0 ? (
                            todayStats.groups.operational.items.map((cat, index) => (
                                <Col key={'op_' + index} lg="2" md="4" className="mb-3">
                                    <Card
                                        className="card-stats shadow h-100 border-0 cursor-pointer element-hover"
                                        style={{ borderLeft: '4px solid #11cdef', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onClick={() => fetchCategoryDetails(cat.category)}
                                    >
                                        <CardBody className="p-3">
                                            <Row>
                                                <div className="col">
                                                    <CardTitle tag="h6" className="text-uppercase text-muted mb-1 text-xs">{cat.category}</CardTitle>
                                                    <span className="h4 font-weight-bold mb-0 text-dark">{currencyFormatter.format(cat.total)}</span>
                                                </div>
                                            </Row>
                                        </CardBody>
                                    </Card>
                                </Col>
                            ))
                        ) : (
                            <Col className="mb-3"><span className="text-muted text-sm pl-3">Sin gastos operativos este mes.</span></Col>
                        )}
                    </Row>
                </>
            )}

            {/* FALLBACK FOR LEGACY / IF GROUPS MISSING */}
            {!todayStats.groups && todayStats.by_category && todayStats.by_category.length > 0 && (
                <Row className="mb-4">
                    <Col xs="12">
                        <h6 className="heading-small text-muted mb-3">ACUMULADO POR TIPO DE GASTO (Mes)</h6>
                    </Col>
                    {todayStats.by_category.map((cat, index) => (
                        <Col key={index} lg="2" md="4" className="mb-3">
                            <Card className="card-stats shadow h-100 border-0">
                                <CardBody className="p-3">
                                    <Row>
                                        <div className="col">
                                            <CardTitle tag="h6" className="text-uppercase text-muted mb-1 text-xs">
                                                {cat.category}
                                            </CardTitle>
                                            <span className="h4 font-weight-bold mb-0 text-dark">
                                                {currencyFormatter.format(cat.total)}
                                            </span>
                                        </div>
                                    </Row>
                                </CardBody>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            <Row className="mb-3">
                <Col className="text-right">
                    <Button color="success" onClick={() => toggleModal('payment')} className="mr-3">
                        <i className="ni ni-check-bold" /> Registrar Pago Realizado
                    </Button>
                    <Button color="warning" onClick={() => toggleModal('schedule')}>
                        <i className="ni ni-time-alarm" /> Programar Pago
                    </Button>
                </Col>
            </Row>

            <Row>
                <Col xs="12">
                    <ExpenseList
                        refreshTrigger={refreshTrigger}
                        filters={filters}
                        setFilters={setFilters}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </Col>
            </Row>

            <Modal isOpen={modalOpen} toggle={toggleModal} size="lg">
                <ModalHeader toggle={() => toggleModal()}>
                    {editingExpense?.id ? 'Editar Gasto' : (editingExpense?.mode === 'payment' ? 'Registrar Pago Realizado' : 'Programar Pago')}
                </ModalHeader>
                <ModalBody>
                    <ExpenseForm
                        key={editingExpense ? (editingExpense.id || editingExpense.mode) : 'new'}
                        onSuccess={handleSuccess}
                        onCancel={toggleModal}
                        initialData={editingExpense}
                    />
                </ModalBody>
            </Modal>

            {/* DETAIL MODAL */}
            <Modal isOpen={detailModalOpen} toggle={toggleDetailModal} size="lg">
                <ModalHeader toggle={toggleDetailModal}>
                    Detalle: {selectedCategory} ({monthNames[parseInt(filters.month)]})
                </ModalHeader>
                <ModalBody>
                    {loadingDetails ? (
                        <div className="text-center p-5">Loading...</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-items-center table-flush">
                                <thead className="thead-light">
                                    <tr>
                                        <th scope="col">Fecha</th>
                                        <th scope="col">Descripción</th>
                                        <th scope="col">Fuente</th>
                                        <th scope="col" className="text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoryExpenses.length > 0 ? (
                                        categoryExpenses.map((expense, i) => (
                                            <tr key={i}>
                                                <td>{new Date(expense.date).toLocaleDateString()}</td>
                                                <td>
                                                    <span className="font-weight-bold">{expense.description}</span>
                                                    <div className="small text-muted">{expense.provider_name}</div>
                                                </td>
                                                <td>
                                                    {expense.source === 'bancolombia' && <span className="badge badge-warning">Bancolombia</span>}
                                                    {expense.source === 'mercadopago' && <span className="badge badge-info">Mercado Pago</span>}
                                                    {expense.source === 'caja_menor' && <span className="badge badge-success">Caja Menor</span>}
                                                </td>
                                                <td className="text-right font-weight-bold">
                                                    {currencyFormatter.format(expense.amount)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="text-center">No se encontraron registros.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </ModalBody>
            </Modal>
        </div>
    );
};

export default ExpensesManager;
