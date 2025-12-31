import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardTitle, Table, Input, Button, Row, Col, Badge } from 'reactstrap';
import { metricsService } from '../services/api';
import toast from 'react-hot-toast';

const OperationalMetricsPage = () => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState([]);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [refreshing, setRefreshing] = useState(false);

    // Form State (Single Day Edit)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [formValues, setFormValues] = useState({
        chats_start: '',
        chats_end: '',
        orders_manual_count: ''
    });

    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const response = await metricsService.getDailyMetrics({ month, year });
            if (response.success) {
                setMetrics(response.data);
                // Pre-fill form if today's date matches
                const today = new Date().toISOString().split('T')[0];
                const dayMetric = response.data.find(m => m.date === today);
                if (dayMetric && selectedDate === today) {
                    setFormValues({
                        chats_start: dayMetric.chats_start || '',
                        chats_end: dayMetric.chats_end || '',
                        orders_manual_count: dayMetric.orders_manual_count || ''
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching metrics:', error);
            toast.error('Error cargando métricas');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [month, year]);

    // When selecting a date in table, load it into form
    const loadDateIntoForm = (metric) => {
        setSelectedDate(metric.date);
        setFormValues({
            chats_start: metric.chats_start,
            chats_end: metric.chats_end,
            orders_manual_count: metric.orders_manual_count
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await metricsService.updateDailyMetric({
                date: selectedDate,
                chats_start: formValues.chats_start,
                chats_end: formValues.chats_end,
                orders_manual_count: formValues.orders_manual_count
            });
            toast.success('Registro guardado');
            fetchMetrics();
        } catch (error) {
            console.error('Error saving records:', error);
            toast.error('Error al guardar');
        }
    };

    // Derived Calculation for Preview
    const chatsTotalPreview = (parseInt(formValues.chats_end) || 0) - (parseInt(formValues.chats_start) || 0);

    return (
        <div className="content">
            <h2 className="mb-4">Control Operativo Diario</h2>

            <Row>
                {/* Formulario de Ingreso */}
                <Col md={4}>
                    <Card className="shadow">
                        <CardBody>
                            <CardTitle tag="h4" className="mb-4">Ingreso de Datos</CardTitle>
                            <form onSubmit={handleSave}>
                                <div className="mb-3">
                                    <label className="form-label font-weight-bold">Fecha</label>
                                    <Input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => {
                                            setSelectedDate(e.target.value);
                                            // Reset inputs loosely, ideally should fetch data for this date but keeping it simple for now or relying on table click
                                            const found = metrics.find(m => m.date === e.target.value);
                                            if (found) loadDateIntoForm(found);
                                            else setFormValues({ chats_start: '', chats_end: '', orders_manual_count: '' });
                                        }}
                                        required
                                    />
                                </div>

                                <h6 className="text-primary mt-4 mb-3">Chats (WhatsApp)</h6>
                                <div className="mb-3">
                                    <label className="form-label small text-muted">Chats Iniciales</label>
                                    <Input
                                        type="number"
                                        placeholder="Ej: 100"
                                        value={formValues.chats_start}
                                        onChange={(e) => setFormValues({ ...formValues, chats_start: e.target.value })}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small text-muted">Chats Finales</label>
                                    <Input
                                        type="number"
                                        placeholder="Ej: 150"
                                        value={formValues.chats_end}
                                        onChange={(e) => setFormValues({ ...formValues, chats_end: e.target.value })}
                                    />
                                </div>
                                <div className="alert alert-secondary py-2 text-center mb-4">
                                    <small>Total Procesados:</small> <strong className="d-block h5 mb-0">{chatsTotalPreview}</strong>
                                </div>

                                <h6 className="text-success mt-4 mb-3">Pedidos</h6>
                                <div className="mb-4">
                                    <label className="form-label font-weight-bold">Pedidos Procesados (Manual)</label>
                                    <Input
                                        type="number"
                                        placeholder="Cantidad manual..."
                                        value={formValues.orders_manual_count}
                                        onChange={(e) => setFormValues({ ...formValues, orders_manual_count: e.target.value })}
                                    />
                                </div>

                                <Button color="primary" block type="submit">
                                    Guardar Registro
                                </Button>
                            </form>
                        </CardBody>
                    </Card>
                </Col>

                {/* Tabla de Historial */}
                <Col md={8}>
                    <Card className="shadow">
                        <CardBody>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <CardTitle tag="h4" className="mb-0">Historial del Mes</CardTitle>
                                <div className="d-flex gap-2">
                                    <Input type="select" bsSize="sm" style={{ width: '120px' }} value={month} onChange={e => setMonth(e.target.value)}>
                                        {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('es', { month: 'long' })}</option>))}
                                    </Input>
                                    <Input type="select" bsSize="sm" style={{ width: '80px' }} value={year} onChange={e => setYear(e.target.value)}>
                                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                    </Input>
                                    <Button size="sm" color="light" onClick={() => { setRefreshing(true); fetchMetrics(); }}>
                                        <i className={`tim-icons icon-refresh-02 ${refreshing ? 'fa-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>

                            <Table className="align-items-center table-flush table-hover" responsive>
                                <thead className="thead-light">
                                    <tr>
                                        <th>Fecha</th>
                                        <th className="text-center">Chats Total</th>
                                        <th className="text-center">Pedidos Manual</th>
                                        <th className="text-center">Pedidos Sistema</th>
                                        <th className="text-center">Diferencia</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.map((m) => {
                                        const dateLabel = new Date(m.date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
                                        const diff = Math.abs((m.orders_manual_count || 0) - (m.orders_system_count || 0));
                                        // Highlight if difference exists
                                        const diffColor = diff === 0 ? 'text-success' : 'text-danger font-weight-bold';

                                        return (
                                            <tr key={m.date} style={{ cursor: 'pointer' }} onClick={() => loadDateIntoForm(m)}>
                                                <td>{dateLabel}</td>
                                                <td className="text-center">{m.chats_count}</td>
                                                <td className="text-center">{m.orders_manual_count}</td>
                                                <td className="text-center text-muted">{m.orders_system_count}</td>
                                                <td className={`text-center ${diffColor}`}>
                                                    {diff > 0 ? diff : <i className="tim-icons icon-check-2 text-success" />}
                                                </td>
                                                <td className="text-right">
                                                    <Button size="sm" color="link" onClick={() => loadDateIntoForm(m)}>
                                                        <i className="tim-icons icon-pencil" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </CardBody>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default OperationalMetricsPage;
