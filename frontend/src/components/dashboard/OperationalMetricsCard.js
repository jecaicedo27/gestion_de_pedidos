import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardTitle, Table, Input, Row, Col, Badge } from 'reactstrap';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { metricsService } from '../../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const OperationalMetricsCard = () => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState([]);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const navigate = useNavigate();

    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const response = await metricsService.getDailyMetrics({ month, year });
            if (response.success) {
                setMetrics(response.data);
            }
        } catch (error) {
            console.error('Error fetching metrics:', error);
            // toast.error('Error cargando métricas operativas'); // Silent fail on dashboard to avoid annoyance
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [month, year]);

    // Calculate Totals
    const totalChats = metrics.reduce((sum, day) => sum + (day.chats_count || 0), 0);
    const totalOrdersManual = metrics.reduce((sum, day) => sum + (day.orders_manual_count || 0), 0);
    const totalOrdersSystem = metrics.reduce((sum, day) => sum + (day.orders_system_count || 0), 0);

    // Chart Data
    const chartData = {
        labels: metrics.map(m => m.date.slice(-2)), // Show only day DD
        datasets: [
            {
                label: 'Chats Atendidos',
                data: metrics.map(m => m.chats_count),
                borderColor: '#11cdef', // Info Blue
                backgroundColor: 'rgba(17, 205, 239, 0.1)',
                tension: 0.1
            },
            {
                label: 'Pedidos (Manual)',
                data: metrics.map(m => m.orders_manual_count),
                borderColor: '#2dce89', // Success Green
                backgroundColor: 'rgba(45, 206, 137, 0.1)',
                tension: 0.1
            },
            {
                label: 'Pedidos (Sistema)',
                data: metrics.map(m => m.orders_system_count),
                borderColor: '#8898aa', // Gray
                borderDash: [5, 5],
                backgroundColor: 'rgba(136, 152, 170, 0.1)',
                tension: 0.1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Evolución Diaria: Chats vs Pedidos'
            },
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    return (
        <Card className="shadow mb-4">
            <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <CardTitle tag="h3" className="mb-0">Control Operativo (Chats vs Pedidos)</CardTitle>
                    <div className="d-flex gap-2">
                        <small
                            className="text-primary font-weight-bold cursor-pointer underline mr-2 mt-1"
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => navigate('/operational-metrics')}
                        >
                            Ir a Registro
                        </small>
                        <Input
                            type="select"
                            bsSize="sm"
                            style={{ width: '100px' }}
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('es', { month: 'long' })}</option>
                            ))}
                        </Input>
                        <Input
                            type="select"
                            bsSize="sm"
                            style={{ width: '80px' }}
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </Input>
                    </div>
                </div>

                <Row>
                    {/* CHART SECTION */}
                    <Col lg={8} className="mb-4">
                        <div style={{ height: '350px' }}>
                            <Line options={chartOptions} data={chartData} />
                        </div>
                    </Col>

                    {/* TABLE SECTION */}
                    <Col lg={4}>
                        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                            <Table className="align-items-center table-flush table-hover" size="sm">
                                <thead className="thead-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th className="text-center">Fecha</th>
                                        <th className="text-center">Chats</th>
                                        <th className="text-center">Man / Sis</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.map((day) => {
                                        const diff = Math.abs((day.orders_manual_count || 0) - (day.orders_system_count || 0));
                                        return (
                                            <tr key={day.date} onClick={() => navigate('/operational-metrics')} style={{ cursor: 'pointer' }}>
                                                <td className="text-center font-weight-bold">
                                                    {day.date.slice(-2)}
                                                </td>
                                                <td className="text-center">
                                                    {day.chats_count}
                                                </td>
                                                <td className="text-center">
                                                    <span className="text-success font-weight-bold">{day.orders_manual_count}</span>
                                                    {' / '}
                                                    <span className="text-muted">{day.orders_system_count}</span>
                                                    {diff > 0 && <Badge color="danger" className="ml-1" style={{ fontSize: '0.6em' }}>!</Badge>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-light font-weight-bold">
                                    <tr>
                                        <td className="text-center">TOTAL</td>
                                        <td className="text-center text-primary">{totalChats}</td>
                                        <td className="text-center">
                                            <span className="text-success">{totalOrdersManual}</span> / <span className="text-muted">{totalOrdersSystem}</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </Table>
                        </div>
                    </Col>
                </Row>
            </CardBody>
        </Card>
    );
};

export default OperationalMetricsCard;
