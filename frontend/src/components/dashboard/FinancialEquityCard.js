
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardBody, CardTitle, Row, Col, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input } from 'reactstrap';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { financialService } from '../../services/api';
import toast from 'react-hot-toast';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const FinancialEquityCard = ({ readOnly = false }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [inputValues, setInputValues] = useState({
        bank_balance: 0,
        mercado_pago_balance: 0,
        receivables: 0,
        payables: 0,
        notes: ''
    });
    const chartRef = useRef(null);

    const handleHideAll = () => {
        const chart = chartRef.current;
        if (chart) {
            chart.data.datasets.forEach((dataset, index) => {
                chart.getDatasetMeta(index).hidden = true;
            });
            chart.update();
        }
    };

    const handleShowAll = () => {
        const chart = chartRef.current;
        if (chart) {
            chart.data.datasets.forEach((dataset, index) => {
                chart.getDatasetMeta(index).hidden = false;
            });
            chart.update();
        }
    };

    // --- SIIGO INCOME LOGIC ---
    const [siigoModalOpen, setSiigoModalOpen] = useState(false);
    const [siigoLoading, setSiigoLoading] = useState(false);
    const [siigoData, setSiigoData] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const toggleSiigoModal = () => setSiigoModalOpen(!siigoModalOpen);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    const fetchSiigoIncome = async () => {
        setSiigoLoading(true);
        setSiigoData(null);
        try {
            const response = await financialService.getSiigoIncome({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            if (response.success) {
                setSiigoData(response);
            } else {
                toast.error(response.message || 'Error consultando Siigo');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error conectando con Siigo');
        } finally {
            setSiigoLoading(false);
        }
    };
    // ---------------------------

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await financialService.getEquityHistory();
            if (response.success) {
                setData(response.data);

                // Pre-fill modal with today's or latest values
                const latest = response.data[response.data.length - 1];
                if (latest) {
                    setInputValues({
                        bank_balance: latest.bank_balance || 0,
                        mercado_pago_balance: latest.mercado_pago_balance || 0,
                        receivables: latest.receivables || 0,
                        payables: latest.payables || 0,
                        notes: latest.notes || ''
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching financial data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleModal = () => setModalOpen(!modalOpen);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputValues(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveSnapshot = async () => {
        try {
            await financialService.saveSnapshot(inputValues);
            toast.success('Datos financieros actualizados');
            toggleModal();
            fetchData();
        } catch (error) {
            toast.error('Error guardando datos');
        }
    };

    // Generate Full Month Dates
    const getMonthDates = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const dates = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            dates.push(d.toISOString().slice(0, 10));
        }
        return dates;
    };

    const fullMonthDates = getMonthDates();

    // Create a map for quick lookup: date string -> full object
    const equityMap = {};
    data.forEach(d => {
        let dateStr = '';
        if (typeof d.date === 'string') dateStr = d.date.substring(0, 10);
        else if (d.date) dateStr = new Date(d.date).toISOString().substring(0, 10);

        if (dateStr) {
            equityMap[dateStr] = d;
        }
    });

    // Chart Data Preparation
    const chartData = {
        labels: fullMonthDates,
        datasets: [
            {
                label: 'Patrimonio Neto',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].total_equity : null),
                borderColor: '#11cdef', // Info cyan (Total)
                backgroundColor: 'rgba(17, 205, 239, 0.1)',
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: false,
                spanGaps: true,
                order: 0
            },
            {
                label: 'Inventario',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].inventory_value : null),
                borderColor: '#2dce89',
                backgroundColor: 'rgba(45, 206, 137, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2,
                hidden: false,
                fill: false,
                spanGaps: true
            },
            {
                label: 'Caja',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].cash_in_hand : null),
                borderColor: '#00ccb1',
                backgroundColor: 'rgba(0, 204, 177, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2,
                hidden: false,
                fill: false,
                spanGaps: true
            },
            {
                label: 'Circulación',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].money_in_circulation : null),
                borderColor: '#fb6340',
                backgroundColor: 'rgba(251, 99, 64, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2,
                hidden: false,
                fill: false,
                spanGaps: true
            },
            {
                label: 'Bancos',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].bank_balance : null),
                borderColor: '#8965e0',
                backgroundColor: 'rgba(137, 101, 224, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2,
                hidden: false,
                fill: false,
                spanGaps: true
            },
            {
                label: 'Mercado Pago',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].mercado_pago_balance : null),
                borderColor: '#5e72e4',
                backgroundColor: 'rgba(94, 114, 228, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2,
                hidden: false,
                fill: false,
                spanGaps: true
            },
            {
                label: 'CxC / Cartera',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].receivables : null),
                borderColor: '#5603ad',
                backgroundColor: 'rgba(86, 3, 173, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2,
                hidden: false,
                fill: false,
                spanGaps: true
            },
            {
                label: 'CxP (Deuda)',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].payables : null),
                borderColor: '#f5365c',
                backgroundColor: 'rgba(245, 54, 92, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2,
                borderDash: [5, 5],
                hidden: false,
                fill: false,
                spanGaps: true
            },
            {
                label: 'Egresos (Salidas)',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].daily_expense : null),
                borderColor: '#ff0d46', // Vivid Red/Pink
                backgroundColor: 'rgba(255, 13, 70, 0.1)',
                tension: 0.1,
                borderWidth: 2,
                pointRadius: 3,
                borderDash: [3, 3], // Dashed line to distinguish flow from stock
                hidden: false,
                fill: false,
                spanGaps: true,
                order: 1 // Layer
            },
            {
                label: 'Ingresos Siigo (Recibos)',
                data: fullMonthDates.map(date => equityMap[date] ? equityMap[date].siigo_income : null),
                borderColor: '#2dce89', // Emerald Green
                backgroundColor: 'rgba(45, 206, 137, 0.1)',
                tension: 0.1,
                borderWidth: 3,
                pointRadius: 3,
                borderDash: [5, 5],
                hidden: false,
                fill: false,
                spanGaps: true,
                order: 0
            }
        ]
    };

    const currencyFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });
    const compactFormatter = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        notation: 'compact',
        maximumFractionDigits: 1
    });

    const lastPointLabelPlugin = {
        id: 'alwaysShowLastPointLabel',
        afterDatasetsDraw: (chart) => {
            const ctx = chart.ctx;
            ctx.save();

            // Safety Check
            if (!chart.getDatasetMeta(0) || !chart.data.datasets[0]) {
                ctx.restore();
                return;
            }

            const meta = chart.getDatasetMeta(0);
            const dataset = chart.data.datasets[0].data;

            if (!dataset || !meta.data) {
                ctx.restore();
                return;
            }

            // Encontrar el último índice con datos válidos (no null)
            let lastIndex = -1;
            for (let i = dataset.length - 1; i >= 0; i--) {
                if (dataset[i] !== null && dataset[i] !== undefined) {
                    lastIndex = i;
                    break;
                }
            }

            if (lastIndex !== -1 && meta.data[lastIndex]) {
                // Último punto visible
                const lastPoint = meta.data[lastIndex];

                // Calcular variación
                const currentVal = dataset[lastIndex];
                let diff = 0;

                // Buscar el penúltimo valor válido para comparar
                if (lastIndex > 0) {
                    let prevIndex = lastIndex - 1;
                    while (prevIndex >= 0 && (dataset[prevIndex] === null || dataset[prevIndex] === undefined)) {
                        prevIndex--;
                    }

                    if (prevIndex >= 0) {
                        const prevVal = dataset[prevIndex];
                        diff = (currentVal || 0) - (prevVal || 0);
                    }
                }

                // Configurar fuente y color
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                // Determinar color y símbolo
                const isPositive = diff >= 0;
                ctx.fillStyle = isPositive ? '#2dce89' : '#f5365c';
                const symbol = isPositive ? '▲' : '▼';

                // Formato compacto para números grandes (ej: 2.5M)
                const formattedDiff = compactFormatter.format(Math.abs(diff));

                const text = `${symbol} ${formattedDiff}`;

                // Dibujar texto encima del punto (offset -15px en Y)
                if (!lastPoint.skip && lastPoint.x !== undefined && lastPoint.y !== undefined) {
                    ctx.fillText(text, lastPoint.x, lastPoint.y - 12);
                }
            }
            ctx.restore();
        }
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: 25, // Increased spacing
                    font: {
                        size: 11
                    }
                },
                onHover: (event, legendItem, legend) => {
                    const index = legendItem.datasetIndex;
                    const ci = legend.chart;
                    if (ci.isDatasetVisible(index)) {
                        ci.data.datasets[index].borderWidth = 6;
                        ci.data.datasets[index].pointRadius = 7;
                        ci.data.datasets[index].pointHoverRadius = 9;
                        ci.update();
                    }
                },
                onLeave: (event, legendItem, legend) => {
                    const index = legendItem.datasetIndex;
                    const ci = legend.chart;
                    // Restore defaults: Index 0 (Total) is thicker (3px), others are thin (2px)
                    ci.data.datasets[index].borderWidth = index === 0 ? 3 : 2;
                    ci.data.datasets[index].pointRadius = index === 0 ? 4 : 2;
                    ci.data.datasets[index].pointHoverRadius = index === 0 ? 6 : 4;
                    ci.update();
                }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        if (context.parsed.y !== null) {
                            return context.dataset.label + ': ' + currencyFormatter.format(context.parsed.y);
                        }
                        return '';
                    },
                    afterBody: (context) => {
                        const date = context[0].label;
                        const dataIndex = context[0].dataIndex;
                        const record = equityMap[date];
                        if (!record) return [];

                        const lines = [];

                        // Calculate difference with previous day for Total Equity
                        if (dataIndex > 0) {
                            const prevDate = fullMonthDates[dataIndex - 1];
                            const prevRecord = equityMap[prevDate];
                            if (prevRecord) {
                                const diff = (record.total_equity || 0) - (prevRecord.total_equity || 0);
                                const sign = diff >= 0 ? '+' : '-';
                                const symbol = diff >= 0 ? '▲' : '▼';
                                lines.push('');
                                lines.push(`Variación Total Ayer: ${symbol} ${currencyFormatter.format(Math.abs(diff))}`);
                            }
                        }

                        return lines;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function (value) {
                        return '$' + (value / 1000000).toFixed(1) + 'M'; // abbreviated
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                display: true,
                ticks: {
                    display: true,
                    color: '#8898aa',
                    autoSkip: true,
                    maxTicksLimit: 7
                },
                grid: {
                    display: false,
                    drawOnChartArea: false, // Only draw the tick marks/axis line
                }
            }
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
    };

    if (loading) return <div className="text-center p-5">Cargando reporte financiero...</div>;

    const current = data.length > 0 ? data[data.length - 1] : {};

    const formatMoney = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
    const formatMoneySimple = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);



    const todayLabel = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full' });

    return (
        <Card className="shadow">
            <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <CardTitle tag="h5" className="text-uppercase text-muted mb-0">Evolución de Patrimonio</CardTitle>
                        <span className="h2 font-weight-bold mb-0 text-primary">{formatMoney(current.total_equity)}</span>
                    </div>
                    <div>
                        {!readOnly && (
                            <>
                                <Button color="warning" size="sm" outline onClick={handleHideAll} className="mr-2" title="Ocultar todas las líneas">
                                    <i className="ni ni-fat-remove" /> Ocultar Todo
                                </Button>
                                <Button color="success" size="sm" outline onClick={handleShowAll} className="mr-2" title="Mostrar todas las líneas">
                                    <i className="ni ni-check-bold" /> Mostrar Todo
                                </Button>
                                <Button color="info" size="sm" onClick={toggleSiigoModal} className="mr-2">
                                    <i className="ni ni-money-coins mr-1" /> Ingresos Siigo
                                </Button>
                                <Button color="primary" size="sm" onClick={toggleModal}>
                                    <i className="ni ni-settings-gear-65 mr-1" /> Ajustes Manuales
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="chart-container" style={{ position: 'relative', height: '600px', width: '100%' }}>
                    <Line
                        ref={chartRef}
                        data={chartData}
                        options={chartOptions}
                        plugins={[lastPointLabelPlugin]}
                    />
                </div>

                <hr className="my-4" />

                {/* Resumen de componentes */}
                <Row className="text-center d-flex justify-content-between">
                    <Col>
                        <small className="text-muted d-block">Inventario</small>
                        <span className="font-weight-bold text-success">{formatMoney(current.inventory_value)}</span>
                    </Col>
                    <Col>
                        <small className="text-muted d-block">Caja</small>
                        <span className="font-weight-bold text-info">{formatMoney(current.cash_in_hand)}</span>
                    </Col>
                    <Col>
                        <small className="text-muted d-block">Circulación</small>
                        <span className="font-weight-bold text-warning">{formatMoney(current.money_in_circulation)}</span>
                    </Col>
                    <Col>
                        <small className="text-muted d-block">Bancos</small>
                        <span className="font-weight-normal">{formatMoney(current.bank_balance)}</span>
                    </Col>
                    <Col>
                        <small className="text-muted d-block">Mercado Pago</small>
                        <span className="font-weight-normal">{formatMoney(current.mercado_pago_balance)}</span>
                    </Col>
                    <Col>
                        <small className="text-muted d-block h6 mb-0">CxC</small>
                        <span className="font-weight-normal text-sm">{formatMoney(current.receivables)}</span>
                    </Col>
                    <Col>
                        <small className="text-muted d-block h6 mb-0">CxP (Deuda)</small>
                        <span className="font-weight-normal text-danger text-sm">-{formatMoney(current.payables)}</span>
                    </Col>
                </Row>
            </CardBody>

            {/* Modal para inputs manuales */}
            <Modal isOpen={modalOpen} toggle={toggleModal}>
                <ModalHeader toggle={toggleModal}>
                    Ajustes Financieros del Día
                    <br />
                    <small className="text-muted">{todayLabel}</small>
                </ModalHeader>
                <ModalBody>
                    <Form>
                        <FormGroup>
                            <Label for="bank_balance">Saldo en Bancos</Label>
                            <Input
                                type="number"
                                name="bank_balance"
                                id="bank_balance"
                                value={inputValues.bank_balance}
                                onChange={handleInputChange}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label for="mercado_pago_balance">Saldo Mercado Pago</Label>
                            <Input
                                type="number"
                                name="mercado_pago_balance"
                                id="mercado_pago_balance"
                                value={inputValues.mercado_pago_balance}
                                onChange={handleInputChange}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label for="receivables">Cuentas por Cobrar (Cartera)</Label>
                            <Input
                                type="number"
                                name="receivables"
                                id="receivables"
                                value={inputValues.receivables}
                                onChange={handleInputChange}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label for="payables">Cuentas por Pagar (Proveedores)</Label>
                            <Input
                                type="number"
                                name="payables"
                                id="payables"
                                value={inputValues.payables}
                                onChange={handleInputChange}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label for="notes">Notas / Observaciones</Label>
                            <Input
                                type="textarea"
                                name="notes"
                                id="notes"
                                value={inputValues.notes}
                                onChange={handleInputChange}
                            />
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button color="primary" onClick={handleSaveSnapshot}>Guardar</Button>{' '}
                    <Button color="secondary" onClick={toggleModal}>Cancelar</Button>
                </ModalFooter>
            </Modal>

            {/* Modal para Ingresos SIIGO */}
            <Modal isOpen={siigoModalOpen} toggle={toggleSiigoModal} size="lg">
                <ModalHeader toggle={toggleSiigoModal}>Ingresos Registrados en SIIGO</ModalHeader>
                <ModalBody>
                    <Row className="mb-4 align-items-end">
                        <Col md={4}>
                            <FormGroup className="mb-0">
                                <Label>Desde</Label>
                                <Input type="date" name="startDate" value={dateRange.startDate} onChange={handleDateChange} />
                            </FormGroup>
                        </Col>
                        <Col md={4}>
                            <FormGroup className="mb-0">
                                <Label>Hasta</Label>
                                <Input type="date" name="endDate" value={dateRange.endDate} onChange={handleDateChange} />
                            </FormGroup>
                        </Col>
                        <Col md={4}>
                            <Button color="primary" block onClick={fetchSiigoIncome} disabled={siigoLoading}>
                                {siigoLoading ? 'Consultando...' : 'Consultar'}
                            </Button>
                        </Col>
                    </Row>

                    {siigoData && (
                        <div className="fade-in">
                            <div className="text-center mb-4 p-3 bg-gradient-default rounded shadow-sm text-white">
                                <h4 className="text-white text-uppercase ls-1 mb-1">Total Ingresos</h4>
                                <h1 className="text-white mb-0 font-weight-bold display-4">{formatMoneySimple(siigoData.total)}</h1>
                            </div>

                            <Row className="mb-4">
                                {Object.entries(siigoData.byAccount).map(([account, amount]) => (
                                    <Col sm={6} md={4} key={account} className="mb-3">
                                        <Card className="card-stats mb-0 shadow-sm border">
                                            <CardBody className="p-3">
                                                <Row>
                                                    <Col>
                                                        <h6 className="text-muted text-uppercase mb-1" style={{ fontSize: '0.7rem' }}>{account}</h6>
                                                        <span className="h4 font-weight-bold mb-0">{formatMoneySimple(amount)}</span>
                                                    </Col>
                                                </Row>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>

                            <h5 className="mb-3">Detalle de Comprobantes ({siigoData.details?.length || 0})</h5>
                            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <table className="table table-sm table-flush table-hover">
                                    <thead className="thead-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th>Fecha</th>
                                            <th># Recibo</th>
                                            <th>Cliente</th>
                                            <th>Cuenta Destino</th>
                                            <th className="text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {siigoData.details?.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.date}</td>
                                                <td>{item.name}</td>
                                                <td title={item.customer}>{item.customer}</td>
                                                <td>{item.account}</td>
                                                <td className="text-right font-weight-bold">{formatMoneySimple(item.amount)}</td>
                                            </tr>
                                        ))}
                                        {(!siigoData.details || siigoData.details.length === 0) && (
                                            <tr>
                                                <td colSpan="5" className="text-center py-3">No se encontraron registros.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={toggleSiigoModal}>Cerrar</Button>
                </ModalFooter>
            </Modal>
        </Card>
    );
};

export default FinancialEquityCard;
